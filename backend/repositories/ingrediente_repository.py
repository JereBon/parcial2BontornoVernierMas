from sqlmodel import Session
from ..models import Ingrediente
from .base import BaseRepository


class IngredienteRepository(BaseRepository[Ingrediente]):
    def __init__(self, session: Session):
        super().__init__(session, Ingrediente)
