import logging
import uuid
from datetime import datetime, timezone

import mercadopago
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..core.config import settings
from ..core.deps import get_current_user
from ..core.ws_manager import ws_manager
from ..database import get_session
from ..models import Usuario
from ..models.estado_pedido import EstadoPedidoCodigo
from ..models.forma_pago import FormaPagoCodigo
from ..models.pedido import Pago
from ..repositories.lookups import EstadoPedidoRepository, FormaPagoRepository
from ..repositories.pago_repository import PagoRepository
from ..repositories.pedido_repository import PedidoRepository
from ..schemas.pedido import PagoRead, PagoResponse
from ..services.pedido_service import PedidoService
from ..uow.unit_of_work import UnitOfWork

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pagos", tags=["Pagos"])


def _sdk() -> mercadopago.SDK:
    if not settings.MP_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Mercado Pago no configurado")
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def _build_preference(pedido, idempotency_key: str) -> dict:
    # back_urls deben ser URLs públicas para que auto_return funcione.
    # MP_STORE_NGROK_URL = ngrok apuntando al FRONTEND (5174).
    # Se agrega ngrok-skip-browser-warning=1 igual que TP9 para evitar el interstitial.
    if settings.MP_STORE_NGROK_URL:
        retorno_url = f"{settings.MP_STORE_NGROK_URL}/mp/retorno?ngrok-skip-browser-warning=1"
        use_auto_return = True
    else:
        store_base = settings.MP_STORE_URL or "http://localhost:5174"
        retorno_url = f"{store_base}/mp/retorno"
        use_auto_return = False

    items = [
        {
            "title": d.nombre_snapshot,
            "quantity": d.cantidad,
            "unit_price": float(d.precio_snapshot),
            "currency_id": "ARS",
        }
        for d in pedido.detalles
    ]
    if pedido.costo_envio > 0:
        items.append(
            {
                "title": "Costo de envio",
                "quantity": 1,
                "unit_price": float(pedido.costo_envio),
                "currency_id": "ARS",
            }
        )

    data = {
        "items": items,
        "back_urls": {
            "success": retorno_url,
            "failure": retorno_url,
            "pending": retorno_url,
        },
        **({"auto_return": "approved"} if use_auto_return else {}),
        "external_reference": str(pedido.id),
        "statement_descriptor": "FoodStore",
        **({"notification_url": settings.MP_WEBHOOK_URL} if settings.MP_WEBHOOK_URL else {}),
    }
    return data


class CrearPagoRequest(BaseModel):
    pedido_id: int


