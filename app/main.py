from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.routers import auth, menu, orders, tables, chat, loyalty

app = FastAPI(
    title="Restaurant API",
    description="Plataforma de gestión y comunicación para restaurantes",
    version="1.0.0",
)

# CORS — ajustar origins en producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.on_event("startup")
async def startup():
    """Crear tablas en DB al iniciar (solo para desarrollo)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Restaurant API funcionando 🍽️",
        "docs": "/docs",
        "version": "1.0.0",
    }
