from pathlib import Path
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
from app.routers import auth, menu, orders, tables, chat, loyalty, users, upload, restaurants

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

uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

async def _seed_default_data():
    async with AsyncSessionLocal() as db:
        existing_users = await db.execute(select(func.count()).select_from(User))
        if existing_users.scalar() > 0:
            print("ℹ️ Seed omitido: ya existen usuarios.")
            return

        has_users = False

        superadmin = User(
            name="Superadmin",
            email="superadmin@system.com",
            hashed_password=hash_password("superadmin123"),
            role=UserRole.superadmin,
            restaurant_id=None,
        )
        db.add(superadmin)

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
    if settings.SEED_DEFAULT_USERS:
        await _seed_default_data()

@app.get("/", tags=["Root"])
async def root():
    return {"message": "Restaurant SaaS API funcionando 🍽️", "docs": "/docs", "version": "2.0.0"}