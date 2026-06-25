"""
Correr desde la raíz del proyecto:
    backend/.venv/bin/python -m backend.seed_productos
"""
from sqlmodel import Session, select
from .database import engine
from .models import (
    Categoria, Ingrediente, Producto,
    ProductoCategoria, ProductoIngrediente, UnidadMedida,
)


def get_um(session: Session, simbolo: str) -> UnidadMedida:
    return session.exec(select(UnidadMedida).where(UnidadMedida.simbolo == simbolo)).one()


def upsert_categoria(session: Session, nombre: str, parent_id=None) -> Categoria:
    cat = session.exec(select(Categoria).where(Categoria.nombre == nombre)).first()
    if not cat:
        cat = Categoria(nombre=nombre, parent_id=parent_id)
        session.add(cat)
        session.flush()
    return cat


def upsert_ingrediente(session: Session, nombre: str, stock: int, simbolo: str, es_alergeno=False) -> Ingrediente:
    ing = session.exec(select(Ingrediente).where(Ingrediente.nombre == nombre)).first()
    if not ing:
        um = get_um(session, simbolo)
        ing = Ingrediente(nombre=nombre, stock_cantidad=stock, unidad_medida_id=um.id, es_alergeno=es_alergeno)
        session.add(ing)
        session.flush()
    return ing


def upsert_producto(session: Session, nombre: str, precio: float, descripcion: str, cat_ids: list[int]) -> Producto:
    prod = session.exec(select(Producto).where(Producto.nombre == nombre)).first()
    if not prod:
        prod = Producto(nombre=nombre, precio_base=precio, descripcion=descripcion, disponible=True)
        session.add(prod)
        session.flush()
        for i, cid in enumerate(cat_ids):
            session.add(ProductoCategoria(producto_id=prod.id, categoria_id=cid, es_principal=(i == 0)))
        session.flush()
    return prod


def link_ingrediente(session: Session, prod_id: int, ing_id: int, cantidad: float, simbolo: str, removible=False):
    exists = session.exec(
        select(ProductoIngrediente)
        .where(ProductoIngrediente.producto_id == prod_id)
        .where(ProductoIngrediente.ingrediente_id == ing_id)
    ).first()
    if not exists:
        um = get_um(session, simbolo)
        session.add(ProductoIngrediente(
            producto_id=prod_id, ingrediente_id=ing_id,
            cantidad=cantidad, unidad_medida_id=um.id, es_removible=removible,
        ))


