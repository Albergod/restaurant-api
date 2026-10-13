from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/restaurant_db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    FRONTEND_URL: str = "http://localhost:3000"
    SEED_DEFAULT_USERS: bool = True
    ALLOW_PUBLIC_STAFF_REGISTRATION: bool = False
    SUPERADMIN_EMAIL: str = ""
    SUPERADMIN_PASSWORD: str = ""
    DEFAULT_ADMIN_PASSWORD: str = "admin123"
    DEFAULT_WAITER_PASSWORD: str = "mesero123"
    DEFAULT_KITCHEN_PASSWORD: str = "cocina123"
    MEDIA_STORAGE: str = "local"
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    # ── Paddle (Merchant of Record, cobro internacional) ──
    PADDLE_API_KEY: str = ""
    PADDLE_WEBHOOK_SECRET: str = ""
    PADDLE_ENV: str = "sandbox"  # sandbox | production
    PADDLE_CLIENT_TOKEN: str = ""  # se expone al frontend (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)
    # Price IDs creados en el dashboard de Paddle (sandbox y prod por separado)
    PADDLE_PRICE_MONTHLY: str = ""
    PADDLE_PRICE_BIWEEKLY: str = ""
    # Montos esperados en centavos USD (sanity check anti-manipulación)
    PADDLE_MONTHLY_CENTS: int = 999
    PADDLE_BIWEEKLY_CENTS: int = 599

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
