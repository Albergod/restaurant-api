"""Tests del flujo de pedidos."""

import pytest


@pytest.mark.asyncio
async def test_crear_pedido_en_mesa_calcula_total(client, active_restaurant):
    headers = active_restaurant["admin_headers"]

    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Cat"})
    cat_id = cat.json()["id"]
    prod = await client.post(
        "/api/menu/products",
        headers=headers,
        json={"category_id": cat_id, "name": "Pizza", "price": 12000},
    )
    prod_id = prod.json()["id"]

    tabla = await client.post("/api/tables/", headers=headers, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]

    response = await client.post(
        "/api/orders/",
        json={
            "table_qr": qr,
            "order_type": "dine_in",
            "items": [{"product_id": prod_id, "quantity": 3, "observations": "sin oregano"}],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["total"] == 36000  # 12000 * 3
    assert data["status"] == "pending"
    assert data["order_type"] == "dine_in"
    assert data["restaurant_id"] == active_restaurant["data"]["id"]
    assert data["table_number"] == 1


@pytest.mark.asyncio
async def test_crear_pedido_sin_items_retorna_400(client, active_restaurant):
    headers = active_restaurant["admin_headers"]
    tabla = await client.post("/api/tables/", headers=headers, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]

    response = await client.post(
        "/api/orders/",
        json={"table_qr": qr, "order_type": "dine_in", "items": []},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_crear_pedido_con_qr_inexistente_retorna_404(client):
    response = await client.post(
        "/api/orders/",
        json={
            "table_qr": "no-existe",
            "order_type": "dine_in",
            "items": [{"product_id": 1, "quantity": 1}],
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_promocion_aplica_precio_promocional(client, active_restaurant):
    headers = active_restaurant["admin_headers"]
    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Cat"})
    cat_id = cat.json()["id"]
    prod = await client.post(
        "/api/menu/products",
        headers=headers,
        json={"category_id": cat_id, "name": "Combo", "price": 20000, "is_promoted": True, "promo_price": 15000},
    )
    prod_id = prod.json()["id"]

    tabla = await client.post("/api/tables/", headers=headers, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]

    response = await client.post(
        "/api/orders/",
        json={
            "table_qr": qr,
            "order_type": "dine_in",
            "items": [{"product_id": prod_id, "quantity": 2}],
        },
    )
    assert response.status_code == 201
    assert response.json()["total"] == 30000  # 15000 * 2, no 20000


@pytest.mark.asyncio
async def test_cambiar_estado_pedido_como_mesero(client, active_restaurant):
    """El mesero puede confirmar (pending -> confirmed)."""
    headers_admin = active_restaurant["admin_headers"]
    tabla = await client.post("/api/tables/", headers=headers_admin, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]
    cat = await client.post("/api/menu/categories", headers=headers_admin, json={"name": "Cat"})
    prod = await client.post("/api/menu/products", headers=headers_admin, json={"category_id": cat.json()["id"], "name": "X", "price": 100})

    pedido = await client.post(
        "/api/orders/",
        json={"table_qr": qr, "order_type": "dine_in", "items": [{"product_id": prod.json()["id"], "quantity": 1}]},
    )
    pedido_id = pedido.json()["id"]

    # El admin crea al mesero (el registro público de staff está desactivado)
    mesero = await client.post(
        "/api/users/",
        headers=headers_admin,
        json={"name": "Mesero", "email": "mesero@test.com", "password": "meseropass", "role": "waiter"},
    )
    assert mesero.status_code == 201, mesero.text
    login_mesero = await client.post(
        "/api/auth/login", data={"username": "mesero@test.com", "password": "meseropass"}
    )
    assert login_mesero.status_code == 200, login_mesero.text
    headers_mesero = {"Authorization": f"Bearer {login_mesero.json()['access_token']}"}
    response = await client.patch(
        f"/api/orders/{pedido_id}/status",
        headers=headers_mesero,
        json={"status": "confirmed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_mesero_no_puede_marcar_preparando(client, superadmin_token, active_restaurant):
    """Mesero solo puede: confirmed, delivered, cancelled."""
    headers_admin = active_restaurant["admin_headers"]
    tabla = await client.post("/api/tables/", headers=headers_admin, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]
    cat = await client.post("/api/menu/categories", headers=headers_admin, json={"name": "Cat"})
    prod = await client.post("/api/menu/products", headers=headers_admin, json={"category_id": cat.json()["id"], "name": "X", "price": 100})
    pedido = await client.post(
        "/api/orders/",
        json={"table_qr": qr, "order_type": "dine_in", "items": [{"product_id": prod.json()["id"], "quantity": 1}]},
    )
    pedido_id = pedido.json()["id"]

    # Crear un mesero via superadmin (no se puede por API publica)
    # Aqui lo registramos via /api/users/ con el superadmin token
    headers_super = {"Authorization": f"Bearer {superadmin_token}"}
    response = await client.post(
        "/api/users/",
        headers=headers_super,
        json={
            "name": "Mesero Test",
            "email": "mesero2@test.com",
            "password": "meseropass",
            "role": "waiter",
            "restaurant_id": active_restaurant["data"]["id"],
        },
    )
    assert response.status_code == 201

    login = await client.post("/api/auth/login", data={"username": "mesero2@test.com", "password": "meseropass"})
    mesero_token = login.json()["access_token"]
    headers_mesero = {"Authorization": f"Bearer {mesero_token}"}

    # Mesero intenta marcar preparando (no permitido)
    response = await client.patch(
        f"/api/orders/{pedido_id}/status",
        headers=headers_mesero,
        json={"status": "preparing"},
    )
    assert response.status_code == 403, "Fuga: mesero pudo marcar preparando"


@pytest.mark.asyncio
async def test_pedido_no_aparece_en_otro_restaurante(client, superadmin_token):
    """El admin de B no debe ver los pedidos del restaurante A."""
    headers_super = {"Authorization": f"Bearer {superadmin_token}"}

    r1 = await client.post("/api/restaurants/", headers=headers_super, json={"name": "A", "slug": "iso-a", "admin_password": "adminpass123"})
    r2 = await client.post("/api/restaurants/", headers=headers_super, json={"name": "B", "slug": "iso-b", "admin_password": "adminpass123"})
    rest_a_id = r1.json()["id"]

    # Login admin A
    login_a = await client.post("/api/auth/login", data={"username": f"admin-{rest_a_id}@iso-a.com", "password": "adminpass123"})
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    trial = await client.post(f"/api/restaurants/{rest_a_id}/trial", headers=headers_a)
    assert trial.status_code == 201, trial.text
    tabla = await client.post("/api/tables/", headers=headers_a, json={"number": 1, "capacity": 4})
    qr = tabla.json()["qr_code"]
    cat = await client.post("/api/menu/categories", headers=headers_a, json={"name": "Cat"})
    prod = await client.post("/api/menu/products", headers=headers_a, json={"category_id": cat.json()["id"], "name": "P", "price": 100})

    await client.post(
        "/api/orders/",
        json={"table_qr": qr, "order_type": "dine_in", "items": [{"product_id": prod.json()["id"], "quantity": 1}]},
    )

    # Login admin B
    rest_b_id = r2.json()["id"]
    login_b = await client.post("/api/auth/login", data={"username": f"admin-{rest_b_id}@iso-b.com", "password": "adminpass123"})
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Admin B lista pedidos
    response = await client.get("/api/orders/", headers=headers_b)
    assert response.status_code == 200
    pedidos = response.json()
    assert all(p["restaurant_id"] != rest_a_id for p in pedidos), "Fuga: admin B ve pedidos de A"
