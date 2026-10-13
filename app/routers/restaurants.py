from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
import re
import uuid
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, hash_password, create_access_token
from app.models.models import Restaurant, User, UserRole, Order, OrderStatus, OrderItem, OrderStatusHistory, Category, Product, Table, ChatSession, ChatMessage, LoyaltyPoints
from app.schemas.schemas import RestaurantCreate, RestaurantUpdate, RestaurantSignup

router = APIRouter(prefix="/api/restaurants", tags=["Restaurantes"])

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

@router.post("/signup", status_code=201)
async def signup_restaurant(data: RestaurantSignup, db: AsyncSession = Depends(get_db)):
    """Alta self-service: crea restaurante en estado registered + admin.

    No activa el trial (eso pasa al pulsar «Activar prueba»). Honeypot
    anti-bots: el campo website debe venir vacío.
    """
    if (data.website or "").strip():
        raise HTTPException(status_code=400, detail="Solicitud inválida")
    slug = data.slug.strip().lower()
    if not SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="Slug inválido (minúsculas, números y guiones)")
    if len(data.admin_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    existing = await db.execute(select(Restaurant).where(Restaurant.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ese nombre corto ya está en uso")
    email_taken = await db.execute(select(User).where(User.email == data.admin_email))
    if email_taken.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")

    restaurant = Restaurant(name=data.name.strip(), slug=slug)
    db.add(restaurant)
    await db.flush()
    admin_user = User(
        name=data.admin_name.strip() or "Administrador",
        email=data.admin_email,
        hashed_password=hash_password(data.admin_password),
        role=UserRole.admin,
        restaurant_id=restaurant.id,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(restaurant)
    token = create_access_token({"sub": str(admin_user.id), "role": admin_user.role.value, "restaurant_id": restaurant.id})
    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "slug": restaurant.slug,
        "plan": restaurant.plan.value,
        "subscription_status": restaurant.subscription_status.value,
        "access_token": token,
        "token_type": "bearer",
        "role": admin_user.role.value,
        "restaurant_id": restaurant.id,
    }

@router.get("/demo/overview")
async def demo_overview(db: AsyncSession = Depends(get_db)):
    """Demo pública (sin login): escaparate del restaurante 'demo' con datos ficticios."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Restaurant).where(Restaurant.slug == "demo", Restaurant.is_active == True)
    )
    demo = result.scalar_one_or_none()
    if not demo:
        raise HTTPException(status_code=404, detail="Demo no disponible por ahora")
    cats = await db.execute(
        select(Category)
        .where(Category.restaurant_id == demo.id, Category.is_active == True)
        .options(selectinload(Category.products))
        .order_by(Category.sort_order)
    )
    categories = cats.scalars().all()
    table = await db.execute(
        select(Table).where(Table.restaurant_id == demo.id).order_by(Table.number).limit(1)
    )
    table = table.scalar_one_or_none()
    return {
        "restaurant": {"id": demo.id, "name": demo.name, "slug": demo.slug},
        "table_qr": table.qr_code if table else None,
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "products": [
                    {"id": p.id, "name": p.name, "description": p.description, "price": p.price, "image_url": p.image_url}
                    for p in c.products if p.is_available
                ],
            }
            for c in categories
        ],
    }

@router.post("/demo/reset", status_code=200)
async def demo_reset(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Restaura la demo a su estado original.

    Solo funciona si el usuario autenticado pertenece al restaurante con slug
    'demo'. Borra pedidos, chat, lealtad y TODA la posible basura dejada por
    visitantes (platos, categorias, mesas y usuarios creados en la demo), y
    re-siembra la carta y mesas originales. Conserva unicamente al usuario que
    pulsa el boton (normalmente el admin demo del tour), ademas del
    restaurante, su suscripcion y su configuracion. Sin el freno de pedidos
    activos: es una demo.
    """
    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == current_user["restaurant_id"]))).scalar_one_or_none()
    if not restaurant or restaurant.slug != "demo":
        raise HTTPException(status_code=403, detail="Solo disponible para el restaurante demo")
    restaurant_id = restaurant.id

    order_ids = select(Order.id).where(Order.restaurant_id == restaurant_id)
    session_ids = select(ChatSession.id).where(ChatSession.restaurant_id == restaurant_id)
    counts = {}
    for model, child_column, parent_ids in [
        (OrderStatusHistory, OrderStatusHistory.order_id, order_ids),
        (OrderItem, OrderItem.order_id, order_ids),
        (ChatMessage, ChatMessage.session_id, session_ids),
        (ChatSession, None, None),
        (LoyaltyPoints, None, None),
        (Order, None, None),
        (Product, None, None),
        (Category, None, None),
        (Table, None, None),
        (User, None, None),
    ]:
        stmt = delete(model)
        if child_column is not None:
            stmt = stmt.where(child_column.in_(parent_ids))
        elif model is User:
            stmt = stmt.where(User.restaurant_id == restaurant_id, User.id != int(current_user["id"]))
        else:
            stmt = stmt.where(model.restaurant_id == restaurant_id)
        result = await db.execute(stmt)
        counts[model.__name__] = result.rowcount
        if child_column is not None:
            await db.flush()

    # Re-siembra canónica (igual que el seed inicial + carta de ejemplo para
    # que el tour nunca arranque con el menú vacío).
    for t_data in [
        {"number": 1, "capacity": 4},
        {"number": 2, "capacity": 2},
        {"number": 3, "capacity": 6},
        {"number": 4, "capacity": 4},
    ]:
        db.add(Table(restaurant_id=restaurant_id, qr_code=str(uuid.uuid4()), **t_data))
    menu = [
        ("Entradas", "Para empezar", 1, [
            ("Empanadas x3", "Crujientes, con ají de la casa", 12000),
            ("Patacones con hogao", "Plátano verde con hogao criollo", 10000),
        ]),
        ("Platos Fuertes", "Especialidades", 2, [
            ("Bandeja Paisa", "La completa: fríjoles, chicharrón, huevo y más", 28000),
            ("Sancocho de gallina", "Servido con arroz, aguacate y arepa", 22000),
        ]),
        ("Bebidas", "Para acompañar", 3, [
            ("Limonada Natural", "Recién hecha, en agua o en leche", 8000),
            ("Jugo de lulo", "Fruta fresca licuada al momento", 9000),
        ]),
    ]
    for cat_name, cat_desc, sort_order, products in menu:
        category = Category(restaurant_id=restaurant_id, name=cat_name, description=cat_desc, sort_order=sort_order)
        db.add(category)
        await db.flush()
        for prod_name, prod_desc, price in products:
            db.add(Product(
                restaurant_id=restaurant_id, category_id=category.id,
                name=prod_name, description=prod_desc, price=price,
            ))
    counts["SeededTables"] = 4
    counts["SeededProducts"] = 6

    await db.commit()
    return {"restaurant_id": restaurant_id, "deleted": counts, "message": "Demo restaurada a su estado original. Solo se conserva tu usuario."}

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
        "plan": restaurant.plan.value if restaurant.plan else "trial",
        "subscription_status": restaurant.subscription_status.value if restaurant.subscription_status else "trialing",
        "trial_started_at": None,
        "trial_ends_at": restaurant.trial_ends_at.isoformat() if restaurant.trial_ends_at else None,
        "current_period_end": restaurant.current_period_end.isoformat() if restaurant.current_period_end else None,
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


