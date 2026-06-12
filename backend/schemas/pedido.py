from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from ..models.estado_pedido import EstadoPedidoCodigo
from .lookups import EstadoPedidoRead, FormaPagoRead
from .direccion import DireccionRead


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
    motivo: Optional[str] = Field(default=None, max_length=500)


class CancelarPedido(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=500)


class DetallePedidoRead(BaseModel):
    id: int
    producto_id: int
    nombre_snapshot: str
    precio_snapshot: float
    cantidad: int
    subtotal_snap: float
    personalizacion: Optional[List[int]] = None
    model_config = ConfigDict(from_attributes=True)


class HistorialEstadoPedidoRead(BaseModel):
    id: int
    estado_desde: Optional[EstadoPedidoRead] = None
    estado_hacia: Optional[EstadoPedidoRead] = None
    created_at: datetime
    usuario_id: Optional[int] = None
    motivo: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PedidoRead(BaseModel):
    id: int
    usuario_id: int
    estado: EstadoPedidoRead
    forma_pago: FormaPagoRead
    subtotal: float
    descuento: float
    costo_envio: float
    total: float
    notas: Optional[str] = None
    direccion: Optional[DireccionRead] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PedidoReadFull(PedidoRead):
    detalles: List[DetallePedidoRead] = []
    historial: List[HistorialEstadoPedidoRead] = []
