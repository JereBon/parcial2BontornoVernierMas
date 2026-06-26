from fastapi import HTTPException
from sqlmodel import Session
from ..models import Ingrediente
from ..schemas.catalogo import IngredienteCreate, IngredienteUpdate
from ..repositories.ingrediente_repository import IngredienteRepository
from .producto_service import ProductoService


class IngredienteService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = IngredienteRepository(session)
        self.producto_service = ProductoService(session)

    def get_by_id(self, ingrediente_id: int) -> Ingrediente:
        ing = self.repo.get_with_unit(ingrediente_id)
        if ing is None:
            raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
        return ing

    def list_paginated(
        self, *, skip: int, limit: int, nombre: str | None = None
    ) -> tuple[list[Ingrediente], int]:
        return self.repo.search(skip=skip, limit=limit, nombre=nombre)

    def create(self, payload: IngredienteCreate) -> Ingrediente:
        ing = Ingrediente(
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            es_alergeno=payload.es_alergeno,
            stock_cantidad=payload.stock_cantidad,
            unidad_medida_id=payload.unidad_medida_id,
            precio_costo=payload.precio_costo,
        )
        self.repo.add(ing)
        return self.repo.get_with_unit(ing.id)

    def update(self, ingrediente_id: int, payload: IngredienteUpdate) -> Ingrediente:
        ing = self.get_by_id(ingrediente_id)
        data = payload.model_dump(exclude_unset=True)
        costo_cambio = "precio_costo" in data and data["precio_costo"] != ing.precio_costo
        unidad_cambio = (
            "unidad_medida_id" in data
            and data["unidad_medida_id"] != ing.unidad_medida_id
        )
        for k, v in data.items():
            setattr(ing, k, v)
        self.repo.add(ing)
        # Si cambió la unidad del insumo, propagarla a los productos que lo usan
        # para que el modal de producto refleje el cambio aplicado.
        if unidad_cambio:
            self.producto_service.repo.set_unidad_for_ingrediente(
                ing.id, ing.unidad_medida_id
            )
        # Si cambió el precio-costo (o la unidad), recalcular el precio de venta
        # de todos los productos que usan este insumo: el precio del producto se
        # actualiza automáticamente, sin tener que re-guardarlo.
        if costo_cambio or unidad_cambio:
            self.producto_service.recompute_por_ingrediente(ing.id)
        return self.repo.get_with_unit(ing.id)

    def ajustar_stock(self, ingrediente_id: int, cantidad: int) -> Ingrediente:
        ing = self.get_by_id(ingrediente_id)
        nuevo = ing.stock_cantidad + cantidad
        if nuevo < 0:
            raise HTTPException(
                status_code=409,
                detail=f"Stock insuficiente: disponible {ing.stock_cantidad}, solicitado -{abs(cantidad)}",
            )
        ing.stock_cantidad = nuevo
        return self.repo.add(ing)

    def delete(self, ingrediente_id: int) -> None:
        ing = self.get_by_id(ingrediente_id)
        productos_ids = self.producto_service.repo.ids_using_ingrediente(ingrediente_id)
        if productos_ids:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"No se puede eliminar: el ingrediente está usado en "
                    f"{len(productos_ids)} producto(s). Quitalo de esos productos primero."
                ),
            )
        self.repo.hard_delete(ing)
