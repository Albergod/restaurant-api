from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, get_current_user
from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

@router.post("/register", response_model=UserOut, status_code=201)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    if data.role != UserRole.customer and not settings.ALLOW_PUBLIC_STAFF_REGISTRATION:
        raise HTTPException(status_code=403, detail="El registro público de personal está desactivado")
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = User(name=data.name, email=data.email, hashed_password=hash_password(data.password), role=data.role, restaurant_id=data.restaurant_id)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    token = create_access_token({"sub": str(user.id), "role": user.role.value, "restaurant_id": user.restaurant_id})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "restaurant_id": user.restaurant_id}


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == int(current_user["id"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user