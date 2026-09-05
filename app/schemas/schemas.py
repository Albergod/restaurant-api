from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.models import OrderStatus, OrderType, UserRole, MessageSender

class RestaurantCreate(BaseModel):
    name: str
    slug: str
    admin_name: Optional[str] = "Administrador"
    admin_email: Optional[EmailStr] = None
    admin_password: Optional[str] = None

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.customer
    restaurant_id: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    restaurant_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    restaurant_id: Optional[int]
    name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    restaurant_id: Optional[int] = None

class TableCreate(BaseModel):
    number: int
    capacity: int = 4

class TableOut(BaseModel):
    id: int
    restaurant_id: int
    number: int
    qr_code: Optional[str]
    qr_image: Optional[str] = None
    capacity: int
    is_occupied: bool
    class Config: from_attributes = True

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0

class CategoryOut(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str]
    sort_order: int
    is_active: bool
    class Config: from_attributes = True

class ProductCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_featured: bool = False
    is_promoted: bool = False
    promo_price: Optional[float] = None

    @field_validator("category_id")
    @classmethod
    def _category_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("category_id debe ser un entero positivo")
        return v

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
    restaurant_id: int
    category_id: int
    name: str
    description: Optional[str]
    price: float
    image_url: Optional[str]
    is_available: bool
    is_featured: bool
    is_promoted: bool
    promo_price: Optional[float]
    class Config: from_attributes = True

class CategoryWithProducts(BaseModel):
    id: int
    restaurant_id: int
    name: str
    description: Optional[str]
    products: List[ProductOut]
    class Config: from_attributes = True

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = 1
    observations: Optional[str] = None

class OrderCreate(BaseModel):
    table_qr: Optional[str] = None
    customer_name: Optional[str] = None
    order_type: OrderType = OrderType.dine_in
    notes: Optional[str] = None
    items: List[OrderItemCreate]
    restaurant_id: Optional[int] = None

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    observations: Optional[str]
    class Config: from_attributes = True

class OrderOut(BaseModel):
    id: int
    restaurant_id: int
    table_id: Optional[int]
    table_qr: Optional[str] = None
    table_number: Optional[int] = None
    has_active_chat: bool = False
    unread_count: int = 0
    active_chat_session_id: Optional[int] = None
    waiter_id: Optional[int]
    customer_name: Optional[str]
    order_type: OrderType
    status: OrderStatus
    notes: Optional[str]
    total: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemOut]
    class Config: from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class ChatMessageCreate(BaseModel):
    content: str

class ChatSessionOut(BaseModel):
    id: int
    restaurant_id: int
    table_id: int
    is_open: bool
    created_at: datetime
    messages: List[dict]
    class Config: from_attributes = True

class KitchenOrderOut(BaseModel):
    id: int
    restaurant_id: int
    table_id: Optional[int]
    table_number: Optional[int] = None
    has_active_chat: bool = False
    unread_count: int = 0
    active_chat_session_id: Optional[int] = None
    order_type: OrderType
    status: OrderStatus
    created_at: datetime
    items: List[OrderItemOut]
    class Config: from_attributes = True

class LoyaltyOut(BaseModel):
    user_id: int
    restaurant_id: int
    points: int
    updated_at: datetime
    class Config: from_attributes = True