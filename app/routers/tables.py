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
from app.schemas.schemas import TableCreate, TableOut

router = APIRouter(prefix="/api/tables", tags=["Mesas"])


def _attach_qr(table):
    table.qr_image = generate_qr_image(f"{settings.FRONTEND_URL.rstrip('/')}/menu/{table.qr_code}")
    return table


@router.post("/", response_model=TableOut, status_code=201)
async def create_table(
    data: TableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Crear una mesa y generar su código QR único. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    existing = await db.execute(select(Table).where(Table.number == data.number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe una mesa con ese número")

    table = Table(
        number=data.number,
        capacity=data.capacity,
        qr_code=str(uuid.uuid4()),   # Token único para el QR
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return _attach_qr(table)


@router.get("/", response_model=List[TableOut])
async def list_tables(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Listar todas las mesas con estado de ocupación. Meseros y admin."""
    result = await db.execute(select(Table).order_by(Table.number))
    tables = result.scalars().all()
    for t in tables:
        _attach_qr(t)
    return tables


@router.get("/{table_id}", response_model=TableOut)
async def get_table(table_id: int, db: AsyncSession = Depends(get_db)):
    """Info de una mesa. Acceso público (el QR lleva al cliente aquí)."""
    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    return _attach_qr(table)


@router.post("/{table_id}/regenerate-qr", response_model=TableOut)
async def regenerate_qr(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Regenerar el código QR de una mesa (útil si el QR se compromete). Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    result = await db.execute(select(Table).where(Table.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    table.qr_code = str(uuid.uuid4())
    await db.commit()
    await db.refresh(table)
    return _attach_qr(table)
