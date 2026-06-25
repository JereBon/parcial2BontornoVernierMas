from sqlmodel import Session, select
from ..models import Ingrediente
from .base import BaseRepository


class IngredienteRepository(BaseRepository[Ingrediente]):
    def __init__(self, session: Session):
        super().__init__(session, Ingrediente)

    def _eager(self):
        return [Ingrediente.unidad_medida]

    def search(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        nombre: str | None = None,
    ) -> tuple[list[Ingrediente], int]:
        filters = []
        if nombre:
            filters.append(Ingrediente.nombre.ilike(f"%{nombre}%"))
        items = self.list(
            skip=skip,
            limit=limit,
            filters=filters or None,
            order_by=Ingrediente.nombre,
            eager=self._eager(),
        )
        total = self.count(filters=filters or None)
        return (items, total)

    def get_with_unit(self, ingrediente_id: int) -> Ingrediente | None:
        return self.get(ingrediente_id, eager=self._eager())
