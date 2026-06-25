from sqlmodel import Session, select
from .base import BaseRepository
from ..models.pedido import Pago


class PagoRepository(BaseRepository[Pago]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, Pago)

    def get_by_pedido(self, pedido_id: int) -> Pago | None:
        stmt = select(Pago).where(Pago.pedido_id == pedido_id)
        return self.session.exec(stmt).first()

    def get_by_mp_payment_id(self, mp_payment_id: int) -> Pago | None:
        stmt = select(Pago).where(Pago.mp_payment_id == mp_payment_id)
        return self.session.exec(stmt).first()

    def get_by_external_reference(self, external_reference: str) -> Pago | None:
        stmt = select(Pago).where(Pago.external_reference == external_reference)
        return self.session.exec(stmt).first()
