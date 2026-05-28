from typing import Annotated
from fastapi import APIRouter, Depends, Query, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import (
    ProductoRead,
    ProductoReadFull,
    ProductoCreate,
    ProductoUpdate,
    ProductoDisponibilidadUpdate,
    PaginatedResponse,
)
from ..models import Producto
from ..services.producto_service import ProductoService
from ..repositories.producto_repository import ProductoRepository
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import require_roles

router = APIRouter(prefix="/productos", tags=["Productos"])
_admin_only = require_roles("ADMIN")
_admin_or_stock = require_roles("ADMIN", "STOCK")


def _serialize_full(session: Session, prod: Producto) -> dict:
    alergeno_map = ProductoRepository(session).get_alergeno_map(prod.id)
    return {
        "id": prod.id,
        "nombre": prod.nombre,
        "precio": prod.precio,
        "descripcion": prod.descripcion,
        "stock_cantidad": prod.stock_cantidad,
        "disponible": prod.disponible,
        "categorias": [
            {
                "id": c.id,
                "nombre": c.nombre,
                "descripcion": c.descripcion,
                "parent_id": c.parent_id,
            }
            for c in prod.categorias
        ],
        "ingredientes": [
            {
                "id": ing.id,
                "nombre": ing.nombre,
                "es_alergeno": alergeno_map.get(ing.id, False),
            }
            for ing in prod.ingredientes
        ],
    }


@router.get("/", response_model=PaginatedResponse[ProductoReadFull])
def read_productos(
    session: Session = Depends(get_session),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    nombre: Annotated[str | None, Query(max_length=120)] = None,
    categoria_id: Annotated[int | None, Query(ge=1)] = None,
    disponible: Annotated[bool | None, Query()] = None,
    precio_min: Annotated[float | None, Query(ge=0)] = None,
    precio_max: Annotated[float | None, Query(ge=0)] = None,
):
    items, total = ProductoService(session).search(
        skip=skip,
        limit=limit,
        nombre=nombre,
        categoria_id=categoria_id,
        disponible=disponible,
        precio_min=precio_min,
        precio_max=precio_max,
        eager_full=True,
    )
    return PaginatedResponse[ProductoReadFull](
        total=total,
        items=[_serialize_full(session, p) for p in items],
        limit=limit,
        offset=skip,
    )


@router.get("/{producto_id}", response_model=ProductoReadFull)
def read_one(
    producto_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    p = ProductoService(session).get_full(producto_id)
    return _serialize_full(session, p)


@router.post(
    "/",
    response_model=ProductoReadFull,
    status_code=201,
    dependencies=[Depends(_admin_only)],
)
def create(payload: ProductoCreate, session: Session = Depends(get_session)):
    with UnitOfWork(session) as uow:
        prod = ProductoService(uow.session).create(payload)
        return _serialize_full(uow.session, prod)


@router.put(
    "/{producto_id}",
    response_model=ProductoReadFull,
    dependencies=[Depends(_admin_only)],
)
def update(
    producto_id: Annotated[int, Path(ge=1)],
    payload: ProductoUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        prod = ProductoService(uow.session).update(producto_id, payload)
        return _serialize_full(uow.session, prod)


@router.patch(
    "/{producto_id}/disponibilidad",
    response_model=ProductoReadFull,
    dependencies=[Depends(_admin_or_stock)],
)
def patch_disponibilidad(
    producto_id: Annotated[int, Path(ge=1)],
    payload: ProductoDisponibilidadUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        prod = ProductoService(uow.session).patch_disponibilidad(producto_id, payload)
        return _serialize_full(uow.session, prod)


@router.delete("/{producto_id}", status_code=204, dependencies=[Depends(_admin_only)])
def remove(
    producto_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        ProductoService(uow.session).delete(producto_id)
