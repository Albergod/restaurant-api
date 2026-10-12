from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Restaurant, SubscriptionStatus, UserRole

# Días de gracia tras vencer el periodo antes de bloquear por mora.
GRACE_DAYS = 3

def _status_value(status) -> str:
    return status.value if isinstance(status, SubscriptionStatus) else str(status or "")


def is_registered(restaurant: Restaurant | None) -> bool:
    """Registrado pero sin prueba activada: creó cuenta y restaurante,
    todavía no pulsó «Activar prueba gratuita»."""
    return (
        restaurant is not None
        and _status_value(restaurant.subscription_status) == SubscriptionStatus.trialing.value
        and restaurant.trial_ends_at is None
    )


def subscription_state(restaurant: Restaurant | None) -> str:
    """Estado simplificado para la UI: registered|trialing|active|past_due|suspended|cancelled|expired|inactive."""
    if restaurant is None or not restaurant.is_active:
        return "inactive"
    status = _status_value(restaurant.subscription_status)
    if status in (SubscriptionStatus.suspended.value, SubscriptionStatus.cancelled.value):
        return status
    if is_registered(restaurant):
        return "registered"
    now = datetime.utcnow()
    if status == SubscriptionStatus.trialing.value:
        return "expired" if restaurant.trial_ends_at is not None and restaurant.trial_ends_at < now else status
    end = restaurant.current_period_end
    if end is not None and end + timedelta(days=GRACE_DAYS) < now:
        return "expired"
    return status or "active"


def subscription_block_reason(restaurant: Restaurant | None, *, allow_registered: bool = False) -> str | None:
    """None si la suscripción permite operar; si no, mensaje para el 402.

    allow_registered=True (login): un registrado puede entrar para activar su
    prueba; el paywall vive en el frontend.
    """
    if restaurant is None or not restaurant.is_active:
        return "Este restaurante no está activo"
    now = datetime.utcnow()
    status = _status_value(restaurant.subscription_status)
    if status in (SubscriptionStatus.suspended.value, SubscriptionStatus.cancelled.value):
        return "Suscripción suspendida. Renueva tu plan para seguir operando"
    if is_registered(restaurant):
        if allow_registered:
            return None
        return "Activa tu prueba gratuita para empezar a operar"
    if status == SubscriptionStatus.trialing.value:
        if restaurant.trial_ends_at is not None and restaurant.trial_ends_at < now:
            return "Tu periodo de prueba terminó. Elige un plan para continuar"
        return None
    # active / past_due: se permite dentro del periodo + gracia
    end = restaurant.current_period_end
    if end is not None and end + timedelta(days=GRACE_DAYS) < now:
        return "Tu suscripción venció. Renueva tu plan para seguir operando"
    return None

async def require_active_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Gate SaaS: superadmin pasa siempre; resto requiere suscripción al día (402)."""
    if current_user["role"] == UserRole.superadmin.value:
        return current_user
    restaurant_id = current_user.get("restaurant_id")
    restaurant = await db.get(Restaurant, restaurant_id) if restaurant_id else None
    reason = subscription_block_reason(restaurant)
    if reason is not None:
        raise HTTPException(status_code=402, detail=reason)
    return current_user

async def get_admin_only(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Se requiere rol admin o superadmin")
    return current_user

async def get_admin_or_staff(current_user: dict = Depends(get_current_user)) -> dict:
    allowed = [UserRole.admin.value, UserRole.waiter.value, UserRole.kitchen.value, UserRole.superadmin.value]
    if current_user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return current_user