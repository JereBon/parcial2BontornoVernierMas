"""
Carga datos de demo para la presentacion.
Correr DESPUES de que uvicorn haya creado las tablas:

    python -m backend.seed_demo
"""
from sqlmodel import Session, select
from .database import engine
from .models import (
    Rol, UsuarioRol, Usuario,
    Categoria, Ingrediente, Producto,
    ProductoCategoria, ProductoIngrediente,
)
from .models.rol import RolCodigo
from .core.security import hash_password


# ── Datos ────────────────────────────────────────────────────────────────────

CATEGORIAS = [
    # (nombre, descripcion, parent_nombre)
    ("Comidas",       "Platos y porciones",      None),
    ("Pizzas",        "Pizzas artesanales",       "Comidas"),
    ("Hamburguesas",  "Burgers y combos",         "Comidas"),
    ("Bebidas",       "Todo para tomar",          None),
    ("Gaseosas",      "Refrescos y sodas",        "Bebidas"),
    ("Cervezas",      "Birras nacionales e importadas", "Bebidas"),
]

INGREDIENTES = [
    "Harina 000",
    "Queso mozzarella",
    "Salsa de tomate",
    "Carne vacuna",
    "Pan de hamburguesa",
    "Lechuga",
    "Tomate",
    "Cebolla",
    "Morrones",
    "Jamon",
]

PRODUCTOS = [
    # (nombre, precio, stock, descripcion, categorias[], ingredientes[])
    (
        "Pizza Margherita",
        1500.0, 10,
        "Clasica con tomate y mozzarella",
        ["Pizzas"],
        ["Harina 000", "Queso mozzarella", "Salsa de tomate"],
    ),
    (
        "Pizza Napolitana",
        1650.0, 8,
        "Margherita con tomate en rodajas y ajo",
        ["Pizzas"],
        ["Harina 000", "Queso mozzarella", "Salsa de tomate", "Tomate"],
    ),
    (
        "Pizza Especial",
        1800.0, 6,
        "Con jamon, morrones y aceitunas",
        ["Pizzas"],
        ["Harina 000", "Queso mozzarella", "Salsa de tomate", "Jamon", "Morrones"],
    ),
    (
        "Hamburguesa Clasica",
        1200.0, 15,
        "Medallón de carne, lechuga, tomate y cebolla",
        ["Hamburguesas"],
        ["Carne vacuna", "Pan de hamburguesa", "Lechuga", "Tomate", "Cebolla"],
    ),
    (
        "Hamburguesa Doble",
        1600.0, 10,
        "Doble medallón con queso",
        ["Hamburguesas"],
        ["Carne vacuna", "Pan de hamburguesa", "Queso mozzarella", "Lechuga", "Tomate"],
    ),
    (
        "Coca-Cola 500ml",
        500.0, 50,
        "Gaseosa fria",
        ["Gaseosas"],
        [],
    ),
    (
        "Sprite 500ml",
        500.0, 40,
        "Gaseosa limon",
        ["Gaseosas"],
        [],
    ),
    (
        "Cerveza Quilmes 500ml",
        700.0, 30,
        "Rubia nacional",
        ["Cervezas"],
        [],
    ),
]

CLIENTE = {
    "email": "cliente@test.com",
    "nombre": "Cliente Test",
    "password": "cliente123",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_categoria(session: Session, nombre: str, parent_id: int | None) -> Categoria:
    existing = session.exec(
        select(Categoria).where(Categoria.nombre == nombre, Categoria.deleted_at == None)
    ).first()
    if existing:
        return existing
    cat = Categoria(nombre=nombre, parent_id=parent_id)
    session.add(cat)
    session.flush()
    return cat


def _get_or_create_ingrediente(session: Session, nombre: str) -> Ingrediente:
    existing = session.exec(
        select(Ingrediente).where(Ingrediente.nombre == nombre, Ingrediente.deleted_at == None)
    ).first()
    if existing:
        return existing
    ing = Ingrediente(nombre=nombre)
    session.add(ing)
    session.flush()
    return ing


def _link_exists(session: Session, model, **kwargs) -> bool:
    stmt = select(model)
    for k, v in kwargs.items():
        stmt = stmt.where(getattr(model, k) == v)
    return session.exec(stmt).first() is not None


# ── Main ──────────────────────────────────────────────────────────────────────

def seed_demo() -> None:
    with Session(engine) as session:
        print("Cargando categorias...")
        cat_map: dict[str, Categoria] = {}
        for nombre, descripcion, parent_nombre in CATEGORIAS:
            parent_id = cat_map[parent_nombre].id if parent_nombre else None
            cat = _get_or_create_categoria(session, nombre, parent_id)
            cat.descripcion = descripcion
            cat_map[nombre] = cat
        session.flush()

        print("Cargando ingredientes...")
        ing_map: dict[str, Ingrediente] = {}
        for nombre in INGREDIENTES:
            ing_map[nombre] = _get_or_create_ingrediente(session, nombre)
        session.flush()

        print("Cargando productos...")
        for nombre, precio, stock, descripcion, cats, ings in PRODUCTOS:
            prod = session.exec(
                select(Producto).where(Producto.nombre == nombre, Producto.deleted_at == None)
            ).first()
            if not prod:
                prod = Producto(
                    nombre=nombre,
                    precio=precio,
                    stock_cantidad=stock,
                    disponible=True,
                    descripcion=descripcion,
                )
                session.add(prod)
                session.flush()

            for cat_nombre in cats:
                cat = cat_map[cat_nombre]
                if not _link_exists(session, ProductoCategoria, producto_id=prod.id, categoria_id=cat.id):
                    session.add(ProductoCategoria(producto_id=prod.id, categoria_id=cat.id))

            for ing_nombre in ings:
                ing = ing_map[ing_nombre]
                if not _link_exists(session, ProductoIngrediente, producto_id=prod.id, ingrediente_id=ing.id):
                    session.add(ProductoIngrediente(producto_id=prod.id, ingrediente_id=ing.id, es_alergeno=False))

        session.flush()

        print("Cargando cliente de prueba...")
        existing = session.exec(select(Usuario).where(Usuario.email == CLIENTE["email"])).first()
        if not existing:
            user = Usuario(
                email=CLIENTE["email"],
                nombre=CLIENTE["nombre"],
                password_hash=hash_password(CLIENTE["password"]),
            )
            session.add(user)
            session.flush()
            rol_client = session.exec(select(Rol).where(Rol.codigo == RolCodigo.CLIENT.value)).first()
            if rol_client:
                session.add(UsuarioRol(usuario_id=user.id, rol_id=rol_client.id))
            session.flush()

        session.commit()
        print("Demo cargado correctamente.")
        print(f"  Cliente: {CLIENTE['email']} / {CLIENTE['password']}")
        print(f"  Admin:   admin@admin.com / admin12345")


if __name__ == "__main__":
    seed_demo()
