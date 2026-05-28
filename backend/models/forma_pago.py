from enum import Enum
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String


class FormaPagoCodigo(str, Enum):
    EFECTIVO = "EFECTIVO"
    TARJETA = "TARJETA"
    TRANSFERENCIA = "TRANSFERENCIA"


class FormaPago(SQLModel, table=True):
    __tablename__ = "forma_pago"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(
        sa_column=Column(String(30), unique=True, nullable=False, index=True)
    )
    nombre: str = Field(max_length=80)
