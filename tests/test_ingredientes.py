"""
Integration tests for /api/v1/ingredientes/* endpoints.
Covers: CRUD, auth restrictions, stock management, search.
"""
import pytest

_BASE = "/api/v1/ingredientes"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def ingrediente_payload(unidad_id):
    return {
        "nombre": "Tomate Test",
        "descripcion": "Tomate fresco",
        "es_alergeno": False,
        "stock_cantidad": 500,
        "unidad_medida_id": unidad_id,
    }


@pytest.fixture
def ingrediente(client, admin_headers, ingrediente_payload):
    r = client.post(f"{_BASE}/", json=ingrediente_payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "cliente_ing@test.com",
        "password": "Test1234!",
        "nombre": "Cliente",
        "apellido": "Ing",
        "celular": "1122334455",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": "cliente_ing@test.com",
        "password": "Test1234!",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestIngredienteRead:
    def test_list_is_public(self, client):
        r = client.get(f"{_BASE}/")
        assert r.status_code == 200
        assert "items" in r.json()
        assert "total" in r.json()

    def test_get_by_id(self, client, ingrediente):
        r = client.get(f"{_BASE}/{ingrediente['id']}")
        assert r.status_code == 200
        assert r.json()["nombre"] == ingrediente["nombre"]

    def test_get_nonexistent_returns_404(self, client):
        r = client.get(f"{_BASE}/999999")
        assert r.status_code == 404

    def test_filter_by_nombre(self, client, ingrediente):
        r = client.get(f"{_BASE}/?nombre=Tomate")
        assert r.status_code == 200
        assert any(i["nombre"] == "Tomate Test" for i in r.json()["items"])

    def test_list_includes_unidad_medida(self, client, ingrediente):
        r = client.get(f"{_BASE}/{ingrediente['id']}")
        assert r.json()["unidad_medida"] is not None


class TestIngredienteCreate:
    def test_admin_can_create(self, client, admin_headers, ingrediente_payload):
        r = client.post(f"{_BASE}/", json=ingrediente_payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["nombre"] == ingrediente_payload["nombre"]
        assert data["stock_cantidad"] == ingrediente_payload["stock_cantidad"]
        assert data["es_alergeno"] is False

    def test_client_cannot_create(self, client, client_headers, ingrediente_payload):
        r = client.post(f"{_BASE}/", json=ingrediente_payload, headers=client_headers)
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self, client, ingrediente_payload):
        client.cookies.clear()
        r = client.post(f"{_BASE}/", json=ingrediente_payload)
        assert r.status_code == 401

    def test_create_with_invalid_payload_returns_422(self, client, admin_headers):
        r = client.post(f"{_BASE}/", json={"nombre": "X"}, headers=admin_headers)
        assert r.status_code == 422


class TestIngredienteUpdate:
    def test_admin_can_update_nombre(self, client, admin_headers, ingrediente, unidad_id):
        r = client.put(
            f"{_BASE}/{ingrediente['id']}",
            json={"nombre": "Tomate Perita", "unidad_medida_id": unidad_id},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["nombre"] == "Tomate Perita"

    def test_update_stock_cantidad(self, client, admin_headers, ingrediente, unidad_id):
        r = client.put(
            f"{_BASE}/{ingrediente['id']}",
            json={"stock_cantidad": 999, "unidad_medida_id": unidad_id},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["stock_cantidad"] == 999

    def test_client_cannot_update(self, client, client_headers, ingrediente, unidad_id):
        r = client.put(
            f"{_BASE}/{ingrediente['id']}",
            json={"nombre": "Hack", "unidad_medida_id": unidad_id},
            headers=client_headers,
        )
        assert r.status_code == 403


class TestIngredienteDelete:
    def test_admin_can_delete(self, client, admin_headers, ingrediente):
        r = client.delete(f"{_BASE}/{ingrediente['id']}", headers=admin_headers)
        assert r.status_code == 204

    def test_client_cannot_delete(self, client, client_headers, ingrediente):
        r = client.delete(f"{_BASE}/{ingrediente['id']}", headers=client_headers)
        assert r.status_code == 403
