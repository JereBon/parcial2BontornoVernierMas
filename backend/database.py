from sqlmodel import SQLModel, create_engine, Session
from .core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=True)


def init_db() -> None:
    from .models import (
        Rol,
        UsuarioRol,
        Usuario,
        EstadoPedido,
        FormaPago,
        DireccionEntrega,
        Categoria,
        Ingrediente,
        Producto,
        ProductoCategoria,
        ProductoIngrediente,
        Pedido,
        DetallePedido,
        HistorialEstadoPedido,
    )

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
