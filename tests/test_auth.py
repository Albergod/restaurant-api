"""Tests del flujo de autenticacion."""

import pytest


@pytest.mark.asyncio
async def test_register_crea_usuario_activo(client):
    response = await client.post(
        "/api/auth/register",
        json={
            "name": "Juan",
            "email": "juan@test.com",
            "password": "secret123",
            "role": "customer",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "juan@test.com"
    assert data["name"] == "Juan"
    assert data["role"] == "customer"
    assert data["is_active"] is True
    assert "hashed_password" not in data  # No debe filtrarse


@pytest.mark.asyncio
async def test_register_email_duplicado_retorna_400(client):
    body = {"name": "X", "email": "dup@test.com", "password": "p1234567", "role": "customer"}
    r1 = await client.post("/api/auth/register", json=body)
    assert r1.status_code == 201
    r2 = await client.post("/api/auth/register", json=body)
    assert r2.status_code == 400
    assert "ya est" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_register_staff_publico_bloqueado(client):
    """Por defecto ALLOW_PUBLIC_STAFF_REGISTRATION=false."""
    response = await client.post(
        "/api/auth/register",
        json={"name": "Hacker", "email": "h@test.com", "password": "p12345678", "role": "admin"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_login_con_credenciales_validas(client):
    await client.post(
        "/api/auth/register",
        json={"name": "Ana", "email": "ana@test.com", "password": "anapass", "role": "customer"},
    )
    response = await client.post(
        "/api/auth/login",
        data={"username": "ana@test.com", "password": "anapass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "customer"


@pytest.mark.asyncio
async def test_login_password_incorrecta_retorna_401(client):
    await client.post(
        "/api/auth/register",
        json={"name": "B", "email": "b@test.com", "password": "rightpass", "role": "customer"},
    )
    response = await client.post(
        "/api/auth/login",
        data={"username": "b@test.com", "password": "wrongpass"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_usuario_inexistente_retorna_401(client):
    response = await client.post(
        "/api/auth/login",
        data={"username": "nadie@test.com", "password": "cualquiera"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_con_token_valido(client):
    await client.post(
        "/api/auth/register",
        json={"name": "C", "email": "c@test.com", "password": "cpass123", "role": "customer"},
    )
    login = await client.post("/api/auth/login", data={"username": "c@test.com", "password": "cpass123"})
    token = login.json()["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "c@test.com"


@pytest.mark.asyncio
async def test_me_sin_token_retorna_401(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_token_invalido_retorna_401(client):
    response = await client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_jwt_contiene_restaurant_id(client, created_restaurant):
    """El token del admin debe llevar el restaurant_id."""
    headers = created_restaurant["admin_headers"]

    # Decodificar el payload sin verificar firma para inspeccionarlo
    import jwt
    from app.core.config import settings

    token = created_restaurant["admin_token"]
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    assert payload["role"] == "admin"
    assert payload["restaurant_id"] == created_restaurant["data"]["id"]


@pytest.mark.asyncio
async def test_jwt_superadmin_tiene_restaurant_id_null(client, superadmin_token):
    import jwt
    from app.core.config import settings

    payload = jwt.decode(superadmin_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["role"] == "superadmin"
    assert payload["restaurant_id"] is None