@router.post("/crear", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def crear_pago(
    body: CrearPagoRequest,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    """Crea preferencia MP y registra Pago en tabla. Retorna preference_id + init_point."""
    pedido = PedidoService(session).get_full(body.pedido_id, user)

    fp_repo = FormaPagoRepository(session)
    forma = fp_repo.get(pedido.forma_pago_id)
    if forma is None or forma.codigo != FormaPagoCodigo.MERCADOPAGO.value:
        raise HTTPException(
            status_code=400,
            detail="Este pedido no tiene Mercado Pago como forma de pago",
        )

    pago_repo = PagoRepository(session)
    existing = pago_repo.get_by_pedido(body.pedido_id)
    if existing and existing.mp_status == "approved":
        raise HTTPException(status_code=409, detail="El pedido ya tiene un pago aprobado")

    idempotency_key = str(uuid.uuid4())
    sdk = _sdk()
    preference_data = _build_preference(pedido, idempotency_key)

    try:
        request_options = mercadopago.config.RequestOptions()
        request_options.custom_headers = {"x-idempotency-key": idempotency_key}
        result = sdk.preference().create(preference_data, request_options)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error al contactar MercadoPago: {exc}") from exc

    if result["status"] not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Error al crear preferencia MP: {result.get('response')}",
        )

    response = result["response"]
    preference_id = response["id"]
    init_point = response["init_point"]

    with UnitOfWork(session) as uow:
        if existing:
            existing.mp_preference_id = preference_id
            existing.idempotency_key = idempotency_key
            existing.updated_at = datetime.now(timezone.utc)
            uow.session.add(existing)
            pago = existing
        else:
            pago = Pago(
                pedido_id=body.pedido_id,
                mp_preference_id=preference_id,
                mp_status="pending",
                transaction_amount=pedido.total,
                external_reference=str(body.pedido_id),
                idempotency_key=idempotency_key,
            )
            uow.session.add(pago)
            uow.session.flush()

    return PagoResponse(
        id=pago.id,
        pedido_id=pago.pedido_id,
        mp_payment_id=pago.mp_payment_id,
        mp_preference_id=pago.mp_preference_id,
        mp_status=pago.mp_status,
        mp_status_detail=pago.mp_status_detail,
        transaction_amount=float(pago.transaction_amount),
        payment_method_id=pago.payment_method_id,
        external_reference=pago.external_reference,
        idempotency_key=pago.idempotency_key,
        created_at=pago.created_at,
        updated_at=pago.updated_at,
        preference_id=preference_id,
        init_point=init_point,
    )


@router.post("/webhook", status_code=200)
async def mp_webhook(request: Request, session: Session = Depends(get_session)):
    """IPN endpoint de MercadoPago. Actualiza Pago y Pedido. Notifica via WebSocket."""
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    topic = body.get("type") or request.query_params.get("topic")
    resource_id = body.get("data", {}).get("id") or request.query_params.get("id")

    if topic != "payment" or not resource_id:
        return {"ok": True}

    try:
        sdk = _sdk()
        payment = sdk.payment().get(resource_id)
        if payment["status"] != 200:
            return {"ok": True}

        info = payment["response"]
        status_mp = info.get("status")
        status_detail = info.get("status_detail")
        external_ref = info.get("external_reference")
        mp_payment_id = info.get("id")
        payment_method = info.get("payment_method_id")
        transaction_amount = info.get("transaction_amount", 0)

        if not external_ref:
            return {"ok": True}

        pedido_id = int(external_ref)
        repo = PedidoRepository(session)
        pedido = repo.get_full(pedido_id)
        if pedido is None:
            return {"ok": True}

        # Update Pago record
        pago_repo = PagoRepository(session)
        pago = pago_repo.get_by_pedido(pedido_id)

        with UnitOfWork(session) as uow:
            if pago is None:
                pago = Pago(
                    pedido_id=pedido_id,
                    mp_payment_id=mp_payment_id,
                    mp_status=status_mp,
                    mp_status_detail=status_detail,
                    transaction_amount=transaction_amount,
                    payment_method_id=payment_method,
                    external_reference=str(pedido_id),
                    idempotency_key=str(uuid.uuid4()),
                )
                uow.session.add(pago)
            else:
                pago.mp_payment_id = mp_payment_id
                pago.mp_status = status_mp
                pago.mp_status_detail = status_detail
                pago.transaction_amount = transaction_amount
                pago.payment_method_id = payment_method
                pago.updated_at = datetime.now(timezone.utc)
                uow.session.add(pago)

        estado_repo = EstadoPedidoRepository(session)
        estado_actual = estado_repo.get(pedido.estado_id)
        if estado_actual is None or estado_actual.codigo not in (
            EstadoPedidoCodigo.PENDIENTE.value,
            EstadoPedidoCodigo.CONFIRMADO.value,
        ):
            return {"ok": True}

        if status_mp == "approved":
            nuevo = EstadoPedidoCodigo.CONFIRMADO
        elif status_mp in ("rejected", "cancelled"):
            nuevo = EstadoPedidoCodigo.CANCELADO
        else:
            return {"ok": True}

        sys_user = session.exec(select(Usuario)).first()

        with UnitOfWork(session) as uow:
            pedido_upd, anterior = PedidoService(uow.session).cambiar_estado(
                pedido_id, nuevo, sys_user, motivo=f"MP payment {status_mp}"
            )

        await ws_manager.broadcast_pedido(
            pedido_upd.id,
            {
                "event": "estado_cambiado",
                "pedido_id": pedido_upd.id,
                "estado_anterior": anterior.value,
                "estado_nuevo": nuevo.value,
                "usuario_id": None,
                "motivo": f"MP payment {status_mp}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception as e:
        logger.warning("pagos webhook error: %s", e)

    return {"ok": True}


@router.get("/retorno", include_in_schema=False)
def mp_retorno(request: Request):
    """Redirect de vuelta al store tras pago en MercadoPago."""
    mp_status = request.query_params.get("status", "")
    pedido_id = request.query_params.get("external_reference", "")
    if pedido_id:
        return RedirectResponse(
            url=f"{settings.MP_STORE_URL}/mis-pedidos/{pedido_id}?mp={mp_status}"
        )
    return RedirectResponse(url=f"{settings.MP_STORE_URL}/mis-pedidos")


@router.get("/{pedido_id}", response_model=PagoRead)
def get_pago(
    pedido_id: int,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    """Consulta el pago asociado a un pedido."""
    pedido = PedidoService(session).get_full(pedido_id, user)
    pago = PagoRepository(session).get_by_pedido(pedido.id)
    if pago is None:
        raise HTTPException(status_code=404, detail="Pago no encontrado para este pedido")
    return pago
