from sqlmodel import Session, select
from ..models import (
    Rol,
    UsuarioRol,
    Usuario,
    EstadoPedido,
    EstadoPedidoCodigo,
    FormaPago,
    FormaPagoCodigo,
    UnidadMedida,
    Categoria,
    Ingrediente,
    Producto,
    ProductoCategoria,
    ProductoIngrediente,
)
from ..models.rol import RolCodigo
from ..uow.unit_of_work import UnitOfWork
from .security import hash_password

ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASSWORD = "admin12345"

ROLES = [
    (RolCodigo.ADMIN.value, "Administrador"),
    (RolCodigo.STOCK.value, "Gestor de Stock"),
    (RolCodigo.PEDIDOS.value, "Gestor de Pedidos"),
    (RolCodigo.CLIENT.value, "Cliente"),
]

# (codigo, descripcion, orden, es_terminal)
ESTADOS = [
    (EstadoPedidoCodigo.PENDIENTE.value, "Pendiente", 1, False),
    (EstadoPedidoCodigo.CONFIRMADO.value, "Confirmado", 2, False),
    (EstadoPedidoCodigo.EN_PREP.value, "En preparacion", 3, False),
    (EstadoPedidoCodigo.ENTREGADO.value, "Entregado", 4, True),
    (EstadoPedidoCodigo.CANCELADO.value, "Cancelado", 5, True),
]

# (codigo, descripcion, habilitado)
FORMAS_PAGO = [
    (FormaPagoCodigo.MERCADOPAGO.value, "Mercado Pago", True),
    (FormaPagoCodigo.EFECTIVO.value, "Efectivo", True),
    (FormaPagoCodigo.TRANSFERENCIA.value, "Transferencia", True),
]

# (nombre, simbolo, tipo)
UNIDADES_MEDIDA = [
    ("Gramos", "g", "masa"),
    ("Kilogramos", "kg", "masa"),
    ("Mililitros", "ml", "volumen"),
    ("Litros", "L", "volumen"),
    ("Unidades", "ud", "contable"),
    ("Porciones", "porciones", "contable"),
]


def _upsert_lookup(session: Session, model, codigo: str, **fields):
    existing = session.exec(select(model).where(model.codigo == codigo)).first()
    if existing is None:
        session.add(model(codigo=codigo, **fields))
    else:
        for k, v in fields.items():
            setattr(existing, k, v)
        session.add(existing)


def _upsert_unidad_medida(session: Session, nombre: str, simbolo: str, tipo: str) -> None:
    existing = session.exec(
        select(UnidadMedida).where(UnidadMedida.nombre == nombre)
    ).first()
    if existing is None:
        session.add(UnidadMedida(nombre=nombre, simbolo=simbolo, tipo=tipo))


def seed_all(session: Session) -> None:
    with UnitOfWork(session) as uow:
        sess = uow.session
        for codigo, nombre in ROLES:
            _upsert_lookup(sess, Rol, codigo, nombre=nombre)
        for codigo, descripcion, orden, es_terminal in ESTADOS:
            _upsert_lookup(
                sess, EstadoPedido, codigo,
                descripcion=descripcion, orden=orden, es_terminal=es_terminal
            )
        for codigo, descripcion, habilitado in FORMAS_PAGO:
            _upsert_lookup(
                sess, FormaPago, codigo,
                descripcion=descripcion, habilitado=habilitado
            )
        for nombre, simbolo, tipo in UNIDADES_MEDIDA:
            _upsert_unidad_medida(sess, nombre, simbolo, tipo)
        sess.flush()
        admin = sess.exec(select(Usuario).where(Usuario.email == ADMIN_EMAIL)).first()
        if admin is None:
            admin = Usuario(
                email=ADMIN_EMAIL,
                nombre="Admin",
                apellido="Admin",
                password_hash=hash_password(ADMIN_PASSWORD),
            )
            sess.add(admin)
            sess.flush()
            rol_admin = sess.exec(
                select(Rol).where(Rol.codigo == RolCodigo.ADMIN.value)
            ).first()
            if rol_admin is not None:
                sess.add(UsuarioRol(usuario_id=admin.id, rol_id=rol_admin.id))
        else:
            # Siempre actualizar la contraseña para que coincida con la del seed
            admin.password_hash = hash_password(ADMIN_PASSWORD)

    # Productos y stocks — solo si la tabla está vacía (primera vez)
    with UnitOfWork(session) as uow:
        sess = uow.session
        if sess.exec(select(Producto)).first() is None:
            _seed_productos(sess)
            _patch_stocks(sess)


# Stocks realistas para un restaurante (unidades según el ingrediente):
# masas/panes: unidades; carnes/quesos/vegetales: gramos; líquidos: ml
_STOCKS_REALISTAS: dict[str, int] = {
    "Pan brioche":               500,    # 500 panes
    "Medallón de carne 200g":  20000,    # 100 medallones × 200 g
    "Medallón de carne 300g":  15000,    # 50 medallones × 300 g
    "Queso cheddar":            5000,
    "Lechuga":                  5000,
    "Tomate":                   5000,
    "Cebolla caramelizada":     3000,
    "Panceta ahumada":          3000,
    "Masa de pizza":             200,    # 200 bases
    "Salsa de tomate":         10000,    # 10 L
    "Queso mozzarella":         8000,
    "Pepperoni":                3000,
    "Jamón cocido":             4000,
    "Ananá en rodajas":         3000,
    "Coca-Cola 500ml":         50000,    # 100 botellas × 500 ml
    "Agua mineral 500ml":      60000,    # 120 botellas × 500 ml
    "Jugo de naranja":         20000,
    "Brownie de chocolate":      100,    # 100 unidades
    "Helado de vainilla":      10000,
    "Mix de verdes":            5000,
    "Aderezo césar":            5000,
    "Crutones":                 3000,
    "Pechuga de pollo grillada": 5000,
}


def _patch_stocks(sess: Session) -> None:
    for nombre, stock in _STOCKS_REALISTAS.items():
        ing = sess.exec(select(Ingrediente).where(Ingrediente.nombre == nombre)).first()
        if ing is not None:
            ing.stock_cantidad = stock
            sess.add(ing)


def _seed_productos(sess: Session) -> None:
    # ── unidades ──────────────────────────────────────────────────
    def um(simbolo: str) -> UnidadMedida:
        return sess.exec(select(UnidadMedida).where(UnidadMedida.simbolo == simbolo)).first()

    g   = um("g")
    ml  = um("ml")
    ud  = um("ud")

    # ── categorías ────────────────────────────────────────────────
    def cat(nombre: str, descripcion: str) -> Categoria:
        existing = sess.exec(select(Categoria).where(Categoria.nombre == nombre)).first()
        if existing:
            return existing
        c = Categoria(nombre=nombre, descripcion=descripcion)
        sess.add(c)
        sess.flush()
        return c

    hamburguesas = cat("Hamburguesas",  "Burgers artesanales con pan brioche")
    pizzas       = cat("Pizzas",        "Pizzas al horno de piedra")
    bebidas      = cat("Bebidas",       "Frías y calientes")
    postres      = cat("Postres",       "Para cerrar con dulzura")
    ensaladas    = cat("Ensaladas",     "Frescas y livianas")

    # ── ingredientes ──────────────────────────────────────────────
    def ing(nombre: str, unidad: UnidadMedida, stock: int = 100, alergeno: bool = False) -> Ingrediente:
        existing = sess.exec(select(Ingrediente).where(Ingrediente.nombre == nombre)).first()
        if existing:
            return existing
        i = Ingrediente(nombre=nombre, unidad_medida_id=unidad.id, stock_cantidad=stock, es_alergeno=alergeno)
        sess.add(i)
        sess.flush()
        return i

    pan_brioche      = ing("Pan brioche",              ud, stock=500,  alergeno=True)
    carne_200        = ing("Medallón de carne 200g",    g, stock=20000)
    carne_300        = ing("Medallón de carne 300g",    g, stock=15000)
    queso_cheddar    = ing("Queso cheddar",             g, stock=5000, alergeno=True)
    lechuga          = ing("Lechuga",                   g, stock=5000)
    tomate           = ing("Tomate",                    g, stock=5000)
    cebolla          = ing("Cebolla caramelizada",      g, stock=3000)
    panceta          = ing("Panceta ahumada",           g, stock=3000)
    masa_pizza       = ing("Masa de pizza",            ud, stock=200,  alergeno=True)
    salsa_tomate     = ing("Salsa de tomate",          ml, stock=10000)
    mozzarella       = ing("Queso mozzarella",          g, stock=8000, alergeno=True)
    pepperoni_ing    = ing("Pepperoni",                 g, stock=3000)
    jamon            = ing("Jamón cocido",              g, stock=4000)
    anana            = ing("Ananá en rodajas",          g, stock=3000)
    coca             = ing("Coca-Cola 500ml",          ml, stock=50000)
    agua             = ing("Agua mineral 500ml",       ml, stock=60000)
    jugo_naranja     = ing("Jugo de naranja",          ml, stock=20000)
    brownie          = ing("Brownie de chocolate",     ud, stock=100,  alergeno=True)
    helado_vainilla  = ing("Helado de vainilla",        g, stock=10000, alergeno=True)
    mix_verdes       = ing("Mix de verdes",             g, stock=5000)
    aderezo_cesar    = ing("Aderezo césar",            ml, stock=5000)
    crutones         = ing("Crutones",                  g, stock=3000, alergeno=True)
    pollo_grillado   = ing("Pechuga de pollo grillada", g, stock=5000)

    # ── helper para crear producto ────────────────────────────────
    def prod(
        nombre: str,
        precio: float,
        descripcion: str,
        categoria: Categoria,
        ingredientes: list,   # [(Ingrediente, cantidad_float, UnidadMedida)]
        stock: int = 50,
    ) -> Producto:
        p = Producto(
            nombre=nombre,
            precio_base=precio,
            descripcion=descripcion,
            disponible=True,
            stock_cantidad=stock,
        )
        sess.add(p)
        sess.flush()
        sess.add(ProductoCategoria(producto_id=p.id, categoria_id=categoria.id))
        for ingrediente, cantidad, unidad in ingredientes:
            sess.add(ProductoIngrediente(
                producto_id=p.id,
                ingrediente_id=ingrediente.id,
                cantidad=cantidad,
                unidad_medida_id=unidad.id,
                es_removible=True,
            ))
        sess.flush()
        return p

    # ── HAMBURGUESAS ──────────────────────────────────────────────
    prod("Burger Clásica", 1800,
         "Medallón de carne, queso cheddar, lechuga y tomate en pan brioche",
         hamburguesas,
         [(pan_brioche, 1, ud), (carne_200, 200, g), (queso_cheddar, 30, g),
          (lechuga, 20, g), (tomate, 30, g)])

    prod("Burger BBQ", 2200,
         "Medallón 300g, panceta ahumada, cebolla caramelizada y cheddar doble",
         hamburguesas,
         [(pan_brioche, 1, ud), (carne_300, 300, g), (panceta, 40, g),
          (cebolla, 30, g), (queso_cheddar, 50, g)])

    prod("Burger Doble", 2500,
         "Dos medallones (400g), doble cheddar, lechuga y tomate",
         hamburguesas,
         [(pan_brioche, 1, ud), (carne_200, 400, g),
          (queso_cheddar, 60, g), (lechuga, 20, g), (tomate, 30, g)])

    prod("Burger Pollo Grillado", 2000,
         "Pechuga de pollo grillada, lechuga, tomate y mayonesa",
         hamburguesas,
         [(pan_brioche, 1, ud), (pollo_grillado, 180, g),
          (lechuga, 25, g), (tomate, 30, g)])

    # ── PIZZAS ────────────────────────────────────────────────────
    prod("Pizza Mozzarella", 2800,
         "Salsa de tomate y mozzarella fresca",
         pizzas,
         [(masa_pizza, 1, ud), (salsa_tomate, 80, ml), (mozzarella, 150, g)])

    prod("Pizza Pepperoni", 3200,
         "Salsa de tomate, mozzarella y pepperoni artesanal",
         pizzas,
         [(masa_pizza, 1, ud), (salsa_tomate, 80, ml), (mozzarella, 150, g),
          (pepperoni_ing, 80, g)])

    prod("Pizza Capricciosa", 3000,
         "Salsa de tomate, mozzarella y jamón cocido",
         pizzas,
         [(masa_pizza, 1, ud), (salsa_tomate, 80, ml), (mozzarella, 150, g),
          (jamon, 80, g)])

    prod("Pizza Hawaiana", 3100,
         "Salsa de tomate, mozzarella, jamón y ananá",
         pizzas,
         [(masa_pizza, 1, ud), (salsa_tomate, 80, ml), (mozzarella, 130, g),
          (jamon, 60, g), (anana, 50, g)])

    # ── BEBIDAS ───────────────────────────────────────────────────
    prod("Coca-Cola 500ml", 700,
         "Bebida cola refrescante",
         bebidas,
         [(coca, 500, ml)], stock=200)

    prod("Agua Mineral 500ml", 400,
         "Agua mineral sin gas",
         bebidas,
         [(agua, 500, ml)], stock=300)

    prod("Jugo de Naranja Natural", 800,
         "Jugo exprimido al momento",
         bebidas,
         [(jugo_naranja, 300, ml)], stock=80)

    # ── POSTRES ───────────────────────────────────────────────────
    prod("Brownie con Helado", 1200,
         "Brownie de chocolate tibio con una bocha de helado de vainilla",
         postres,
         [(brownie, 1, ud), (helado_vainilla, 100, g)])

    prod("Helado Triple", 900,
         "Tres bochas de helado de vainilla",
         postres,
         [(helado_vainilla, 300, g)])

    # ── ENSALADAS ─────────────────────────────────────────────────
    prod("Ensalada César", 1500,
         "Mix de verdes, pollo grillado, crutones y aderezo césar",
         ensaladas,
         [(mix_verdes, 150, g), (pollo_grillado, 100, g),
          (crutones, 30, g), (aderezo_cesar, 40, ml)])
