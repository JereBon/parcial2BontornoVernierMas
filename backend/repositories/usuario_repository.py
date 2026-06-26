from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Usuario, UsuarioRol, Rol
from .base import BaseRepository


class UsuarioRepository(BaseRepository[Usuario]):
    def __init__(self, session: Session):
        super().__init__(session, Usuario)

    def search(
        self,
        *,
        skip: int,
        limit: int,
        rol_codigo: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Usuario], int]:
        stmt = select(Usuario).where(Usuario.deleted_at.is_(None))
        if rol_codigo:
            stmt = (
                stmt.join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
                .join(Rol, Rol.id == UsuarioRol.rol_id)
                .where(Rol.codigo == rol_codigo)
            )
        if busqueda:
            like = f"%{busqueda}%"
            stmt = stmt.where(
                (Usuario.email.ilike(like)) | (Usuario.nombre.ilike(like))
            )
        total = int(
            self.session.exec(
                select(func.count()).select_from(stmt.subquery())
            ).one()
        )
        stmt = (
            stmt.options(selectinload(Usuario.roles))
            .order_by(Usuario.id)
            .offset(skip)
            .limit(limit)
        )
        items = list(self.session.exec(stmt).unique().all())
        return (items, total)

    def get_first_with_roles(self) -> Usuario | None:
        """Primer usuario (usado como actor de sistema en el webhook de pagos)."""
        return self.session.exec(
            select(Usuario)
            .where(Usuario.deleted_at.is_(None))
            .options(selectinload(Usuario.roles))
            .order_by(Usuario.id)
        ).first()

    def add_roles(self, usuario_id: int, rol_ids: list[int]) -> None:
        for rid in rol_ids:
            self.session.add(UsuarioRol(usuario_id=usuario_id, rol_id=rid))
        self.session.flush()

    def replace_roles(self, usuario_id: int, rol_ids: list[int]) -> None:
        for ur in self.session.exec(
            select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id)
        ).all():
            self.session.delete(ur)
        self.session.flush()
        self.add_roles(usuario_id, rol_ids)

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
