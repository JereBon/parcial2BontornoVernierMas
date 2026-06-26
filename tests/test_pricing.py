"""Tests del módulo de pricing puro (sin DB).

Reglas de negocio (corrección del profesor):
- El insumo tiene un precio-costo expresado por su unidad canónica (kg / L / unidad).
- El costo de un producto = Σ (cantidad_del_insumo_en_canónica · precio_costo).
- El precio de venta = costo · (1 + margen_de_ganancia%).
"""
from decimal import Decimal

import pytest

from backend.services.pricing import (
    to_canonical,
    costo_total,
    precio_venta,
    IngredienteCosto,
)


class TestToCanonical:
    def test_gramos_a_kg(self):
        assert to_canonical(Decimal("500"), "g") == Decimal("0.5")

    def test_kg_es_identidad(self):
        assert to_canonical(Decimal("2"), "kg") == Decimal("2")

    def test_mililitros_a_litros(self):
        assert to_canonical(Decimal("250"), "ml") == Decimal("0.25")

    def test_litros_identidad(self):
        assert to_canonical(Decimal("1.5"), "L") == Decimal("1.5")

    def test_unidades_identidad(self):
        assert to_canonical(Decimal("3"), "ud") == Decimal("3")

    def test_simbolo_desconocido_es_identidad(self):
        assert to_canonical(Decimal("4"), None) == Decimal("4")


class TestCostoTotal:
    def test_un_insumo_en_gramos(self):
        # 200 g de carne a $5000/kg = $1000
        items = [IngredienteCosto(cantidad=Decimal("200"), simbolo="g", precio_costo=Decimal("5000"))]
        assert costo_total(items) == Decimal("1000.000")

    def test_varios_insumos(self):
        # 200 g carne a $5000/kg = 1000 ; 2 ud pan a $150 = 300 ; total 1300
        items = [
            IngredienteCosto(cantidad=Decimal("200"), simbolo="g", precio_costo=Decimal("5000")),
            IngredienteCosto(cantidad=Decimal("2"), simbolo="ud", precio_costo=Decimal("150")),
        ]
        assert costo_total(items) == Decimal("1300.000")

    def test_sin_insumos_es_cero(self):
        assert costo_total([]) == Decimal("0")


class TestPrecioVenta:
    """precio_venta redondea siempre hacia arriba al múltiplo de 100 más
    cercano: un precio de venta "redondo" se ve más real que uno con
    centavos (ej. $3929.20 -> $4000, nunca para abajo)."""

    def test_margen_50_ya_es_multiplo_de_100(self):
        # costo 1000, margen 50% -> 1500 (ya redondo, no cambia)
        assert precio_venta(Decimal("1000"), Decimal("50")) == Decimal("1500")

    def test_margen_cero_ya_es_multiplo_de_100(self):
        assert precio_venta(Decimal("1000"), Decimal("0")) == Decimal("1000")

    def test_redondea_al_multiplo_de_100_hacia_arriba(self):
        # costo 1000, margen 33.33% -> bruto 1333.30 -> redondea a 1400
        assert precio_venta(Decimal("1000"), Decimal("33.33")) == Decimal("1400")

    def test_redondea_hacia_arriba_aunque_exceda_por_poco(self):
        # costo 3929.20 (caso real: hamburguesa) -> redondea a 4000
        assert precio_venta(Decimal("3929.20"), Decimal("0")) == Decimal("4000")

    def test_un_centavo_arriba_del_multiplo_redondea_al_siguiente(self):
        # 100.01 nunca se queda en 100: redondea al siguiente múltiplo (200)
        assert precio_venta(Decimal("100.01"), Decimal("0")) == Decimal("200")
