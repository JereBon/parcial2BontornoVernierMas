from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioAdminCreate(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=80)
    apellido: str = Field(..., min_length=2, max_length=80)
    celular: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(..., min_length=8, max_length=72)
    roles: List[str] = Field(default_factory=list)


class UsuarioAdminUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=80)
    celular: Optional[str] = Field(default=None, max_length=20)
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)


class UsuarioRolesUpdate(BaseModel):
    roles: List[str] = Field(
        ..., description="Lista de codigos: ADMIN, STOCK, PEDIDOS, CLIENT"
    )


class UsuarioAdminRead(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    apellido: str
    celular: Optional[str] = None
    roles: List[str]
    model_config = ConfigDict(from_attributes=True)
