"""Configuracion global de pytest y fixtures compartidos.

Estrategia:
- Levanta un PostgreSQL temporal por sesion (pytest-postgresql)
- Crea todas las tablas via Base.metadata.create_all()
- Provee una app FastAPI con DB apuntando a esa BD
- Provee un cliente HTTP httpx que habla con la app via TestClient
- Al final de cada test, hace TRUNCATE a todas las tablas (mas rapido que drop/create)
"""

import os
import sys
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport

# Aniadir el directorio raiz al path para que 'import app' funcione
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Setear env vars ANTES de importar la app para que settings los lea
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("BACKEND_CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("MEDIA_STORAGE", "local")
os.environ.setdefault("SEED_DEFAULT_USERS", "false")


@pytest.fixture(scope="session")
def pg_url(request):
    """URL de la BD PostgreSQL temporal para toda la sesion de tests.

    Si existe TEST_DATABASE_URL se usa esa BD (útil cuando no hay binarios
    de postgres locales); si no, se levanta un PostgreSQL temporal.
    """
    override = os.environ.get("TEST_DATABASE_URL")
    if override:
        if "+asyncpg" not in override:
            override = override.replace("postgresql://", "postgresql+asyncpg://", 1)
        return override
    proc = request.getfixturevalue("postgresql_proc")
    return f"postgresql+asyncpg://{proc.user}@{proc.host}:{proc.port}/{proc.dbname}"


@pytest.fixture(scope="session", autouse=True)
def configure_db(pg_url):
    """Configura DATABASE_URL antes de que se importe ningun modulo de la app."""
    os.environ["DATABASE_URL"] = pg_url


@pytest.fixture(scope="session")
async def app(pg_url, configure_db):
    """App FastAPI con BD apuntando al Postgres de tests.

    Nota: se pide configure_db explícitamente para garantizar el orden:
    primero se fija DATABASE_URL y después se importa la app (el engine
    se crea al importar app.core.database).
    """
    # Importar DENTRO del fixture para que os.environ ya este seteado
    from app.core.database import engine, Base
    from app.main import app as fastapi_app
    from app.models import models  # noqa: F401  (asegura que los modelos se registran)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    return fastapi_app


@pytest.fixture(autouse=True)
async def clean_db(app):
    """Trunca todas las tablas despues de cada test."""
    from app.core.database import engine
    from sqlalchemy import text

    yield

    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE TABLE order_status_history, order_items, orders, "
            "chat_messages, chat_sessions, loyalty_points, products, "
            "subscription_payments, "
            "categories, tables, users, restaurants RESTART IDENTITY CASCADE"
        ))


@pytest.fixture
async def client(app):
    """Cliente HTTP async contra la app en memoria (sin red)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def superadmin_token(client):
    """Crea un superadmin directo en BD y devuelve su JWT.

    No usa /api/auth/register para no depender del flag
    ALLOW_PUBLIC_STAFF_REGISTRATION.
    """
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.models import User, UserRole

    async with AsyncSessionLocal() as session:
        session.add(User(
            name="Test Superadmin",
            email="super@test.com",
            hashed_password=hash_password("superpass123"),
            role=UserRole.superadmin,
            restaurant_id=None,
        ))
        await session.commit()

    response = await client.post(
        "/api/auth/login",
        data={"username": "super@test.com", "password": "superpass123"},
    )
    assert response.status_code == 200, f"Setup fallo: {response.text}"
    return response.json()["access_token"]


@pytest.fixture
async def auth_headers(superadmin_token):
    """Headers con Authorization Bearer para llamadas autenticadas."""
    return {"Authorization": f"Bearer {superadmin_token}"}


@pytest.fixture
async def created_restaurant(client, auth_headers):
    """Crea un restaurante via API y devuelve su data + el token del admin creado."""
    response = await client.post(
        "/api/restaurants/",
        headers=auth_headers,
        json={
            "name": "Restaurante Test",
            "slug": "test-rest",
            "admin_name": "Test Admin",
            "admin_email": "admin@test.com",
            "admin_password": "adminpass123",
        },
    )
    assert response.status_code == 201, f"Setup fallo: {response.text}"
    data = response.json()

    # Hacer login con el admin del restaurante
    login = await client.post(
        "/api/auth/login",
        data={"username": "admin@test.com", "password": "adminpass123"},
    )
    admin_token = login.json()["access_token"]

    return {
        "data": data,
        "admin_token": admin_token,
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
    }


@pytest.fixture
async def active_restaurant(client, created_restaurant):
    """Restaurante con trial activado (puede operar: crear mesas, productos...)."""
    rid = created_restaurant["data"]["id"]
    headers = created_restaurant["admin_headers"]
    response = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert response.status_code == 201, f"Setup fallo: {response.text}"
    return created_restaurant
