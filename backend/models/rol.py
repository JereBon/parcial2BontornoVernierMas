from enum import Enum
from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String


class RolCodigo(str, Enum):
    ADMIN = "ADMIN"
    STOCK = "STOCK"
    PEDIDOS = "PEDIDOS"
    CLIENT = "CLIENT"


class UsuarioRol(SQLModel, table=True):
    __tablename__ = "usuario_rol"
    usuario_id: int = Field(foreign_key="usuario.id", primary_key=True)
    rol_id: int = Field(foreign_key="rol.id", primary_key=True)


class Rol(SQLModel, table=True):
    __tablename__ = "rol"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(
        sa_column=Column(String(20), unique=True, nullable=False, index=True)
    )
    nombre: str = Field(max_length=80)
    usuarios: List["Usuario"] = Relationship(
        back_populates="roles", link_model=UsuarioRol
    )
