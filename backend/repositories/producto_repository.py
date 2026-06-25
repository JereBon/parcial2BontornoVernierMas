from decimal import Decimal
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Producto, ProductoCategoria, ProductoIngrediente, UnidadMedida, Ingrediente
from .base import BaseRepository

# Conversion to base unit: masa→g, volumen→ml, contable→u
_FACTOR: dict[str, float] = {
    'g': 1.0,
    'kg': 1000.0,
    'ml': 1.0,
    'l': 1000.0,
    'L': 1000.0,
    'ud': 1.0,
    'u': 1.0,
    'porciones': 1.0,
}


def _to_base(cantidad: float, simbolo: str | None) -> float:
    return cantidad * _FACTOR.get(simbolo or 'u', 1.0)


def compute_stock_disponible(session: Session, producto_id: int) -> int:
    links = list(
        session.exec(
            select(ProductoIngrediente)
            .where(ProductoIngrediente.producto_id == producto_id)
            .options(
                selectinload(ProductoIngrediente.ingrediente).selectinload(
                    Ingrediente.unidad_medida
                ),
                selectinload(ProductoIngrediente.unidad_medida),
            )
        ).all()
    )
    if not links:
        return 0

    stocks = []
    for link in links:
        ing = link.ingrediente
        if ing is None:
            return 0

        stock_base = _to_base(
            float(ing.stock_cantidad),
            ing.unidad_medida.simbolo if ing.unidad_medida else None,
        )
        required_base = _to_base(
            float(link.cantidad),
            link.unidad_medida.simbolo if link.unidad_medida else None,
        )

        if required_base <= 0:
            stocks.append(0)
            continue
        stocks.append(int(stock_base // required_base))

    return min(stocks) if stocks else 0


class ProductoRepository(BaseRepository[Producto]):
    def __init__(self, session: Session):
        super().__init__(session, Producto)

    def search(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        nombre: str | None = None,
        categoria_ids: list[int] | None = None,
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
            stmt = stmt.where(Producto.precio_base >= precio_min)
        if precio_max is not None:
            stmt = stmt.where(Producto.precio_base <= precio_max)
        if categoria_ids:
            stmt = stmt.join(
                ProductoCategoria, ProductoCategoria.producto_id == Producto.id
            ).where(ProductoCategoria.categoria_id.in_(categoria_ids))
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.exec(count_stmt).one())
        if eager_full:
            stmt = stmt.options(
                selectinload(Producto.categorias),
                selectinload(Producto.producto_ingredientes).selectinload(
                    ProductoIngrediente.ingrediente
                ).selectinload(Ingrediente.unidad_medida),
                selectinload(Producto.producto_ingredientes).selectinload(
                    ProductoIngrediente.unidad_medida
                ),
                selectinload(Producto.unidad_venta),
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
                selectinload(Producto.categorias),
                selectinload(Producto.producto_ingredientes).selectinload(
                    ProductoIngrediente.ingrediente
                ).selectinload(Ingrediente.unidad_medida),
                selectinload(Producto.producto_ingredientes).selectinload(
                    ProductoIngrediente.unidad_medida
                ),
                selectinload(Producto.unidad_venta),
            )
        )
        return self.session.exec(stmt).unique().first()

    def get_producto_ingredientes(self, producto_id: int) -> list[ProductoIngrediente]:
        return list(
            self.session.exec(
                select(ProductoIngrediente)
                .where(ProductoIngrediente.producto_id == producto_id)
                .options(
                    selectinload(ProductoIngrediente.ingrediente).selectinload(
                        Ingrediente.unidad_medida
                    ),
                    selectinload(ProductoIngrediente.unidad_medida),
                )
            ).all()
        )

    def count_active_by_categoria(self, categoria_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(Producto)
            .join(ProductoCategoria, ProductoCategoria.producto_id == Producto.id)
            .where(ProductoCategoria.categoria_id == categoria_id)
            .where(Producto.deleted_at.is_(None))
        )
        return int(self.session.exec(stmt).one())
