"""
Script para poblar la base de datos con datos de simulación realistas.
Ejecutar con: python seed_data.py
"""
import asyncio
from app.core.database import engine, AsyncSessionLocal, Base
from app.core.security import hash_password
from app.models.models import User, Category, Product, Table

CATEGORIES = [
    {"name": "Entradas", "description": "Para empezar con buen pie", "sort_order": 1},
    {"name": "Platos Fuertes", "description": "Nuestras especialidades principales", "sort_order": 2},
    {"name": "Pastas", "description": "Frescas y hechas en casa", "sort_order": 3},
    {"name": "Ensaladas", "description": "Opciones frescas y saludables", "sort_order": 4},
    {"name": "Postres", "description": "El broche de oro", "sort_order": 5},
    {"name": "Bebidas", "description": "Para acompañar tu comida", "sort_order": 6},
]

PRODUCTS = [
    # Entradas (cat 1)
    {"category_id": 1, "name": "Nachos con Guacamole", "description": "Totopos crujientes con guacamole fresco, pico de gallo y crema", "price": 8.99, "is_featured": True},
    {"category_id": 1, "name": "Alitas BBQ", "description": "8 alitas bañadas en salsa BBQ ahumada con apio y aderezo ranch", "price": 10.99, "is_featured": True},
    {"category_id": 1, "name": "Bruschetta Italiana", "description": "Pan artesanal con tomate, albahaca fresca y aceite de oliva", "price": 7.50},
    {"category_id": 1, "name": "Sopa del Día", "description": "Pregunta a tu mesero por la sopa de hoy", "price": 5.99},
    {"category_id": 1, "name": "Quesadillas de Flor de Calabaza", "description": "Tortilla de maíz con queso Oaxaca y flor de calabaza", "price": 9.50},

    # Platos Fuertes (cat 2)
    {"category_id": 2, "name": "Hamburguesa Clásica", "description": "Carne Angus 200g, lechuga, tomate, cebolla caramelizada y papas fritas", "price": 14.99, "is_featured": True},
    {"category_id": 2, "name": "Costillas BBQ", "description": "Medio rack de costillas ahumadas con salsa BBQ casera y coleslaw", "price": 22.99, "is_promoted": True, "promo_price": 18.99},
    {"category_id": 2, "name": "Salmón a la Plancha", "description": "Filete de salmón con puré de papa y vegetales al vapor", "price": 19.99},
    {"category_id": 2, "name": "Tacos al Pastor", "description": "4 tacos de cerdo marinado con piña, cilantro y cebolla", "price": 12.50, "is_featured": True},
    {"category_id": 2, "name": "Pollo a la Parmesana", "description": "Pechuga empanizada con salsa marinara y queso mozzarella gratinado", "price": 15.99},
    {"category_id": 2, "name": "Filete Mignon", "description": "Corte premium 250g con salsa de vino tinto y papas al horno", "price": 28.99, "is_promoted": True, "promo_price": 24.99},

    # Pastas (cat 3)
    {"category_id": 3, "name": "Spaghetti Carbonara", "description": "Pasta al dente con panceta, huevo, queso parmesano y pimienta negra", "price": 13.99},
    {"category_id": 3, "name": "Fettuccine Alfredo", "description": "Pasta fresca con salsa cremosa de mantequilla y parmesano", "price": 12.99, "is_featured": True},
    {"category_id": 3, "name": "Penne Arrabbiata", "description": "Pasta con salsa de tomate picante, ajo y albahaca", "price": 11.99},
    {"category_id": 3, "name": "Lasagna de la Casa", "description": "Capas de pasta con ragú de carne, bechamel y queso gratinado", "price": 14.99, "is_promoted": True, "promo_price": 12.49},

    # Ensaladas (cat 4)
    {"category_id": 4, "name": "Ensalada César", "description": "Lechuga romana, crutones, parmesano y aderezo césar casero", "price": 9.99},
    {"category_id": 4, "name": "Ensalada Griega", "description": "Pepino, tomate, olivas, queso feta y aderezo de limón", "price": 10.50},
    {"category_id": 4, "name": "Bowl de Quinoa", "description": "Quinoa, aguacate, edamame, zanahoria y aderezo de jengibre", "price": 11.99},

    # Postres (cat 5)
    {"category_id": 5, "name": "Tiramisú", "description": "Clásico postre italiano con mascarpone, café y cacao", "price": 7.99, "is_featured": True},
    {"category_id": 5, "name": "Brownie con Helado", "description": "Brownie de chocolate caliente con helado de vainilla y salsa de chocolate", "price": 8.50},
    {"category_id": 5, "name": "Flan Napolitano", "description": "Flan casero con caramelo y un toque de vainilla", "price": 6.50},
    {"category_id": 5, "name": "Cheesecake de Frutos Rojos", "description": "Base de galleta con crema de queso y coulis de frutos rojos", "price": 8.99, "is_promoted": True, "promo_price": 6.99},

    # Bebidas (cat 6)
    {"category_id": 6, "name": "Limonada Natural", "description": "Limonada fresca con hierbabuena", "price": 3.99},
    {"category_id": 6, "name": "Agua de Jamaica", "description": "Infusión fría de flor de jamaica", "price": 3.50},
    {"category_id": 6, "name": "Refresco", "description": "Coca-Cola, Sprite, Fanta o Agua Mineral", "price": 2.99},
    {"category_id": 6, "name": "Café Americano", "description": "Café de grano recién molido", "price": 3.50},
    {"category_id": 6, "name": "Cerveza Artesanal", "description": "IPA, Stout o Lager de nuestra selección local", "price": 6.99},
    {"category_id": 6, "name": "Margarita Clásica", "description": "Tequila, triple sec, limón y sal", "price": 9.99},
]

TABLES = [
    {"number": 1, "capacity": 4},
    {"number": 2, "capacity": 2},
    {"number": 3, "capacity": 6},
    {"number": 4, "capacity": 4},
    {"number": 5, "capacity": 8},
    {"number": 6, "capacity": 2},
    {"number": 7, "capacity": 4},
    {"number": 8, "capacity": 6},
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Verificar si ya hay datos
        from sqlalchemy import select, func
        count = await db.execute(select(func.count()).select_from(Category))
        if count.scalar() > 0:
            print("⚠ La base de datos ya tiene datos. Omitiendo seed.")
            return

        # Categorías
        print("→ Creando categorías...")
        cats = []
        for c in CATEGORIES:
            cat = Category(**c)
            db.add(cat)
            cats.append(cat)
        await db.flush()

        # Productos
        print("→ Creando productos...")
        for p in PRODUCTS:
            product = Product(**p)
            db.add(product)
        await db.flush()

        # Mesas
        print("→ Creando mesas...")
        import uuid
        for t in TABLES:
            table = Table(number=t["number"], capacity=t["capacity"], qr_code=str(uuid.uuid4()))
            db.add(table)

        await db.commit()
        print("✅ Datos de simulación cargados exitosamente:")
        print(f"   - {len(CATEGORIES)} categorías")
        print(f"   - {len(PRODUCTS)} productos")
        print(f"   - {len(TABLES)} mesas")


if __name__ == "__main__":
    asyncio.run(seed())
