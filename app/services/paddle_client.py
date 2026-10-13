"""Cliente mínimo de Paddle Billing (Merchant of Record, cobro internacional).

Cubre lo necesario para SaaS prepago con suscripciones:
- crear transacción de checkout (retorna URL hosted + id)
- leer transacción / suscripción (verificación server-side)
- verificar firma HMAC de webhooks (header Paddle-Signature)

Docs: https://developer.paddle.com/api-reference/overview
"""
import hashlib
import hmac
import time
from typing import Any, Optional

import httpx

SANDBOX_BASE = "https://sandbox-api.paddle.com"
PRODUCTION_BASE = "https://api.paddle.com"

# Tolerancia del timestamp del webhook (docs: 5s; usamos 5 min contra clock skew).
WEBHOOK_MAX_AGE_SECONDS = 300


def api_base(env: str) -> str:
    return PRODUCTION_BASE if env == "production" else SANDBOX_BASE


class PaddleError(Exception):
    pass


async def _request(api_key: str, env: str, method: str, path: str, payload: Optional[dict] = None) -> dict:
    async with httpx.AsyncClient(base_url=api_base(env), timeout=20.0) as client:
        response = await client.request(
            method,
            path,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
    try:
        data = response.json()
    except ValueError:
        raise PaddleError(f"Paddle respondió no-JSON ({response.status_code})")
    if response.status_code >= 400 or "error" in data:
        err = data.get("error", {})
        raise PaddleError(f"Paddle {response.status_code}: {err.get('detail', err or response.text)[:300]}")
    return data.get("data", data)


async def create_checkout_transaction(
    api_key: str,
    env: str,
    price_id: str,
    custom_data: dict,
    customer_email: Optional[str] = None,
) -> dict:
    """Crea una transacción y devuelve {id, checkout_url}.

    custom_data viaja de vuelta en los webhooks (aquí: restaurant_id/plan/cycle).
    """
    payload: dict[str, Any] = {
        "items": [{"price_id": price_id, "quantity": 1}],
        "custom_data": custom_data,
    }
    if customer_email:
        payload["customer_email"] = customer_email
    data = await _request(api_key, env, "POST", "/transactions", payload)
    checkout = data.get("checkout") or {}
    return {"id": data.get("id"), "checkout_url": checkout.get("url")}


async def get_transaction(api_key: str, env: str, transaction_id: str) -> dict:
    return await _request(api_key, env, "GET", f"/transactions/{transaction_id}")


async def get_subscription(api_key: str, env: str, subscription_id: str) -> dict:
    return await _request(api_key, env, "GET", f"/subscriptions/{subscription_id}")


def parse_signature_header(header: str) -> tuple[str, list[str]]:
    """Extrae (ts, [h1, ...]) del header 'Paddle-Signature: ts=...;h1=...'."""
    parts: dict[str, str] = {}
    for chunk in (header or "").split(";"):
        if "=" in chunk:
            key, _, value = chunk.partition("=")
            parts[key.strip()] = value.strip()
    ts = parts.get("ts", "")
    sigs = [v for k, v in parts.items() if k.startswith("h") and v]
    return ts, sigs


def verify_webhook_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """Verifica HMAC-SHA256(ts + ':' + body) contra h1. False si inválido/viejo."""
    if not secret or not signature_header:
        return False
    ts, sigs = parse_signature_header(signature_header)
    if not ts or not sigs:
        return False
    try:
        age = abs(time.time() - int(ts))
    except ValueError:
        return False
    if age > WEBHOOK_MAX_AGE_SECONDS:
        return False
    signed_payload = f"{ts}:".encode() + raw_body
    computed = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(computed, s) for s in sigs)
