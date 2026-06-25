"""
Test configuration and shared fixtures.

Requires PostgreSQL with a test database:
    CREATE DATABASE parcial_db_test;

Override with env var:
    TEST_DATABASE_URL=postgresql://user:pass@localhost/mytest pytest
"""
import os

# Set env vars BEFORE any backend import so pydantic Settings reads test values
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/parcial_db_test",
)
os.environ["RATE_LIMIT_AUTH_BURST"] = "10000"
os.environ["RATE_LIMIT_AUTH_PER_MINUTE"] = "10000.0"
os.environ["RATE_LIMIT_DEFAULT_BURST"] = "10000"
os.environ["RATE_LIMIT_DEFAULT_PER_MINUTE"] = "10000.0"

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, text

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

# Tables to truncate between tests (FK-ordered: children before parents)
_TRUNCATE_TABLES = [
    "historial_estado_pedido",
    "detalle_pedido",
    "pedido",
    "direccion_entrega",
    "usuario_rol",
    "usuario",
    "producto_ingrediente",
    "producto_categoria",
    "producto",
    "categoria",
    "ingrediente",
]


@pytest.fixture(scope="session")
def test_engine():
    """Create all tables once per session against the test database."""
    # Import all models so SQLModel.metadata is fully populated
    import backend.models  # noqa: F401
    from backend.models import pedido as _pedido_models  # noqa: F401

    engine = create_engine(TEST_DATABASE_URL, echo=False)
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def app(test_engine):
    """App with get_session overridden to use the test database."""
    from backend.main import app as _app
    from backend.database import get_session

    def _override():
        with Session(test_engine) as session:
            yield session

    _app.dependency_overrides[get_session] = _override
    yield _app
    _app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def client(app):
    """Single TestClient shared across the session (lifespan runs once)."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_and_reseed(test_engine, client):
    """
    Before each test:
    - Clear session cookies so auth state doesn't leak between tests
    - Truncate all transactional tables
    - Re-seed lookup + admin data
    """
    client.cookies.clear()

    with test_engine.connect() as conn:
        conn.execute(
            text(
                "TRUNCATE "
                + ", ".join(_TRUNCATE_TABLES)
                + " RESTART IDENTITY CASCADE"
            )
        )
        conn.commit()

    from backend.core.seed import seed_all

    with Session(test_engine) as session:
        seed_all(session)

    yield


# ---------------------------------------------------------------------------
# Shared fixtures used across multiple test modules
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_headers(client):
    """Login as the seeded admin and return Bearer auth headers."""
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@admin.com", "password": "admin12345"},
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def unidad_id(client):
    """Return the id of the first available unidad de medida (e.g. Gramos)."""
    r = client.get("/api/v1/lookups/unidades-medida")
    return r.json()[0]["id"]
