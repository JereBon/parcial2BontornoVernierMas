from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DireccionCreate(BaseModel):
    alias: Optional[str] = Field(default=None, max_length=50)
    linea1: str = Field(..., min_length=2, max_length=500)
    linea2: Optional[str] = Field(default=None, max_length=500)
    ciudad: str = Field(..., min_length=2, max_length=100)
    provincia: Optional[str] = Field(default=None, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, max_length=10)
    es_principal: bool = False


class DireccionUpdate(BaseModel):
    alias: Optional[str] = Field(default=None, max_length=50)
    linea1: Optional[str] = Field(default=None, min_length=2, max_length=500)
    linea2: Optional[str] = Field(default=None, max_length=500)
    ciudad: Optional[str] = Field(default=None, min_length=2, max_length=100)
    provincia: Optional[str] = Field(default=None, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, max_length=10)


class DireccionRead(BaseModel):
    id: int
    usuario_id: int
    alias: Optional[str] = None
    linea1: str
    linea2: Optional[str] = None
    ciudad: str
    provincia: Optional[str] = None
    codigo_postal: Optional[str] = None
    es_principal: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
