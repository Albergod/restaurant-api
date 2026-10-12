"""Facturación SaaS: checkout Paddle (cobro internacional), webhooks y estado.

Patrón (igual que Wompi/MP en cc-platform):
- cada pago aprobado extiende current_period_end de forma aditiva
- idempotencia por provider_payment_id único + re-verificación server-side
- el webhook nunca confía solo en el redirect del checkout

Nota sobre montos: los totales de Paddle incluyen impuestos según país, por
lo que NO se exige igualdad exacta con el precio base; se registra el monto
real cobrado. La firma HMAC es la garantía anti-manipulación.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.deps import subscription_state
from app.models.models import (
    BillingCycle, CYCLE_DAYS, Restaurant, SubscriptionPayment,
    SubscriptionPlan, SubscriptionStatus, UserRole,
)
from app.services import paddle_client

router = APIRouter(prefix="/api/billing", tags=["Facturación"])

VALID_PLANS = {SubscriptionPlan.basic.value, SubscriptionPlan.pro.value}
VALID_CYCLES = {BillingCycle.monthly.value, BillingCycle.biweekly.value}


def _paddle_configured() -> bool:
    return bool(settings.PADDLE_API_KEY and settings.PADDLE_WEBHOOK_SECRET)


def _price_id_for(cycle: str) -> str:
    return settings.PADDLE_PRICE_MONTHLY if cycle == BillingCycle.monthly.value else settings.PADDLE_PRICE_BIWEEKLY


def _activate(restaurant: Restaurant, plan: str, cycle: str) -> None:
    """Extiende el periodo de forma aditiva y deja la cuenta activa."""
    days = CYCLE_DAYS.get(cycle, CYCLE_DAYS[BillingCycle.monthly.value])
    now = datetime.utcnow()
    base = restaurant.current_period_end
    if base is None or base < now:
        base = now
    restaurant.current_period_end = base + timedelta(days=days)
    restaurant.plan = SubscriptionPlan(plan) if plan in VALID_PLANS else SubscriptionPlan.basic
    restaurant.subscription_status = SubscriptionStatus.active


async def expire_subscriptions() -> int:
    """Suspende restaurantes vencidos más allá de la gracia (cron horario).

    Idempotente: solo toca trialing/active/past_due que el gate bloquearía.
    Retorna cuántos suspendió.
    """
    from app.core.database import AsyncSessionLocal
    from app.deps import is_registered, subscription_block_reason

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Restaurant).where(
                Restaurant.subscription_status.in_([
                    SubscriptionStatus.trialing,
                    SubscriptionStatus.active,
                    SubscriptionStatus.past_due,
                ])
            )
        )
        suspended = 0
        for restaurant in result.scalars().all():
            # Un registrado (sin trial activado) nunca se suspende solo.
            if is_registered(restaurant):
                continue
            if subscription_block_reason(restaurant) is not None:
                restaurant.subscription_status = SubscriptionStatus.suspended
                suspended += 1
        await db.commit()
        return suspended


@router.get("/config")
async def billing_config(current_user: dict = Depends(get_current_user)):
    """Lo que el frontend necesita para mostrar planes y abrir el checkout."""
    if current_user["role"] not in (UserRole.admin.value, UserRole.superadmin.value):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return {
        "paddle_available": _paddle_configured(),
        "paddle_env": settings.PADDLE_ENV,
        "paddle_client_token": settings.PADDLE_CLIENT_TOKEN or None,
        "cycles": {
            BillingCycle.monthly.value: {"days": 30, "cents_usd": settings.PADDLE_MONTHLY_CENTS},
            BillingCycle.biweekly.value: {"days": 15, "cents_usd": settings.PADDLE_BIWEEKLY_CENTS},
        },
    }


@router.post("/paddle/checkout", status_code=201)
async def paddle_checkout(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Crea una transacción Paddle y devuelve el checkout hosted."""
    if current_user["role"] not in (UserRole.admin.value, UserRole.superadmin.value):
        raise HTTPException(status_code=403, detail="Solo administradores")
    if not _paddle_configured():
        raise HTTPException(status_code=503, detail="Pago internacional no configurado")
    plan = str(data.get("plan") or "")
    cycle = str(data.get("cycle") or "")
    if plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail="Plan inválido (basic|pro)")
    if cycle not in VALID_CYCLES:
        raise HTTPException(status_code=400, detail="Ciclo inválido (monthly|biweekly)")
    price_id = _price_id_for(cycle)
    if not price_id:
        raise HTTPException(status_code=503, detail="Precio de Paddle no configurado para este ciclo")
    restaurant_id = current_user.get("restaurant_id") or data.get("restaurant_id")
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="Indica el restaurante a activar")
    restaurant = await db.get(Restaurant, int(restaurant_id))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    if current_user["role"] == UserRole.admin.value and restaurant.id != current_user.get("restaurant_id"):
        raise HTTPException(status_code=403, detail="No puedes pagar otro restaurante")

    try:
        txn = await paddle_client.create_checkout_transaction(
            settings.PADDLE_API_KEY,
            settings.PADDLE_ENV,
            price_id,
            {"restaurant_id": str(restaurant.id), "plan": plan, "cycle": cycle},
        )
    except paddle_client.PaddleError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not txn.get("id") or not txn.get("checkout_url"):
        raise HTTPException(status_code=502, detail="Paddle no devolvió checkout")

    db.add(SubscriptionPayment(
        restaurant_id=restaurant.id,
        provider="paddle",
        provider_payment_id=txn["id"],
        plan=plan,
        cycle=cycle,
        amount_cents=0,
        status="pending",
    ))
    await db.commit()
    return {"transaction_id": txn["id"], "checkout_url": txn["checkout_url"]}


