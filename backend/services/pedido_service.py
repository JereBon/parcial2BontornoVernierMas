from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session
from ..models import Usuario, Producto
from ..models.rol import RolCodigo
from ..models.pedido import Pedido, DetallePedido, HistorialEstadoPedido
from ..models.estado_pedido import (
    EstadoPedidoCodigo,
    ALLOWED_TRANSITIONS,
    TERMINAL_STATES,
)
from ..repositories.pedido_repository import PedidoRepository
from ..repositories.producto_repository import ProductoRepository
from ..repositories.direccion_repository import DireccionRepository
from ..repositories.historial_pedido_repository import HistorialEstadoPedidoRepository
from ..repositories.lookups import EstadoPedidoRepository, FormaPagoRepository
from ..schemas.pedido import PedidoCreate

_STAFF_CODES = {RolCodigo.ADMIN.value, RolCodigo.PEDIDOS.value}
_CANCEL_FROM_CLIENT = {EstadoPedidoCodigo.PENDIENTE, EstadoPedidoCodigo.CONFIRMADO}


class PedidoService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = PedidoRepository(session)
        self.prod_repo = ProductoRepository(session)
        self.dir_repo = DireccionRepository(session)
        self.estado_repo = EstadoPedidoRepository(session)
        self.forma_pago_repo = FormaPagoRepository(session)
        self.historial_repo = HistorialEstadoPedidoRepository(session)

    def _is_staff(self, user: Usuario) -> bool:
        return user.has_any_role(*_STAFF_CODES)

    def _assert_can_view(self, pedido: Pedido, user: Usuario) -> None:
        if self._is_staff(user) or pedido.usuario_id == user.id:
            return
        raise HTTPException(status_code=403, detail="No autorizado")

    def _estado_id_by_codigo(self, codigo: EstadoPedidoCodigo) -> int:
        estado = self.estado_repo.get_by_codigo(codigo.value)
        if estado is None:
            raise HTTPException(
                status_code=500, detail=f"Seed faltante: estado {codigo.value}"
            )
        return estado.id

    def _codigo_by_id(self, estado_id: int) -> EstadoPedidoCodigo:
        estado = self.estado_repo.get(estado_id)
        if estado is None:
            raise HTTPException(status_code=500, detail="Estado inexistente en DB")
        return EstadoPedidoCodigo(estado.codigo)

    def get_full(self, pedido_id: int, user: Usuario) -> Pedido:
        pedido = self.repo.get_full(pedido_id)
        if pedido is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        self._assert_can_view(pedido, user)
        return pedido

    def search_for_user(
        self,
        *,
        user: Usuario,
        skip: int,
        limit: int,
        estado: EstadoPedidoCodigo | None,
        usuario_id: int | None,
    ) -> tuple[list[Pedido], int]:
        if not self._is_staff(user):
            usuario_id = user.id
        return self.repo.search(
            skip=skip,
            limit=limit,
            usuario_id=usuario_id,
            estado_codigo=estado.value if estado else None,
        )

    def search_own(
        self, *, user: Usuario, skip: int, limit: int, estado: EstadoPedidoCodigo | None
    ) -> tuple[list[Pedido], int]:
        return self.repo.search(
            skip=skip,
            limit=limit,
            usuario_id=user.id,
            estado_codigo=estado.value if estado else None,
        )

    def create(self, payload: PedidoCreate, user: Usuario) -> Pedido:
        if not payload.items:
            raise HTTPException(
                status_code=400, detail="El pedido debe tener al menos un item"
            )
        direccion = self.dir_repo.get_for_user(payload.direccion_id, user.id)
        if direccion is None:
            raise HTTPException(
                status_code=404, detail="Direccion no encontrada o no te pertenece"
            )
        forma = self.forma_pago_repo.get(payload.forma_pago_id)
        if forma is None:
            raise HTTPException(status_code=404, detail="Forma de pago no encontrada")
        productos: dict[int, Producto] = {}
        cantidades_por_prod: dict[int, int] = {}
        for item in payload.items:
            if item.producto_id not in productos:
                prod = self.prod_repo.get(item.producto_id)
                if prod is None:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Producto id={item.producto_id} no encontrado",
                    )
                if not prod.disponible:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Producto '{prod.nombre}' no esta disponible",
                    )
                productos[prod.id] = prod
            cantidades_por_prod[item.producto_id] = (
                cantidades_por_prod.get(item.producto_id, 0) + item.cantidad
            )
        for pid, qty_total in cantidades_por_prod.items():
            prod = productos[pid]
            if prod.stock_cantidad < qty_total:
                raise HTTPException(
                    status_code=409,
                    detail=f"Stock insuficiente para '{prod.nombre}' (disponible: {prod.stock_cantidad}, pedido: {qty_total})",
                )
        detalles: list[DetallePedido] = []
        total = 0.0
        for item in payload.items:
            prod = productos[item.producto_id]
            subtotal = round(prod.precio * item.cantidad, 2)
            total += subtotal
            detalles.append(
                DetallePedido(
                    producto_id=prod.id,
                    producto_nombre=prod.nombre,
                    producto_precio=prod.precio,
                    cantidad=item.cantidad,
                    subtotal=subtotal,
                )
            )
        for pid, qty_total in cantidades_por_prod.items():
            prod = productos[pid]
            prod.stock_cantidad -= qty_total
            self.session.add(prod)
        estado_pendiente_id = self._estado_id_by_codigo(EstadoPedidoCodigo.PENDIENTE)
        pedido = Pedido(
            usuario_id=user.id,
            estado_id=estado_pendiente_id,
            forma_pago_id=forma.id,
            direccion_id=direccion.id,
            direccion_snapshot=direccion.to_snapshot(),
            total=round(total, 2),
            notas=payload.notas,
        )
        self.session.add(pedido)
        self.session.flush()
        for d in detalles:
            d.pedido_id = pedido.id
            self.session.add(d)
        self.historial_repo.add(
            HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_anterior_id=None,
                estado_nuevo_id=estado_pendiente_id,
                changed_by_id=user.id,
                nota="Pedido creado",
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id)

    def _restore_stock(self, pedido: Pedido) -> None:
        for d in pedido.detalles:
            prod = self.prod_repo.get(d.producto_id)
            if prod is not None:
                prod.stock_cantidad += d.cantidad
                self.session.add(prod)

    def _validate_transition(
        self, current: EstadoPedidoCodigo, nuevo: EstadoPedidoCodigo
    ) -> None:
        if current in TERMINAL_STATES:
            raise HTTPException(
                status_code=409, detail=f"Estado terminal {current.value}"
            )
        if nuevo not in ALLOWED_TRANSITIONS.get(current, set()):
            raise HTTPException(
                status_code=409,
                detail=f"Transicion invalida: {current.value} -> {nuevo.value}",
            )

    def cambiar_estado(
        self,
        pedido_id: int,
        nuevo: EstadoPedidoCodigo,
        user: Usuario,
        nota: str | None = None,
    ) -> Pedido:
        if not self._is_staff(user):
            raise HTTPException(status_code=403, detail="Solo personal autorizado")
        pedido = self.repo.get_full(pedido_id)
        if pedido is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        anterior = self._codigo_by_id(pedido.estado_id)
        self._validate_transition(anterior, nuevo)
        if nuevo == EstadoPedidoCodigo.CANCELADO:
            self._restore_stock(pedido)
        nuevo_id = self._estado_id_by_codigo(nuevo)
        pedido.estado_id = nuevo_id
        pedido.updated_at = datetime.now(timezone.utc)
        self.session.add(pedido)
        self.historial_repo.add(
            HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_anterior_id=self._estado_id_by_codigo(anterior),
                estado_nuevo_id=nuevo_id,
                changed_by_id=user.id,
                nota=nota,
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id)

    def cancelar(
        self, pedido_id: int, user: Usuario, motivo: str | None = None
    ) -> Pedido:
        pedido = self.repo.get_full(pedido_id)
        if pedido is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        anterior = self._codigo_by_id(pedido.estado_id)
        if not self._is_staff(user):
            if pedido.usuario_id != user.id:
                raise HTTPException(status_code=403, detail="No autorizado")
            if anterior not in _CANCEL_FROM_CLIENT:
                raise HTTPException(
                    status_code=409,
                    detail=f"Solo se puede cancelar desde PENDIENTE o CONFIRMADO (actual: {anterior.value})",
                )
        self._validate_transition(anterior, EstadoPedidoCodigo.CANCELADO)
        self._restore_stock(pedido)
        cancelado_id = self._estado_id_by_codigo(EstadoPedidoCodigo.CANCELADO)
        pedido.estado_id = cancelado_id
        pedido.updated_at = datetime.now(timezone.utc)
        self.session.add(pedido)
        self.historial_repo.add(
            HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_anterior_id=self._estado_id_by_codigo(anterior),
                estado_nuevo_id=cancelado_id,
                changed_by_id=user.id,
                nota=motivo or "Cancelado",
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id)
