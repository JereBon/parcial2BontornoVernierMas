from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session
from ..database import get_session
from ..schemas.lookups import EstadoPedidoRead, FormaPagoRead
from ..repositories.lookups import EstadoPedidoRepository, FormaPagoRepository

router = APIRouter(prefix="/lookups", tags=["Lookups"])


@router.get("/estados-pedido", response_model=List[EstadoPedidoRead])
def estados_pedido(session: Session = Depends(get_session)):
    return EstadoPedidoRepository(session).list_all()


@router.get("/formas-pago", response_model=List[FormaPagoRead])
def formas_pago(session: Session = Depends(get_session)):
    return FormaPagoRepository(session).list_all()
