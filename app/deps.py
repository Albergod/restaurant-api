from fastapi import Depends, HTTPException
from app.core.security import get_current_user
from app.models.models import UserRole

async def get_admin_only(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Se requiere rol admin o superadmin")
    return current_user

async def get_admin_or_staff(current_user: dict = Depends(get_current_user)) -> dict:
    allowed = [UserRole.admin.value, UserRole.waiter.value, UserRole.kitchen.value, UserRole.superadmin.value]
    if current_user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return current_user