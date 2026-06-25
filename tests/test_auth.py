"""
Tests for /api/v1/auth/* endpoints.
Covers: register, login, /me, /refresh, /logout.
"""
import pytest

_BASE = "/api/v1/auth"

_USER = {
    "email": "testuser@test.com",
    "password": "Test1234!",
    "nombre": "Test",
    "apellido": "User",
    "celular": "1234567890",
}


def _register(client, payload=None):
    return client.post(f"{_BASE}/register", json=payload or _USER)


def _login(client, email=None, password=None):
    return client.post(
        f"{_BASE}/login",
        json={"email": email or _USER["email"], "password": password or _USER["password"]},
    )


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

class TestRegister:
    def test_success(self, client):
        r = _register(client)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == _USER["email"]
        assert data["nombre"] == _USER["nombre"]
        assert "id" in data
        assert "password_hash" not in data

    def test_default_role_is_client(self, client):
        r = _register(client)
        roles = [rol["codigo"] for rol in r.json()["roles"]]
        assert "CLIENT" in roles
        assert "ADMIN" not in roles

    def test_duplicate_email_returns_409(self, client):
        _register(client)
        r = _register(client)
        assert r.status_code == 409

    def test_invalid_email_returns_422(self, client):
        r = _register(client, {**_USER, "email": "not-an-email"})
        assert r.status_code == 422

    def test_short_password_returns_422(self, client):
        r = _register(client, {**_USER, "password": "short"})
        assert r.status_code == 422

    def test_missing_required_field_returns_422(self, client):
        payload = {k: v for k, v in _USER.items() if k != "nombre"}
        r = _register(client, payload)
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_success_returns_access_token(self, client):
        _register(client)
        r = _login(client)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["access_token"] != ""
        assert data["token_type"] == "bearer"

    def test_success_sets_access_cookie(self, client):
        _register(client)
        r = _login(client)
        assert r.status_code == 200
        assert "access_token" in r.headers.get("set-cookie", "")

    def test_success_returns_refresh_token(self, client):
        _register(client)
        r = _login(client)
        assert r.json().get("refresh_token") is not None

    def test_wrong_password_returns_401(self, client):
        _register(client)
        r = _login(client, password="wrongpassword")
        assert r.status_code == 401

    def test_nonexistent_user_returns_401(self, client):
        r = _login(client, email="nobody@nowhere.com")
        assert r.status_code == 401

    def test_response_includes_user_data(self, client):
        _register(client)
        r = _login(client)
        user = r.json()["user"]
        assert user["email"] == _USER["email"]
        assert "roles" in user


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

class TestMe:
    def test_returns_own_profile(self, client):
        _register(client)
        token = _login(client).json()["access_token"]
        r = client.get(f"{_BASE}/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == _USER["email"]

    def test_unauthenticated_returns_401(self, client):
        r = client.get(f"{_BASE}/me")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, client):
        r = client.get(
            f"{_BASE}/me", headers={"Authorization": "Bearer invalid.jwt.token"}
        )
        assert r.status_code == 401

    def test_admin_has_admin_role(self, client):
        r = client.post(
            f"{_BASE}/login", json={"email": "admin@admin.com", "password": "admin12345"}
        )
        token = r.json()["access_token"]
        me = client.get(f"{_BASE}/me", headers={"Authorization": f"Bearer {token}"}).json()
        roles = [rol["codigo"] for rol in me["roles"]]
        assert "ADMIN" in roles


# ---------------------------------------------------------------------------
# /refresh
# ---------------------------------------------------------------------------

class TestRefresh:
    def test_returns_new_access_token(self, client):
        _register(client)
        login_data = _login(client).json()
        refresh_token = login_data["refresh_token"]

        r = client.post(
            f"{_BASE}/refresh",
            cookies={"refresh_token": refresh_token},
        )
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["access_token"] != ""

    def test_no_cookie_returns_401(self, client):
        r = client.post(f"{_BASE}/refresh")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, client):
        r = client.post(
            f"{_BASE}/refresh",
            cookies={"refresh_token": "invalid.refresh.token"},
        )
        assert r.status_code == 401

    def test_access_token_cannot_be_used_as_refresh(self, client):
        """Access tokens have type 'access', refresh endpoint expects type 'refresh'."""
        _register(client)
        access_token = _login(client).json()["access_token"]
        r = client.post(
            f"{_BASE}/refresh",
            cookies={"refresh_token": access_token},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# /logout
# ---------------------------------------------------------------------------

class TestLogout:
    def test_returns_204(self, client):
        _register(client)
        _login(client)
        r = client.post(f"{_BASE}/logout")
        assert r.status_code == 204
