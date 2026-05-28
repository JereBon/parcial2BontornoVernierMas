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
        if payload.principal:
            self.repo.unset_principal(user.id)
        d = DireccionEntrega(
            usuario_id=user.id,
            alias=payload.alias,
            calle=payload.calle,
            numero=payload.numero,
            ciudad=payload.ciudad,
            codigo_postal=payload.codigo_postal,
            detalles=payload.detalles,
            principal=payload.principal,
        )
        return self.repo.add(d)

    def update(
        self, id_: int, payload: DireccionUpdate, user: Usuario
    ) -> DireccionEntrega:
        d = self.get_mine(id_, user)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(d, k, v)
        return self.repo.add(d)

    def set_principal(self, id_: int, user: Usuario) -> DireccionEntrega:
        d = self.get_mine(id_, user)
        self.repo.unset_principal(user.id)
        d.principal = True
        return self.repo.add(d)

    def delete(self, id_: int, user: Usuario) -> None:
        d = self.get_mine(id_, user)
        self.repo.delete(d)
