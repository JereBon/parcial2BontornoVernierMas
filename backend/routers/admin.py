from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import (
    UsuarioAdminCreate,
    UsuarioAdminUpdate,
    UsuarioRolesUpdate,
    UsuarioAdminRead,
    PaginatedResponse,
)
from ..services.admin_user_service import AdminUserService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import require_roles

router = APIRouter(prefix="/admin", tags=["Admin"])
_admin_only = require_roles("ADMIN")


def _serialize(u) -> UsuarioAdminRead:
    return UsuarioAdminRead(
        id=u.id,
        email=u.email,
        nombre=u.nombre,
        apellido=u.apellido,
        celular=getattr(u, 'celular', None),
        roles=[r.codigo for r in u.roles],
    )


@router.get(
    "/usuarios",
    response_model=PaginatedResponse[UsuarioAdminRead],
    dependencies=[Depends(_admin_only)],
)
def list_usuarios(
    session: Session = Depends(get_session),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    rol: Annotated[str | None, Query()] = None,
    busqueda: Annotated[str | None, Query(max_length=120)] = None,
):
    items, total = AdminUserService(session).list_paginated(
        skip=skip, limit=limit, rol_codigo=rol, busqueda=busqueda
    )
    return PaginatedResponse[UsuarioAdminRead](
        total=total, items=[_serialize(u) for u in items], limit=limit, offset=skip
    )


@router.get(
    "/usuarios/{user_id}",
    response_model=UsuarioAdminRead,
    dependencies=[Depends(_admin_only)],
)
def get_usuario(
    user_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    return _serialize(AdminUserService(session).get(user_id))


@router.post(
    "/usuarios",
    response_model=UsuarioAdminRead,
    status_code=201,
    dependencies=[Depends(_admin_only)],
)
def create_usuario(
    payload: UsuarioAdminCreate, session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        return _serialize(AdminUserService(uow.session).create(payload))


@router.patch(
    "/usuarios/{user_id}",
    response_model=UsuarioAdminRead,
    dependencies=[Depends(_admin_only)],
)
def update_usuario(
    user_id: Annotated[int, Path(ge=1)],
    payload: UsuarioAdminUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        return _serialize(AdminUserService(uow.session).update(user_id, payload))


@router.put(
    "/usuarios/{user_id}/roles",
    response_model=UsuarioAdminRead,
    dependencies=[Depends(_admin_only)],
)
def replace_roles(
    user_id: Annotated[int, Path(ge=1)],
    payload: UsuarioRolesUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        return _serialize(AdminUserService(uow.session).replace_roles(user_id, payload))


@router.delete(
    "/usuarios/{user_id}", status_code=204, dependencies=[Depends(_admin_only)]
)
def soft_delete(
    user_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        AdminUserService(uow.session).soft_delete(user_id)
