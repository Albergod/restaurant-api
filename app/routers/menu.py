from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Category, Product, Table, UserRole
from app.schemas.schemas import (
    CategoryCreate, CategoryOut, CategoryWithProducts,
    ProductCreate, ProductUpdate, ProductOut,
    TableOut
)

router = APIRouter(prefix="/api/menu", tags=["Menú"])


# ──────────────────────────────────────────
# CATEGORÍAS
# ──────────────────────────────────────────

@router.get("/", response_model=List[CategoryWithProducts])
async def get_full_menu(db: AsyncSession = Depends(get_db)):
    """Menú completo con categorías y productos disponibles. Acceso público (QR)."""
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)
        .options(selectinload(Category.products))
        .order_by(Category.sort_order)
    )
    categories = result.scalars().all()
    # Filtrar solo productos disponibles
    for cat in categories:
        cat.products = [p for p in cat.products if p.is_available]
    return categories


@router.get("/featured", response_model=List[ProductOut])
async def get_featured_products(db: AsyncSession = Depends(get_db)):
    """Productos destacados / recomendados para mostrar arriba del menú."""
    result = await db.execute(
        select(Product).where(Product.is_featured == True, Product.is_available == True)
    )
    return result.scalars().all()


@router.get("/promotions", response_model=List[ProductOut])
async def get_promotions(db: AsyncSession = Depends(get_db)):
    """Productos en promoción."""
    result = await db.execute(
        select(Product).where(Product.is_promoted == True, Product.is_available == True)
    )
    return result.scalars().all()


@router.get("/table-by-qr/{qr_code}", response_model=TableOut)
async def get_table_by_qr(qr_code: str, db: AsyncSession = Depends(get_db)):
    """Obtener info de una mesa por su código QR. Público (lo necesita el menú)."""
    result = await db.execute(select(Table).where(Table.qr_code == qr_code))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    return table


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Crear categoría. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    cat = Category(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Desactivar categoría. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    cat.is_active = False
    await db.commit()


# ──────────────────────────────────────────
# PRODUCTOS
# ──────────────────────────────────────────

@router.post("/products", response_model=ProductOut, status_code=201)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Agregar producto al menú. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    product = Product(**data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Editar producto (precio, disponibilidad, promoción, etc.). Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Eliminar producto. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    await db.delete(product)
    await db.commit()
