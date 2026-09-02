from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select, func

from app.core.database import engine, Base, AsyncSessionLocal
from app.core.config import settings
from app.core.security import hash_password
from app.models.models import (
    ChatMessage, ChatSession, LoyaltyPoints,
    Order, OrderItem, OrderStatusHistory,
    User, UserRole, Category, Product, Table,
)
from app.routers import auth, menu, orders, tables, chat, loyalty, users, upload

app = FastAPI(
    title="Restaurant API",
    description="Plataforma de gestión y comunicación para restaurantes",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
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
    """Crea datos por defecto si la DB está vacía."""
    async with AsyncSessionLocal() as db:
        count = await db.execute(select(func.count()).select_from(User))
        if count.scalar() > 0:
            return

        # Limpiar datos previos de pedidos y chat
        for table, model_cls in [
            ("chat_messages", ChatMessage), ("chat_sessions", ChatSession),
            ("order_status_history", OrderStatusHistory),
            ("order_items", OrderItem), ("orders", Order),
            ("loyalty_points", LoyaltyPoints),
        ]:
            await db.execute(delete(model_cls))
        await db.flush()

        admin = User(
            name="Admin",
            email="admin@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            role=UserRole.admin,
        )
        db.add(admin)

        waiter = User(
            name="Mesero",
            email="mesero@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_WAITER_PASSWORD),
            role=UserRole.waiter,
        )
        db.add(waiter)

        kitchen = User(
            name="Cocina",
            email="cocina@restaurant.com",
            hashed_password=hash_password(settings.DEFAULT_KITCHEN_PASSWORD),
            role=UserRole.kitchen,
        )
        db.add(kitchen)

        import uuid
        for t_data in [
            {"number": 1, "capacity": 4},
            {"number": 2, "capacity": 2},
            {"number": 3, "capacity": 6},
            {"number": 4, "capacity": 4},
            {"number": 5, "capacity": 8},
            {"number": 6, "capacity": 2},
            {"number": 7, "capacity": 4},
            {"number": 8, "capacity": 6},
        ]:
            db.add(Table(number=t_data["number"], capacity=t_data["capacity"], qr_code=str(uuid.uuid4())))

        for c_data in [
            {"name": "Entradas", "description": "Para empezar con buen pie", "sort_order": 1},
            {"name": "Platos Fuertes", "description": "Nuestras especialidades principales", "sort_order": 2},
            {"name": "Pastas", "description": "Frescas y hechas en casa", "sort_order": 3},
            {"name": "Ensaladas", "description": "Opciones frescas y saludables", "sort_order": 4},
            {"name": "Postres", "description": "El broche de oro", "sort_order": 5},
            {"name": "Bebidas", "description": "Para acompañar tu comida", "sort_order": 6},
        ]:
            db.add(Category(**c_data))
        await db.flush()

        PRODUCTS = [
            {"category_id": 1, "name": "Nachos con Guacamole", "description": "Totopos crujientes con guacamole fresco, pico de gallo y crema", "price": 8.99, "is_featured": True},
            {"category_id": 1, "name": "Alitas BBQ", "description": "8 alitas bañadas en salsa BBQ ahumada con apio y aderezo ranch", "price": 10.99, "is_featured": True},
            {"category_id": 1, "name": "Bruschetta Italiana", "description": "Pan artesanal con tomate, albahaca fresca y aceite de oliva", "price": 7.50},
            {"category_id": 1, "name": "Sopa del Día", "description": "Pregunta a tu mesero por la sopa de hoy", "price": 5.99},
            {"category_id": 1, "name": "Quesadillas de Flor de Calabaza", "description": "Tortilla de maíz con queso Oaxaca y flor de calabaza", "price": 9.50},
            {"category_id": 2, "name": "Hamburguesa Clásica", "description": "Carne Angus 200g, lechuga, tomate, cebolla caramelizada y papas fritas", "price": 14.99, "is_featured": True},
            {"category_id": 2, "name": "Costillas BBQ", "description": "Medio rack de costillas ahumadas con salsa BBQ casera y coleslaw", "price": 22.99, "is_promoted": True, "promo_price": 18.99},
            {"category_id": 2, "name": "Salmón a la Plancha", "description": "Filete de salmón con puré de papa y vegetales al vapor", "price": 19.99},
            {"category_id": 2, "name": "Tacos al Pastor", "description": "4 tacos de cerdo marinado con piña, cilantro y cebolla", "price": 12.50, "is_featured": True},
            {"category_id": 2, "name": "Pollo a la Parmesana", "description": "Pechuga empanizada con salsa marinara y queso mozzarella gratinado", "price": 15.99},
            {"category_id": 2, "name": "Filete Mignon", "description": "Corte premium 250g con salsa de vino tinto y papas al horno", "price": 28.99, "is_promoted": True, "promo_price": 24.99},
            {"category_id": 3, "name": "Spaghetti Carbonara", "description": "Pasta al dente con panceta, huevo, queso parmesano y pimienta negra", "price": 13.99},
            {"category_id": 3, "name": "Fettuccine Alfredo", "description": "Pasta fresca con salsa cremosa de mantequilla y parmesano", "price": 12.99, "is_featured": True},
            {"category_id": 3, "name": "Penne Arrabbiata", "description": "Pasta con salsa de tomate picante, ajo y albahaca", "price": 11.99},
            {"category_id": 3, "name": "Lasagna de la Casa", "description": "Capas de pasta con ragú de carne, bechamel y queso gratinado", "price": 14.99, "is_promoted": True, "promo_price": 12.49},
            {"category_id": 4, "name": "Ensalada César", "description": "Lechuga romana, crutones, parmesano y aderezo césar casero", "price": 9.99},
            {"category_id": 4, "name": "Ensalada Griega", "description": "Pepino, tomate, olivas, queso feta y aderezo de limón", "price": 10.50},
            {"category_id": 4, "name": "Bowl de Quinoa", "description": "Quinoa, aguacate, edamame, zanahoria y aderezo de jengibre", "price": 11.99},
            {"category_id": 5, "name": "Tiramisú", "description": "Clásico postre italiano con mascarpone, café y cacao", "price": 7.99, "is_featured": True},
            {"category_id": 5, "name": "Brownie con Helado", "description": "Brownie de chocolate caliente con helado de vainilla y salsa de chocolate", "price": 8.50},
            {"category_id": 5, "name": "Flan Napolitano", "description": "Flan casero con caramelo y un toque de vainilla", "price": 6.50},
            {"category_id": 5, "name": "Cheesecake de Frutos Rojos", "description": "Base de galleta con crema de queso y coulis de frutos rojos", "price": 8.99, "is_promoted": True, "promo_price": 6.99},
            {"category_id": 6, "name": "Limonada Natural", "description": "Limonada fresca con hierbabuena", "price": 3.99},
            {"category_id": 6, "name": "Agua de Jamaica", "description": "Infusión fría de flor de jamaica", "price": 3.50},
            {"category_id": 6, "name": "Refresco", "description": "Coca-Cola, Sprite, Fanta o Agua Mineral", "price": 2.99},
            {"category_id": 6, "name": "Café Americano", "description": "Café de grano recién molido", "price": 3.50},
            {"category_id": 6, "name": "Cerveza Artesanal", "description": "IPA, Stout o Lager de nuestra selección local", "price": 6.99},
            {"category_id": 6, "name": "Margarita Clásica", "description": "Tequila, triple sec, limón y sal", "price": 9.99},
        ]
        for p in PRODUCTS:
            db.add(Product(**p))

        await db.commit()
        print("✅ Datos por defecto creados (admin, mesero, cocina, menú, mesas)")


@app.on_event("startup")
async def startup():
    """Crear tablas en DB al iniciar y sembrar datos por defecto."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.SEED_DEFAULT_USERS:
        await _seed_default_data()


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Restaurant API funcionando 🍽️",
        "docs": "/docs",
        "version": "1.0.0",
    }
