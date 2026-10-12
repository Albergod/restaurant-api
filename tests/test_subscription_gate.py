"""Gate de suscripción SaaS: 402 cuando el restaurante no está al día."""
from datetime import datetime, timedelta

import pytest

pytestmark = pytest.mark.asyncio


async def _set_subscription(restaurant_id: int, **fields):
    # Import perezoso: app.core.database debe importarse DESPUÉS de que
    # conftest fije DATABASE_URL al Postgres temporal (ver configure_db).
    from app.core.database import AsyncSessionLocal
    from app.models.models import Restaurant
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Restaurant).where(Restaurant.id == restaurant_id))
        restaurant = result.scalar_one()
        for key, value in fields.items():
            setattr(restaurant, key, value)
        await session.commit()


async def _admin_login(client, email="admin@test.com", password="adminpass123"):
    return await client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )


async def test_new_restaurant_defaults_to_trial(client, created_restaurant):
    data = created_restaurant["data"]
    assert data["plan"] == "trial"
    assert data["subscription_status"] == "trialing"


async def test_login_allowed_while_trialing_without_end(client, created_restaurant):
    login = await _admin_login(client)
    assert login.status_code == 200, login.text


async def test_registered_allows_login_but_blocks_operations(client, created_restaurant):
    """Recién registrado (sin trial activado): entra, pero no puede operar."""
    login = await _admin_login(client)
    assert login.status_code == 200, login.text
    headers = created_restaurant["admin_headers"]
    response = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert response.status_code == 402, response.text
    assert "prueba" in response.json()["detail"].lower()


async def test_login_allowed_but_operations_blocked_with_expired_trial(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(rid, trial_ends_at=datetime.utcnow() - timedelta(days=1))
    login = await _admin_login(client)
    assert login.status_code == 200, login.text
    headers = created_restaurant["admin_headers"]
    response = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert response.status_code == 402, response.text
    assert "prueba" in response.json()["detail"].lower()


async def test_login_allowed_but_operations_blocked_when_suspended(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(rid, subscription_status="suspended")
    login = await _admin_login(client)
    assert login.status_code == 200, login.text
    headers = created_restaurant["admin_headers"]
    response = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert response.status_code == 402, response.text


async def test_superadmin_bypass_unaffected(client, auth_headers, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(rid, subscription_status="suspended")
    response = await client.get("/api/restaurants/", headers=auth_headers)
    assert response.status_code == 200, response.text


async def test_active_with_future_period_allows_login(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(
        rid,
        plan="basic",
        subscription_status="active",
        current_period_end=datetime.utcnow() + timedelta(days=20),
    )
    login = await _admin_login(client)
    assert login.status_code == 200, login.text


async def test_active_within_grace_period_allows_login(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(
        rid,
        plan="basic",
        subscription_status="active",
        current_period_end=datetime.utcnow() - timedelta(days=2),
    )
    login = await _admin_login(client)
    assert login.status_code == 200, login.text


async def test_active_beyond_grace_blocks_operations(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    await _set_subscription(
        rid,
        plan="basic",
        subscription_status="active",
        current_period_end=datetime.utcnow() - timedelta(days=10),
    )
    login = await _admin_login(client)
    assert login.status_code == 200, login.text
    headers = created_restaurant["admin_headers"]
    response = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert response.status_code == 402, response.text


async def test_public_order_blocked_when_suspended(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    admin_headers = created_restaurant["admin_headers"]
    # El setup requiere trial activo (registered no puede crear nada).
    trial = await client.post(f"/api/restaurants/{rid}/trial", headers=admin_headers)
    assert trial.status_code == 201, trial.text
    # Mesa + producto para poder pedir
    table = await client.post("/api/tables/", headers=admin_headers, json={"number": 1, "capacity": 4})
    assert table.status_code == 201, table.text
    table_qr = table.json()["qr_code"]
    cat = await client.post("/api/menu/categories", headers=admin_headers, json={"name": "Platos"})
    assert cat.status_code == 201, cat.text
    prod = await client.post(
        "/api/menu/products",
        headers=admin_headers,
        json={"name": "Bandeja", "price": 25000, "category_id": cat.json()["id"]},
    )
    assert prod.status_code == 201, prod.text

    await _set_subscription(rid, subscription_status="suspended")
    order = await client.post(
        "/api/orders/",
        json={
            "order_type": "dine_in",
            "table_qr": table_qr,
            "customer_name": "Cliente",
            "items": [{"product_id": prod.json()["id"], "quantity": 1}],
        },
    )
    assert order.status_code == 402, order.text

    menu = await client.get("/api/menu/", params={"table_qr": table_qr})
    assert menu.status_code == 402, menu.text


async def test_management_blocked_when_suspended(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    admin_headers = created_restaurant["admin_headers"]
    await _set_subscription(rid, subscription_status="suspended")
    response = await client.post("/api/menu/categories", headers=admin_headers, json={"name": "X"})
    assert response.status_code == 402, response.text
    response = await client.post("/api/tables/", headers=admin_headers, json={"number": 9})
    assert response.status_code == 402, response.text
