from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, ForeignKey, Integer
from typing import List, Optional
from datetime import datetime
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


class ProductoCategoria(SQLModel, table=True):
    __tablename__ = "producto_categoria"
    producto_id: int = Field(foreign_key="producto.id", primary_key=True)
    categoria_id: int = Field(foreign_key="categoria.id", primary_key=True)


class ProductoIngrediente(SQLModel, table=True):
    __tablename__ = "producto_ingrediente"
    producto_id: int = Field(foreign_key="producto.id", primary_key=True)
    ingrediente_id: int = Field(foreign_key="ingrediente.id", primary_key=True)
    es_alergeno: bool = Field(default=False)


class Categoria(SQLModel, table=True):
    __tablename__ = "categoria"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True, max_length=80)
    descripcion: Optional[str] = Field(default=None, max_length=200)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("categoria.id"), nullable=True),
    )
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
    nombre: str = Field(index=True, max_length=80)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    productos: List["Producto"] = Relationship(
        back_populates="ingredientes", link_model=ProductoIngrediente
    )


class Producto(SQLModel, table=True):
    __tablename__ = "producto"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True, max_length=120)
    precio: float
    descripcion: Optional[str] = Field(default=None, max_length=500)
    stock_cantidad: int = Field(default=0, ge=0)
    disponible: bool = Field(default=True, index=True)
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
    categorias: List[Categoria] = Relationship(
        back_populates="productos", link_model=ProductoCategoria
    )
    ingredientes: List[Ingrediente] = Relationship(
        back_populates="productos", link_model=ProductoIngrediente
    )


from .pedido import Pedido, DetallePedido, HistorialEstadoPedido
