"""Journeys API: ciclos de vida completos punta a punta (sin navegador).

Cubre con el stack existente (pytest + httpx en memoria):
1. Dueño: signup → registered/402 → trial → setup → pedido público →
   flujo completo hasta delivered → mora → 402 → webhook reactiva → opera.
2. Staff: mesero/cocina reales operan un pedido de punta a punta.
3. Cliente: QR → menú → pedido → tracking → chat → lectura → cierre.
"""
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta

import pytest

pytestmark = pytest.mark.asyncio

SECRET = "test-webhook-secret-123"


def _signed(body: dict) -> tuple[bytes, str]:
    raw = json.dumps(body, separators=(",", ":")).encode()
    ts = int(time.time())
    sig = hmac.new(SECRET.encode(), f"{ts}:".encode() + raw, hashlib.sha256).hexdigest()
    return raw, f"ts={ts};h1={sig}"


async def _signup_owner(client, slug="journey-rest", email="owner@journey.co"):
    response = await client.post(
        "/api/restaurants/signup",
        json={
            "name": "Journey Rest",
            "slug": slug,
            "admin_name": "Owner",
            "admin_email": email,
            "admin_password": "ownerpass123",
            "website": "",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body, {"Authorization": f"Bearer {body['access_token']}"}


async def _setup_menu_table(client, headers):
    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Platos"})
    assert cat.status_code == 201, cat.text
    prod = await client.post(
        "/api/menu/products", headers=headers,
        json={"name": "Bandeja", "price": 25000, "category_id": cat.json()["id"]},
    )
    assert prod.status_code == 201, prod.text
    table = await client.post("/api/tables/", headers=headers, json={"number": 1, "capacity": 4})
    assert table.status_code == 201, table.text
    return table.json()["qr_code"], prod.json()["id"]


async def test_journey_owner_full_lifecycle(client, monkeypatch):
    """Signup → 402 → trial → setup → pedido → delivered → mora → 402 → pago → opera."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "PADDLE_WEBHOOK_SECRET", SECRET)

    # 1. Registro self-service: queda registered
    data, headers = await _signup_owner(client)
    assert data["subscription_status"] == "trialing"
    rid = data["id"]

    # 2. Registered: login ok pero operar da 402
    blocked = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert blocked.status_code == 402, blocked.text

    # 3. Activa trial y monta el restaurante
    trial = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert trial.status_code == 201, trial.text
    table_qr, product_id = await _setup_menu_table(client, headers)

    # 4. Cliente pide por QR y el pedido fluye hasta entregado
    order = await client.post(
        "/api/orders/",
        json={"table_qr": table_qr, "order_type": "dine_in",
              "items": [{"product_id": product_id, "quantity": 2}]},
    )
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]
    assert order.json()["total"] == 50000
    for status in ("confirmed", "preparing", "ready", "delivered"):
        response = await client.patch(
            f"/api/orders/{order_id}/status", headers=headers, json={"status": status}
        )
        assert response.status_code == 200, response.text
    delivered = await client.get(f"/api/orders/{order_id}")
    assert delivered.json()["status"] == "delivered"

    # 5. Simula mora: periodo vencido más allá de la gracia
    from app.core.database import AsyncSessionLocal
    from app.models.models import Restaurant, SubscriptionStatus
    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        restaurant.plan = "basic"
        restaurant.subscription_status = SubscriptionStatus.active
        restaurant.current_period_end = datetime.utcnow() - timedelta(days=10)
        await session.commit()
    blocked = await client.post("/api/menu/categories", headers=headers, json={"name": "Y"})
    assert blocked.status_code == 402, blocked.text
    public_blocked = await client.get("/api/menu/", params={"table_qr": table_qr})
    assert public_blocked.status_code == 402, public_blocked.text

    # 6. Webhook Paddle reactiva y vuelve a operar (idempotente ante replay)
    event = {
        "event_id": "evt_journey_1",
        "event_type": "subscription.created",
        "occurred_at": "2026-10-12T00:00:00Z",
        "notification_id": "ntf_journey_1",
        "data": {
            "id": "sub_journey_1",
            "status": "active",
            "custom_data": {"restaurant_id": str(rid), "plan": "basic", "cycle": "monthly"},
            "details": {"totals": {"grand_total": "9.99"}},
        },
    }
    raw, header = _signed(event)
    hook = await client.post(
        "/api/billing/paddle/webhook", content=raw,
        headers={"Content-Type": "application/json", "Paddle-Signature": header},
    )
    assert hook.status_code == 200, hook.text
    assert hook.json()["alreadyProcessed"] is False
    replay = await client.post(
        "/api/billing/paddle/webhook", content=raw,
        headers={"Content-Type": "application/json", "Paddle-Signature": header},
    )
    assert replay.json()["alreadyProcessed"] is True

    ok = await client.post("/api/menu/categories", headers=headers, json={"name": "Postres"})
    assert ok.status_code == 201, ok.text
    status = await client.get("/api/billing/status", headers=headers)
    assert status.json()["subscription_status"] == "active"


async def test_journey_staff_operates_order(client):
    """Mesero y cocinera reales: confirmar → preparar → listo → entregar."""
    data, headers = await _signup_owner(client, slug="staff-rest", email="owner@staff.co")
    rid = data["id"]
    trial = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert trial.status_code == 201, trial.text
    table_qr, product_id = await _setup_menu_table(client, headers)

    async def make_staff(name, email, role):
        created = await client.post(
            "/api/users/", headers=headers,
            json={"name": name, "email": email, "password": "staffpass123", "role": role},
        )
        assert created.status_code == 201, created.text
        login = await client.post("/api/auth/login", data={"username": email, "password": "staffpass123"})
        assert login.status_code == 200, login.text
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    waiter_h = await make_staff("Mesero", "mesero@staff.co", "waiter")
    kitchen_h = await make_staff("Cocina", "cocina@staff.co", "kitchen")

    order = await client.post(
        "/api/orders/",
        json={"table_qr": table_qr, "order_type": "dine_in",
              "items": [{"product_id": product_id, "quantity": 1}]},
    )
    order_id = order.json()["id"]

    for headers_use, status in ((waiter_h, "confirmed"), (kitchen_h, "preparing"),
                                (kitchen_h, "ready"), (waiter_h, "delivered")):
        response = await client.patch(
            f"/api/orders/{order_id}/status", headers=headers_use, json={"status": status}
        )
        assert response.status_code == 200, response.text
        assert response.json()["status"] == status

    # Al entregar se libera la mesa
    tables = await client.get("/api/tables/", headers=headers)
    assert tables.status_code == 200
    assert all(not t["is_occupied"] for t in tables.json())


async def test_journey_customer_chat_and_tracking(client):
    """Cliente QR: menú → pedido → tracking → chat → lectura → cierre."""
    data, headers = await _signup_owner(client, slug="chat-rest", email="owner@chat.co")
    trial = await client.post(f"/api/restaurants/{data['id']}/trial", headers=headers)
    assert trial.status_code == 201, trial.text
    table_qr, product_id = await _setup_menu_table(client, headers)

    menu = await client.get("/api/menu/", params={"table_qr": table_qr})
    assert menu.status_code == 200, menu.text
    assert any(p["name"] == "Bandeja" for c in menu.json() for p in c["products"])

    order = await client.post(
        "/api/orders/",
        json={"table_qr": table_qr, "order_type": "dine_in", "customer_name": "Ana",
              "items": [{"product_id": product_id, "quantity": 1}]},
    )
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]

    tracked = await client.get(f"/api/orders/{order_id}")
    assert tracked.status_code == 200, tracked.text
    assert tracked.json()["total"] == 25000

    session = await client.post(f"/api/chat/sessions/{table_qr}")
    assert session.status_code == 201, session.text
    session_id = session.json()["id"]

    sent = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"sender": "customer", "content": "¿Cuánto demora?"},
    )
    assert sent.status_code in (200, 201), sent.text
    reply = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        headers=headers,
        json={"sender": "waiter", "content": "Unos 15 minutos"},
    )
    assert reply.status_code in (200, 201), reply.text

    read = await client.patch(f"/api/chat/sessions/{session_id}/read", headers=headers)
    assert read.status_code == 204, read.text
    closed = await client.patch(f"/api/chat/sessions/{session_id}/close", headers=headers)
    assert closed.status_code == 204, closed.text


async def test_product_can_move_to_new_category(client):
    """La auditoría: editar un producto y cambiarlo a una categoría recién
    creada debe persistir (antes el PATCH ignoraba category_id en silencio)."""
    data, headers = await _signup_owner(client, slug="move-cat-rest", email="owner@movecat.co")
    rid = data["id"]
    trial = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert trial.status_code == 201, trial.text

    entradas = await client.post("/api/menu/categories", headers=headers, json={"name": "Entradas"})
    bebidas = await client.post("/api/menu/categories", headers=headers, json={"name": "Bebidas"})
    assert entradas.status_code == 201 and bebidas.status_code == 201
    prod = await client.post(
        "/api/menu/products", headers=headers,
        json={"name": "Limonada", "price": 8000, "category_id": entradas.json()["id"]},
    )
    assert prod.status_code == 201, prod.text
    prod_id = prod.json()["id"]

    moved = await client.patch(
        f"/api/menu/products/{prod_id}", headers=headers,
        json={"category_id": bebidas.json()["id"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["category_id"] == bebidas.json()["id"]

    menu = await client.get("/api/menu/", headers=headers, params={"restaurant_id": rid})
    assert menu.status_code == 200, menu.text
    by_cat = {c["id"]: [p["name"] for p in c["products"]] for c in menu.json()}
    assert "Limonada" in by_cat[bebidas.json()["id"]]
    assert "Limonada" not in by_cat[entradas.json()["id"]]


async def test_product_move_to_foreign_category_rejected(client):
    """No se puede mover un producto a una categoría de otro restaurante."""
    data_a, headers_a = await _signup_owner(client, slug="move-a", email="owner@movea.co")
    data_b, headers_b = await _signup_owner(client, slug="move-b", email="owner@moveb.co")
    for h, rid in ((headers_a, data_a["id"]), (headers_b, data_b["id"])):
        trial = await client.post(f"/api/restaurants/{rid}/trial", headers=h)
        assert trial.status_code == 201, trial.text

    cat_a = await client.post("/api/menu/categories", headers=headers_a, json={"name": "A"})
    cat_b = await client.post("/api/menu/categories", headers=headers_b, json={"name": "B"})
    prod = await client.post(
        "/api/menu/products", headers=headers_a,
        json={"name": "Plato A", "price": 1000, "category_id": cat_a.json()["id"]},
    )
    assert prod.status_code == 201, prod.text

    denied = await client.patch(
        f"/api/menu/products/{prod.json()['id']}", headers=headers_a,
        json={"category_id": cat_b.json()["id"]},
    )
    assert denied.status_code == 400, denied.text

    missing = await client.patch(
        f"/api/menu/products/{prod.json()['id']}", headers=headers_a,
        json={"category_id": 999999},
    )
    assert missing.status_code == 400, missing.text


async def test_category_rename_and_guarded_delete(client):
    """Renombrar ok; borrar bloqueado con aviso si tiene productos."""
    data, headers = await _signup_owner(client, slug="cat-rest", email="owner@cat.co")
    rid = data["id"]
    trial = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert trial.status_code == 201, trial.text

    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "Bebidas"})
    assert cat.status_code == 201, cat.text
    cat_id = cat.json()["id"]

    renamed = await client.patch(f"/api/menu/categories/{cat_id}", headers=headers,
                                 json={"name": "Bebidas frías"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Bebidas frías"

    empty = await client.patch(f"/api/menu/categories/{cat_id}", headers=headers,
                               json={"name": "   "})
    assert empty.status_code == 400, empty.text

    prod = await client.post("/api/menu/products", headers=headers,
                             json={"name": "Limonada", "price": 8000, "category_id": cat_id})
    assert prod.status_code == 201, prod.text

    blocked = await client.delete(f"/api/menu/categories/{cat_id}", headers=headers)
    assert blocked.status_code == 400, blocked.text
    assert "1 producto" in blocked.json()["detail"]

    # Mueve el plato fuera y ahora sí deja borrar.
    other = await client.post("/api/menu/categories", headers=headers, json={"name": "Otras"})
    moved = await client.patch(f"/api/menu/products/{prod.json()['id']}", headers=headers,
                               json={"category_id": other.json()["id"]})
    assert moved.status_code == 200, moved.text
    gone = await client.delete(f"/api/menu/categories/{cat_id}", headers=headers)
    assert gone.status_code == 204, gone.text


async def test_category_rename_foreign_rejected(client):
    """No se puede renombrar ni borrar categoría ajena."""
    _, headers_a = await _signup_owner(client, slug="cat-a", email="owner@cata.co")
    data_b, headers_b = await _signup_owner(client, slug="cat-b", email="owner@catb.co")
    data_a_rid = (await client.get("/api/billing/status", headers=headers_a)).json()["restaurant_id"]
    for h, rid in ((headers_a, data_a_rid), (headers_b, data_b["id"])):
        trial = await client.post(f"/api/restaurants/{rid}/trial", headers=h)
        assert trial.status_code == 201, trial.text
    cat_b = await client.post("/api/menu/categories", headers=headers_b, json={"name": "B"})
    cat_b_id = cat_b.json()["id"]
    denied = await client.patch(f"/api/menu/categories/{cat_b_id}", headers=headers_a,
                                json={"name": "Robada"})
    assert denied.status_code == 404, denied.text
    denied_del = await client.delete(f"/api/menu/categories/{cat_b_id}", headers=headers_a)
    assert denied_del.status_code == 404, denied_del.text
