from pydantic import BaseModel, ConfigDict


class EstadoPedidoRead(BaseModel):
    id: int
    codigo: str
    descripcion: str
    orden: int
    es_terminal: bool
    model_config = ConfigDict(from_attributes=True)


class FormaPagoRead(BaseModel):
    id: int
    codigo: str
    descripcion: str
    habilitado: bool
    model_config = ConfigDict(from_attributes=True)


class UnidadMedidaRead(BaseModel):
    id: int
    nombre: str
    simbolo: str
    tipo: str
    model_config = ConfigDict(from_attributes=True)
