from pathlib import Path
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import (
    ChatMessage, ChatSession, LoyaltyPoints, Order, OrderItem, OrderStatusHistory,
    User, UserRole, Category, Product, Table, Restaurant,
)
from app.routers import auth, menu, orders, tables, chat, loyalty, users, upload, restaurants, billing

app = FastAPI(title="Restaurant API", description="Plataforma de gestión y comunicación para restaurantes (Multi-tenant SaaS)", version="2.0.0")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(tables.router)
app.include_router(chat.router)
app.include_router(loyalty.router)
app.include_router(users.router)
app.include_router(upload.router)
app.include_router(billing.router)

uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

async def _sync_superadmin(db):
    """Crea o actualiza el superadmin a partir de la configuración.

    Las credenciales vienen de SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en el
    entorno, nunca hardcodeadas en el código. Idempotente: se ejecuta en cada
    arranque sin duplicar usuarios.
    """
    email = settings.SUPERADMIN_EMAIL.strip()
    password = settings.SUPERADMIN_PASSWORD.strip()
    if not email or not password:
        print("⚠️ SUPERADMIN_EMAIL/PASSWORD vacíos: no se gestiona el superadmin desde config.")
        return

    superadmin = (await db.execute(
        select(User).where(User.role == UserRole.superadmin).order_by(User.id).limit(1)
    )).scalar_one_or_none()

    if superadmin is None:
        superadmin = User(
            name="Superadmin",
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.superadmin,
            restaurant_id=None,
        )
        db.add(superadmin)
        print("✅ Superadmin creado desde configuración.")
    else:
        changes = []
        if superadmin.email != email:
            superadmin.email = email
            changes.append("email")
        superadmin.hashed_password = hash_password(password)
        changes.append("password")
        print("✅ Superadmin sincronizado desde configuración (había usuario existente).")


async def _seed_default_data():
    async with AsyncSessionLocal() as db:
        existing_users = await db.execute(select(func.count()).select_from(User))
        await _sync_superadmin(db)
        await db.commit()
        if existing_users.scalar() > 0:
            print("ℹ️ Seed de demo omitido: ya existen usuarios.")
            return

        has_users = False

        restaurant_count_result = await db.execute(select(func.count()).select_from(Restaurant))

        restaurant = None
        if restaurant_count_result.scalar() == 0:
            restaurant = Restaurant(name="Restaurante Demo", slug="demo", is_active=True)
            db.add(restaurant)
            await db.flush()
        else:
            first = await db.execute(select(Restaurant).order_by(Restaurant.id).limit(1))
            restaurant = first.scalar_one()

        admin = User(
            name="Admin",
            email="admin@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.admin,
            restaurant_id=restaurant.id,
        )
        db.add(admin)
        waiter = User(
            name="Mesero",
            email="mesero@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_WAITER_PASSWORD),
            role=UserRole.waiter,
            restaurant_id=restaurant.id,
        )
        db.add(waiter)
        kitchen = User(
            name="Cocina",
            email="cocina@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_KITCHEN_PASSWORD),
            role=UserRole.kitchen,
            restaurant_id=restaurant.id,
        )
        db.add(kitchen)

        existing_tables = await db.execute(
            select(func.count()).select_from(Table).where(Table.restaurant_id == restaurant.id)
        )
        if existing_tables.scalar() == 0:
            import uuid
            for t_data in [
                {"number": 1, "capacity": 4},
                {"number": 2, "capacity": 2},
                {"number": 3, "capacity": 6},
                {"number": 4, "capacity": 4},
            ]:
                db.add(Table(
                    restaurant_id=restaurant.id,
                    number=t_data["number"],
                    capacity=t_data["capacity"],
                    qr_code=str(uuid.uuid4()),
                ))

        existing_categories = await db.execute(
            select(func.count()).select_from(Category).where(Category.restaurant_id == restaurant.id)
        )
        if existing_categories.scalar() == 0:
            for c_data in [
                {"name": "Entradas", "description": "Para empezar", "sort_order": 1},
                {"name": "Platos Fuertes", "description": "Especialidades", "sort_order": 2},
                {"name": "Bebidas", "description": "Para acompañar", "sort_order": 3},
            ]:
                db.add(Category(restaurant_id=restaurant.id, **c_data))

        await db.commit()
        print(f"✅ Seed completado para restaurante '{restaurant.name}' (id={restaurant.id})")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all no altera tablas existentes: parche idempotente para BDs
        # creadas antes de la columna currency (ceguera de prod incluida).
        from sqlalchemy import text
        await conn.execute(text(
            "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS "
            "currency VARCHAR(3) DEFAULT 'COP'"
        ))
    if settings.SEED_DEFAULT_USERS:
        await _seed_default_data()
    asyncio.create_task(_expiry_cron())


async def _expiry_cron():
    """Suspende suscripciones vencidas cada hora (idempotente)."""
    from app.routers.billing import expire_subscriptions
    while True:
        try:
            suspended = await expire_subscriptions()
            if suspended:
                print(f"⏸️ Suscripciones suspendidas por mora: {suspended}")
        except Exception as e:
            print(f"⚠️ Cron de expiración falló (reintenta en 1h): {e}")
        await asyncio.sleep(3600)

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Restaurant SaaS API funcionando 🍽️", "docs": "/docs", "version": "2.0.0"}