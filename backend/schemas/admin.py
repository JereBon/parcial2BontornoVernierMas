from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioAdminCreate(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=8, max_length=72)
    roles: List[str] = Field(default_factory=list)


class UsuarioAdminUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)


class UsuarioRolesUpdate(BaseModel):
    roles: List[str] = Field(
        ..., description="Lista de codigos: ADMIN, STOCK, PEDIDOS, CLIENT"
    )


class UsuarioAdminRead(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    roles: List[str]
    model_config = ConfigDict(from_attributes=True)
