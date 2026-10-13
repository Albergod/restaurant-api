"""Moneda por restaurante (COP/USD) y precios sanos.

Cubre la issue de la auditoría: precios en pesos sin decimales fantasma,
tope anti-dedazos y redondeo COP al guardar.
"""
import pytest

pytestmark = pytest.mark.asyncio


async def _signup(client, slug, email):
    r = await client.post(
        "/api/restaurants/signup",
        json={"name": slug, "slug": slug, "admin_name": "O",
              "admin_email": email, "admin_password": "ownerpass123", "website": ""},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    trial = await client.post(f"/api/restaurants/{body['id']}/trial", headers=headers)
    assert trial.status_code == 201, trial.text
    return body, headers


async def _menu(client, headers):
    cat = await client.post("/api/menu/categories", headers=headers, json={"name": "C"})
    assert cat.status_code == 201, cat.text
    return cat.json()["id"]


async def test_default_currency_is_cop(client):
    body, _ = await _signup(client, "cop-def", "o@copdef.co")
    assert body["currency"] == "COP"


async def test_set_currency_owner_ok_invalid_400_and_staff_403(client):
    body, headers = await _signup(client, "cop-set", "o@copset.co")
    rid = body["id"]
    ok = await client.post(f"/api/restaurants/{rid}/currency", headers=headers, json={"currency": "usd"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["currency"] == "USD"
    bad = await client.post(f"/api/restaurants/{rid}/currency", headers=headers, json={"currency": "EUR"})
    assert bad.status_code == 400, bad.text
    waiter = await client.post(
        "/api/users/", headers=headers,
        json={"name": "W", "email": "w@copset.co", "password": "wpass1234", "role": "waiter"},
    )
    assert waiter.status_code == 201, waiter.text
    login = await client.post("/api/auth/login", data={"username": "w@copset.co", "password": "wpass1234"})
    w_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    denied = await client.post(f"/api/restaurants/{rid}/currency", headers=w_headers, json={"currency": "COP"})
    assert denied.status_code == 403, denied.text
    status = await client.get("/api/billing/status", headers=headers)
    assert status.json()["currency"] == "USD"


async def test_negative_and_huge_prices_rejected(client):
    _, headers = await _signup(client, "cop-val", "o@copval.co")
    cat_id = await _menu(client, headers)
    neg = await client.post("/api/menu/products", headers=headers,
                            json={"name": "N", "price": -100, "category_id": cat_id})
    assert neg.status_code == 422, neg.text
    huge = await client.post("/api/menu/products", headers=headers,
                             json={"name": "H", "price": 2_000_000_000, "category_id": cat_id})
    assert huge.status_code == 422, huge.text
    prod = await client.post("/api/menu/products", headers=headers,
                             json={"name": "OK", "price": 25000, "category_id": cat_id})
    assert prod.status_code == 201, prod.text
    upd_neg = await client.patch(f"/api/menu/products/{prod.json()['id']}", headers=headers,
                                 json={"price": -5})
    assert upd_neg.status_code == 422, upd_neg.text


async def test_cop_rounds_to_integer_usd_keeps_decimals(client):
    _, headers = await _signup(client, "cop-round", "o@copround.co")
    cat_id = await _menu(client, headers)
    cop = await client.post("/api/menu/products", headers=headers,
                            json={"name": "A", "price": 19999.99, "category_id": cat_id})
    assert cop.status_code == 201, cop.text
    assert cop.json()["price"] == 20000
    rid = cop.json()["restaurant_id"]
    await client.post(f"/api/restaurants/{rid}/currency", headers=headers, json={"currency": "USD"})
    usd = await client.post("/api/menu/products", headers=headers,
                            json={"name": "B", "price": 19.99, "category_id": cat_id})
    assert usd.status_code == 201, usd.text
    assert usd.json()["price"] == 19.99
    upd = await client.patch(f"/api/menu/products/{cop.json()['id']}", headers=headers,
                             json={"price": 1500.4})
    assert upd.status_code == 200, upd.text
    # Sigue en USD: conserva decimales.
    assert upd.json()["price"] == 1500.4
