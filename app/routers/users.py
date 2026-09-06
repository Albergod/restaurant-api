from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import hash_password, get_current_user
from app.models.models import Restaurant, User, UserRole
from app.schemas.schemas import UserOut, UserUpdate, UserRegister

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    allowed = [UserRole.admin.value, UserRole.waiter.value, UserRole.kitchen.value, UserRole.superadmin.value]
    if current_user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    query = select(User)
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(User.restaurant_id == current_user["restaurant_id"])
    return (await db.execute(query)).scalars().all()

@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserRegister, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")

    needs_restaurant = data.role in [UserRole.admin.value, UserRole.waiter.value, UserRole.kitchen.value]

    if current_user["role"] == UserRole.superadmin.value:
        restaurant_id = data.restaurant_id
        if needs_restaurant and not restaurant_id:
            raise HTTPException(status_code=400, detail="Este rol requiere restaurant_id")
    else:
        restaurant_id = current_user["restaurant_id"]
        if not restaurant_id:
            raise HTTPException(status_code=400, detail="El admin actual no tiene restaurante asignado")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Email already registered")

    if restaurant_id is not None:
        restaurant = (await db.execute(
            select(Restaurant).where(Restaurant.id == restaurant_id, Restaurant.is_active == True)
        )).scalar_one_or_none()
        if not restaurant:
            raise HTTPException(status_code=400, detail="El restaurante no existe o está inactivo")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
        restaurant_id=restaurant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    query = select(User).where(User.id == user_id)
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(User.restaurant_id == current_user["restaurant_id"])
    user = (await db.execute(query)).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    if "email" in update_data:
        existing = await db.execute(select(User).where(User.email == update_data["email"], User.id != user_id))
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Email already taken")
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    query = select(User).where(User.id == user_id)
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(User.restaurant_id == current_user["restaurant_id"])
    user = (await db.execute(query)).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()