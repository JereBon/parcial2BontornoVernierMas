from sqlmodel import Session, select
from ..models import DireccionEntrega
from .base import BaseRepository


class DireccionRepository(BaseRepository[DireccionEntrega]):
    def __init__(self, session: Session):
        super().__init__(session, DireccionEntrega)

    def list_by_usuario(self, usuario_id: int) -> list[DireccionEntrega]:
        stmt = (
            select(DireccionEntrega)
            .where(DireccionEntrega.usuario_id == usuario_id)
            .where(DireccionEntrega.deleted_at.is_(None))
            .order_by(
                DireccionEntrega.principal.desc(), DireccionEntrega.created_at.desc()
            )
        )
        return list(self.session.exec(stmt).all())

    def get_for_user(self, id_: int, usuario_id: int) -> DireccionEntrega | None:
        stmt = (
            select(DireccionEntrega)
            .where(DireccionEntrega.id == id_)
            .where(DireccionEntrega.usuario_id == usuario_id)
            .where(DireccionEntrega.deleted_at.is_(None))
        )
        return self.session.exec(stmt).first()

    def unset_principal(self, usuario_id: int) -> None:
        stmt = (
            select(DireccionEntrega)
            .where(DireccionEntrega.usuario_id == usuario_id)
            .where(DireccionEntrega.principal == True)
        )
        for d in self.session.exec(stmt).all():
            d.principal = False
            self.session.add(d)
