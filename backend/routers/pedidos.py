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
    PaginatedResponse,
)
from ..models import Usuario
from ..models.estado_pedido import EstadoPedidoCodigo
from ..services.pedido_service import PedidoService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import get_current_user, require_roles

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])
_staff = require_roles("ADMIN", "PEDIDOS")


@router.post("/", response_model=PedidoReadFull, status_code=status.HTTP_201_CREATED)
def create_pedido(
    payload: PedidoCreate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return PedidoService(uow.session).create(payload, user)


@router.get("/me", response_model=PaginatedResponse[PedidoRead])
def read_mine(
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: Annotated[EstadoPedidoCodigo | None, Query()] = None,
):
    items, total = PedidoService(session).search_own(
        user=user, skip=skip, limit=limit, estado=estado
    )
    return PaginatedResponse[PedidoRead](
        total=total,
        items=[PedidoRead.model_validate(p) for p in items],
        limit=limit,
        offset=skip,
    )


@router.get(
    "/", response_model=PaginatedResponse[PedidoRead], dependencies=[Depends(_staff)]
)
def read_all(
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    estado: Annotated[EstadoPedidoCodigo | None, Query()] = None,
    usuario_id: Annotated[int | None, Query(ge=1)] = None,
):
    items, total = PedidoService(session).search_for_user(
        user=user, skip=skip, limit=limit, estado=estado, usuario_id=usuario_id
    )
    return PaginatedResponse[PedidoRead](
        total=total,
        items=[PedidoRead.model_validate(p) for p in items],
        limit=limit,
        offset=skip,
    )


@router.get("/{pedido_id}", response_model=PedidoReadFull)
def read_one(
    pedido_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    return PedidoService(session).get_full(pedido_id, user)


@router.patch(
    "/{pedido_id}/estado", response_model=PedidoReadFull, dependencies=[Depends(_staff)]
)
def cambiar_estado(
    pedido_id: Annotated[int, Path(ge=1)],
    payload: EstadoUpdate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return PedidoService(uow.session).cambiar_estado(
            pedido_id, payload.estado, user, payload.nota
        )


@router.post("/{pedido_id}/cancelar", response_model=PedidoReadFull)
def cancelar(
    pedido_id: Annotated[int, Path(ge=1)],
    payload: CancelarPedido,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return PedidoService(uow.session).cancelar(pedido_id, user, payload.motivo)
