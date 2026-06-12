from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from ..models import Usuario
from .base import BaseRepository


class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def get_by_email(
        self, email: str, *, include_deleted: bool = False
    ) -> Usuario | None:
        stmt = (
            select(Usuario)
            .where(Usuario.email == email)
            .options(selectinload(Usuario.roles))
        )
        if not include_deleted:
            stmt = stmt.where(Usuario.deleted_at.is_(None))
        return self.session.exec(stmt).first()

    def get_with_roles(self, user_id: int) -> Usuario | None:
        stmt = (
            select(Usuario)
            .where(Usuario.id == user_id)
            .where(Usuario.deleted_at.is_(None))
            .options(selectinload(Usuario.roles))
        )
        return self.session.exec(stmt).first()
