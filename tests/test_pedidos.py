"""
Tests for /api/v1/pedidos/* endpoints.
Covers: create, FSM transitions, cancel, historial, list permissions.
"""
import pytest

_AUTH = "/api/v1/auth"
_PEDIDOS = "/api/v1/pedidos"
_INGREDIENTES = "/api/v1/ingredientes"
_PRODUCTOS = "/api/v1/productos"
_LOOKUPS = "/api/v1/lookups"
_DIRS = "/api/v1/direcciones"

_ADMIN = {"email": "admin@admin.com", "password": "admin12345"}
_CLIENT_PAYLOAD = {
    "email": "cliente@test.com",
    "password": "Test1234!",
    "nombre": "Cliente",
    "apellido": "Test",
    "celular": "1122334455",
}


# ---------------------------------------------------------------------------
# Fixtures  (admin_headers and unidad_id come from conftest.py)
# ---------------------------------------------------------------------------

@pytest.fixture
def client_user(client):
    client.post(f"{_AUTH}/register", json=_CLIENT_PAYLOAD)
    r = client.post(f"{_AUTH}/login", json={
        "email": _CLIENT_PAYLOAD["email"],
        "password": _CLIENT_PAYLOAD["password"],
    })
    assert r.status_code == 200, r.text
    return {
        "id": r.json()["user"]["id"],
        "token": r.json()["access_token"],
        "headers": {"Authorization": f"Bearer {r.json()['access_token']}"},
    }


