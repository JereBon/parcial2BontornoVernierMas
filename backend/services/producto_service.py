from decimal import Decimal
from fastapi import HTTPException
from sqlmodel import Session
from ..models import (
    Producto,
    ProductoIngrediente,
)
from ..schemas.catalogo import (
    ProductoCreate,
    ProductoUpdate,
    ProductoDisponibilidadUpdate,
    ProductoIngredienteInput,
)
from ..repositories.producto_repository import ProductoRepository
from ..repositories.categoria_repository import CategoriaRepository
from ..repositories.ingrediente_repository import IngredienteRepository
from ..repositories.lookups import UnidadMedidaRepository
from . import pricing


class ProductoService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProductoRepository(session)
        self.cat_repo = CategoriaRepository(session)
        self.ing_repo = IngredienteRepository(session)
        self.um_repo = UnidadMedidaRepository(session)

    def get_full(self, producto_id: int) -> Producto:
        prod = self.repo.get_full(producto_id)
        if prod is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        # costo_total es un campo de solo-lectura (no es columna): se adjunta a la
        # instancia para que el schema de respuesta lo serialice.
        object.__setattr__(prod, "costo_total", self._costo_total(prod.id))
        return prod

    def search(self, **kwargs) -> tuple[list[Producto], int]:
        return self.repo.search(**kwargs)

    # ── Cálculo de costo y precio ──────────────────────────────────────────

    def _costo_total(self, producto_id: int) -> Decimal:
        """Costo del producto a partir del precio-costo de sus insumos."""
        links = self.repo.get_producto_ingredientes(producto_id)
        items = [
            pricing.IngredienteCosto(
                cantidad=link.cantidad,
                simbolo=link.unidad_medida.simbolo if link.unidad_medida else None,
                precio_costo=(
                    link.ingrediente.precio_costo if link.ingrediente else Decimal("0")
                ),
            )
            for link in links
        ]
        return pricing.costo_total(items)

    def _recompute_precio(self, producto_id: int) -> None:
        """Recalcula precio_base = costo · (1 + margen%) y lo persiste.

        Se vuelve a leer el producto y se expira la colección de insumos para
        no arrastrar instancias obsoletas tras un reemplazo de ingredientes.
        """
        costo = self._costo_total(producto_id)
        prod = self.repo.get(producto_id)
        if prod is None:
            return
        self.session.expire(prod, ["producto_ingredientes"])
        prod.precio_base = float(pricing.precio_venta(costo, prod.margen_ganancia))
        self.session.add(prod)
        self.session.flush()

    def recompute_por_ingrediente(self, ingrediente_id: int) -> list[int]:
        """Recalcula el precio de todos los productos que usan un insumo.

        Se llama cuando cambia el precio-costo de un insumo, para que el precio
        del producto se actualice automáticamente sin tener que re-guardarlo.
        Devuelve los ids de los productos recalculados.
        """
        ids = self.repo.ids_using_ingrediente(ingrediente_id)
        for pid in ids:
            self._recompute_precio(pid)
        return ids

    # ── Validaciones ───────────────────────────────────────────────────────

    def _resolve_categorias(self, ids: list[int]) -> None:
        for cid in ids:
            if self.cat_repo.get(cid) is None:
                raise HTTPException(
                    status_code=404, detail=f"Categoria id={cid} no encontrada"
                )

    def _resolve_ingredientes(self, items: list[ProductoIngredienteInput]) -> None:
        for it in items:
            if self.ing_repo.get(it.ingrediente_id) is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Ingrediente id={it.ingrediente_id} no encontrado",
                )
            if self.um_repo.get(it.unidad_medida_id) is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Unidad de medida id={it.unidad_medida_id} no encontrada",
                )

    def _build_links(
        self, prod_id: int, items: list[ProductoIngredienteInput]
    ) -> list[ProductoIngrediente]:
        return [
            ProductoIngrediente(
                producto_id=prod_id,
                ingrediente_id=it.ingrediente_id,
                cantidad=it.cantidad,
                unidad_medida_id=it.unidad_medida_id,
                es_removible=it.es_removible,
            )
            for it in items
        ]

    # ── Mutaciones ─────────────────────────────────────────────────────────

    def create(self, payload: ProductoCreate) -> Producto:
        self._resolve_categorias(payload.categorias_ids)
        self._resolve_ingredientes(payload.ingredientes)
        prod = Producto(
            nombre=payload.nombre,
            precio_base=0,  # se calcula abajo desde el costo + margen
            margen_ganancia=payload.margen_ganancia,
            descripcion=payload.descripcion,
            imagenes_url=payload.imagenes_url,
            disponible=payload.disponible,
            unidad_venta_id=payload.unidad_venta_id,
        )
        self.session.add(prod)
        self.session.flush()
        self.repo.replace_categorias(prod.id, payload.categorias_ids)
        self.repo.replace_ingredientes(
            prod.id, self._build_links(prod.id, payload.ingredientes)
        )
        self._recompute_precio(prod.id)
        return self.get_full(prod.id)

    def update(self, producto_id: int, payload: ProductoUpdate) -> Producto:
        prod = self.get_full(producto_id)
        data = payload.model_dump(exclude_unset=True)
        # precio_base se ignora: es derivado del costo + margen.
        for k in ("nombre", "margen_ganancia", "descripcion", "imagenes_url",
                  "disponible", "unidad_venta_id"):
            if k in data:
                setattr(prod, k, data[k])
        self.session.add(prod)
        if data.get("categorias_ids") is not None:
            self._resolve_categorias(data["categorias_ids"])
            self.repo.replace_categorias(prod.id, data["categorias_ids"])
        if data.get("ingredientes") is not None:
            items = [ProductoIngredienteInput(**i) for i in data["ingredientes"]]
            self._resolve_ingredientes(items)
            self.repo.replace_ingredientes(
                prod.id, self._build_links(prod.id, items)
            )
        self._recompute_precio(prod.id)
        return self.get_full(prod.id)

    def patch_disponibilidad(
        self, producto_id: int, payload: ProductoDisponibilidadUpdate
    ) -> Producto:
        prod = self.get_full(producto_id)
        data = payload.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=400, detail="Sin cambios para aplicar")
        for k, v in data.items():
            setattr(prod, k, v)
        self.session.add(prod)
        self.session.flush()
        return self.get_full(prod.id)

    def delete(self, producto_id: int) -> None:
        prod = self.repo.get(producto_id)
        if prod is None:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        self.repo.delete(prod)
