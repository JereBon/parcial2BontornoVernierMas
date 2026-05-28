from fastapi import HTTPException
from sqlmodel import Session, select
from ..models import (
    Producto,
    Categoria,
    Ingrediente,
    ProductoCategoria,
    ProductoIngrediente,
)
from ..schemas.catalogo import (
    ProductoCreate,
    ProductoUpdate,
    ProductoDisponibilidadUpdate,
    ProductoIngredienteInput,
)
from ..repositories.producto_repository import ProductoRepository
from ..repositories.categoria_repository import CategoriaRepository
from ..repositories.ingrediente_repository import IngredienteRepository


class ProductoService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProductoRepository(session)
        self.cat_repo = CategoriaRepository(session)
        self.ing_repo = IngredienteRepository(session)

    def get_full(self, producto_id: int) -> Producto:
        prod = self.repo.get_full(producto_id)
        if prod is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        return prod

    def search(self, **kwargs) -> tuple[list[Producto], int]:
        return self.repo.search(**kwargs)

    def _resolve_categorias(self, ids: list[int]) -> None:
        for cid in ids:
            if self.cat_repo.get(cid) is None:
                raise HTTPException(
                    status_code=404, detail=f"Categoria id={cid} no encontrada"
                )

    def _resolve_ingredientes(self, items: list[ProductoIngredienteInput]) -> None:
        for it in items:
            if self.ing_repo.get(it.ingrediente_id) is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Ingrediente id={it.ingrediente_id} no encontrado",
                )

    def _replace_categorias(self, prod_id: int, ids: list[int]) -> None:
        for pc in self.session.exec(
            select(ProductoCategoria).where(ProductoCategoria.producto_id == prod_id)
        ).all():
            self.session.delete(pc)
        for cid in ids:
            self.session.add(ProductoCategoria(producto_id=prod_id, categoria_id=cid))

    def _replace_ingredientes(
        self, prod_id: int, items: list[ProductoIngredienteInput]
    ) -> None:
        for pi in self.session.exec(
            select(ProductoIngrediente).where(
                ProductoIngrediente.producto_id == prod_id
            )
        ).all():
            self.session.delete(pi)
        for it in items:
            self.session.add(
                ProductoIngrediente(
                    producto_id=prod_id,
                    ingrediente_id=it.ingrediente_id,
                    es_alergeno=it.es_alergeno,
                )
            )

    def create(self, payload: ProductoCreate) -> Producto:
        self._resolve_categorias(payload.categorias_ids)
        self._resolve_ingredientes(payload.ingredientes)
        prod = Producto(
            nombre=payload.nombre,
            precio=payload.precio,
            descripcion=payload.descripcion,
            stock_cantidad=payload.stock_cantidad,
            disponible=payload.disponible,
        )
        self.session.add(prod)
        self.session.flush()
        self._replace_categorias(prod.id, payload.categorias_ids)
        self._replace_ingredientes(prod.id, payload.ingredientes)
        self.session.flush()
        return self.repo.get_full(prod.id)

    def update(self, producto_id: int, payload: ProductoUpdate) -> Producto:
        prod = self.get_full(producto_id)
        data = payload.model_dump(exclude_unset=True)
        for k in ("nombre", "precio", "descripcion", "stock_cantidad", "disponible"):
            if k in data:
                setattr(prod, k, data[k])
        if "categorias_ids" in data and data["categorias_ids"] is not None:
            self._resolve_categorias(data["categorias_ids"])
            self._replace_categorias(prod.id, data["categorias_ids"])
        if "ingredientes" in data and data["ingredientes"] is not None:
            items = [ProductoIngredienteInput(**i) for i in data["ingredientes"]]
            self._resolve_ingredientes(items)
            self._replace_ingredientes(prod.id, items)
        self.session.flush()
        return self.repo.get_full(prod.id)

    def patch_disponibilidad(
        self, producto_id: int, payload: ProductoDisponibilidadUpdate
    ) -> Producto:
        prod = self.get_full(producto_id)
        data = payload.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=400, detail="Sin cambios para aplicar")
        for k, v in data.items():
            setattr(prod, k, v)
        self.session.add(prod)
        self.session.flush()
        return self.repo.get_full(prod.id)

    def delete(self, producto_id: int) -> None:
        prod = self.repo.get(producto_id)
        if prod is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        self.repo.delete(prod)
