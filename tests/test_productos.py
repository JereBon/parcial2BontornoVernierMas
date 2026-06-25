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
def ingrediente(client, admin_headers, unidad_id):
    r = client.post("/api/v1/ingredientes/", json={
        "nombre": "Ingrediente Prod Test",
        "es_alergeno": False,
        "stock_cantidad": 2000,
        "unidad_medida_id": unidad_id,
    }, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def producto_payload(ingrediente, unidad_id):
    return {
        "nombre": "Hamburguesa Test",
        "precio_base": 800.0,
        "descripcion": "Test burger",
        "disponible": True,
        "categorias_ids": [],
        "ingredientes": [{
            "ingrediente_id": ingrediente["id"],
            "cantidad": "1.000",
            "unidad_medida_id": unidad_id,
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
        assert r.json()["precio_base"] == producto_payload["precio_base"]

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


class TestProductoDelete:
    def test_admin_can_delete(self, client, admin_headers, producto):
        r = client.delete(f"{_BASE}/{producto['id']}", headers=admin_headers)
        assert r.status_code == 204

    def test_client_cannot_delete(self, client, client_headers, producto):
        r = client.delete(f"{_BASE}/{producto['id']}", headers=client_headers)
        assert r.status_code == 403