TRIAL_DAYS = 14

@router.post("/{restaurant_id}/trial", status_code=201)
async def start_trial(restaurant_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Activa la prueba gratis de 14 días (una sola vez).

    El contador arranca al pulsar «Activar prueba», antes del onboarding:
    sin requisito de productos (se cargan después, dentro del trial).
    """
    from datetime import datetime, timedelta
    from app.models.models import SubscriptionStatus

    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    is_owner = current_user["role"] == UserRole.admin.value and current_user.get("restaurant_id") == restaurant.id
    if current_user["role"] != UserRole.superadmin.value and not is_owner:
        raise HTTPException(status_code=403, detail="Solo el administrador del restaurante")
    if restaurant.trial_started_at is not None:
        raise HTTPException(status_code=409, detail="La prueba gratis ya fue usada en este restaurante")
    now = datetime.utcnow()
    restaurant.trial_started_at = now
    restaurant.trial_ends_at = now + timedelta(days=TRIAL_DAYS)
    restaurant.subscription_status = SubscriptionStatus.trialing
    await db.commit()
    await db.refresh(restaurant)
    return {
        "id": restaurant.id,
        "plan": restaurant.plan.value,
        "subscription_status": restaurant.subscription_status.value,
        "trial_started_at": restaurant.trial_started_at.isoformat(),
        "trial_ends_at": restaurant.trial_ends_at.isoformat(),
    }


@router.patch("/{restaurant_id}")
async def update_restaurant(restaurant_id: int, data: RestaurantUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.superadmin.value:
        raise HTTPException(status_code=403, detail="Solo superadmin puede editar restaurantes")

    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No se proporcionaron datos para actualizar")

    if "slug" in update_data:
        new_slug = update_data["slug"].strip().lower()
        if not new_slug:
            raise HTTPException(status_code=400, detail="El slug no puede estar vacio")
        slug_taken = (await db.execute(
            select(Restaurant).where(Restaurant.slug == new_slug, Restaurant.id != restaurant_id)
        )).scalar_one_or_none()
        if slug_taken:
            raise HTTPException(status_code=400, detail=f"El slug '{new_slug}' ya esta en uso")
        update_data["slug"] = new_slug

    if "name" in update_data:
        new_name = update_data["name"].strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacio")
        update_data["name"] = new_name

    for field, value in update_data.items():
        setattr(restaurant, field, value)

    await db.commit()
    await db.refresh(restaurant)
    return {"id": restaurant.id, "name": restaurant.name, "slug": restaurant.slug, "is_active": restaurant.is_active}


@router.post("/{restaurant_id}/reset", status_code=200)
async def reset_restaurant_content(restaurant_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Elimina pedidos, mesas, productos, categorias, chat y puntos de fidelidad.

    Conserva el restaurante, sus usuarios y configuracion. Util para que un
    cliente que termina una prueba o cambia de carta empiece de cero.
    """
    if current_user["role"] != UserRole.superadmin.value:
        raise HTTPException(status_code=403, detail="Solo superadmin puede resetear restaurantes")

    restaurant = (await db.execute(select(Restaurant).where(Restaurant.id == restaurant_id))).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")

    active_orders = (await db.execute(
        select(func.count()).select_from(Order).where(
            Order.restaurant_id == restaurant_id,
            Order.status.in_([OrderStatus.pending, OrderStatus.confirmed, OrderStatus.preparing, OrderStatus.ready]),
        )
    )).scalar()
    if active_orders > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede resetear: hay {active_orders} pedido(s) activo(s). Cierralos primero.",
        )

    counts = {}

    order_ids = select(Order.id).where(Order.restaurant_id == restaurant_id)
    session_ids = select(ChatSession.id).where(ChatSession.restaurant_id == restaurant_id)

    targets = [
        (OrderStatusHistory, OrderStatusHistory.order_id, order_ids),
        (OrderItem, OrderItem.order_id, order_ids),
        (ChatMessage, ChatMessage.session_id, session_ids),
        (ChatSession, None, None),
        (LoyaltyPoints, None, None),
        (Order, None, None),
        (Product, None, None),
        (Category, None, None),
        (Table, None, None),
    ]
    for model, child_column, parent_ids in targets:
        stmt = delete(model)
        if child_column is not None:
            stmt = stmt.where(child_column.in_(parent_ids))
        else:
            stmt = stmt.where(model.restaurant_id == restaurant_id)
        result = await db.execute(stmt)
        counts[model.__name__] = result.rowcount
        if child_column is not None:
            await db.flush()

    await db.commit()
    return {
        "restaurant_id": restaurant_id,
        "deleted": counts,
        "message": "Contenido del restaurante eliminado. Restaurante y usuarios conservados.",
    }