from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import (
    IngredienteRead,
    IngredienteCreate,
    IngredienteUpdate,
    IngredienteStockUpdate,
    PaginatedResponse,
)
from ..services.ingrediente_service import IngredienteService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import require_roles

router = APIRouter(prefix="/ingredientes", tags=["Ingredientes"])
_admin_only = require_roles("ADMIN")
_stock_or_admin = require_roles("ADMIN", "STOCK")


@router.get("/", response_model=PaginatedResponse[IngredienteRead])
def read_ingredientes(
    session: Session = Depends(get_session),
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 20,
    nombre: Annotated[str | None, Query(max_length=120)] = None,
):
    skip = (page - 1) * size
    items, total = IngredienteService(session).list_paginated(
        skip=skip, limit=size, nombre=nombre
    )
    return PaginatedResponse.build([IngredienteRead.model_validate(i) for i in items], total, page, size)


@router.get("/{ingrediente_id}", response_model=IngredienteRead)
def read_one(
    ingrediente_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    return IngredienteService(session).get_by_id(ingrediente_id)


@router.post(
    "/",
    response_model=IngredienteRead,
    status_code=201,
    dependencies=[Depends(_admin_only)],
)
def create(payload: IngredienteCreate, session: Session = Depends(get_session)):
    with UnitOfWork(session) as uow:
        return IngredienteService(uow.session).create(payload)


@router.put(
    "/{ingrediente_id}",
    response_model=IngredienteRead,
    dependencies=[Depends(_admin_only)],
)
def update(
    ingrediente_id: Annotated[int, Path(ge=1)],
    payload: IngredienteUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        return IngredienteService(uow.session).update(ingrediente_id, payload)


@router.patch(
    "/{ingrediente_id}/stock",
    response_model=IngredienteRead,
    dependencies=[Depends(_stock_or_admin)],
)
def patch_stock(
    ingrediente_id: Annotated[int, Path(ge=1)],
    payload: IngredienteStockUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        return IngredienteService(uow.session).update(
            ingrediente_id, payload  # type: ignore[arg-type]
        )


@router.delete(
    "/{ingrediente_id}", status_code=204, dependencies=[Depends(_admin_only)]
)
def remove(
    ingrediente_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        IngredienteService(uow.session).delete(ingrediente_id)
