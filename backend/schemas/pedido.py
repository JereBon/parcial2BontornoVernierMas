from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from ..models.estado_pedido import EstadoPedidoCodigo
from .lookups import EstadoPedidoRead, FormaPagoRead


class PedidoItemCreate(BaseModel):
    producto_id: int = Field(..., ge=1)
    cantidad: int = Field(..., ge=1, le=999)


class PedidoCreate(BaseModel):
    direccion_id: int = Field(..., ge=1)
    forma_pago_id: int = Field(..., ge=1)
    notas: Optional[str] = Field(default=None, max_length=500)
    items: List[PedidoItemCreate] = Field(..., min_length=1)


class EstadoUpdate(BaseModel):
    estado: EstadoPedidoCodigo
    nota: Optional[str] = Field(default=None, max_length=255)


class CancelarPedido(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=255)


class DetallePedidoRead(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    producto_precio: float
    cantidad: int
    subtotal: float
    model_config = ConfigDict(from_attributes=True)


class HistorialEstadoPedidoRead(BaseModel):
    id: int
    estado_anterior: Optional[EstadoPedidoRead] = None
    estado_nuevo: EstadoPedidoRead
    changed_at: datetime
    changed_by_id: Optional[int] = None
    nota: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PedidoRead(BaseModel):
    id: int
    usuario_id: int
    estado: EstadoPedidoRead
    forma_pago: FormaPagoRead
    total: float
    direccion_snapshot: str
    notas: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PedidoReadFull(PedidoRead):
    detalles: List[DetallePedidoRead] = []
    historial: List[HistorialEstadoPedidoRead] = []
