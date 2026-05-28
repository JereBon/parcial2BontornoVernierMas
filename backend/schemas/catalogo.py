from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=80)
    descripcion: Optional[str] = Field(default=None, max_length=200)
    parent_id: Optional[int] = None


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)
    descripcion: Optional[str] = Field(default=None, max_length=200)
    parent_id: Optional[int] = None


class CategoriaRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class CategoriaTreeNode(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    parent_id: Optional[int] = None
    children: List["CategoriaTreeNode"] = []
    model_config = ConfigDict(from_attributes=True)


CategoriaTreeNode.model_rebuild()


class IngredienteCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=80)


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=80)


class IngredienteRead(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class ProductoIngredienteInput(BaseModel):
    ingrediente_id: int = Field(..., ge=1)
    es_alergeno: bool = False


class ProductoIngredienteRead(BaseModel):
    id: int
    nombre: str
    es_alergeno: bool = False
    model_config = ConfigDict(from_attributes=True)


class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    precio: float = Field(..., gt=0)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    stock_cantidad: int = Field(default=0, ge=0)
    disponible: bool = True
    categorias_ids: List[int] = []
    ingredientes: List[ProductoIngredienteInput] = []


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=120)
    precio: Optional[float] = Field(default=None, gt=0)
    descripcion: Optional[str] = Field(default=None, max_length=500)
    stock_cantidad: Optional[int] = Field(default=None, ge=0)
    disponible: Optional[bool] = None
    categorias_ids: Optional[List[int]] = None
    ingredientes: Optional[List[ProductoIngredienteInput]] = None


class ProductoDisponibilidadUpdate(BaseModel):
    disponible: Optional[bool] = None
    stock_cantidad: Optional[int] = Field(default=None, ge=0)


class ProductoRead(BaseModel):
    id: int
    nombre: str
    precio: float
    descripcion: Optional[str] = None
    stock_cantidad: int
    disponible: bool
    model_config = ConfigDict(from_attributes=True)


class ProductoReadFull(BaseModel):
    id: int
    nombre: str
    precio: float
    descripcion: Optional[str] = None
    stock_cantidad: int
    disponible: bool
    categorias: List[CategoriaRead] = []
    ingredientes: List[ProductoIngredienteRead] = []
    model_config = ConfigDict(from_attributes=True)
