from pydantic import BaseModel, ConfigDict


class EstadoPedidoRead(BaseModel):
    id: int
    codigo: str
    nombre: str
    orden: int
    model_config = ConfigDict(from_attributes=True)


class FormaPagoRead(BaseModel):
    id: int
    codigo: str
    nombre: str
    model_config = ConfigDict(from_attributes=True)
