from typing import Annotated, List
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import (
    CategoriaRead,
    CategoriaCreate,
    CategoriaUpdate,
    CategoriaTreeNode,
    PaginatedResponse,
)
from ..services.categoria_service import CategoriaService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import require_roles

router = APIRouter(prefix="/categorias", tags=["Categorias"])
_admin_only = require_roles("ADMIN")


@router.get("/", response_model=PaginatedResponse[CategoriaRead])
def read_categorias(
    session: Session = Depends(get_session),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    parent_id: Annotated[int | None, Query(ge=1)] = None,
    only_roots: Annotated[bool, Query()] = False,
):
    items, total = CategoriaService(session).list_paginated(
        skip=skip, limit=limit, parent_id=parent_id, only_roots=only_roots
    )
    return PaginatedResponse[CategoriaRead](
        total=total,
        items=[CategoriaRead.model_validate(c) for c in items],
        limit=limit,
        offset=skip,
    )


@router.get("/tree", response_model=List[CategoriaTreeNode])
def read_tree(session: Session = Depends(get_session)):
    return CategoriaService(session).get_tree()


@router.get("/{categoria_id}", response_model=CategoriaRead)
def read_categoria(
    categoria_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    return CategoriaService(session).get_by_id(categoria_id)


@router.post(
    "/",
    response_model=CategoriaRead,
    status_code=201,
    dependencies=[Depends(_admin_only)],
)
def create_categoria(payload: CategoriaCreate, session: Session = Depends(get_session)):
    with UnitOfWork(session) as uow:
        return CategoriaService(uow.session).create(payload)


@router.put(
    "/{categoria_id}", response_model=CategoriaRead, dependencies=[Depends(_admin_only)]
)
def update_categoria(
    categoria_id: Annotated[int, Path(ge=1)],
    payload: CategoriaUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        return CategoriaService(uow.session).update(categoria_id, payload)


@router.delete("/{categoria_id}", status_code=204, dependencies=[Depends(_admin_only)])
def delete_categoria(
    categoria_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        CategoriaService(uow.session).delete(categoria_id)
