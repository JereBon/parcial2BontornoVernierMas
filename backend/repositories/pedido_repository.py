from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Pedido, EstadoPedido
from ..models.pedido import HistorialEstadoPedido
from .base import BaseRepository


class PedidoRepository(BaseRepository[Pedido]):
    def __init__(self, session: Session):
        super().__init__(session, Pedido)

    def _eager_full(self, stmt):
        return stmt.options(
            selectinload(Pedido.estado),
            selectinload(Pedido.forma_pago),
            selectinload(Pedido.detalles),
            selectinload(Pedido.historial).selectinload(
                HistorialEstadoPedido.estado_anterior
            ),
            selectinload(Pedido.historial).selectinload(
                HistorialEstadoPedido.estado_nuevo
            ),
        )

    def get_full(self, pedido_id: int) -> Pedido | None:
        stmt = (
            select(Pedido)
            .where(Pedido.id == pedido_id)
            .where(Pedido.deleted_at.is_(None))
        )
        return self.session.exec(self._eager_full(stmt)).unique().first()

    def search(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        usuario_id: int | None = None,
        estado_codigo: str | None = None,
    ) -> tuple[list[Pedido], int]:
        stmt = select(Pedido).where(Pedido.deleted_at.is_(None))
        if usuario_id is not None:
            stmt = stmt.where(Pedido.usuario_id == usuario_id)
        if estado_codigo is not None:
            stmt = stmt.join(EstadoPedido, EstadoPedido.id == Pedido.estado_id).where(
                EstadoPedido.codigo == estado_codigo
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.exec(count_stmt).one())
        stmt = (
            stmt.options(selectinload(Pedido.estado), selectinload(Pedido.forma_pago))
            .order_by(Pedido.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list(self.session.exec(stmt).unique().all())
        return (items, total)
