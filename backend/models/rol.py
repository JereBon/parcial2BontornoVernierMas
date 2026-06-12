from datetime import datetime, timezone
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
    asignado_por_id: Optional[int] = Field(default=None, foreign_key="usuario.id")
    expires_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Rol(SQLModel, table=True):
    __tablename__ = "rol"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(
        sa_column=Column(String(20), unique=True, nullable=False, index=True)
    )
    nombre: str = Field(max_length=50, unique=True)
    descripcion: Optional[str] = Field(default=None)
    usuarios: List["Usuario"] = Relationship(
        back_populates="roles",
        link_model=UsuarioRol,
        sa_relationship_kwargs={
            "primaryjoin": "Rol.id == UsuarioRol.rol_id",
            "secondaryjoin": "UsuarioRol.usuario_id == Usuario.id",
        },
    )
