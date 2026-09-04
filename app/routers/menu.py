from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, decode_token
from app.models.models import Category, OrderItem, Product, Table, UserRole
from app.routers.upload import delete_image
from app.schemas.schemas import (
    CategoryCreate, CategoryOut, CategoryWithProducts,
    ProductCreate, ProductUpdate, ProductOut, TableOut
)

router = APIRouter(prefix="/api/menu", tags=["Menú"])


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        return decode_token(token)
    except Exception:
        return None


async def _resolve_restaurant_id(table_qr, restaurant_id, current_user, db):
    if restaurant_id is not None:
        if not current_user or current_user["role"] not in (UserRole.admin.value, UserRole.superadmin.value):
            raise HTTPException(status_code=403, detail="Solo administradores pueden filtrar por restaurante")
        if current_user["role"] == UserRole.admin.value and restaurant_id != current_user["restaurant_id"]:
            raise HTTPException(status_code=403, detail="No puedes ver otro restaurante")
    elif current_user and current_user["role"] == UserRole.admin.value:
        restaurant_id = current_user["restaurant_id"]

    if table_qr:
        result = await db.execute(select(Table.restaurant_id).where(Table.qr_code == table_qr))
        rid = result.scalar_one_or_none()
        if rid is None:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        restaurant_id = rid

    return restaurant_id

@router.get("/", response_model=List[CategoryWithProducts])
async def get_full_menu(
    table_qr: Optional[str] = None,
    restaurant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    restaurant_id = await _resolve_restaurant_id(table_qr, restaurant_id, current_user, db)

    query = select(Category).where(Category.is_active == True).options(selectinload(Category.products)).order_by(Category.sort_order)
    if restaurant_id is not None:
        query = query.where(Category.restaurant_id == restaurant_id)

    result = await db.execute(query)
    categories = result.scalars().all()
    for cat in categories:
        cat.products = [p for p in cat.products if p.is_available]
    return categories

@router.get("/featured", response_model=List[ProductOut])
async def get_featured_products(
    table_qr: Optional[str] = None,
    restaurant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    restaurant_id = await _resolve_restaurant_id(table_qr, restaurant_id, current_user, db)

    query = select(Product).where(Product.is_featured == True, Product.is_available == True)
    if restaurant_id is not None:
        query = query.where(Product.restaurant_id == restaurant_id)
    return (await db.execute(query)).scalars().all()

@router.get("/promotions", response_model=List[ProductOut])
async def get_promotions(
    table_qr: Optional[str] = None,
    restaurant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    restaurant_id = await _resolve_restaurant_id(table_qr, restaurant_id, current_user, db)

    query = select(Product).where(Product.is_promoted == True, Product.is_available == True)
    if restaurant_id is not None:
        query = query.where(Product.restaurant_id == restaurant_id)
    return (await db.execute(query)).scalars().all()

@router.get("/table-by-qr/{qr_code}", response_model=TableOut)
async def get_table_by_qr(qr_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Table).where(Table.qr_code == qr_code))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    return table

@router.post("/categories", response_model=CategoryOut, status_code=201)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    cat = Category(restaurant_id=current_user["restaurant_id"], **data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat

@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    result = await db.execute(select(Category).where(Category.id == category_id, Category.restaurant_id == current_user["restaurant_id"]))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.is_active = False
    await db.commit()

@router.post("/products", response_model=ProductOut, status_code=201)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    product = Product(restaurant_id=current_user["restaurant_id"], **data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product

@router.patch("/products/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    result = await db.execute(select(Product).where(Product.id == product_id, Product.restaurant_id == current_user["restaurant_id"]))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    changes = data.model_dump(exclude_unset=True)
    old_image_url = product.image_url if "image_url" in changes and changes["image_url"] != product.image_url else None
    for field, value in changes.items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    await delete_image(old_image_url)
    return product

@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Solo administradores")
    result = await db.execute(select(Product).where(Product.id == product_id, Product.restaurant_id == current_user["restaurant_id"]))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    await db.execute(delete(OrderItem).where(OrderItem.product_id == product_id))
    image_url = product.image_url
    await db.delete(product)
    await db.commit()
    await delete_image(image_url)