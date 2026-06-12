from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Integer as SAInteger, Column, Numeric
from .estado_pedido import (
    EstadoPedido,
    EstadoPedidoCodigo,
    ALLOWED_TRANSITIONS,
    TERMINAL_STATES,
)
from .forma_pago import FormaPago
from .direccion import DireccionEntrega


class Pedido(SQLModel, table=True):
    __tablename__ = "pedido"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuario.id", index=True)
    estado_id: int = Field(foreign_key="estado_pedido.id", index=True)
    forma_pago_id: int = Field(foreign_key="forma_pago.id")
    direccion_id: Optional[int] = Field(
        default=None, foreign_key="direccion_entrega.id"
    )
    subtotal: float = Field(ge=0)
    descuento: float = Field(default=0.0, ge=0)
    costo_envio: float = Field(default=50.0, ge=0)
    total: float = Field(ge=0)
    notas: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    estado: Optional[EstadoPedido] = Relationship()
    forma_pago: Optional[FormaPago] = Relationship()
    direccion: Optional[DireccionEntrega] = Relationship()
    detalles: List["DetallePedido"] = Relationship(
        back_populates="pedido",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    historial: List["HistorialEstadoPedido"] = Relationship(
        back_populates="pedido",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DetallePedido(SQLModel, table=True):
    __tablename__ = "detalle_pedido"
    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedido.id", index=True)
    producto_id: int = Field(foreign_key="producto.id")
    nombre_snapshot: str = Field(max_length=200)
    precio_snapshot: float = Field(ge=0)
    cantidad: int = Field(gt=0)
    subtotal_snap: float = Field(ge=0)
    personalizacion: Optional[List[int]] = Field(
        default=None,
        sa_column=Column(ARRAY(SAInteger), nullable=True),
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pedido: Optional[Pedido] = Relationship(back_populates="detalles")


class HistorialEstadoPedido(SQLModel, table=True):
    __tablename__ = "historial_estado_pedido"
    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedido.id", index=True)
    estado_desde_id: Optional[int] = Field(
        default=None, foreign_key="estado_pedido.id"
    )
    estado_hacia_id: int = Field(foreign_key="estado_pedido.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id")
    motivo: Optional[str] = Field(default=None, max_length=500)
    pedido: Optional[Pedido] = Relationship(back_populates="historial")
    estado_desde: Optional[EstadoPedido] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[HistorialEstadoPedido.estado_desde_id]"
        }
    )
    estado_hacia: Optional[EstadoPedido] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[HistorialEstadoPedido.estado_hacia_id]"
        }
    )


class Pago(SQLModel, table=True):
    __tablename__ = "pago"
    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(foreign_key="pedido.id", index=True)
    mp_payment_id: Optional[int] = Field(default=None, unique=True)
    mp_preference_id: Optional[str] = Field(default=None, max_length=100)
    mp_status: str = Field(max_length=30)
    mp_status_detail: Optional[str] = Field(default=None, max_length=100)
    transaction_amount: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    payment_method_id: Optional[str] = Field(default=None, max_length=50)
    external_reference: str = Field(max_length=100, unique=True)
    idempotency_key: str = Field(max_length=100, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
