"""
Integration tests for /api/v1/productos/* endpoints.
Covers: CRUD, disponibilidad toggle, image update, auth restrictions, filtering.
"""
import pytest

_BASE = "/api/v1/productos"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def unidad_kg(client):
    """Id de la unidad Kilogramos (unidad canónica de masa)."""
    r = client.get("/api/v1/lookups/unidades-medida")
    kg = next(u for u in r.json() if u["simbolo"] == "kg")
    return kg["id"]


@pytest.fixture
def ingrediente(client, admin_headers, unidad_kg):
    # precio_costo = $2000 por kg.
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": "Ingrediente Prod Test",
        "es_alergeno": False,
        "stock_cantidad": 2000,
        "unidad_medida_id": unidad_kg,
        "precio_costo": "2000.00",
    }, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def producto_payload(ingrediente, unidad_kg):
    # 0.5 kg de insumo a $2000/kg = $1000 de costo; margen 50% -> precio 1500.
    return {
        "nombre": "Hamburguesa Test",
        "margen_ganancia": "50.00",
        "descripcion": "Test burger",
        "disponible": True,
        "categorias_ids": [],
        "ingredientes": [{
            "ingrediente_id": ingrediente["id"],
            "cantidad": "0.500",
            "unidad_medida_id": unidad_kg,
            "es_removible": True,
        }],
    }


@pytest.fixture
def producto(client, admin_headers, producto_payload):
    r = client.post(f"{_BASE}/", json=producto_payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client_headers(client):
    """Register + login a CLIENT user and return their headers."""
    client.post("/api/v1/auth/register", json={
        "email": "cliente_prod@test.com",
        "password": "Test1234!",
        "nombre": "Cliente",
        "apellido": "Prod",
        "celular": "1234567890",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": "cliente_prod@test.com",
        "password": "Test1234!",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestProductoRead:
    def test_list_is_public(self, client):
        r = client.get(f"{_BASE}/")
        assert r.status_code == 200
        assert "items" in r.json()
        assert "total" in r.json()

    def test_list_returns_paginated(self, client, producto):
        r = client.get(f"{_BASE}/")
        assert r.json()["total"] >= 1

    def test_get_by_id_returns_full_detail(self, client, producto):
        r = client.get(f"{_BASE}/{producto['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == producto["id"]
        assert "categorias" in data
        assert "producto_ingredientes" in data

    def test_get_nonexistent_returns_404(self, client):
        r = client.get(f"{_BASE}/999999")
        assert r.status_code == 404

    def test_filter_by_disponible(self, client, producto):
        r = client.get(f"{_BASE}/?disponible=true")
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["disponible"] is True

    def test_filter_by_nombre(self, client, producto):
        r = client.get(f"{_BASE}/?nombre=Hamburguesa")
        assert r.status_code == 200
        assert any(p["nombre"] == "Hamburguesa Test" for p in r.json()["items"])


class TestProductoCreate:
    def test_admin_can_create(self, client, admin_headers, producto_payload):
        r = client.post(f"{_BASE}/", json=producto_payload, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["nombre"] == producto_payload["nombre"]
        # precio calculado: costo 1000 (0.5kg * $2000) * (1 + 50%) = 1500
        assert r.json()["precio_base"] == 1500.0

    def test_create_calcula_precio_desde_costo_y_margen(
        self, client, admin_headers, producto_payload
    ):
        # Otro caso (triangulación): margen 0% -> precio == costo
        payload = {**producto_payload, "margen_ganancia": "0.00"}
        r = client.post(f"{_BASE}/", json=payload, headers=admin_headers)
        assert r.status_code == 201
        body = r.json()
        assert body["precio_base"] == 1000.0
        full = client.get(f"{_BASE}/{body['id']}").json()
        assert float(full["costo_total"]) == 1000.0

    def test_client_cannot_create(self, client, client_headers, producto_payload):
        r = client.post(f"{_BASE}/", json=producto_payload, headers=client_headers)
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self, client, producto_payload):
        client.cookies.clear()
        r = client.post(f"{_BASE}/", json=producto_payload)
        assert r.status_code == 401

    def test_create_without_ingredientes_returns_422(self, client, admin_headers, producto_payload):
        payload = {**producto_payload, "ingredientes": []}
        r = client.post(f"{_BASE}/", json=payload, headers=admin_headers)
        assert r.status_code == 422


class TestProductoUpdate:
    def test_admin_can_update(self, client, admin_headers, producto):
        r = client.put(f"{_BASE}/{producto['id']}", json={
            "nombre": "Hamburguesa Actualizada",
            "precio_base": 900.0,
            "ingredientes": producto["producto_ingredientes"] and [
                {
                    "ingrediente_id": pi["ingrediente_id"],
                    "cantidad": str(pi["cantidad"]),
                    "unidad_medida_id": pi["unidad_medida_id"],
                    "es_removible": pi["es_removible"],
                }
                for pi in producto["producto_ingredientes"]
            ],
        }, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["nombre"] == "Hamburguesa Actualizada"

    def test_patch_disponibilidad(self, client, admin_headers, producto):
        r = client.patch(
            f"{_BASE}/{producto['id']}/disponibilidad",
            json={"disponible": False},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["disponible"] is False

    def test_patch_imagenes(self, client, admin_headers, producto):
        urls = ["https://res.cloudinary.com/test/image1.jpg"]
        r = client.patch(
            f"{_BASE}/{producto['id']}/imagenes",
            json={"imagenes_url": urls},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["imagenes_url"] == urls


class TestPrecioAutomatico:
    def test_cambio_de_precio_costo_recalcula_precio_producto(
        self, client, admin_headers, producto, ingrediente
    ):
        # Precio inicial: costo 1000 * 1.5 = 1500
        assert producto["precio_base"] == 1500.0

        # Duplico el precio-costo del insumo: $2000 -> $4000 por kg
        r = client.put(
            f"/api/v1/ingredientes/{ingrediente['id']}",
            json={"precio_costo": "4000.00"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text

        # El precio del producto se actualizó solo, sin re-guardarlo:
        # costo 2000 (0.5kg * $4000) * 1.5 = 3000
        full = client.get(f"{_BASE}/{producto['id']}").json()
        assert full["precio_base"] == 3000.0
        assert float(full["costo_total"]) == 2000.0


class TestProductoDelete:
    def test_admin_can_delete(self, client, admin_headers, producto):
        r = client.delete(f"{_BASE}/{producto['id']}", headers=admin_headers)
        assert r.status_code == 204

    def test_client_cannot_delete(self, client, client_headers, producto):
        r = client.delete(f"{_BASE}/{producto['id']}", headers=client_headers)
        assert r.status_code == 403
