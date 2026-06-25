from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session
from ..models import Usuario, Producto, Ingrediente
from ..models.rol import RolCodigo
from ..models.forma_pago import FormaPagoCodigo
from ..models.pedido import Pedido, DetallePedido, HistorialEstadoPedido
from ..models.estado_pedido import (
    EstadoPedidoCodigo,
    ALLOWED_TRANSITIONS,
    TERMINAL_STATES,
)
from ..repositories.pedido_repository import PedidoRepository
from ..repositories.producto_repository import ProductoRepository, _to_base, _FACTOR
from ..repositories.direccion_repository import DireccionRepository
from ..repositories.historial_pedido_repository import HistorialEstadoPedidoRepository
from ..repositories.lookups import EstadoPedidoRepository, FormaPagoRepository
from ..schemas.pedido import PedidoCreate

_STAFF_CODES = {RolCodigo.ADMIN.value, RolCodigo.PEDIDOS.value}
_CANCEL_FROM_CLIENT = {EstadoPedidoCodigo.PENDIENTE, EstadoPedidoCodigo.CONFIRMADO}
COSTO_ENVIO_DEFAULT = 50.0


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

    def _build_ingredient_decrements(
        self, cantidades_por_prod: dict[int, int]
    ) -> dict[int, float]:
        """Returns {ing_id: needed_in_base_units}."""
        decrements: dict[int, float] = {}
        for prod_id, qty in cantidades_por_prod.items():
            links = self.prod_repo.get_producto_ingredientes(prod_id)
            if not links:
                raise HTTPException(
                    status_code=409,
                    detail=f"El producto id={prod_id} no tiene ingredientes configurados",
                )
            for link in links:
                ing_id = link.ingrediente_id
                recipe_simbolo = link.unidad_medida.simbolo if link.unidad_medida else None
                needed_base = _to_base(float(link.cantidad), recipe_simbolo) * qty
                decrements[ing_id] = decrements.get(ing_id, 0.0) + needed_base
        return decrements

    def _check_ingredient_stock(self, decrements: dict[int, float]) -> None:
        for ing_id, needed_base in decrements.items():
            ing = self.session.get(Ingrediente, ing_id)
            if ing is None:
                raise HTTPException(status_code=500, detail=f"Ingrediente id={ing_id} no encontrado")
            ing_simbolo = ing.unidad_medida.simbolo if ing.unidad_medida else None
            stock_base = _to_base(float(ing.stock_cantidad), ing_simbolo)
            if stock_base < needed_base:
                raise HTTPException(
                    status_code=409,
                    detail=f"Stock insuficiente del ingrediente '{ing.nombre}' "
                    f"(disponible: {stock_base:.0f} unidades base, necesario: {needed_base:.0f})",
                )

    def _apply_ingredient_decrements(self, decrements: dict[int, float]) -> None:
        for ing_id, needed_base in decrements.items():
            ing = self.session.get(Ingrediente, ing_id)
            ing_simbolo = ing.unidad_medida.simbolo if ing.unidad_medida else None
            factor = _FACTOR.get(ing_simbolo or 'u', 1.0)
            ing.stock_cantidad -= int(needed_base / factor)
            self.session.add(ing)

    def _restore_ingredient_stock(self, pedido: Pedido) -> None:
        cantidades: dict[int, int] = {d.producto_id: d.cantidad for d in pedido.detalles}
        if not cantidades:
            return
        decrements = self._build_ingredient_decrements(cantidades)
        for ing_id, amount in decrements.items():
            ing = self.session.get(Ingrediente, ing_id)
            if ing is not None:
                ing.stock_cantidad += int(amount)
                self.session.add(ing)

    def create(self, payload: PedidoCreate, user: Usuario) -> Pedido:
        if not payload.items:
            raise HTTPException(
                status_code=400, detail="El pedido debe tener al menos un item"
            )
        forma = self.forma_pago_repo.get(payload.forma_pago_id)
        if forma is None:
            raise HTTPException(status_code=404, detail="Forma de pago no encontrada")

        es_efectivo = forma.codigo == FormaPagoCodigo.EFECTIVO.value
        if es_efectivo:
            direccion = None
        else:
            if payload.direccion_id is None:
                raise HTTPException(
                    status_code=400, detail="Se requiere direccion de entrega para esta forma de pago"
                )
            direccion = self.dir_repo.get_for_user(payload.direccion_id, user.id)
            if direccion is None:
                raise HTTPException(
                    status_code=404, detail="Direccion no encontrada o no te pertenece"
                )

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

        decrements = self._build_ingredient_decrements(cantidades_por_prod)
        self._check_ingredient_stock(decrements)

        detalles: list[DetallePedido] = []
        subtotal = 0.0
        for item in payload.items:
            prod = productos[item.producto_id]
            subtotal_item = round(prod.precio_base * item.cantidad, 2)
            subtotal += subtotal_item
            detalles.append(
                DetallePedido(
                    producto_id=prod.id,
                    nombre_snapshot=prod.nombre,
                    precio_snapshot=prod.precio_base,
                    cantidad=item.cantidad,
                    subtotal_snap=subtotal_item,
                )
            )

        self._apply_ingredient_decrements(decrements)

        subtotal = round(subtotal, 2)
        descuento = 0.0
        costo_envio = COSTO_ENVIO_DEFAULT
        total = round(subtotal - descuento + costo_envio, 2)

        estado_pendiente_id = self._estado_id_by_codigo(EstadoPedidoCodigo.PENDIENTE)
        pedido = Pedido(
            usuario_id=user.id,
            estado_id=estado_pendiente_id,
            forma_pago_id=forma.id,
            direccion_id=direccion.id if direccion else None,
            subtotal=subtotal,
            descuento=descuento,
            costo_envio=costo_envio,
            total=total,
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
                estado_desde_id=None,
                estado_hacia_id=estado_pendiente_id,
                usuario_id=user.id,
                motivo="Pedido creado",
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id)

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
        motivo: str | None = None,
    ) -> tuple["Pedido", EstadoPedidoCodigo]:
        if not self._is_staff(user):
            raise HTTPException(status_code=403, detail="Solo personal autorizado")
        pedido = self.repo.get_full(pedido_id)
        if pedido is None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        anterior = self._codigo_by_id(pedido.estado_id)
        self._validate_transition(anterior, nuevo)
        if nuevo == EstadoPedidoCodigo.CANCELADO:
            self._restore_ingredient_stock(pedido)
        nuevo_id = self._estado_id_by_codigo(nuevo)
        pedido.estado_id = nuevo_id
        pedido.updated_at = datetime.now(timezone.utc)
        self.session.add(pedido)
        self.historial_repo.add(
            HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde_id=self._estado_id_by_codigo(anterior),
                estado_hacia_id=nuevo_id,
                usuario_id=user.id,
                motivo=motivo,
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id), anterior

    def cancelar(
        self, pedido_id: int, user: Usuario, motivo: str | None = None
    ) -> tuple["Pedido", EstadoPedidoCodigo]:
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
        self._restore_ingredient_stock(pedido)
        cancelado_id = self._estado_id_by_codigo(EstadoPedidoCodigo.CANCELADO)
        pedido.estado_id = cancelado_id
        pedido.updated_at = datetime.now(timezone.utc)
        self.session.add(pedido)
        self.historial_repo.add(
            HistorialEstadoPedido(
                pedido_id=pedido.id,
                estado_desde_id=self._estado_id_by_codigo(anterior),
                estado_hacia_id=cancelado_id,
                usuario_id=user.id,
                motivo=motivo or "Cancelado",
            )
        )
        self.session.flush()
        return self.repo.get_full(pedido.id), anterior
