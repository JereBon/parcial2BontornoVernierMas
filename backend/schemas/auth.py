from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RolRead(BaseModel):
    id: int
    codigo: str
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class UsuarioCreate(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=80)
    apellido: str = Field(..., min_length=2, max_length=80)
    celular: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(..., min_length=8, max_length=72)


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class UsuarioRead(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    apellido: str
    celular: Optional[str] = None
    roles: List[RolRead] = []
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 1800  # 30 min in seconds
    user: UsuarioRead
