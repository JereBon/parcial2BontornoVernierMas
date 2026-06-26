"""Lógica pura de costos y precios (sin acceso a DB).

El insumo (`Ingrediente`) tiene un `precio_costo` expresado por su unidad
**canónica**: kg para masa, L para volumen, unidad para lo contable.

- Costo de un producto = Σ (cantidad_del_insumo_en_canónica · precio_costo).
- Precio de venta = costo · (1 + margen_de_ganancia%), redondeado a 2 decimales.

Al ser funciones puras se testean sin base de datos y son el único lugar
donde vive la regla de negocio del cálculo de precios.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
from typing import Iterable

# Factor para llevar una cantidad a la unidad canónica de su tipo
# (masa→kg, volumen→L, contable→unidad).
_FACTOR_CANONICO: dict[str, Decimal] = {
    "g": Decimal("0.001"),
    "kg": Decimal("1"),
    "ml": Decimal("0.001"),
    "l": Decimal("1"),
    "L": Decimal("1"),
    "ud": Decimal("1"),
    "u": Decimal("1"),
    "porciones": Decimal("1"),
}


@dataclass(frozen=True)
class IngredienteCosto:
    """Un insumo dentro de un producto, con su cantidad y costo unitario."""

    cantidad: Decimal
    simbolo: str | None
    precio_costo: Decimal


def to_canonical(cantidad: Decimal, simbolo: str | None) -> Decimal:
    """Convierte `cantidad` (en la unidad `simbolo`) a la unidad canónica."""
    factor = _FACTOR_CANONICO.get(simbolo or "u", Decimal("1"))
    return Decimal(cantidad) * factor


def costo_total(items: Iterable[IngredienteCosto]) -> Decimal:
    """Costo de un producto: suma del costo de cada insumo que lo compone."""
    total = Decimal("0")
    for it in items:
        total += to_canonical(it.cantidad, it.simbolo) * Decimal(it.precio_costo)
    return total


def precio_venta(costo: Decimal, margen_pct: Decimal) -> Decimal:
    """Precio de venta = costo · (1 + margen%), redondeado SIEMPRE hacia
    arriba al múltiplo de 100 más cercano (precio "redondo": $3929.20 pasa
    a $4000, nunca para abajo, para que sea un precio real de venta)."""
    bruto = Decimal(costo) * (Decimal("1") + Decimal(margen_pct) / Decimal("100"))
    centenas = (bruto / Decimal("100")).to_integral_value(rounding=ROUND_CEILING)
    return centenas * Decimal("100")
