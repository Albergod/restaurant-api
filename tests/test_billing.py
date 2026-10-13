"""Facturación Paddle + trial: firma, idempotencia y activación."""
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta

import pytest

from app.services import paddle_client

pytestmark = pytest.mark.asyncio

SECRET = "test-webhook-secret-123"


def _signed(body: dict, secret: str = SECRET, ts: int | None = None) -> tuple[bytes, str]:
    raw = json.dumps(body, separators=(",", ":")).encode()
    ts = ts if ts is not None else int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}:".encode() + raw, hashlib.sha256).hexdigest()
    return raw, f"ts={ts};h1={sig}"


def _sub_created_event(restaurant_id: int, sub_id: str = "sub_test_1") -> dict:
    return {
        "event_id": "evt_test_1",
        "event_type": "subscription.created",
        "occurred_at": "2026-10-12T00:00:00Z",
        "notification_id": "ntf_test_1",
        "data": {
            "id": sub_id,
            "status": "active",
            "custom_data": {"restaurant_id": str(restaurant_id), "plan": "basic", "cycle": "monthly"},
            "details": {"totals": {"grand_total": "9.99"}},
        },
    }


# ── Firma HMAC ─────────────────────────────────────────────────────────────

def test_signature_valid():
    raw, header = _signed({"a": 1})
    assert paddle_client.verify_webhook_signature(raw, header, SECRET) is True


def test_signature_tampered_body():
    raw, header = _signed({"a": 1})
    assert paddle_client.verify_webhook_signature(b'{"a": 2}', header, SECRET) is False


def test_signature_wrong_secret():
    raw, header = _signed({"a": 1})
    assert paddle_client.verify_webhook_signature(raw, header, "otro-secreto") is False


def test_signature_old_timestamp_rejected():
    raw, header = _signed({"a": 1}, ts=int(time.time()) - 3600)
    assert paddle_client.verify_webhook_signature(raw, header, SECRET) is False


def test_signature_malformed_header():
    raw, _ = _signed({"a": 1})
    assert paddle_client.verify_webhook_signature(raw, "basura", SECRET) is False
    assert paddle_client.verify_webhook_signature(raw, "", SECRET) is False


# ── Checkout: validaciones ─────────────────────────────────────────────────

async def test_checkout_requires_admin(client, created_restaurant):
    # Mesero del restaurante no puede comprar
    admin_headers = created_restaurant["admin_headers"]
    waiter = await client.post(
        "/api/users/", headers=admin_headers,
        json={"name": "W", "email": "w@t.co", "password": "wpass1234", "role": "waiter"},
    )
    assert waiter.status_code == 201, waiter.text
    login = await client.post("/api/auth/login", data={"username": "w@t.co", "password": "wpass1234"})
    w_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.post(
        "/api/billing/paddle/checkout", headers=w_headers, json={"plan": "basic", "cycle": "monthly"}
    )
    assert response.status_code == 403, response.text


