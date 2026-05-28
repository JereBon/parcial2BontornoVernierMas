from fastapi import HTTPException
from sqlmodel import Session
from ..models import Ingrediente
from ..schemas.catalogo import IngredienteCreate, IngredienteUpdate
from ..repositories.ingrediente_repository import IngredienteRepository


class IngredienteService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = IngredienteRepository(session)

    def get_by_id(self, ingrediente_id: int) -> Ingrediente:
        ing = self.repo.get(ingrediente_id)
        if ing is None:
            raise HTTPException(status_code=404, detail="Ingrediente no encontrado")
        return ing

    def list_paginated(self, *, skip: int, limit: int) -> tuple[list[Ingrediente], int]:
        items = self.repo.list(skip=skip, limit=limit, order_by=Ingrediente.nombre)
        total = self.repo.count()
        return (items, total)

    def create(self, payload: IngredienteCreate) -> Ingrediente:
        ing = Ingrediente(nombre=payload.nombre)
        return self.repo.add(ing)

    def update(self, ingrediente_id: int, payload: IngredienteUpdate) -> Ingrediente:
        ing = self.get_by_id(ingrediente_id)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(ing, k, v)
        return self.repo.add(ing)

    def delete(self, ingrediente_id: int) -> None:
        ing = self.get_by_id(ingrediente_id)
        self.repo.delete(ing)