def seed():
    with Session(engine) as session:
        # ── Categorías ────────────────────────────────────────────────────────
        hamburguesas = upsert_categoria(session, "Hamburguesas")
        pizzas       = upsert_categoria(session, "Pizzas")
        bebidas      = upsert_categoria(session, "Bebidas")
        postres      = upsert_categoria(session, "Postres")
        clasicas     = upsert_categoria(session, "Clásicas",   parent_id=hamburguesas.id)
        especiales   = upsert_categoria(session, "Especiales", parent_id=hamburguesas.id)
        gaseosas     = upsert_categoria(session, "Gaseosas",   parent_id=bebidas.id)
        jugos        = upsert_categoria(session, "Jugos",      parent_id=bebidas.id)

        # ── Ingredientes ──────────────────────────────────────────────────────
        pan      = upsert_ingrediente(session, "Pan de hamburguesa", 100,   "ud")
        carne    = upsert_ingrediente(session, "Carne vacuna",       15000, "g")
        lechuga  = upsert_ingrediente(session, "Lechuga",            5000,  "g",  es_alergeno=False)
        tomate   = upsert_ingrediente(session, "Tomate",             5000,  "g")
        cebolla  = upsert_ingrediente(session, "Cebolla",            3000,  "g")
        cheddar  = upsert_ingrediente(session, "Queso cheddar",      3000,  "g",  es_alergeno=True)
        bacon    = upsert_ingrediente(session, "Bacon",              2000,  "g")
        pepino   = upsert_ingrediente(session, "Pepino",             2000,  "g")
        salsa_e  = upsert_ingrediente(session, "Salsa especial",     2000,  "g")
        huevo    = upsert_ingrediente(session, "Huevo",              50,    "ud", es_alergeno=True)

        masa_p   = upsert_ingrediente(session, "Masa de pizza",      30,    "ud")
        s_tomate = upsert_ingrediente(session, "Salsa de tomate",    5000,  "g")
        mozza    = upsert_ingrediente(session, "Mozzarella",         4000,  "g",  es_alergeno=True)
        jamon    = upsert_ingrediente(session, "Jamón",              3000,  "g")
        pimiento = upsert_ingrediente(session, "Pimiento",           2000,  "g")
        aceituna = upsert_ingrediente(session, "Aceitunas",          1000,  "g")

        coca     = upsert_ingrediente(session, "Coca Cola 500ml",    60,    "ud")
        sprite   = upsert_ingrediente(session, "Sprite 500ml",       40,    "ud")
        agua_i   = upsert_ingrediente(session, "Agua mineral",       60,    "ud")
        j_naran  = upsert_ingrediente(session, "Jugo de naranja",    10000, "ml")

        brownie  = upsert_ingrediente(session, "Brownie",            30,    "ud")
        helado   = upsert_ingrediente(session, "Helado",             5000,  "g",  es_alergeno=True)
        chocolate= upsert_ingrediente(session, "Chocolate",          2000,  "g",  es_alergeno=True)

        # ── Productos ─────────────────────────────────────────────────────────
        # Hamburguesas
        h_clasica = upsert_producto(session, "Hamburguesa Clásica", 850,
            "Carne vacuna, lechuga, tomate y cebolla en pan artesanal.",
            [clasicas.id, hamburguesas.id])
        link_ingrediente(session, h_clasica.id, pan.id,    1,   "ud")
        link_ingrediente(session, h_clasica.id, carne.id,  150, "g")
        link_ingrediente(session, h_clasica.id, lechuga.id,30,  "g",  removible=True)
        link_ingrediente(session, h_clasica.id, tomate.id, 40,  "g",  removible=True)
        link_ingrediente(session, h_clasica.id, cebolla.id,30,  "g",  removible=True)

        h_bbq = upsert_producto(session, "Hamburguesa BBQ", 1100,
            "Carne, bacon crocante, cheddar y salsa BBQ especial.",
            [especiales.id, hamburguesas.id])
        link_ingrediente(session, h_bbq.id, pan.id,    1,   "ud")
        link_ingrediente(session, h_bbq.id, carne.id,  150, "g")
        link_ingrediente(session, h_bbq.id, bacon.id,  60,  "g",  removible=True)
        link_ingrediente(session, h_bbq.id, cheddar.id,40,  "g",  removible=True)
        link_ingrediente(session, h_bbq.id, salsa_e.id,30,  "g",  removible=True)

        h_doble = upsert_producto(session, "Hamburguesa Doble", 1350,
            "Doble carne, doble cheddar, lechuga y tomate.",
            [especiales.id, hamburguesas.id])
        link_ingrediente(session, h_doble.id, pan.id,    1,   "ud")
        link_ingrediente(session, h_doble.id, carne.id,  300, "g")
        link_ingrediente(session, h_doble.id, cheddar.id,80,  "g",  removible=True)
        link_ingrediente(session, h_doble.id, lechuga.id,30,  "g",  removible=True)
        link_ingrediente(session, h_doble.id, tomate.id, 40,  "g",  removible=True)

        h_huevo = upsert_producto(session, "Hamburguesa con Huevo", 1000,
            "Clásica con huevo frito, cheddar y pepino.",
            [especiales.id, hamburguesas.id])
        link_ingrediente(session, h_huevo.id, pan.id,    1,   "ud")
        link_ingrediente(session, h_huevo.id, carne.id,  150, "g")
        link_ingrediente(session, h_huevo.id, huevo.id,  1,   "ud")
        link_ingrediente(session, h_huevo.id, cheddar.id,40,  "g",  removible=True)
        link_ingrediente(session, h_huevo.id, pepino.id, 30,  "g",  removible=True)

        # Pizzas
        p_mozza = upsert_producto(session, "Pizza Mozzarella", 1200,
            "Salsa de tomate y abundante mozzarella.",
            [pizzas.id])
        link_ingrediente(session, p_mozza.id, masa_p.id,  1,   "ud")
        link_ingrediente(session, p_mozza.id, s_tomate.id,100, "g")
        link_ingrediente(session, p_mozza.id, mozza.id,   200, "g")

        p_jamon = upsert_producto(session, "Pizza Jamón y Queso", 1450,
            "Mozzarella, jamón cocido y salsa de tomate.",
            [pizzas.id])
        link_ingrediente(session, p_jamon.id, masa_p.id,  1,   "ud")
        link_ingrediente(session, p_jamon.id, s_tomate.id,100, "g")
        link_ingrediente(session, p_jamon.id, mozza.id,   150, "g")
        link_ingrediente(session, p_jamon.id, jamon.id,   100, "g",  removible=True)

        p_esp = upsert_producto(session, "Pizza Especial", 1700,
            "Jamón, pimiento, aceitunas y mozzarella.",
            [pizzas.id])
        link_ingrediente(session, p_esp.id, masa_p.id,  1,   "ud")
        link_ingrediente(session, p_esp.id, s_tomate.id,100, "g")
        link_ingrediente(session, p_esp.id, mozza.id,   150, "g")
        link_ingrediente(session, p_esp.id, jamon.id,   80,  "g",  removible=True)
        link_ingrediente(session, p_esp.id, pimiento.id,60,  "g",  removible=True)
        link_ingrediente(session, p_esp.id, aceituna.id,40,  "g",  removible=True)

        # Bebidas
        b_coca = upsert_producto(session, "Coca Cola 500ml", 400, "Coca Cola fría.", [gaseosas.id, bebidas.id])
        link_ingrediente(session, b_coca.id, coca.id, 1, "ud")

        b_sprite = upsert_producto(session, "Sprite 500ml", 400, "Sprite fría.", [gaseosas.id, bebidas.id])
        link_ingrediente(session, b_sprite.id, sprite.id, 1, "ud")

        b_agua = upsert_producto(session, "Agua Mineral", 300, "Agua mineral sin gas.", [bebidas.id])
        link_ingrediente(session, b_agua.id, agua_i.id, 1, "ud")

        b_jugo = upsert_producto(session, "Jugo de Naranja", 550, "Jugo exprimido natural.", [jugos.id, bebidas.id])
        link_ingrediente(session, b_jugo.id, j_naran.id, 300, "ml")

        # Postres
        pos_brownie = upsert_producto(session, "Brownie con Helado", 850,
            "Brownie tibio con helado de vainilla y salsa de chocolate.",
            [postres.id])
        link_ingrediente(session, pos_brownie.id, brownie.id,  1,  "ud")
        link_ingrediente(session, pos_brownie.id, helado.id,   100,"g",  removible=True)
        link_ingrediente(session, pos_brownie.id, chocolate.id,30, "g",  removible=True)

        session.commit()
        print("✔ Seed de productos completado.")
        print(f"  Categorías: 8  |  Ingredientes: 23  |  Productos: 11")


if __name__ == "__main__":
    seed()