@pytest.fixture
def ingrediente_id(client, admin_headers, unidad_id):
    r = client.post(f"{_INGREDIENTES}/", json={
        "nombre": "Harina Test",
        "es_alergeno": False,
        "stock_cantidad": 5000,
        "unidad_medida_id": unidad_id,
    }, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture
def producto_id(client, admin_headers, ingrediente_id, unidad_id):
    r = client.post(f"{_PRODUCTOS}/", json={
        "nombre": "Pizza Test",
        "precio_base": 500.0,
        "disponible": True,
        "categorias_ids": [],
        "ingredientes": [{
            "ingrediente_id": ingrediente_id,
            "cantidad": "1.000",
            "unidad_medida_id": unidad_id,
            "es_removible": False,
        }],
    }, headers=admin_headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture
def direccion_id(client, client_user):
    r = client.post(f"{_DIRS}/", json={
        "linea1": "Calle Falsa 123",
        "ciudad": "Buenos Aires",
        "es_principal": True,
    }, headers=client_user["headers"])
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.fixture
def forma_pago_id(client):
    r = client.get(f"{_LOOKUPS}/formas-pago")
    efectivo = next(f for f in r.json() if f["codigo"] == "EFECTIVO")
    return efectivo["id"]


@pytest.fixture
def pedido_payload(forma_pago_id, producto_id, direccion_id):
    return {
        "forma_pago_id": forma_pago_id,
        "direccion_id": direccion_id,
        "items": [{"producto_id": producto_id, "cantidad": 1}],
        "notas": "Test order",
    }


@pytest.fixture
def pedido(client, client_user, pedido_payload):
    r = client.post(f"{_PEDIDOS}/", json=pedido_payload, headers=client_user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Pedido creation
# ---------------------------------------------------------------------------

class TestPedidoCreate:
    def test_create_success(self, client, client_user, pedido_payload):
        r = client.post(f"{_PEDIDOS}/", json=pedido_payload, headers=client_user["headers"])
        assert r.status_code == 201
        data = r.json()
        assert data["estado"]["codigo"] == "PENDIENTE"
        assert data["total"] > 0
        assert len(data["detalles"]) == 1
        # Creation is recorded in historial
        assert len(data["historial"]) == 1
        assert data["historial"][0]["estado_desde"] is None

    def test_total_equals_subtotal_plus_envio(self, client, client_user, pedido_payload):
        r = client.post(f"{_PEDIDOS}/", json=pedido_payload, headers=client_user["headers"])
        data = r.json()
        expected = round(data["subtotal"] - data["descuento"] + data["costo_envio"], 2)
        assert round(data["total"], 2) == expected

    def test_create_unauthenticated_returns_401(self, client, pedido_payload):
        client.cookies.clear()  # drop any fixture-set auth cookie
        r = client.post(f"{_PEDIDOS}/", json=pedido_payload)
        assert r.status_code == 401

    def test_create_empty_items_returns_422(self, client, client_user, forma_pago_id, direccion_id):
        r = client.post(f"{_PEDIDOS}/", json={
            "forma_pago_id": forma_pago_id,
            "direccion_id": direccion_id,
            "items": [],
        }, headers=client_user["headers"])
        assert r.status_code == 422

    def test_create_with_foreign_address_returns_404(
        self, client, client_user, admin_headers, pedido_payload
    ):
        # Create an address belonging to admin
        r = client.post(f"{_DIRS}/", json={
            "linea1": "Admin St 1",
            "ciudad": "Córdoba",
        }, headers=admin_headers)
        admin_dir_id = r.json()["id"]

        payload = {**pedido_payload, "direccion_id": admin_dir_id}
        r = client.post(f"{_PEDIDOS}/", json=payload, headers=client_user["headers"])
        assert r.status_code == 404

    def test_create_decrements_ingredient_stock(
        self, client, client_user, pedido_payload, ingrediente_id, admin_headers
    ):
        stock_before = client.get(
            f"{_INGREDIENTES}/{ingrediente_id}", headers=admin_headers
        ).json()["stock_cantidad"]

        client.post(f"{_PEDIDOS}/", json=pedido_payload, headers=client_user["headers"])

        stock_after = client.get(
            f"{_INGREDIENTES}/{ingrediente_id}", headers=admin_headers
        ).json()["stock_cantidad"]
        assert stock_after < stock_before


# ---------------------------------------------------------------------------
# FSM transitions
# ---------------------------------------------------------------------------

class TestPedidoFSM:
    def test_pendiente_to_confirmado(self, client, pedido, admin_headers):
        r = client.patch(
            f"{_PEDIDOS}/{pedido['id']}/estado",
            json={"estado": "CONFIRMADO"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["estado"]["codigo"] == "CONFIRMADO"

    def test_confirmado_to_en_preparacion(self, client, pedido, admin_headers):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CONFIRMADO"}, headers=admin_headers)
        r = client.patch(
            f"{_PEDIDOS}/{pid}/estado",
            json={"estado": "EN_PREP"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["estado"]["codigo"] == "EN_PREP"

    def test_en_preparacion_to_entregado(self, client, pedido, admin_headers):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CONFIRMADO"}, headers=admin_headers)
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "EN_PREP"}, headers=admin_headers)
        r = client.patch(
            f"{_PEDIDOS}/{pid}/estado",
            json={"estado": "ENTREGADO"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["estado"]["codigo"] == "ENTREGADO"

    def test_invalid_transition_returns_409(self, client, pedido, admin_headers):
        """PENDIENTE → EN_PREP is not allowed; must go through CONFIRMADO."""
        r = client.patch(
            f"{_PEDIDOS}/{pedido['id']}/estado",
            json={"estado": "EN_PREP"},
            headers=admin_headers,
        )
        assert r.status_code == 409

    def test_terminal_state_cannot_be_changed(self, client, pedido, admin_headers):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CANCELADO"}, headers=admin_headers)
        r = client.patch(
            f"{_PEDIDOS}/{pid}/estado",
            json={"estado": "CONFIRMADO"},
            headers=admin_headers,
        )
        assert r.status_code == 409

    def test_entregado_is_terminal(self, client, pedido, admin_headers):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CONFIRMADO"}, headers=admin_headers)
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "EN_PREP"}, headers=admin_headers)
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "ENTREGADO"}, headers=admin_headers)
        r = client.patch(
            f"{_PEDIDOS}/{pid}/estado",
            json={"estado": "CANCELADO"},
            headers=admin_headers,
        )
        assert r.status_code == 409

    def test_client_cannot_use_estado_endpoint(self, client, pedido, client_user):
        r = client.patch(
            f"{_PEDIDOS}/{pedido['id']}/estado",
            json={"estado": "CONFIRMADO"},
            headers=client_user["headers"],
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cancellation
# ---------------------------------------------------------------------------

class TestCancelar:
    def test_client_can_cancel_pendiente(self, client, pedido, client_user):
        r = client.post(
            f"{_PEDIDOS}/{pedido['id']}/cancelar",
            json={},
            headers=client_user["headers"],
        )
        assert r.status_code == 200
        assert r.json()["estado"]["codigo"] == "CANCELADO"

    def test_cancel_restores_ingredient_stock(
        self, client, pedido, client_user, ingrediente_id, admin_headers
    ):
        stock_after_order = client.get(
            f"{_INGREDIENTES}/{ingrediente_id}", headers=admin_headers
        ).json()["stock_cantidad"]

        client.post(
            f"{_PEDIDOS}/{pedido['id']}/cancelar",
            json={},
            headers=client_user["headers"],
        )

        stock_after_cancel = client.get(
            f"{_INGREDIENTES}/{ingrediente_id}", headers=admin_headers
        ).json()["stock_cantidad"]
        assert stock_after_cancel > stock_after_order

    def test_client_cannot_cancel_en_preparacion(
        self, client, pedido, admin_headers, client_user
    ):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CONFIRMADO"}, headers=admin_headers)
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "EN_PREP"}, headers=admin_headers)

        r = client.post(
            f"{_PEDIDOS}/{pid}/cancelar",
            json={},
            headers=client_user["headers"],
        )
        assert r.status_code == 409

    def test_client_cannot_cancel_others_pedido(self, client, pedido):
        other = {
            "email": "otro@test.com",
            "password": "Test1234!",
            "nombre": "Otro",
            "apellido": "User",
            "celular": "9988776655",
        }
        client.post(f"{_AUTH}/register", json=other)
        token = client.post(f"{_AUTH}/login", json={
            "email": other["email"], "password": other["password"]
        }).json()["access_token"]

        r = client.post(
            f"{_PEDIDOS}/{pedido['id']}/cancelar",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403

    def test_delete_alias_cancels_pedido(self, client, pedido, client_user):
        r = client.delete(
            f"{_PEDIDOS}/{pedido['id']}",
            headers=client_user["headers"],
        )
        assert r.status_code == 200
        assert r.json()["estado"]["codigo"] == "CANCELADO"


# ---------------------------------------------------------------------------
# Historial
# ---------------------------------------------------------------------------

class TestHistorial:
    def test_creation_logged(self, client, pedido, client_user):
        r = client.get(
            f"{_PEDIDOS}/{pedido['id']}/historial",
            headers=client_user["headers"],
        )
        assert r.status_code == 200
        historial = r.json()
        assert len(historial) == 1
        assert historial[0]["estado_desde"] is None
        assert historial[0]["estado_hacia"]["codigo"] == "PENDIENTE"

    def test_transition_appended(self, client, pedido, admin_headers, client_user):
        pid = pedido["id"]
        client.patch(
            f"{_PEDIDOS}/{pid}/estado",
            json={"estado": "CONFIRMADO", "motivo": "OK"},
            headers=admin_headers,
        )
        r = client.get(
            f"{_PEDIDOS}/{pid}/historial",
            headers=client_user["headers"],
        )
        historial = r.json()
        assert len(historial) == 2
        assert historial[1]["estado_hacia"]["codigo"] == "CONFIRMADO"
        assert historial[1]["motivo"] == "OK"

    def test_sorted_chronologically(self, client, pedido, admin_headers, client_user):
        pid = pedido["id"]
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "CONFIRMADO"}, headers=admin_headers)
        client.patch(f"{_PEDIDOS}/{pid}/estado", json={"estado": "EN_PREP"}, headers=admin_headers)

        historial = client.get(
            f"{_PEDIDOS}/{pid}/historial",
            headers=client_user["headers"],
        ).json()
        assert len(historial) == 3
        # Each entry's created_at >= the previous
        timestamps = [h["created_at"] for h in historial]
        assert timestamps == sorted(timestamps)

    def test_unauthenticated_returns_401(self, client, pedido):
        client.cookies.clear()
        r = client.get(f"{_PEDIDOS}/{pedido['id']}/historial")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# List / permissions
# ---------------------------------------------------------------------------

class TestPedidoList:
    def test_me_returns_own_pedidos(self, client, pedido, client_user):
        r = client.get(f"{_PEDIDOS}/me", headers=client_user["headers"])
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["usuario_id"] == client_user["id"]

    def test_admin_list_returns_all(self, client, pedido, admin_headers):
        r = client.get(f"{_PEDIDOS}/", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_client_cannot_access_admin_list(self, client, pedido, client_user):
        r = client.get(f"{_PEDIDOS}/", headers=client_user["headers"])
        assert r.status_code == 403

    def test_client_can_view_own_pedido(self, client, pedido, client_user):
        r = client.get(f"{_PEDIDOS}/{pedido['id']}", headers=client_user["headers"])
        assert r.status_code == 200

    def test_client_cannot_view_others_pedido(self, client, pedido):
        other = {
            "email": "spy@test.com",
            "password": "Test1234!",
            "nombre": "Spy",
            "apellido": "User",
            "celular": "1111111111",
        }
        client.post(f"{_AUTH}/register", json=other)
        token = client.post(f"{_AUTH}/login", json={
            "email": other["email"], "password": other["password"]
        }).json()["access_token"]

        r = client.get(
            f"{_PEDIDOS}/{pedido['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403
