from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, Path, status, Body
from pydantic import BaseModel
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
from ..repositories.producto_repository import ProductoRepository, compute_stock_disponible
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import require_roles


class ImagenesUpdate(BaseModel):
    imagenes_url: Optional[List[str]] = None

router = APIRouter(prefix="/productos", tags=["Productos"])
_admin_only = require_roles("ADMIN")
_admin_or_stock = require_roles("ADMIN", "STOCK")


def _serialize_full(session: Session, prod: Producto) -> dict:
    return {
        "id": prod.id,
        "nombre": prod.nombre,
        "precio_base": prod.precio_base,
        "descripcion": prod.descripcion,
        "imagenes_url": prod.imagenes_url,
        "disponible": prod.disponible,
        "stock_disponible": compute_stock_disponible(session, prod.id),
        "categorias": [
            {
                "id": c.id,
                "nombre": c.nombre,
                "descripcion": c.descripcion,
                "imagen_url": c.imagen_url,
                "parent_id": c.parent_id,
            }
            for c in prod.categorias
        ],
        "producto_ingredientes": [
            {
                "ingrediente_id": pi.ingrediente_id,
                "ingrediente": {
                    "id": pi.ingrediente.id,
                    "nombre": pi.ingrediente.nombre,
                    "descripcion": pi.ingrediente.descripcion,
                    "es_alergeno": pi.ingrediente.es_alergeno,
                    "stock_cantidad": pi.ingrediente.stock_cantidad,
                    "unidad_medida": {
                        "id": pi.ingrediente.unidad_medida.id,
                        "nombre": pi.ingrediente.unidad_medida.nombre,
                        "simbolo": pi.ingrediente.unidad_medida.simbolo,
                        "tipo": pi.ingrediente.unidad_medida.tipo,
                    } if pi.ingrediente.unidad_medida else None,
                } if pi.ingrediente else None,
                "cantidad": float(pi.cantidad),
                "unidad_medida_id": pi.unidad_medida_id,
                "unidad_medida": {
                    "id": pi.unidad_medida.id,
                    "nombre": pi.unidad_medida.nombre,
                    "simbolo": pi.unidad_medida.simbolo,
                    "tipo": pi.unidad_medida.tipo,
                } if pi.unidad_medida else None,
                "es_removible": pi.es_removible,
            }
            for pi in prod.producto_ingredientes
        ],
        "unidad_venta": {
            "id": prod.unidad_venta.id,
            "nombre": prod.unidad_venta.nombre,
            "simbolo": prod.unidad_venta.simbolo,
            "tipo": prod.unidad_venta.tipo,
        } if prod.unidad_venta else None,
    }


@router.get("/", response_model=PaginatedResponse[ProductoReadFull])
def read_productos(
    session: Session = Depends(get_session),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    nombre: Annotated[str | None, Query(max_length=120)] = None,
    categoria_ids: Annotated[list[int] | None, Query()] = None,
    disponible: Annotated[bool | None, Query()] = None,
    precio_min: Annotated[float | None, Query(ge=0)] = None,
    precio_max: Annotated[float | None, Query(ge=0)] = None,
):
    items, total = ProductoService(session).search(
        skip=skip,
        limit=limit,
        nombre=nombre,
        categoria_ids=categoria_ids,
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


@router.patch(
    "/{producto_id}/imagenes",
    response_model=ProductoReadFull,
    dependencies=[Depends(_admin_only)],
)
def patch_imagenes(
    producto_id: Annotated[int, Path(ge=1)],
    payload: ImagenesUpdate,
    session: Session = Depends(get_session),
):
    with UnitOfWork(session) as uow:
        prod = uow.session.get(Producto, producto_id)
        if prod is None:
            from fastapi import HTTPException
            raise HTTPException(404, "Producto no encontrado")
        prod.imagenes_url = payload.imagenes_url
        uow.session.add(prod)
        uow.session.flush()
        return _serialize_full(uow.session, prod)


@router.delete("/{producto_id}", status_code=204, dependencies=[Depends(_admin_only)])
def remove(
    producto_id: Annotated[int, Path(ge=1)], session: Session = Depends(get_session)
):
    with UnitOfWork(session) as uow:
        ProductoService(uow.session).delete(producto_id)
