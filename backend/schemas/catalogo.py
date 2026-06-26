from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from .lookups import UnidadMedidaRead


class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None)
    imagen_url: Optional[str] = Field(default=None)
    parent_id: Optional[int] = None


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None)
    imagen_url: Optional[str] = Field(default=None)
    parent_id: Optional[int] = None


class CategoriaRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    parent_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class CategoriaTreeNode(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    imagen_url: Optional[str] = None
    parent_id: Optional[int] = None
    children: List["CategoriaTreeNode"] = []
    model_config = ConfigDict(from_attributes=True)


CategoriaTreeNode.model_rebuild()


class IngredienteCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None)
    es_alergeno: bool = False
    stock_cantidad: int = Field(default=0, ge=0)
    unidad_medida_id: int = Field(..., ge=1)
    # Precio-costo por unidad canónica (kg / L / unidad).
    precio_costo: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=2)


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    descripcion: Optional[str] = Field(default=None)
    es_alergeno: Optional[bool] = None
    stock_cantidad: Optional[int] = Field(default=None, ge=0)
    unidad_medida_id: Optional[int] = Field(default=None, ge=1)
    precio_costo: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)


class IngredienteStockUpdate(BaseModel):
    stock_cantidad: int = Field(..., ge=0)


class IngredienteRead(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    es_alergeno: bool
    stock_cantidad: int
    precio_costo: Decimal = Decimal("0")
    unidad_medida: Optional[UnidadMedidaRead] = None
    model_config = ConfigDict(from_attributes=True)


class ProductoIngredienteInput(BaseModel):
    ingrediente_id: int = Field(..., ge=1)
    cantidad: Decimal = Field(..., gt=0, decimal_places=3)
    unidad_medida_id: int = Field(..., ge=1)
    es_removible: bool = False


class ProductoIngredienteRead(BaseModel):
    ingrediente_id: int
    ingrediente: Optional[IngredienteRead] = None
    cantidad: Decimal
    unidad_medida_id: int
    unidad_medida: Optional[UnidadMedidaRead] = None
    es_removible: bool
    model_config = ConfigDict(from_attributes=True)


class ProductoCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    # precio_base es ignorado en el input: se calcula desde el costo de
    # insumos y el margen. Se acepta por compatibilidad pero no se usa.
    precio_base: Optional[float] = Field(default=None, ge=0)
    # Margen de ganancia (%) del producto.
    margen_ganancia: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=2)
    descripcion: Optional[str] = Field(default=None)
    imagenes_url: Optional[List[str]] = Field(default=None)
    disponible: bool = True
    unidad_venta_id: Optional[int] = Field(default=None, ge=1)
    categorias_ids: List[int] = []
    ingredientes: List[ProductoIngredienteInput] = Field(..., min_length=1)


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    precio_base: Optional[float] = Field(default=None, ge=0)
    margen_ganancia: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    descripcion: Optional[str] = Field(default=None)
    imagenes_url: Optional[List[str]] = Field(default=None)
    disponible: Optional[bool] = None
    unidad_venta_id: Optional[int] = Field(default=None, ge=1)
    categorias_ids: Optional[List[int]] = None
    ingredientes: Optional[List[ProductoIngredienteInput]] = Field(
        default=None, min_length=1
    )


class ProductoDisponibilidadUpdate(BaseModel):
    disponible: Optional[bool] = None


class ProductoStockUpdate(BaseModel):
    stock_cantidad: int = Field(..., ge=0)


class ProductoRead(BaseModel):
    id: int
    nombre: str
    precio_base: float
    margen_ganancia: Decimal = Decimal("0")
    descripcion: Optional[str] = None
    imagenes_url: Optional[List[str]] = None
    disponible: bool
    stock_cantidad: int = 0
    stock_disponible: int = 0
    unidad_venta: Optional[UnidadMedidaRead] = None
    model_config = ConfigDict(from_attributes=True)


class ProductoReadFull(ProductoRead):
    # Costo total calculado a partir de los insumos (solo lectura).
    costo_total: Decimal = Decimal("0")
    categorias: List[CategoriaRead] = []
    producto_ingredientes: List[ProductoIngredienteRead] = []
    model_config = ConfigDict(from_attributes=True)
