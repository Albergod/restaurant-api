import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.qr import generate_qr_image
from app.core.security import get_current_user
from app.models.models import Table, UserRole

router = APIRouter(prefix="/api/tables", tags=["Mesas"])

@router.post("/", response_model=dict, status_code=201)
async def create_table(data: dict, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    restaurant_id = current_user["restaurant_id"]
    
    existing = await db.execute(select(Table).where(Table.restaurant_id == restaurant_id, Table.number == data["number"]))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una mesa con ese número en este restaurante")

    table = Table(restaurant_id=restaurant_id, number=data["number"], capacity=data.get("capacity", 4), qr_code=str(uuid.uuid4()))
    db.add(table)
    await db.commit()
    await db.refresh(table)
    
    return {
        "id": table.id, "restaurant_id": table.restaurant_id, "number": table.number,
        "qr_code": table.qr_code, "qr_image": generate_qr_image(f"{settings.FRONTEND_URL.rstrip('/')}/menu/{table.qr_code}"),
        "capacity": table.capacity, "is_occupied": table.is_occupied
    }

@router.get("/", response_model=List[dict])
async def list_tables(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.superadmin.value:
        result = await db.execute(select(Table).order_by(Table.restaurant_id, Table.number))
    else:
        result = await db.execute(select(Table).where(Table.restaurant_id == current_user["restaurant_id"]).order_by(Table.number))
    tables = result.scalars().all()
    return [
        {"id": t.id, "restaurant_id": t.restaurant_id, "number": t.number, "qr_code": t.qr_code,
         "qr_image": generate_qr_image(f"{settings.FRONTEND_URL.rstrip('/')}/menu/{t.qr_code}"),
         "capacity": t.capacity, "is_occupied": t.is_occupied} for t in tables
    ]

@router.get("/{table_id}", response_model=dict)
async def get_table(table_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    return {
        "id": table.id, "restaurant_id": table.restaurant_id, "number": table.number, "qr_code": table.qr_code,
        "qr_image": generate_qr_image(f"{settings.FRONTEND_URL.rstrip('/')}/menu/{table.qr_code}"),
        "capacity": table.capacity, "is_occupied": table.is_occupied
    }

@router.post("/{table_id}/regenerate-qr", response_model=dict)
async def regenerate_qr(table_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    result = await db.execute(select(Table).where(Table.id == table_id, Table.restaurant_id == current_user["restaurant_id"]))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    table.qr_code = str(uuid.uuid4())
    await db.commit()
    await db.refresh(table)
    return {
        "id": table.id, "restaurant_id": table.restaurant_id, "number": table.number, "qr_code": table.qr_code,
        "qr_image": generate_qr_image(f"{settings.FRONTEND_URL.rstrip('/')}/menu/{table.qr_code}"),
        "capacity": table.capacity, "is_occupied": table.is_occupied
    }