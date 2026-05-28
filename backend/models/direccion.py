from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class DireccionEntrega(SQLModel, table=True):
    __tablename__ = "direccion_entrega"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuario.id", index=True)
    alias: str = Field(max_length=40)
    calle: str = Field(max_length=120)
    numero: str = Field(max_length=20)
    ciudad: str = Field(max_length=80)
    codigo_postal: Optional[str] = Field(default=None, max_length=20)
    detalles: Optional[str] = Field(default=None, max_length=255)
    principal: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)

    def to_snapshot(self) -> str:
        parts = [self.alias, f"{self.calle} {self.numero}", self.ciudad]
        if self.codigo_postal:
            parts.append(f"CP {self.codigo_postal}")
        if self.detalles:
            parts.append(self.detalles)
        return " — ".join(parts)
