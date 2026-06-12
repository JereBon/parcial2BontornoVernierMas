"""
Integration tests for /api/v1/categorias/* endpoints.
Covers: CRUD, tree endpoint, auth restrictions, parent-child hierarchy.
"""
import pytest

_BASE = "/api/v1/categorias"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def categoria(client, admin_headers):
    r = client.post(f"{_BASE}/", json={
        "nombre": "Pizzas Test",
        "descripcion": "Todas las pizzas",
    }, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "cliente_cat@test.com",
        "password": "Test1234!",
        "nombre": "Cliente",
        "apellido": "Cat",
        "celular": "9988776655",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": "cliente_cat@test.com",
        "password": "Test1234!",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestCategoriaRead:
    def test_list_is_public(self, client):
        r = client.get(f"{_BASE}/")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_get_by_id(self, client, categoria):
        r = client.get(f"{_BASE}/{categoria['id']}")
        assert r.status_code == 200
        assert r.json()["nombre"] == "Pizzas Test"

    def test_get_nonexistent_returns_404(self, client):
        r = client.get(f"{_BASE}/999999")
        assert r.status_code == 404

    def test_tree_endpoint_is_public(self, client, categoria):
        r = client.get(f"{_BASE}/tree")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_tree_contains_created_category(self, client, categoria):
        r = client.get(f"{_BASE}/tree")
        names = [c["nombre"] for c in r.json()]
        assert "Pizzas Test" in names


class TestCategoriaCreate:
    def test_admin_can_create(self, client, admin_headers):
        r = client.post(f"{_BASE}/", json={"nombre": "Bebidas Test"}, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["nombre"] == "Bebidas Test"

    def test_create_with_parent(self, client, admin_headers, categoria):
        r = client.post(f"{_BASE}/", json={
            "nombre": "Pizzas Clásicas",
            "parent_id": categoria["id"],
        }, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["parent_id"] == categoria["id"]

    def test_client_cannot_create(self, client, client_headers):
        r = client.post(f"{_BASE}/", json={"nombre": "Hack"}, headers=client_headers)
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self, client):
        client.cookies.clear()
        r = client.post(f"{_BASE}/", json={"nombre": "Hack"})
        assert r.status_code == 401

    def test_create_missing_nombre_returns_422(self, client, admin_headers):
        r = client.post(f"{_BASE}/", json={"descripcion": "sin nombre"}, headers=admin_headers)
        assert r.status_code == 422


class TestCategoriaUpdate:
    def test_admin_can_update(self, client, admin_headers, categoria):
        r = client.put(
            f"{_BASE}/{categoria['id']}",
            json={"nombre": "Pizzas Artesanales"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["nombre"] == "Pizzas Artesanales"

    def test_client_cannot_update(self, client, client_headers, categoria):
        r = client.put(
            f"{_BASE}/{categoria['id']}",
            json={"nombre": "Hack"},
            headers=client_headers,
        )
        assert r.status_code == 403


class TestCategoriaDelete:
    def test_admin_can_delete(self, client, admin_headers, categoria):
        r = client.delete(f"{_BASE}/{categoria['id']}", headers=admin_headers)
        assert r.status_code == 204

    def test_client_cannot_delete(self, client, client_headers, categoria):
        r = client.delete(f"{_BASE}/{categoria['id']}", headers=client_headers)
        assert r.status_code == 403
