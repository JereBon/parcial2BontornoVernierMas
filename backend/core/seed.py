from sqlmodel import Session, select
from ..models import (
    Rol,
    UsuarioRol,
    Usuario,
    EstadoPedido,
    EstadoPedidoCodigo,
    FormaPago,
    FormaPagoCodigo,
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
ESTADOS = [
    (EstadoPedidoCodigo.PENDIENTE.value, "Pendiente", 1),
    (EstadoPedidoCodigo.CONFIRMADO.value, "Confirmado", 2),
    (EstadoPedidoCodigo.EN_PREPARACION.value, "En preparacion", 3),
    (EstadoPedidoCodigo.EN_CAMINO.value, "En camino", 4),
    (EstadoPedidoCodigo.ENTREGADO.value, "Entregado", 5),
    (EstadoPedidoCodigo.CANCELADO.value, "Cancelado", 99),
]
FORMAS_PAGO = [
    (FormaPagoCodigo.EFECTIVO.value, "Efectivo"),
    (FormaPagoCodigo.TARJETA.value, "Tarjeta"),
    (FormaPagoCodigo.TRANSFERENCIA.value, "Transferencia"),
]


def _upsert_lookup(session: Session, model, codigo: str, **fields):
    existing = session.exec(select(model).where(model.codigo == codigo)).first()
    if existing is None:
        session.add(model(codigo=codigo, **fields))


def seed_all(session: Session) -> None:
    with UnitOfWork(session) as uow:
        sess = uow.session
        for codigo, nombre in ROLES:
            _upsert_lookup(sess, Rol, codigo, nombre=nombre)
        for codigo, nombre, orden in ESTADOS:
            _upsert_lookup(sess, EstadoPedido, codigo, nombre=nombre, orden=orden)
        for codigo, nombre in FORMAS_PAGO:
            _upsert_lookup(sess, FormaPago, codigo, nombre=nombre)
        sess.flush()
        admin = sess.exec(select(Usuario).where(Usuario.email == ADMIN_EMAIL)).first()
        if admin is None:
            admin = Usuario(
                email=ADMIN_EMAIL,
                nombre="Admin",
                password_hash=hash_password(ADMIN_PASSWORD),
            )
            sess.add(admin)
            sess.flush()
            rol_admin = sess.exec(
                select(Rol).where(Rol.codigo == RolCodigo.ADMIN.value)
            ).first()
            if rol_admin is not None:
                sess.add(UsuarioRol(usuario_id=admin.id, rol_id=rol_admin.id))
