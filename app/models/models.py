import enum
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    waiter = "waiter"
    kitchen = "kitchen"
    customer = "customer"

class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    preparing = "preparing"
    ready = "ready"
    delivered = "delivered"
    cancelled = "cancelled"

class OrderType(str, enum.Enum):
    dine_in = "dine_in"
    pickup = "pickup"

class MessageSender(str, enum.Enum):
    customer = "customer"
    waiter = "waiter"

class Restaurant(Base):
    __tablename__ = "restaurants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship("User", back_populates="restaurant")
    tables = relationship("Table", back_populates="restaurant")
    categories = relationship("Category", back_populates="restaurant")
    products = relationship("Product", back_populates="restaurant")
    orders = relationship("Order", back_populates="restaurant")
    chat_sessions = relationship("ChatSession", back_populates="restaurant")
    loyalty_points = relationship("LoyaltyPoints", back_populates="restaurant")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.customer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    restaurant = relationship("Restaurant", back_populates="users")
    orders = relationship("Order", back_populates="waiter", foreign_keys="Order.waiter_id")
    messages = relationship("ChatMessage", back_populates="waiter")
    loyalty = relationship("LoyaltyPoints", back_populates="user", uselist=False)

class Table(Base):
    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint('restaurant_id', 'number', name='uq_table_restaurant_number'),)
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    number = Column(Integer, nullable=False)
    qr_code = Column(String, unique=True, index=True)
    capacity = Column(Integer, default=4)
    is_occupied = Column(Boolean, default=False)
    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table")
    chat_sessions = relationship("ChatSession", back_populates="table")

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    name = Column(String(80), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    restaurant = relationship("Restaurant", back_populates="categories")
    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(120), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    image_url = Column(String)
    is_available = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_promoted = Column(Boolean, default=False)
    promo_price = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    restaurant = relationship("Restaurant", back_populates="products")
    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(100))
    order_type = Column(Enum(OrderType), default=OrderType.dine_in)
    status = Column(Enum(OrderStatus), default=OrderStatus.pending)
    notes = Column(Text)
    total = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    restaurant = relationship("Restaurant", back_populates="orders")
    table = relationship("Table", back_populates="orders")
    waiter = relationship("User", back_populates="orders", foreign_keys=[waiter_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    observations = Column(Text)
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    @property
    def product_name(self):
        return self.product.name if self.product else ""

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    status = Column(Enum(OrderStatus), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    order = relationship("Order", back_populates="status_history")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_open = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    restaurant = relationship("Restaurant", back_populates="chat_sessions")
    table = relationship("Table", back_populates="chat_sessions")
    waiter = relationship("User")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    waiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender = Column(Enum(MessageSender), nullable=False)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)
    session = relationship("ChatSession", back_populates="messages")
    waiter = relationship("User", back_populates="messages")

class LoyaltyPoints(Base):
    __tablename__ = "loyalty_points"
    __table_args__ = (UniqueConstraint('restaurant_id', 'user_id', name='uq_loyalty_restaurant_user'),)
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    restaurant = relationship("Restaurant", back_populates="loyalty_points")
    user = relationship("User", back_populates="loyalty")