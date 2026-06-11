from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import LoyaltyPoints, UserRole
from app.schemas.schemas import LoyaltyOut

router = APIRouter(prefix="/api/loyalty", tags=["Fidelización"])


@router.get("/me", response_model=LoyaltyOut)
async def my_points(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Ver mis puntos de fidelización."""
    user_id = int(current_user["sub"])
    result = await db.execute(select(LoyaltyPoints).where(LoyaltyPoints.user_id == user_id))
    loyalty = result.scalar_one_or_none()

    if not loyalty:
        # Crear registro vacío la primera vez
        loyalty = LoyaltyPoints(user_id=user_id, points=0)
        db.add(loyalty)
        await db.commit()
        await db.refresh(loyalty)

    return loyalty


@router.post("/add/{user_id}", response_model=LoyaltyOut)
async def add_points(
    user_id: int,
    points: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Agregar puntos a un cliente. Solo admin o mesero."""
    if current_user["role"] not in [UserRole.admin, UserRole.waiter]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    result = await db.execute(select(LoyaltyPoints).where(LoyaltyPoints.user_id == user_id))
    loyalty = result.scalar_one_or_none()

    if not loyalty:
        loyalty = LoyaltyPoints(user_id=user_id, points=0)
        db.add(loyalty)

    loyalty.points += points
    await db.commit()
    await db.refresh(loyalty)
    return loyalty
