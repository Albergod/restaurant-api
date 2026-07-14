from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.models.models import OrderStatus, OrderType, UserRole, MessageSender


# ──────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.customer


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


# ──────────────────────────────────────────
# MESAS
# ──────────────────────────────────────────

class TableCreate(BaseModel):
    number: int
    capacity: int = 4


class TableOut(BaseModel):
    id: int
    number: int
    qr_code: Optional[str]
    qr_image: Optional[str] = None
    capacity: int
    is_occupied: bool

    class Config:
        from_attributes = True


# ──────────────────────────────────────────
# CATEGORÍAS
# ──────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class CategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


# ──────────────────────────────────────────
# PRODUCTOS
# ──────────────────────────────────────────

class ProductCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_featured: bool = False
    is_promoted: bool = False
    promo_price: Optional[float] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_promoted: Optional[bool] = None
    promo_price: Optional[float] = None


class ProductOut(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str]
    price: float
    image_url: Optional[str]
    is_available: bool
    is_featured: bool
    is_promoted: bool
    promo_price: Optional[float]

    class Config:
        from_attributes = True


class CategoryWithProducts(BaseModel):
    id: int
    name: str
    description: Optional[str]
    products: List[ProductOut]

    class Config:
        from_attributes = True


# ──────────────────────────────────────────
# PEDIDOS
# ──────────────────────────────────────────

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = 1
    observations: Optional[str] = None   # "sin cebolla", "extra salsa", etc.


class OrderCreate(BaseModel):
    table_qr: Optional[str] = None        # QR de la mesa (clientes en local)
    customer_name: Optional[str] = None   # Para pedidos pickup
    order_type: OrderType = OrderType.dine_in
    notes: Optional[str] = None
    items: List[OrderItemCreate]


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    observations: Optional[str]

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    table_id: Optional[int]
    table_qr: Optional[str] = None
    waiter_id: Optional[int]
    customer_name: Optional[str]
    order_type: OrderType
    status: OrderStatus
    notes: Optional[str]
    total: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemOut]

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ──────────────────────────────────────────
# CHAT
# ──────────────────────────────────────────

class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    id: int
    sender: MessageSender
    content: str
    sent_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


class ChatSessionOut(BaseModel):
    id: int
    table_id: int
    is_open: bool
    created_at: datetime
    messages: List[ChatMessageOut]

    class Config:
        from_attributes = True


# ──────────────────────────────────────────
# PANEL DE COCINA
# ──────────────────────────────────────────

class KitchenOrderOut(BaseModel):
    id: int
    table_id: Optional[int]
    order_type: OrderType
    status: OrderStatus
    created_at: datetime
    items: List[OrderItemOut]

    class Config:
        from_attributes = True


# ──────────────────────────────────────────
# FIDELIZACIÓN
# ──────────────────────────────────────────

class LoyaltyOut(BaseModel):
    user_id: int
    points: int
    updated_at: datetime

    class Config:
        from_attributes = True
