from typing import Annotated, List
from fastapi import APIRouter, Depends, Path, status
from sqlmodel import Session
from ..database import get_session
from ..schemas import DireccionCreate, DireccionUpdate, DireccionRead
from ..services.direccion_service import DireccionService
from ..uow.unit_of_work import UnitOfWork
from ..core.deps import get_current_user
from ..models import Usuario

router = APIRouter(prefix="/direcciones", tags=["Direcciones"])


@router.get("/", response_model=List[DireccionRead])
def read_mine(
    session: Session = Depends(get_session), user: Usuario = Depends(get_current_user)
):
    return DireccionService(session).list_mine(user)


@router.get("/{direccion_id}", response_model=DireccionRead)
def read_one(
    direccion_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    return DireccionService(session).get_mine(direccion_id, user)


@router.post("/", response_model=DireccionRead, status_code=status.HTTP_201_CREATED)
def create(
    payload: DireccionCreate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return DireccionService(uow.session).create(payload, user)


@router.put("/{direccion_id}", response_model=DireccionRead)
def update(
    direccion_id: Annotated[int, Path(ge=1)],
    payload: DireccionUpdate,
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return DireccionService(uow.session).update(direccion_id, payload, user)


@router.patch("/{direccion_id}/principal", response_model=DireccionRead)
def set_principal(
    direccion_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        return DireccionService(uow.session).set_principal(direccion_id, user)


@router.delete("/{direccion_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(
    direccion_id: Annotated[int, Path(ge=1)],
    session: Session = Depends(get_session),
    user: Usuario = Depends(get_current_user),
):
    with UnitOfWork(session) as uow:
        DireccionService(uow.session).delete(direccion_id, user)
