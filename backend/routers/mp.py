import logging
import mercadopago
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import Session
from ..database import get_session
from ..core.config import settings
from ..core.deps import get_current_user
from ..models import Usuario
from ..models.estado_pedido import EstadoPedidoCodigo
from ..models.forma_pago import FormaPagoCodigo
from ..repositories.pedido_repository import PedidoRepository
from ..repositories.lookups import EstadoPedidoRepository, FormaPagoRepository
from ..services.mp_service import crear_preference
from ..services.pedido_service import PedidoService
from ..uow.unit_of_work import UnitOfWork
from ..core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["MercadoPago"])


@router.get("/api/v1/mp/retorno")
def mp_retorno(request: Request):
    status = request.query_params.get("status", "")
    pedido_id = request.query_params.get("external_reference", "")
    if pedido_id:
        return RedirectResponse(url=f"{settings.MP_STORE_URL}/mis-pedidos/{pedido_id}?mp={status}")
    return RedirectResponse(url=f"{settings.MP_STORE_URL}/mis-pedidos")


@router.post("/api/v1/pedidos/{pedido_id}/mp-preference")
def get_mp_preference(
    pedido_id: int,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    pedido = PedidoService(session).get_full(pedido_id, user)

    fp_repo = FormaPagoRepository(session)
    forma = fp_repo.get(pedido.forma_pago_id)
    if forma is None or forma.codigo != FormaPagoCodigo.MERCADO_PAGO.value:
        raise HTTPException(
            status_code=400,
            detail="Este pedido no tiene Mercado Pago como forma de pago",
        )

    return crear_preference(pedido)


@router.post("/api/v1/mp/webhook", status_code=200)
async def mp_webhook(request: Request, session: Session = Depends(get_session)):
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    topic = body.get("type") or request.query_params.get("topic")
    resource_id = body.get("data", {}).get("id") or request.query_params.get("id")

    if topic != "payment" or not resource_id:
        return {"ok": True}

    try:
        sdk = mercadopago.SDK(settings.MP_ACCESS_TOKEN)
        payment = sdk.payment().get(resource_id)
        if payment["status"] != 200:
            return {"ok": True}

        info = payment["response"]
        status_mp = info.get("status")
        external_ref = info.get("external_reference")

        if not external_ref:
            return {"ok": True}

        pedido_id = int(external_ref)
        repo = PedidoRepository(session)
        pedido = repo.get_full(pedido_id)
        if pedido is None:
            return {"ok": True}

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

        # Reutilizar un usuario sistema (admin id=1) para el historial
        from sqlmodel import select
        from ..models import Usuario as UsuarioModel
        sys_user = session.exec(select(UsuarioModel)).first()

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
                "motivo": f"MP payment {status_mp}",
            },
        )
    except Exception as e:
        logger.warning("mp_webhook error: %s", e)

    return {"ok": True}