def _cents_of(details: dict) -> int:
    totals = (details or {}).get("totals") or {}
    grand = totals.get("grand_total") or totals.get("total") or "0"
    try:
        return int(float(str(grand)) * 100)
    except (TypeError, ValueError):
        return 0


async def _record_payment(db: AsyncSession, restaurant_id: int | None, provider_payment_id: str,
                          plan: str, cycle: str, amount_cents: int, status: str) -> bool:
    """Guarda el pago si no existe. Retorna True si es nuevo (no duplicado)."""
    existing = await db.execute(
        select(SubscriptionPayment).where(SubscriptionPayment.provider_payment_id == provider_payment_id)
    )
    if existing.scalar_one_or_none():
        return False
    db.add(SubscriptionPayment(
        restaurant_id=restaurant_id,
        provider="paddle",
        provider_payment_id=provider_payment_id,
        plan=plan,
        cycle=cycle,
        amount_cents=amount_cents,
        status=status,
    ))
    await db.flush()
    return True


@router.post("/paddle/webhook")
async def paddle_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Webhook de Paddle: verifica firma HMAC y activa/extiende suscripción."""
    raw = await request.body()
    signature = request.headers.get("Paddle-Signature", "")
    if not paddle_client.verify_webhook_signature(raw, signature, settings.PADDLE_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Firma inválida")
    try:
        import json
        event = json.loads(raw.decode() or "{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="JSON inválido")

    event_type = event.get("event_type", "")
    data = event.get("data") or {}
    custom = data.get("custom_data") or {}
    try:
        restaurant_id = int(custom.get("restaurant_id")) if custom.get("restaurant_id") else None
    except (TypeError, ValueError):
        restaurant_id = None
    plan = str(custom.get("plan") or SubscriptionPlan.basic.value)
    cycle = str(custom.get("cycle") or BillingCycle.monthly.value)
    if plan not in VALID_PLANS:
        plan = SubscriptionPlan.basic.value
    if cycle not in VALID_CYCLES:
        cycle = BillingCycle.monthly.value

    # transaction.completed/pagada ligada a suscripción: la maneja subscription.*,
    # aquí solo se registra para auditoría (sin extender dos veces).
    details = data.get("details") or {}
    linked_subscription = details.get("subscription_id")
    amount_cents = _cents_of(data if "totals" in data else details)

    if event_type in ("subscription.created",) and restaurant_id:
        restaurant = await db.get(Restaurant, restaurant_id)
        if restaurant is None:
            raise HTTPException(status_code=404, detail="Restaurante no encontrado")
        sub_id = str(data.get("id"))
        is_new = await _record_payment(db, restaurant_id, sub_id, plan, cycle, amount_cents, "approved")
        if is_new:
            _activate(restaurant, plan, cycle)
        await db.commit()
        return {"ok": True, "alreadyProcessed": not is_new}

    if event_type in ("transaction.completed", "transaction.paid"):
        txn_id = str(data.get("id"))
        if linked_subscription or not restaurant_id:
            # Ligada a suscripción (la activa subscription.created) o sin tenant:
            # solo auditoría, sin extender.
            if txn_id:
                await _record_payment(db, restaurant_id, txn_id, plan, cycle, amount_cents, "approved")
                await db.commit()
            return {"ok": True, "alreadyProcessed": True}
        restaurant = await db.get(Restaurant, restaurant_id)
        if restaurant is None:
            raise HTTPException(status_code=404, detail="Restaurante no encontrado")
        is_new = await _record_payment(db, restaurant_id, txn_id, plan, cycle, amount_cents, "approved")
        if is_new:
            _activate(restaurant, plan, cycle)
        await db.commit()
        return {"ok": True, "alreadyProcessed": not is_new}

    if event_type in ("subscription.updated", "subscription.canceled"):
        sub_id = str(data.get("id"))
        status = str(data.get("status") or "")
        await _record_payment(db, restaurant_id, f"{sub_id}:{event.get('event_id', '')}", plan, cycle, 0, status or "updated")
        if restaurant_id:
            restaurant = await db.get(Restaurant, restaurant_id)
            if restaurant is not None:
                # Sincroniza fin de periodo pagado sin recortar lo ya extendido.
                period = (data.get("current_billing_period") or {})
                ends_at = period.get("ends_at")
                if ends_at:
                    try:
                        from datetime import timezone
                        parsed = datetime.fromisoformat(str(ends_at).replace("Z", "+00:00"))
                        if parsed.tzinfo is not None:
                            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
                        if restaurant.current_period_end is None or parsed > restaurant.current_period_end:
                            restaurant.current_period_end = parsed
                    except ValueError:
                        pass
        await db.commit()
        return {"ok": True}

    await db.commit()
    return {"ok": True, "ignored": event_type}


@router.get("/status")
async def billing_status(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Estado de suscripción del restaurante del usuario.

    Accesible para todo el staff (el mesero/cocinero solo ve el estado,
    sin detalles de pago) para mostrar avisos elegantes en sus pantallas.
    """
    if current_user["role"] not in (
        UserRole.admin.value,
        UserRole.superadmin.value,
        UserRole.waiter.value,
        UserRole.kitchen.value,
    ):
        raise HTTPException(status_code=403, detail="Sin acceso")
    restaurant_id = current_user.get("restaurant_id")
    if not restaurant_id:
        return {"has_restaurant": False}
    restaurant = await db.get(Restaurant, restaurant_id)
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    last_payment = await db.execute(
        select(SubscriptionPayment)
        .where(SubscriptionPayment.restaurant_id == restaurant.id)
        .order_by(SubscriptionPayment.id.desc())
        .limit(1)
    )
    last_payment = last_payment.scalar_one_or_none()
    return {
        "has_restaurant": True,
        "restaurant_id": restaurant.id,
        "restaurant_slug": restaurant.slug,
        "plan": restaurant.plan.value if restaurant.plan else "trial",
        "subscription_status": restaurant.subscription_status.value if restaurant.subscription_status else "trialing",
        "display_state": subscription_state(restaurant),
        "trial_ends_at": restaurant.trial_ends_at.isoformat() if restaurant.trial_ends_at else None,
        "current_period_end": restaurant.current_period_end.isoformat() if restaurant.current_period_end else None,
        "paddle_available": _paddle_configured(),
        "last_payment": {
            "provider": last_payment.provider,
            "status": last_payment.status,
            "amount_cents": last_payment.amount_cents,
            "created_at": last_payment.created_at.isoformat() if last_payment and last_payment.created_at else None,
        } if last_payment else None,
    }


@router.get("/paddle/transaction/{transaction_id}")
async def paddle_transaction_status(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Re-verificación server-side de una transacción (doble cierre con webhook).

    A propósito NO usa el gate de suscripción: un restaurante en mora debe
    poder verificar su pago para reactivarse.
    """
    if current_user["role"] not in (UserRole.admin.value, UserRole.superadmin.value):
        raise HTTPException(status_code=403, detail="Solo administradores")
    if not _paddle_configured():
        raise HTTPException(status_code=503, detail="Pago internacional no configurado")
    try:
        txn = await paddle_client.get_transaction(settings.PADDLE_API_KEY, settings.PADDLE_ENV, transaction_id)
    except paddle_client.PaddleError as e:
        raise HTTPException(status_code=502, detail=str(e))
    status = str(txn.get("status") or "")
    return {"status": status, "approved": status in ("completed", "paid", "ready")}
