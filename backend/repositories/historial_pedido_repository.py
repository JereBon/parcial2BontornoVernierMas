from sqlmodel import Session, select
from ..models.pedido import HistorialEstadoPedido


class HistorialEstadoPedidoRepository:
    def __init__(self, session: Session):
        self.session = session

    def add(self, entry: HistorialEstadoPedido) -> HistorialEstadoPedido:
        self.session.add(entry)
        self.session.flush()
        return entry

    def list_by_pedido(self, pedido_id: int) -> list[HistorialEstadoPedido]:
        stmt = (
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.created_at.asc())
        )
        return list(self.session.exec(stmt).all())
