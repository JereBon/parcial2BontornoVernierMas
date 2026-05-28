from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DireccionCreate(BaseModel):
    alias: str = Field(..., min_length=2, max_length=40)
    calle: str = Field(..., min_length=2, max_length=120)
    numero: str = Field(..., min_length=1, max_length=20)
    ciudad: str = Field(..., min_length=2, max_length=80)
    codigo_postal: Optional[str] = Field(default=None, max_length=20)
    detalles: Optional[str] = Field(default=None, max_length=255)
    principal: bool = False


class DireccionUpdate(BaseModel):
    alias: Optional[str] = Field(default=None, min_length=2, max_length=40)
    calle: Optional[str] = Field(default=None, min_length=2, max_length=120)
    numero: Optional[str] = Field(default=None, min_length=1, max_length=20)
    ciudad: Optional[str] = Field(default=None, min_length=2, max_length=80)
    codigo_postal: Optional[str] = Field(default=None, max_length=20)
    detalles: Optional[str] = Field(default=None, max_length=255)


class DireccionRead(BaseModel):
    id: int
    usuario_id: int
    alias: str
    calle: str
    numero: str
    ciudad: str
    codigo_postal: Optional[str] = None
    detalles: Optional[str] = None
    principal: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
