from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String


class EstadoPedidoCodigo(str, Enum):
    PENDIENTE = "PENDIENTE"
    CONFIRMADO = "CONFIRMADO"
    EN_PREPARACION = "EN_PREPARACION"
    ENTREGADO = "ENTREGADO"
    CANCELADO = "CANCELADO"


ALLOWED_TRANSITIONS: dict[EstadoPedidoCodigo, set[EstadoPedidoCodigo]] = {
    EstadoPedidoCodigo.PENDIENTE: {
        EstadoPedidoCodigo.CONFIRMADO,
        EstadoPedidoCodigo.CANCELADO,
    },
    EstadoPedidoCodigo.CONFIRMADO: {
        EstadoPedidoCodigo.EN_PREPARACION,
        EstadoPedidoCodigo.CANCELADO,
    },
    EstadoPedidoCodigo.EN_PREPARACION: {
        EstadoPedidoCodigo.ENTREGADO,
        EstadoPedidoCodigo.CANCELADO,
    },
    EstadoPedidoCodigo.ENTREGADO: set(),
    EstadoPedidoCodigo.CANCELADO: set(),
}
TERMINAL_STATES: set[EstadoPedidoCodigo] = {
    EstadoPedidoCodigo.ENTREGADO,
    EstadoPedidoCodigo.CANCELADO,
}


class EstadoPedido(SQLModel, table=True):
    __tablename__ = "estado_pedido"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(
        sa_column=Column(String(20), unique=True, nullable=False, index=True)
    )
    descripcion: str = Field(max_length=80)
    orden: int = Field(default=0)
    es_terminal: bool = Field(default=False)
