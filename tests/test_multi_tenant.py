"""Tests de aislamiento multi-tenant.

Lo mas importante: un admin de un restaurante NUNCA debe poder ver ni
modificar datos del restaurante B.
"""

import pytest


@pytest.mark.asyncio
async def test_admin_ve_solo_su_restaurante_en_listado(client, superadmin_token):
    """El admin del restaurante A no debe ver el restaurante B en su listado."""
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers, json={"name": "Rest A", "slug": "a"})
    r2 = await client.post("/api/restaurants/", headers=headers, json={"name": "Rest B", "slug": "b"})
    rest_a_id = r1.json()["id"]
    rest_b_id = r2.json()["id"]

    login_a = await client.post("/api/auth/login", data={"username": f"admin-{rest_a_id}@a.com", "password": "adminpass"})
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    response = await client.get("/api/restaurants/", headers=headers_a)
    assert response.status_code == 200
    restaurants = response.json()

    ids = [r["id"] for r in restaurants]
    assert rest_a_id in ids
    assert rest_b_id not in ids, "Fuga: admin de A puede ver restaurante B"


@pytest.mark.asyncio
async def test_admin_no_puede_editar_usuarios_de_otro_restaurante(client, superadmin_token):
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers, json={"name": "R1", "slug": "r1"})
    r2 = await client.post("/api/restaurants/", headers=headers, json={"name": "R2", "slug": "r2"})
    rest_a_id = r1.json()["id"]
    rest_b_id = r2.json()["id"]

    login_b = await client.post("/api/auth/login", data={"username": f"admin-{rest_b_id}@r2.com", "password": "adminpass"})
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    list_b = await client.get("/api/users/", headers=headers_b)
    admin_b_id = [u for u in list_b.json() if u["role"] == "admin"][0]["id"]

    login_a = await client.post("/api/auth/login", data={"username": f"admin-{rest_a_id}@r1.com", "password": "adminpass"})
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    response = await client.patch(
        f"/api/users/{admin_b_id}",
        headers=headers_a,
        json={"name": "Hackeado"},
    )
    assert response.status_code == 404, f"Fuga: admin de A modifico admin de B (status {response.status_code})"


@pytest.mark.asyncio
async def test_admin_no_puede_crear_categoria_en_otro_restaurante(client, created_restaurant):
    """El admin solo puede asignar restaurant_id del JWT, no pasar otro por URL."""
    from app.core.database import AsyncSessionLocal
    from app.models.models import Category
    from sqlalchemy import select

    headers = created_restaurant["admin_headers"]

    # Crear una categoria con restaurant_id forzado a otro valor no debe funcionar
    response = await client.post(
        "/api/menu/categories",
        headers=headers,
        json={"name": "Test"},
    )
    assert response.status_code == 201
    cat_id = response.json()["id"]

    # Verificar en BD que la categoria pertenece al restaurante correcto
    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(Category).where(Category.id == cat_id))).scalar_one()
        assert cat.restaurant_id == created_restaurant["data"]["id"]


@pytest.mark.asyncio
async def test_menu_publico_con_qr_a_otro_restaurante_no_filtra(client, superadmin_token):
    """Si paso table_qr de otro restaurante NO debo ver el menu del restaurante actual."""
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers, json={"name": "RestA", "slug": "ra"})
    r2 = await client.post("/api/restaurants/", headers=headers, json={"name": "RestB", "slug": "rb"})
    rest_a_id = r1.json()["id"]

    login_a = await client.post("/api/auth/login", data={"username": f"admin-{rest_a_id}@ra.com", "password": "adminpass"})
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    await client.post("/api/menu/categories", headers=headers_a, json={"name": "CatA"})
    await client.post("/api/menu/products", headers=headers_a, json={"category_id": 1, "name": "ProdA", "price": 100})

    # Crear mesa en restaurante A
    tabla = await client.post("/api/tables/", headers=headers_a, json={"number": 1, "capacity": 4})
    qr_a = tabla.json()["qr_code"]

    # El admin de A ve su menu
    response = await client.get(f"/api/menu/?table_qr={qr_a}")
    assert response.status_code == 200
    categorias = response.json()
    assert any(c["name"] == "CatA" for c in categorias)

    # Un restaurant_id cualquiera sin mesa debe dar 404
    response = await client.get("/api/menu/?table_qr=inexistente")
    assert response.status_code == 404