async def test_checkout_validates_plan_cycle(client, created_restaurant, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "PADDLE_API_KEY", "key")
    monkeypatch.setattr(settings, "PADDLE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(settings, "PADDLE_PRICE_MONTHLY", "pri_x")
    headers = created_restaurant["admin_headers"]
    bad_plan = await client.post(
        "/api/billing/paddle/checkout", headers=headers, json={"plan": "oro", "cycle": "monthly"}
    )
    assert bad_plan.status_code == 400, bad_plan.text
    bad_cycle = await client.post(
        "/api/billing/paddle/checkout", headers=headers, json={"plan": "basic", "cycle": "semanal"}
    )
    assert bad_cycle.status_code == 400, bad_cycle.text


async def test_checkout_503_without_keys(client, created_restaurant):
    headers = created_restaurant["admin_headers"]
    response = await client.post(
        "/api/billing/paddle/checkout", headers=headers, json={"plan": "basic", "cycle": "monthly"}
    )
    assert response.status_code == 503, response.text


# ── Webhook: activación idempotente ─────────────────────────────────────────

async def test_webhook_rejects_bad_signature(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "PADDLE_WEBHOOK_SECRET", SECRET)
    raw, _ = _signed({"event_type": "subscription.created", "data": {}})
    response = await client.post(
        "/api/billing/paddle/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "Paddle-Signature": "ts=123;h1=abc"},
    )
    assert response.status_code == 401, response.text


async def test_webhook_activates_and_is_idempotent(client, created_restaurant, monkeypatch):
    from sqlalchemy import select
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.models.models import Restaurant, SubscriptionPayment

    monkeypatch.setattr(settings, "PADDLE_WEBHOOK_SECRET", SECRET)
    rid = created_restaurant["data"]["id"]

    event = _sub_created_event(rid)
    raw, header = _signed(event)
    first = await client.post(
        "/api/billing/paddle/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "Paddle-Signature": header},
    )
    assert first.status_code == 200, first.text
    assert first.json()["alreadyProcessed"] is False

    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        assert restaurant.subscription_status.value == "active"
        assert restaurant.plan.value == "basic"
        first_end = restaurant.current_period_end
        assert first_end is not None and first_end > datetime.utcnow()
        payments = (await session.execute(
            select(SubscriptionPayment).where(SubscriptionPayment.provider_payment_id == "sub_test_1")
        )).scalars().all()
        assert len(payments) == 1

    # Replay del mismo evento: no duplica ni extiende de nuevo
    second = await client.post(
        "/api/billing/paddle/webhook",
        content=raw,
        headers={"Content-Type": "application/json", "Paddle-Signature": header},
    )
    assert second.status_code == 200, second.text
    assert second.json()["alreadyProcessed"] is True

    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        assert restaurant.current_period_end == first_end


async def test_webhook_transaction_linked_to_subscription_does_not_extend(client, created_restaurant, monkeypatch):
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.models.models import Restaurant

    monkeypatch.setattr(settings, "PADDLE_WEBHOOK_SECRET", SECRET)
    rid = created_restaurant["data"]["id"]

    sub_event = _sub_created_event(rid)
    raw_sub, header_sub = _signed(sub_event)
    await client.post(
        "/api/billing/paddle/webhook", content=raw_sub,
        headers={"Content-Type": "application/json", "Paddle-Signature": header_sub},
    )
    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        end_after_sub = restaurant.current_period_end

    txn_event = {
        "event_id": "evt_test_2",
        "event_type": "transaction.completed",
        "occurred_at": "2026-10-12T00:01:00Z",
        "notification_id": "ntf_test_2",
        "data": {
            "id": "txn_test_1",
            "custom_data": {"restaurant_id": str(rid), "plan": "basic", "cycle": "monthly"},
            "details": {"subscription_id": "sub_test_1", "totals": {"grand_total": "9.99"}},
        },
    }
    raw_txn, header_txn = _signed(txn_event)
    response = await client.post(
        "/api/billing/paddle/webhook", content=raw_txn,
        headers={"Content-Type": "application/json", "Paddle-Signature": header_txn},
    )
    assert response.status_code == 200, response.text

    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        assert restaurant.current_period_end == end_after_sub


# ── Trial ──────────────────────────────────────────────────────────────────

async def test_trial_activates_without_products(client, created_restaurant):
    """El trial arranca al pulsar Activar, antes del onboarding (sin productos)."""
    rid = created_restaurant["data"]["id"]
    headers = created_restaurant["admin_headers"]
    first = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["subscription_status"] == "trialing"
    assert body["trial_started_at"] is not None
    ends_at = datetime.fromisoformat(body["trial_ends_at"])
    assert timedelta(days=13) < ends_at - datetime.utcnow() < timedelta(days=15)


async def test_trial_activates_once(client, created_restaurant):
    rid = created_restaurant["data"]["id"]
    headers = created_restaurant["admin_headers"]
    first = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert first.status_code == 201, first.text

    second = await client.post(f"/api/restaurants/{rid}/trial", headers=headers)
    assert second.status_code == 409, second.text


async def test_trial_forbidden_for_other_restaurant(client, created_restaurant, auth_headers):
    rid = created_restaurant["data"]["id"]
    other = await client.post(
        "/api/restaurants/", headers=auth_headers,
        json={"name": "Otro", "slug": "otro-rest", "admin_email": "otro@t.co", "admin_password": "otro123456"},
    )
    assert other.status_code == 201, other.text
    headers = created_restaurant["admin_headers"]
    response = await client.post(f"/api/restaurants/{other.json()['id']}/trial", headers=headers)
    assert response.status_code == 403, response.text


# ── Status + expiración ────────────────────────────────────────────────────

async def test_billing_status_shape(client, created_restaurant):
    headers = created_restaurant["admin_headers"]
    response = await client.get("/api/billing/status", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["has_restaurant"] is True
    assert body["plan"] == "trial"
    assert body["subscription_status"] == "trialing"


async def test_billing_status_readable_by_staff_but_not_customers(client, created_restaurant):
    admin_headers = created_restaurant["admin_headers"]
    waiter = await client.post(
        "/api/users/", headers=admin_headers,
        json={"name": "W", "email": "w2@t.co", "password": "wpass1234", "role": "waiter"},
    )
    assert waiter.status_code == 201, waiter.text
    login = await client.post("/api/auth/login", data={"username": "w2@t.co", "password": "wpass1234"})
    w_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.get("/api/billing/status", headers=w_headers)
    assert response.status_code == 200, response.text
    assert response.json()["display_state"] == "registered"

    customer = await client.post(
        "/api/auth/register",
        json={"name": "C", "email": "c2@t.co", "password": "cpass1234", "role": "customer"},
    )
    assert customer.status_code == 201, customer.text
    login_c = await client.post("/api/auth/login", data={"username": "c2@t.co", "password": "cpass1234"})
    c_headers = {"Authorization": f"Bearer {login_c.json()['access_token']}"}
    denied = await client.get("/api/billing/status", headers=c_headers)
    assert denied.status_code == 403, denied.text


async def test_expire_subscriptions_suspends_overdue(client, created_restaurant):
    from app.routers.billing import expire_subscriptions
    from app.core.database import AsyncSessionLocal
    from app.models.models import Restaurant, SubscriptionStatus

    rid = created_restaurant["data"]["id"]
    headers = created_restaurant["admin_headers"]

    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        restaurant.plan = "basic"
        restaurant.subscription_status = SubscriptionStatus.active
        restaurant.current_period_end = datetime.utcnow() - timedelta(days=10)
        await session.commit()

    suspended = await expire_subscriptions()
    assert suspended == 1

    async with AsyncSessionLocal() as session:
        restaurant = await session.get(Restaurant, rid)
        assert restaurant.subscription_status == SubscriptionStatus.suspended

    # El login sigue funcionando (paywall en frontend), pero operar no.
    login = await client.post("/api/auth/login", data={"username": "admin@test.com", "password": "adminpass123"})
    assert login.status_code == 200, login.text
    blocked = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert blocked.status_code == 402, blocked.text


# ── Signup self-service ────────────────────────────────────────────────────

async def test_signup_creates_registered_restaurant_and_token(client):
    response = await client.post(
        "/api/restaurants/signup",
        json={
            "name": "Mi Restaurante",
            "slug": "mi-restaurante",
            "admin_name": "Dueña",
            "admin_email": "duena@restaurante.co",
            "admin_password": "clave123456",
            "website": "",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["slug"] == "mi-restaurante"
    assert body["plan"] == "trial"
    assert body["subscription_status"] == "trialing"
    assert body["access_token"]
    assert body["role"] == "admin"

    # Entra (registered) pero no puede operar hasta activar la prueba
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    blocked = await client.post("/api/menu/categories", headers=headers, json={"name": "X"})
    assert blocked.status_code == 402, blocked.text

    trial = await client.post(f"/api/restaurants/{body['id']}/trial", headers=headers)
    assert trial.status_code == 201, trial.text


async def test_signup_validations(client):
    base = {
        "name": "X",
        "slug": "x-1",
        "admin_name": "A",
        "admin_email": "x1@t.co",
        "admin_password": "clave123456",
        "website": "",
    }
    bad_slug = await client.post("/api/restaurants/signup", json={**base, "slug": "Mal Slug!"})
    assert bad_slug.status_code == 400, bad_slug.text
    short_pass = await client.post(
        "/api/restaurants/signup",
        json={**base, "slug": "x-2", "admin_email": "x2@t.co", "admin_password": "corta"},
    )
    assert short_pass.status_code == 400, short_pass.text
    honeypot = await client.post(
        "/api/restaurants/signup",
        json={**base, "slug": "x-3", "admin_email": "x3@t.co", "website": "http://spam.bot"},
    )
    assert honeypot.status_code == 400, honeypot.text


async def test_signup_duplicate_slug_and_email(client):
    payload = {
        "name": "Uno",
        "slug": "duplicado",
        "admin_name": "A",
        "admin_email": "dup@t.co",
        "admin_password": "clave123456",
        "website": "",
    }
    first = await client.post("/api/restaurants/signup", json=payload)
    assert first.status_code == 201, first.text
    again_slug = await client.post(
        "/api/restaurants/signup", json={**payload, "admin_email": "otro@t.co"}
    )
    assert again_slug.status_code == 400, again_slug.text
    again_email = await client.post(
        "/api/restaurants/signup", json={**payload, "slug": "otro-slug"}
    )
    assert again_email.status_code == 400, again_email.text


# ── Demo pública ───────────────────────────────────────────────────────────

async def test_demo_overview_missing_returns_404(client):
    response = await client.get("/api/restaurants/demo/overview")
    assert response.status_code == 404, response.text


async def test_demo_overview_public(client):
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.models import Category, Product, Restaurant, Table

    async with AsyncSessionLocal() as session:
        demo = Restaurant(name="Demo", slug="demo", is_active=True)
        session.add(demo)
        await session.flush()
        session.add(Category(restaurant_id=demo.id, name="Platos", sort_order=1))
        await session.flush()
        cat_id = (await session.execute(
            select(Category).where(Category.restaurant_id == demo.id)
        )).scalar_one().id
        session.add(Product(restaurant_id=demo.id, category_id=cat_id, name="Bandeja", price=25000))
        session.add(Table(restaurant_id=demo.id, number=1, qr_code="demo-qr-123"))
        await session.commit()

    response = await client.get("/api/restaurants/demo/overview")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["restaurant"]["slug"] == "demo"
    assert body["table_qr"] == "demo-qr-123"
    assert body["categories"][0]["products"][0]["name"] == "Bandeja"


# ── Reset demo ─────────────────────────────────────────────────────────────

async def _make_demo_restaurant(client, auth_headers):
    """Crea restaurante con slug 'demo' y devuelve (id, admin_headers)."""
    response = await client.post(
        "/api/restaurants/",
        headers=auth_headers,
        json={
            "name": "Demo",
            "slug": "demo",
            "admin_name": "Demo Admin",
            "admin_email": "demoadmin@test.com",
            "admin_password": "demopass123",
        },
    )
    assert response.status_code == 201, f"Setup fallo: {response.text}"
    login = await client.post(
        "/api/auth/login",
        data={"username": "demoadmin@test.com", "password": "demopass123"},
    )
    assert login.status_code == 200, login.text
    return response.json()["id"], {"Authorization": f"Bearer {login.json()['access_token']}"}


async def test_demo_reset_full_restore(client, auth_headers):
    """El reset restaura la demo: borra basura de visitantes y re-siembra carta/mesas.

    Conserva unicamente al usuario que lo pulsa.
    """
    from sqlalchemy import select, func
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.models import Category, Product, Table, Order, OrderItem, User, UserRole

    demo_id, demo_headers = await _make_demo_restaurant(client, auth_headers)
    keeper_id = None  # se resuelve por BD abajo
    async with AsyncSessionLocal() as session:
        # Basura de un "visitante": categoria/plato/mesa/usuario/pedido extra.
        session.add(Category(restaurant_id=demo_id, name="Basura", sort_order=99))
        await session.flush()
        junk_cat = (await session.execute(
            select(Category).where(Category.restaurant_id == demo_id, Category.name == "Basura")
        )).scalar_one()
        session.add(Product(restaurant_id=demo_id, category_id=junk_cat.id, name="Plato Basura", price=1))
        session.add(Table(restaurant_id=demo_id, number=99, qr_code="junk-qr"))
        # QRs "impresos": deben sobrevivir al reset (bug: Cliente caído).
        session.add(Table(restaurant_id=demo_id, number=1, qr_code="qr-uno"))
        session.add(Table(restaurant_id=demo_id, number=2, qr_code="qr-dos"))
        keeper = (await session.execute(
            select(User).where(User.restaurant_id == demo_id, User.email == "demoadmin@test.com")
        )).scalar_one()
        keeper_id = keeper.id
        session.add(User(
            name="Intruso", email="intruso@test.com", hashed_password=hash_password("x" * 12),
            role=UserRole.waiter, restaurant_id=demo_id,
        ))
        session.add(Order(restaurant_id=demo_id, table_id=None, status="pending", total=1))
        await session.flush()
        order_id = (await session.execute(
            select(Order).where(Order.restaurant_id == demo_id)
        )).scalar_one().id
        prod_id = (await session.execute(
            select(Product).where(Product.restaurant_id == demo_id, Product.name == "Plato Basura")
        )).scalar_one().id
        session.add(OrderItem(order_id=order_id, product_id=prod_id, quantity=1, unit_price=1))
        await session.commit()

    response = await client.post("/api/restaurants/demo/reset", headers=demo_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deleted"]["Order"] == 1
    assert body["deleted"]["User"] == 3  # mesero/cocina del signup + intruso; el keeper se conserva
    assert body["deleted"]["Table"] == 3  # junk-99 + mesas 1 y 2 (se re-siembran)
    assert body["deleted"]["SeededProducts"] == 6

    async with AsyncSessionLocal() as session:
        orders = (await session.execute(
            select(func.count()).select_from(Order).where(Order.restaurant_id == demo_id)
        )).scalar()
        assert orders == 0
        cats = (await session.execute(
            select(Category.name).where(Category.restaurant_id == demo_id).order_by(Category.sort_order)
        )).scalars().all()
        assert cats == ["Entradas", "Platos Fuertes", "Bebidas"]
        n_products = (await session.execute(
            select(func.count()).select_from(Product).where(Product.restaurant_id == demo_id)
        )).scalar()
        assert n_products == 6
        tables = (await session.execute(
            select(Table.number).where(Table.restaurant_id == demo_id).order_by(Table.number)
        )).scalars().all()
        assert tables == [1, 2, 3, 4]
        qrs = {
            n: qr for n, qr in (await session.execute(
                select(Table.number, Table.qr_code).where(Table.restaurant_id == demo_id)
            )).all()
        }
        assert qrs[1] == "qr-uno" and qrs[2] == "qr-dos"  # QRs preservados
        assert qrs[3] and qrs[4] and qrs[3] != qrs[4]  # nuevos con UUID fresco
        users = (await session.execute(
            select(User.id).where(User.restaurant_id == demo_id)
        )).scalars().all()
        assert users == [keeper_id]
        assert "Plato Basura" not in (await session.execute(
            select(Product.name).where(Product.restaurant_id == demo_id)
        )).scalars().all()

    # El keeper sigue pudiendo entrar.
    relogin = await client.post(
        "/api/auth/login",
        data={"username": "demoadmin@test.com", "password": "demopass123"},
    )
    assert relogin.status_code == 200, relogin.text


async def test_demo_reset_forbidden_for_other_restaurant(client, created_restaurant):
    response = await client.post(
        "/api/restaurants/demo/reset", headers=created_restaurant["admin_headers"]
    )
    assert response.status_code == 403, response.text


async def test_demo_reset_requires_auth(client):
    response = await client.post("/api/restaurants/demo/reset")
    assert response.status_code in (401, 403), response.text
