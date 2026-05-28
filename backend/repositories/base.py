from typing import Generic, TypeVar, Type, Sequence, Any
from datetime import datetime, timezone
from sqlmodel import Session, SQLModel, select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

T = TypeVar("T", bound=SQLModel)


class BaseRepository(Generic[T]):
    model: Type[T]

    def __init__(self, session: Session, model: Type[T]):
        self.session = session
        self.model = model

    def _has_soft_delete(self) -> bool:
        return hasattr(self.model, "deleted_at")

    def _active_filter(self) -> ColumnElement[bool] | None:
        if self._has_soft_delete():
            return self.model.deleted_at.is_(None)
        return None

    def _apply_eager(self, stmt, eager: Sequence[Any] | None):
        if eager:
            for rel in eager:
                stmt = stmt.options(selectinload(rel))
        return stmt

    def get(
        self,
        id_: int,
        *,
        eager: Sequence[Any] | None = None,
        include_deleted: bool = False,
    ) -> T | None:
        stmt = select(self.model).where(self.model.id == id_)
        if not include_deleted:
            af = self._active_filter()
            if af is not None:
                stmt = stmt.where(af)
        stmt = self._apply_eager(stmt, eager)
        return self.session.exec(stmt).unique().first()

    def list(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        eager: Sequence[Any] | None = None,
        filters: Sequence[ColumnElement[bool]] | None = None,
        order_by: Any | None = None,
        include_deleted: bool = False,
    ) -> list[T]:
        stmt = select(self.model)
        if not include_deleted:
            af = self._active_filter()
            if af is not None:
                stmt = stmt.where(af)
        if filters:
            for f in filters:
                stmt = stmt.where(f)
        stmt = self._apply_eager(stmt, eager)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.exec(stmt).unique().all())

    def count(
        self,
        *,
        filters: Sequence[ColumnElement[bool]] | None = None,
        include_deleted: bool = False,
    ) -> int:
        stmt = select(func.count()).select_from(self.model)
        if not include_deleted:
            af = self._active_filter()
            if af is not None:
                stmt = stmt.where(af)
        if filters:
            for f in filters:
                stmt = stmt.where(f)
        return int(self.session.exec(stmt).one())

    def add(self, entity: T) -> T:
        self.session.add(entity)
        self.session.flush()
        return entity

    def delete(self, entity: T) -> None:
        if self._has_soft_delete():
            setattr(entity, "deleted_at", datetime.now(timezone.utc))
            self.session.add(entity)
            self.session.flush()
        else:
            self.session.delete(entity)
            self.session.flush()

    def hard_delete(self, entity: T) -> None:
        self.session.delete(entity)
        self.session.flush()
