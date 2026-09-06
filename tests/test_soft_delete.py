"""Tests del patron soft-delete.

Categorias y restaurantes usan is_active=false en vez de DELETE fisico
para preservar integridad referencial de pedidos historicos.
"""

import pytest


@pytest.mark.asyncio
async def test_desactivar_categoria_no_la_borra_de_bd(client, created_restaurant):
    headers = created_restaurant["admin_headers"]

    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Postres"})
    cat_id = cat.json()["id"]

    response = await client.delete(f"/api/menu/categories/{cat_id}", headers=headers)
    assert response.status_code == 204

    # La categoria sigue en la BD pero con is_active=false
    from app.core.database import AsyncSessionLocal
    from app.models.models import Category
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        cat_db = (await db.execute(select(Category).where(Category.id == cat_id))).scalar_one_or_none()
        assert cat_db is not None, "La categoria fue borrada fisicamente"
        assert cat_db.is_active is False


@pytest.mark.asyncio
async def test_categoria_desactivada_no_aparece_en_menu_publico(client, created_restaurant):
    headers = created_restaurant["admin_headers"]

    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Temporal"})
    cat_id = cat.json()["id"]

    response = await client.delete(f"/api/menu/categories/{cat_id}", headers=headers)
    assert response.status_code == 204

    response = await client.get("/api/menu/")
    assert response.status_code == 200
    nombres = [c["name"] for c in response.json()]
    assert "Temporal" not in nombres


@pytest.mark.asyncio
async def test_no_se_puede_desactivar_ultimo_restaurante_activo(client, superadmin_token):
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    response = await client.post("/api/restaurants/", headers=headers, json={"name": "Unico", "slug": "unico"})
    rest_id = response.json()["id"]

    response = await client.delete(f"/api/restaurants/{rest_id}", headers=headers)
    assert response.status_code == 400
    assert "nico" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_puede_desactivar_si_hay_otro_activo(client, superadmin_token):
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers, json={"name": "A", "slug": "a1"})
    r2 = await client.post("/api/restaurants/", headers=headers, json={"name": "B", "slug": "b1"})
    r2_id = r2.json()["id"]

    response = await client.delete(f"/api/restaurants/{r2_id}", headers=headers)
    assert response.status_code == 204

    response = await client.get("/api/restaurants/", headers=headers)
    estados = {r["id"]: r["is_active"] for r in response.json()}
    assert estados[r1.json()["id"]] is True
    assert estados[r2_id] is False


@pytest.mark.asyncio
async def test_reactivar_restaurante(client, superadmin_token):
    headers = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers, json={"name": "A", "slug": "a2"})
    r2 = await client.post("/api/restaurants/", headers=headers, json={"name": "B", "slug": "b2"})
    r2_id = r2.json()["id"]

    await client.delete(f"/api/restaurants/{r2_id}", headers=headers)

    response = await client.post(f"/api/restaurants/{r2_id}/reactivate", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is True


@pytest.mark.asyncio
async def test_producto_no_aparece_si_is_available_false(client, created_restaurant):
    headers = created_restaurant["admin_headers"]

    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Cat"})
    cat_id = cat.json()["id"]

    prod = await client.post(
        "/api/menu/products",
        headers=headers,
        json={"category_id": cat_id, "name": "Hamburguesa", "price": 15000},
    )
    prod_id = prod.json()["id"]

    response = await client.patch(
        f"/api/menu/products/{prod_id}",
        headers=headers,
        json={"is_available": False},
    )
    assert response.status_code == 200

    # El menu publico no debe mostrarlo
    tabla = await client.post("/api/tables/", headers=headers, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]
    response = await client.get(f"/api/menu/?table_qr={qr}")
    categorias = response.json()
    productos_visibles = [p for c in categorias for p in c["products"]]
    assert "Hamburguesa" not in [p["name"] for p in productos_visibles]
