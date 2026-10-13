"""Loyalty, reset de restaurante y subida de imágenes (API)."""
import io

import pytest

pytestmark = pytest.mark.asyncio


async def test_loyalty_add_and_me(client, active_restaurant):
    headers = active_restaurant["admin_headers"]
    # El admin se da puntos a sí mismo (flujo básico crear → leer).
    me = await client.get("/api/loyalty/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["points"] == 0

    # Necesitamos un user_id válido: usamos el propio admin.
    from app.core.database import AsyncSessionLocal
    from app.models.models import User
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        admin = (
            await session.execute(select(User).where(User.email == "admin@test.com"))
        ).scalar_one()

    added = await client.post(f"/api/loyalty/add/{admin.id}?points=10", headers=headers)
    assert added.status_code == 200, added.text
    assert added.json()["points"] == 10

    me2 = await client.get("/api/loyalty/me", headers=headers)
    assert me2.json()["points"] == 10


async def test_loyalty_forbidden_for_customer(client):
    customer = await client.post(
        "/api/auth/register",
        json={"name": "C", "email": "loyal-c@t.co", "password": "cpass1234", "role": "customer"},
    )
    assert customer.status_code == 201, customer.text
    login = await client.post("/api/auth/login", data={"username": "loyal-c@t.co", "password": "cpass1234"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    denied = await client.post("/api/loyalty/add/1?points=5", headers=headers)
    assert denied.status_code == 403, denied.text


async def test_upload_image_and_reject_invalid(client, active_restaurant, tmp_path):
    headers = active_restaurant["admin_headers"]
    png_min = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    response = await client.post(
        "/api/uploads/",
        headers=headers,
        files={"file": ("test.png", png_min, "image/png")},
    )
    assert response.status_code == 200, response.text
    url = response.json()["url"]
    assert url.startswith("/uploads/") or url.startswith("http")

    bad = await client.post(
        "/api/uploads/",
        headers=headers,
        files={"file": ("evil.txt", b"hola", "text/plain")},
    )
    assert bad.status_code == 400, bad.text


async def test_reset_restaurant_clears_content(client, auth_headers, active_restaurant):
    headers = active_restaurant["admin_headers"]
    rid = active_restaurant["data"]["id"]
    # Algo de contenido previo.
    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert cat.status_code == 201, cat.text

    denied = await client.post(f"/api/restaurants/{rid}/reset", headers=headers)
    assert denied.status_code == 403, denied.text

    reset = await client.post(f"/api/restaurants/{rid}/reset", headers=auth_headers)
    assert reset.status_code == 200, reset.text

    menu = await client.get("/api/menu/", headers=headers)
    assert menu.status_code == 200, menu.text
    assert menu.json() == []
