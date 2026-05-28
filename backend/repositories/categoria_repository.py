from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Categoria
from .base import BaseRepository


class CategoriaRepository(BaseRepository[Categoria]):
    def __init__(self, session: Session):
        super().__init__(session, Categoria)

    def get_all_active(self) -> list[Categoria]:
        stmt = (
            select(Categoria)
            .where(Categoria.deleted_at.is_(None))
            .order_by(Categoria.nombre)
        )
        return list(self.session.exec(stmt).unique().all())

    def get_with_children(self, categoria_id: int) -> Categoria | None:
        stmt = (
            select(Categoria)
            .where(Categoria.id == categoria_id)
            .where(Categoria.deleted_at.is_(None))
            .options(selectinload(Categoria.children))
        )
        return self.session.exec(stmt).unique().first()

    def search(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        parent_id: int | None = None,
        only_roots: bool = False,
    ) -> tuple[list[Categoria], int]:
        stmt = select(Categoria).where(Categoria.deleted_at.is_(None))
        if only_roots:
            stmt = stmt.where(Categoria.parent_id.is_(None))
        elif parent_id is not None:
            stmt = stmt.where(Categoria.parent_id == parent_id)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.exec(count_stmt).one())
        stmt = stmt.order_by(Categoria.nombre).offset(skip).limit(limit)
        items = list(self.session.exec(stmt).all())
        return (items, total)
