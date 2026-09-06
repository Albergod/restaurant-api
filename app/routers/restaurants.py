from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, hash_password
from app.models.models import Restaurant, User, UserRole, Order, OrderStatus
from app.schemas.schemas import RestaurantCreate

router = APIRouter(prefix="/api/restaurants", tags=["Restaurantes"])

@router.post("/", status_code=201)
async def create_restaurant(data: RestaurantCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.superadmin.value:
        raise HTTPException(status_code=403, detail="Solo superadmin puede crear restaurantes")
    existing = await db.execute(select(Restaurant).where(Restaurant.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El slug ya está en uso")

    restaurant = Restaurant(name=data.name, slug=data.slug)
    db.add(restaurant)
    await db.flush()

    admin_email = data.admin_email or f"admin-{restaurant.id}@{data.slug}.com"
    admin_password = data.admin_password or uuid.uuid4().hex[:8]
    waiter_email = f"mesero@{data.slug}.com"
    waiter_password = settings.DEFAULT_WAITER_PASSWORD
    kitchen_email = f"cocina@{data.slug}.com"
    kitchen_password = settings.DEFAULT_KITCHEN_PASSWORD

    admin_user = User(name=data.admin_name or "Administrador", email=admin_email, hashed_password=hash_password(admin_password), role=UserRole.admin, restaurant_id=restaurant.id)
    db.add(admin_user)
    db.add(User(name="Mesero", email=waiter_email, hashed_password=hash_password(waiter_password), role=UserRole.waiter, restaurant_id=restaurant.id))
    db.add(User(name="Cocina", email=kitchen_email, hashed_password=hash_password(kitchen_password), role=UserRole.kitchen, restaurant_id=restaurant.id))
    await db.commit()
    await db.refresh(restaurant)

    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "slug": restaurant.slug,
        "is_active": restaurant.is_active,
        "admin_email": admin_email,
        "admin_password": admin_password,
        "waiter_email": waiter_email,
        "waiter_password": waiter_password,
        "kitchen_email": kitchen_email,
        "kitchen_password": kitchen_password,
    }

@router.get("/", response_model=list)
async def list_restaurants(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.superadmin.value:
        result = await db.execute(select(Restaurant).order_by(Restaurant.id))
        return [{"id": r.id, "name": r.name, "slug": r.slug, "is_active": r.is_active} for r in result.scalars().all()]
    elif current_user["role"] == UserRole.admin.value:
        result = await db.execute(select(Restaurant).where(Restaurant.id == current_user["restaurant_id"]))
        r = result.scalar_one_or_none()
        return [{"id": r.id, "name": r.name, "slug": r.slug, "is_active": r.is_active}] if r else []
    raise HTTPException(status_code=403, detail="Acceso denegado")

@router.delete("/{restaurant_id}", status_code=204)
async def deactivate_restaurant(restaurant_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.superadmin.value:
        raise HTTPException(status_code=403, detail="Solo superadmin puede eliminar restaurantes")

    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    if not restaurant.is_active:
        raise HTTPException(status_code=400, detail="El restaurante ya está inactivo")

    active_count = (await db.execute(
        select(func.count()).select_from(Restaurant).where(Restaurant.is_active == True)
    )).scalar()
    if active_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="No se puede desactivar el único restaurante activo del sistema",
        )

    active_orders = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.restaurant_id == restaurant_id,
            Order.status.in_([OrderStatus.pending, OrderStatus.confirmed, OrderStatus.preparing, OrderStatus.ready]),
        )
    )).scalar()
    if active_orders > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede desactivar: tiene {active_orders} pedido(s) activo(s). Ciérralos primero.",
        )

    restaurant.is_active = False
    await db.commit()

@router.post("/{restaurant_id}/reactivate", status_code=200)
async def reactivate_restaurant(restaurant_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.superadmin.value:
        raise HTTPException(status_code=403, detail="Solo superadmin puede reactivar restaurantes")

    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    if restaurant.is_active:
        raise HTTPException(status_code=400, detail="El restaurante ya está activo")

    slug_taken = (await db.execute(
        select(Restaurant).where(Restaurant.slug == restaurant.slug, Restaurant.id != restaurant_id, Restaurant.is_active == True)
    )).scalar_one_or_none()
    if slug_taken:
        raise HTTPException(
            status_code=400,
            detail=f"El slug '{restaurant.slug}' ya está en uso por otro restaurante activo",
        )

    restaurant.is_active = True
    await db.commit()
    await db.refresh(restaurant)
    return {"id": restaurant.id, "name": restaurant.name, "slug": restaurant.slug, "is_active": restaurant.is_active}