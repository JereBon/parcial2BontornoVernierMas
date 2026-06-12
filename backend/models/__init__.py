from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import ARRAY
from .rol import Rol, UsuarioRol, RolCodigo
from .estado_pedido import (
    EstadoPedido,
    EstadoPedidoCodigo,
    ALLOWED_TRANSITIONS,
    TERMINAL_STATES,
)
from .forma_pago import FormaPago, FormaPagoCodigo
from .direccion import DireccionEntrega
from .usuario import Usuario


class UnidadMedida(SQLModel, table=True):
    __tablename__ = "unidad_medida"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, unique=True)
    simbolo: str = Field(max_length=10, unique=True)
    tipo: str = Field(max_length=20)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductoCategoria(SQLModel, table=True):
    __tablename__ = "producto_categoria"
    producto_id: int = Field(foreign_key="producto.id", primary_key=True)
    categoria_id: int = Field(foreign_key="categoria.id", primary_key=True)
    es_principal: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductoIngrediente(SQLModel, table=True):
    __tablename__ = "producto_ingrediente"
    producto_id: int = Field(foreign_key="producto.id", primary_key=True)
    ingrediente_id: int = Field(foreign_key="ingrediente.id", primary_key=True)
    cantidad: Decimal = Field(sa_column=Column(Numeric(10, 3), nullable=False))
    unidad_medida_id: int = Field(foreign_key="unidad_medida.id")
    es_removible: bool = Field(default=False)
    ingrediente: Optional["Ingrediente"] = Relationship()
    unidad_medida: Optional["UnidadMedida"] = Relationship()


class Categoria(SQLModel, table=True):
    __tablename__ = "categoria"
    id: Optional[int] = Field(default=None, primary_key=True)
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("categoria.id"), nullable=True),
    )
    nombre: str = Field(index=True, max_length=100, unique=True)
    descripcion: Optional[str] = Field(default=None)
    imagen_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    parent: Optional["Categoria"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Categoria.id"},
    )
    children: List["Categoria"] = Relationship(back_populates="parent")
    productos: List["Producto"] = Relationship(
        back_populates="categorias", link_model=ProductoCategoria
    )


class Ingrediente(SQLModel, table=True):
    __tablename__ = "ingrediente"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True, max_length=100, unique=True)
    stock_cantidad: int = Field(default=0, ge=0)
    unidad_medida_id: Optional[int] = Field(default=None, foreign_key="unidad_medida.id")
    descripcion: Optional[str] = Field(default=None)
    es_alergeno: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    unidad_medida: Optional["UnidadMedida"] = Relationship()


class Producto(SQLModel, table=True):
    __tablename__ = "producto"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True, max_length=150)
    precio_base: float = Field(ge=0)
    descripcion: Optional[str] = Field(default=None)
    imagenes_url: Optional[List[str]] = Field(
        default=None,
        sa_column=Column(ARRAY(Text), nullable=True),
    )
    disponible: bool = Field(default=True, index=True)
    unidad_venta_id: Optional[int] = Field(default=None, foreign_key="unidad_medida.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    categorias: List[Categoria] = Relationship(
        back_populates="productos", link_model=ProductoCategoria
    )
    producto_ingredientes: List[ProductoIngrediente] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    unidad_venta: Optional[UnidadMedida] = Relationship()


from .pedido import Pedido, DetallePedido, HistorialEstadoPedido
