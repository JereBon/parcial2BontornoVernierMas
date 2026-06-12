"""
Integration tests for /api/v1/direcciones/* endpoints.
Covers: CRUD per user, principal address, auth restrictions, isolation between users.
"""
import pytest

_BASE = "/api/v1/direcciones"
_AUTH = "/api/v1/auth"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(client):
    client.post(f"{_AUTH}/register", json={
        "email": "user_a@test.com",
        "password": "Test1234!",
        "nombre": "Usuario",
        "apellido": "Alpha",
        "celular": "1111111111",
    })
    r = client.post(f"{_AUTH}/login", json={"email": "user_a@test.com", "password": "Test1234!"})
    token = r.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "token": token}


@pytest.fixture
def user_b(client):
    client.post(f"{_AUTH}/register", json={
        "email": "user_b@test.com",
        "password": "Test1234!",
        "nombre": "Usuario",
        "apellido": "Beta",
        "celular": "2222222222",
    })
    r = client.post(f"{_AUTH}/login", json={"email": "user_b@test.com", "password": "Test1234!"})
    token = r.json()["access_token"]
    return {"headers": {"Authorization": f"Bearer {token}"}, "token": token}


@pytest.fixture
def direccion_a(client, user_a):
    r = client.post(f"{_BASE}/", json={
        "linea1": "Av. Siempre Viva 742",
        "ciudad": "Springfield",
        "es_principal": True,
    }, headers=user_a["headers"])
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDireccionCreate:
    def test_authenticated_user_can_create(self, client, user_a):
        r = client.post(f"{_BASE}/", json={
            "linea1": "Calle Falsa 123",
            "ciudad": "Buenos Aires",
        }, headers=user_a["headers"])
        assert r.status_code == 201
        data = r.json()
        assert data["linea1"] == "Calle Falsa 123"
        assert data["ciudad"] == "Buenos Aires"

    def test_address_belongs_to_creator(self, client, user_a, direccion_a):
        r = client.get(f"{_BASE}/{direccion_a['id']}", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["id"] == direccion_a["id"]

    def test_unauthenticated_cannot_create(self, client):
        client.cookies.clear()
        r = client.post(f"{_BASE}/", json={"linea1": "Fake St", "ciudad": "City"})
        assert r.status_code == 401

    def test_create_missing_required_field_returns_422(self, client, user_a):
        r = client.post(f"{_BASE}/", json={"ciudad": "Solo ciudad"}, headers=user_a["headers"])
        assert r.status_code == 422


class TestDireccionRead:
    def test_list_returns_only_own(self, client, user_a, user_b, direccion_a):
        # User B creates their own address
        client.post(f"{_BASE}/", json={"linea1": "Otro st 1", "ciudad": "Córdoba"},
                    headers=user_b["headers"])

        r_a = client.get(f"{_BASE}/", headers=user_a["headers"])
        r_b = client.get(f"{_BASE}/", headers=user_b["headers"])

        ids_a = {d["id"] for d in r_a.json()}
        ids_b = {d["id"] for d in r_b.json()}
        assert not ids_a.intersection(ids_b)

    def test_cannot_read_other_users_address(self, client, user_a, user_b, direccion_a):
        r = client.get(f"{_BASE}/{direccion_a['id']}", headers=user_b["headers"])
        assert r.status_code in (403, 404)

    def test_unauthenticated_cannot_list(self, client):
        client.cookies.clear()
        r = client.get(f"{_BASE}/")
        assert r.status_code == 401


class TestDireccionUpdate:
    def test_owner_can_update(self, client, user_a, direccion_a):
        r = client.put(
            f"{_BASE}/{direccion_a['id']}",
            json={"linea1": "Av. Actualizada 999", "ciudad": "Rosario"},
            headers=user_a["headers"],
        )
        assert r.status_code == 200
        assert r.json()["linea1"] == "Av. Actualizada 999"

    def test_other_user_cannot_update(self, client, user_b, direccion_a):
        r = client.put(
            f"{_BASE}/{direccion_a['id']}",
            json={"linea1": "Hackeada 1", "ciudad": "Nowhere"},
            headers=user_b["headers"],
        )
        assert r.status_code in (403, 404)

    def test_set_as_principal(self, client, user_a, direccion_a):
        # Create a second address
        r2 = client.post(f"{_BASE}/", json={
            "linea1": "Segunda 456",
            "ciudad": "Mendoza",
            "es_principal": False,
        }, headers=user_a["headers"])
        second_id = r2.json()["id"]

        r = client.patch(f"{_BASE}/{second_id}/principal", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["es_principal"] is True


class TestDireccionDelete:
    def test_owner_can_delete(self, client, user_a, direccion_a):
        r = client.delete(f"{_BASE}/{direccion_a['id']}", headers=user_a["headers"])
        assert r.status_code == 204

    def test_other_user_cannot_delete(self, client, user_b, direccion_a):
        r = client.delete(f"{_BASE}/{direccion_a['id']}", headers=user_b["headers"])
        assert r.status_code in (403, 404)
