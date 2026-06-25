from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class DireccionEntrega(SQLModel, table=True):
    __tablename__ = "direccion_entrega"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuario.id", index=True)
    alias: Optional[str] = Field(default=None, max_length=50)
    linea1: str = Field(max_length=500)
    linea2: Optional[str] = Field(default=None, max_length=500)
    ciudad: str = Field(max_length=100)
    provincia: Optional[str] = Field(default=None, max_length=100)
    codigo_postal: Optional[str] = Field(default=None, max_length=10)
    es_principal: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
