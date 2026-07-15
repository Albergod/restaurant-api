import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    ChatMessage, ChatSession, MessageSender,
    Order, OrderItem, OrderStatus, OrderStatusHistory,
    Product, Table, UserRole,
)
from app.schemas.schemas import OrderCreate, OrderOut, OrderStatusUpdate, KitchenOrderOut

router = APIRouter(prefix="/api/orders", tags=["Pedidos"])


async def _recalc_total(order: Order) -> float:
    return sum(item.unit_price * item.quantity for item in order.items)


async def _attach_table_info(order: Order, db: AsyncSession):
    """Populate table_qr, table_number, and chat info from the table relationship."""
    if order.table_id:
        result = await db.execute(
            select(Table.qr_code, Table.number).where(Table.id == order.table_id)
        )
        row = result.one_or_none()
        if row:
            order.table_qr = row.qr_code
            order.table_number = row.number

        # Check if there is an active chat session for this table
        session_result = await db.execute(
            select(ChatSession.id).where(
                ChatSession.table_id == order.table_id,
                ChatSession.is_open == True,
            )
        )
        session_id = session_result.scalar_one_or_none()
        if session_id:
            order.has_active_chat = True
            order.active_chat_session_id = session_id
            unread = await db.execute(
                select(ChatMessage)
                .where(
                    ChatMessage.session_id == session_id,
                    ChatMessage.sender == MessageSender.customer,
                    ChatMessage.is_read == False,
                )
            )
            order.unread_count = len(unread.scalars().all())


@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(data: OrderCreate, db: AsyncSession = Depends(get_db)):
    """
    Crear un pedido desde la mesa (via QR) o para recoger (pickup).
    No requiere login — el cliente escanea el QR y hace su pedido.
    """
    table_id = None

    if data.order_type == "dine_in":
        if not data.table_qr:
            raise HTTPException(status_code=400, detail="Se requiere el QR de la mesa")
        result = await db.execute(select(Table).where(Table.qr_code == data.table_qr))
        table = result.scalar_one_or_none()
        if not table:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        table_id = table.id
        table.is_occupied = True

    if not data.items:
        raise HTTPException(status_code=400, detail="El pedido no tiene productos")

    order = Order(
        table_id=table_id,
        customer_name=data.customer_name,
        order_type=data.order_type,
        status=OrderStatus.pending,
        notes=data.notes,
    )
    db.add(order)
    await db.flush()  # Obtener ID del pedido antes de agregar ítems

    total = 0.0
    for item_data in data.items:
        prod_result = await db.execute(select(Product).where(Product.id == item_data.product_id))
        product = prod_result.scalar_one_or_none()
        if not product or not product.is_available:
            raise HTTPException(status_code=400, detail=f"Producto {item_data.product_id} no disponible")

        unit_price = product.promo_price if product.is_promoted and product.promo_price else product.price
        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            observations=item_data.observations,
        )
        db.add(item)
        total += unit_price * item_data.quantity

    order.total = total

    # Historial de estado inicial
    history = OrderStatusHistory(order_id=order.id, status=OrderStatus.pending)
    db.add(history)

    await db.commit()
    await db.refresh(order)

    # Cargar relaciones para la respuesta
    result = await db.execute(
        select(Order).where(Order.id == order.id).options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
    )
    order = result.scalar_one()
    await _attach_table_info(order, db)
    return order


@router.get("/", response_model=List[OrderOut])
async def list_orders(
    status: OrderStatus = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Listar pedidos. Meseros y admin ven todos; cocina ve solo los confirmados/en preparación."""
    query = (
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .order_by(Order.created_at.desc())
    )

    if current_user["role"] == UserRole.kitchen:
        query = query.where(Order.status.in_([OrderStatus.confirmed, OrderStatus.preparing]))
    elif status:
        query = query.where(Order.status == status)

    result = await db.execute(query)
    orders = result.scalars().all()
    for o in orders:
        await _attach_table_info(o, db)
    return orders


@router.get("/kitchen", response_model=List[KitchenOrderOut])
async def kitchen_panel(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Panel de cocina: pedidos confirmados y en preparación, ordenados por antigüedad.
    Acceso: cocina, meseros y admin.
    """
    allowed = [UserRole.kitchen, UserRole.waiter, UserRole.admin]
    if current_user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    result = await db.execute(
        select(Order)
        .where(Order.status.in_([OrderStatus.confirmed, OrderStatus.preparing]))
        .options(selectinload(Order.items).selectinload(OrderItem.product))
        .order_by(Order.created_at)
    )
    orders = result.scalars().all()
    for o in orders:
        await _attach_table_info(o, db)
    return orders


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Detalle de un pedido. Acceso público para permitir seguimiento al cliente."""
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    await _attach_table_info(order, db)
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Actualizar estado del pedido.
    - Mesero: puede confirmar (pending → confirmed) y marcar entregado.
    - Cocina: puede cambiar a preparing y ready.
    - Admin: puede hacer cualquier cambio.
    """
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    role = current_user["role"]

    waiter_allowed = {OrderStatus.confirmed, OrderStatus.delivered, OrderStatus.cancelled}
    kitchen_allowed = {OrderStatus.preparing, OrderStatus.ready}

    if role == UserRole.waiter and data.status not in waiter_allowed:
        raise HTTPException(status_code=403, detail="Mesero no puede asignar ese estado")
    if role == UserRole.kitchen and data.status not in kitchen_allowed:
        raise HTTPException(status_code=403, detail="Cocina no puede asignar ese estado")

    order.status = data.status

    if data.status == OrderStatus.delivered and order.table_id:
        table_result = await db.execute(select(Table).where(Table.id == order.table_id))
        table = table_result.scalar_one_or_none()
        if table:
            table.is_occupied = False

        # Cerrar sesion de chat activa de la mesa
        chat_result = await db.execute(
            select(ChatSession)
            .where(
                ChatSession.table_id == order.table_id,
                ChatSession.is_open == True,
            )
        )
        chat_session = chat_result.scalar_one_or_none()
        if chat_session:
            chat_session.is_open = False
            chat_session.closed_at = datetime.utcnow()

    history = OrderStatusHistory(
        order_id=order.id,
        status=data.status,
        changed_by=int(current_user["sub"]),
    )
    db.add(history)
    await db.commit()
    await db.refresh(order)
    await _attach_table_info(order, db)
    return order


@router.delete("/{order_id}", status_code=204)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cancelar pedido. Solo admin o mesero si aún está pendiente."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if order.status not in [OrderStatus.pending, OrderStatus.confirmed]:
        raise HTTPException(status_code=400, detail="No se puede cancelar un pedido en preparación o entregado")

    order.status = OrderStatus.cancelled
    await db.commit()
