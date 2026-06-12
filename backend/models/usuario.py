from datetime import datetime, timezone
from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, String
from .rol import Rol, UsuarioRol


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(
        sa_column=Column(String(254), unique=True, index=True, nullable=False)
    )
    nombre: str = Field(max_length=80)
    apellido: str = Field(max_length=80)
    celular: Optional[str] = Field(default=None, max_length=20)
    password_hash: str = Field(nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    roles: List[Rol] = Relationship(
        back_populates="usuarios",
        link_model=UsuarioRol,
        sa_relationship_kwargs={
            "primaryjoin": "Usuario.id == UsuarioRol.usuario_id",
            "secondaryjoin": "UsuarioRol.rol_id == Rol.id",
        },
    )

    def role_codes(self) -> set[str]:
        return {r.codigo for r in self.roles}

    def has_any_role(self, *codes: str) -> bool:
        return any((c in self.role_codes() for c in codes))
