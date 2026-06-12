from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String


class FormaPagoCodigo(str, Enum):
    EFECTIVO = "EFECTIVO"
    TARJETA = "TARJETA"
    TRANSFERENCIA = "TRANSFERENCIA"
    MERCADO_PAGO = "MERCADO_PAGO"


class FormaPago(SQLModel, table=True):
    __tablename__ = "forma_pago"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(
        sa_column=Column(String(20), unique=True, nullable=False, index=True)
    )
    descripcion: str = Field(max_length=80)
    habilitado: bool = Field(default=True)
