from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Producto, ProductoCategoria, ProductoIngrediente
from .base import BaseRepository


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: Session):
        super().__init__(session, Producto)

    def search(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        nombre: str | None = None,
        categoria_id: int | None = None,
        disponible: bool | None = None,
        precio_min: float | None = None,
        precio_max: float | None = None,
        eager_full: bool = False,
    ) -> tuple[list[Producto], int]:
        stmt = select(Producto).where(Producto.deleted_at.is_(None))
        if nombre:
            stmt = stmt.where(Producto.nombre.ilike(f"%{nombre}%"))
        if disponible is not None:
            stmt = stmt.where(Producto.disponible == disponible)
        if precio_min is not None:
            stmt = stmt.where(Producto.precio >= precio_min)
        if precio_max is not None:
            stmt = stmt.where(Producto.precio <= precio_max)
        if categoria_id is not None:
            stmt = stmt.join(
                ProductoCategoria, ProductoCategoria.producto_id == Producto.id
            ).where(ProductoCategoria.categoria_id == categoria_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.exec(count_stmt).one())
        if eager_full:
            stmt = stmt.options(
                selectinload(Producto.categorias), selectinload(Producto.ingredientes)
            )
        stmt = stmt.order_by(Producto.nombre).offset(skip).limit(limit)
        items = list(self.session.exec(stmt).unique().all())
        return (items, total)

    def get_full(self, producto_id: int) -> Producto | None:
        stmt = (
            select(Producto)
            .where(Producto.id == producto_id)
            .where(Producto.deleted_at.is_(None))
            .options(
                selectinload(Producto.categorias), selectinload(Producto.ingredientes)
            )
        )
        return self.session.exec(stmt).unique().first()

    def get_alergeno_map(self, producto_id: int) -> dict[int, bool]:
        rows = self.session.exec(
            select(ProductoIngrediente).where(
                ProductoIngrediente.producto_id == producto_id
            )
        ).all()
        return {r.ingrediente_id: r.es_alergeno for r in rows}

    def count_active_by_categoria(self, categoria_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(Producto)
            .join(ProductoCategoria, ProductoCategoria.producto_id == Producto.id)
            .where(ProductoCategoria.categoria_id == categoria_id)
            .where(Producto.deleted_at.is_(None))
        )
        return int(self.session.exec(stmt).one())
