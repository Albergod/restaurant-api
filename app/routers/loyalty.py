from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import LoyaltyPoints, UserRole

router = APIRouter(prefix="/api/loyalty", tags=["Fidelización"])

@router.get("/me", response_model=dict)
async def my_points(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["id"])
    restaurant_id = current_user["restaurant_id"]
    result = await db.execute(select(LoyaltyPoints).where(LoyaltyPoints.user_id == user_id, LoyaltyPoints.restaurant_id == restaurant_id))
    loyalty = result.scalar_one_or_none()
    if not loyalty:
        loyalty = LoyaltyPoints(user_id=user_id, restaurant_id=restaurant_id, points=0)
        db.add(loyalty)
        await db.commit()
        await db.refresh(loyalty)
    return {"user_id": loyalty.user_id, "restaurant_id": loyalty.restaurant_id, "points": loyalty.points, "updated_at": loyalty.updated_at}

@router.post("/add/{user_id}", response_model=dict)
async def add_points(user_id: int, points: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.waiter.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    restaurant_id = current_user["restaurant_id"]
    result = await db.execute(select(LoyaltyPoints).where(LoyaltyPoints.user_id == user_id, LoyaltyPoints.restaurant_id == restaurant_id))
    loyalty = result.scalar_one_or_none()
    if not loyalty:
        loyalty = LoyaltyPoints(user_id=user_id, restaurant_id=restaurant_id, points=0)
        db.add(loyalty)
    loyalty.points += points
    await db.commit()
    await db.refresh(loyalty)
    return {"user_id": loyalty.user_id, "restaurant_id": loyalty.restaurant_id, "points": loyalty.points, "updated_at": loyalty.updated_at}