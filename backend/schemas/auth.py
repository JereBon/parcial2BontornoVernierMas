from typing import List
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RolRead(BaseModel):
    id: int
    codigo: str
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class UsuarioCreate(BaseModel):
    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=8, max_length=72)


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class UsuarioRead(BaseModel):
    id: int
    email: EmailStr
    nombre: str
    roles: List[RolRead] = []
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioRead
