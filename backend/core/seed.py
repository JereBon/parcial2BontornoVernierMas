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
)
from ..models.rol import RolCodigo
from ..uow.unit_of_work import UnitOfWork
from .security import hash_password

ADMIN_EMAIL = "admin@foodstore.com"
ADMIN_PASSWORD = "Admin1234!"

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
