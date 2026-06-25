from fastapi import HTTPException
from sqlmodel import Session
from ..models import DireccionEntrega, Usuario
from ..schemas.direccion import DireccionCreate, DireccionUpdate
from ..repositories.direccion_repository import DireccionRepository


class DireccionService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = DireccionRepository(session)

    def list_mine(self, user: Usuario) -> list[DireccionEntrega]:
        return self.repo.list_by_usuario(user.id)

    def get_mine(self, id_: int, user: Usuario) -> DireccionEntrega:
        dir_ = self.repo.get_for_user(id_, user.id)
        if dir_ is None:
            raise HTTPException(status_code=404, detail="Direccion no encontrada")
        return dir_

    def create(self, payload: DireccionCreate, user: Usuario) -> DireccionEntrega:
        if payload.es_principal:
            self.repo.unset_principal(user.id)
        d = DireccionEntrega(
            usuario_id=user.id,
            alias=payload.alias,
            linea1=payload.linea1,
            linea2=payload.linea2,
            ciudad=payload.ciudad,
            provincia=payload.provincia,
            codigo_postal=payload.codigo_postal,
            es_principal=payload.es_principal,
        )
        return self.repo.add(d)

    def update(
        self, id_: int, payload: DireccionUpdate, user: Usuario
    ) -> DireccionEntrega:
        d = self.get_mine(id_, user)
        data = payload.model_dump(exclude_unset=True)
        if data.get("es_principal"):
            self.repo.unset_principal(user.id)
        for k, v in data.items():
            setattr(d, k, v)
        return self.repo.add(d)

    def set_principal(self, id_: int, user: Usuario) -> DireccionEntrega:
        d = self.get_mine(id_, user)
        self.repo.unset_principal(user.id)
        d.es_principal = True
        return self.repo.add(d)

    def delete(self, id_: int, user: Usuario) -> None:
        d = self.get_mine(id_, user)
        self.repo.delete(d)
