from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import (
    PedidoCreate,
    PedidoRead,
    PedidoReadFull,
    EstadoUpdate,
    CancelarPedido,
    HistorialEstadoPedidoRead,
    PaginatedResponse,
)
from ..schemas.pedido import PagoRead
from ..models import Usuario
from ..models.estado_pedido import EstadoPedidoCodigo
from ..repositories.pago_repository import PagoRepository
from ..services.pedido_service import PedidoService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import get_current_user, require_roles
from ..core.ws_manager import ws_manager

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])
_staff = require_roles("ADMIN", "PEDIDOS")


def _ws_evento(
    event: str,
    pedido_id: int,
    estado_anterior: str | None,
    estado_nuevo: str,
    usuario_id: int | None,
    motivo: str | None,
) -> dict:
    return {
        "event": event,
        "pedido_id": pedido_id,
        "estado_anterior": estado_anterior,
        "estado_nuevo": estado_nuevo,
        "usuario_id": usuario_id,
        "motivo": motivo,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/", response_model=PedidoReadFull, status_code=status.HTTP_201_CREATED)
async def create_pedido(
    payload: PedidoCreate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        pedido = PedidoService(uow.session).create(payload, user)
    await ws_manager.broadcast_admin(
        _ws_evento("pedido_creado", pedido.id, None, EstadoPedidoCodigo.PENDIENTE.value, user.id, None)
    )
    await ws_manager.broadcast_catalogo({"event": "stock_actualizado"})
    return pedido


@router.get("/me", response_model=PaginatedResponse[PedidoRead])
def read_mine(
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: Annotated[EstadoPedidoCodigo | None, Query()] = None,
):
    skip = (page - 1) * size
    items, total = PedidoService(session).search_own(
        user=user, skip=skip, limit=size, estado=estado
    )
    return PaginatedResponse.build([PedidoRead.model_validate(p) for p in items], total, page, size)


@router.get(
    "/", response_model=PaginatedResponse[PedidoRead], dependencies=[Depends(_staff)]
)
def read_all(
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: Annotated[EstadoPedidoCodigo | None, Query()] = None,
    usuario_id: Annotated[int | None, Query(ge=1)] = None,
):
    skip = (page - 1) * size
    items, total = PedidoService(session).search_for_user(
        user=user, skip=skip, limit=size, estado=estado, usuario_id=usuario_id
    )
    return PaginatedResponse.build([PedidoRead.model_validate(p) for p in items], total, page, size)


def _build_full(pedido, session: Session) -> dict:
    pago = PagoRepository(session).get_by_pedido(pedido.id)
    data = PedidoReadFull.model_validate(pedido).model_dump()
    data["pago"] = PagoRead.model_validate(pago).model_dump() if pago else None
    return data


@router.get("/{pedido_id}", response_model=PedidoReadFull)
def read_one(
    pedido_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    pedido = PedidoService(session).get_full(pedido_id, user)
    return _build_full(pedido, session)


@router.patch(
    "/{pedido_id}/estado", response_model=PedidoReadFull, dependencies=[Depends(_staff)]
)
async def cambiar_estado(
    pedido_id: Annotated[int, Path(ge=1)],
    payload: EstadoUpdate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        pedido, anterior = PedidoService(uow.session).cambiar_estado(
            pedido_id, payload.estado, user, payload.motivo
        )
    event = "pedido_cancelado" if payload.estado == EstadoPedidoCodigo.CANCELADO else "estado_cambiado"
    await ws_manager.broadcast_pedido(
        pedido.id,
        _ws_evento(event, pedido.id, anterior.value, payload.estado.value, user.id, payload.motivo),
    )
    if payload.estado == EstadoPedidoCodigo.CANCELADO:
        await ws_manager.broadcast_catalogo({"event": "stock_actualizado"})
    return pedido


@router.post("/{pedido_id}/cancelar", response_model=PedidoReadFull)
async def cancelar(
    pedido_id: Annotated[int, Path(ge=1)],
    payload: CancelarPedido,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        pedido, anterior = PedidoService(uow.session).cancelar(pedido_id, user, payload.motivo)
    await ws_manager.broadcast_pedido(
        pedido.id,
        _ws_evento("pedido_cancelado", pedido.id, anterior.value, EstadoPedidoCodigo.CANCELADO.value, user.id, payload.motivo),
    )
    await ws_manager.broadcast_catalogo({"event": "stock_actualizado"})
    return pedido


@router.delete("/{pedido_id}", response_model=PedidoReadFull)
async def cancelar_delete(
    pedido_id: Annotated[int, Path(ge=1)],
    payload: CancelarPedido = CancelarPedido(),
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    """Alias DELETE para cancelar — equivalente a POST /cancelar (clientes cancelan su pedido)."""
    with UnitOfWork(session) as uow:
        pedido, anterior = PedidoService(uow.session).cancelar(pedido_id, user, payload.motivo)
    await ws_manager.broadcast_pedido(
        pedido.id,
        _ws_evento("pedido_cancelado", pedido.id, anterior.value, EstadoPedidoCodigo.CANCELADO.value, user.id, payload.motivo),
    )
    await ws_manager.broadcast_catalogo({"event": "stock_actualizado"})
    return pedido


@router.get("/{pedido_id}/historial", response_model=list[HistorialEstadoPedidoRead])
def get_historial(
    pedido_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    """Historial completo de transiciones de estado del pedido, orden cronológico."""
    pedido = PedidoService(session).get_full(pedido_id, user)
    return sorted(pedido.historial, key=lambda h: h.created_at)
