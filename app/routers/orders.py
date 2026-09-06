from datetime import datetime
from typing import List, Optional
import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    ChatMessage, ChatSession, MessageSender, Order, OrderItem, OrderStatus, OrderStatusHistory, Product, Table, UserRole,
)
from app.schemas.schemas import OrderCreate, OrderOut, OrderStatusUpdate, KitchenOrderOut

router = APIRouter(prefix="/api/orders", tags=["Pedidos"])

async def _attach_table_info_bulk(orders, db: AsyncSession):
    """Adjunta table_qr/number/chat info a muchos pedidos en batch.

    Antes: 3 queries por pedido (N+1). Ahora: 3 queries totales para todos.
    """
    table_ids = {o.table_id for o in orders if o.table_id}
    if not table_ids:
        return

    tables_result = await db.execute(
        select(Table.id, Table.qr_code, Table.number).where(Table.id.in_(table_ids))
    )
    tables_map = {row.id: (row.qr_code, row.number) for row in tables_result.all()}

    sessions_result = await db.execute(
        select(ChatSession.id, ChatSession.table_id).where(
            ChatSession.table_id.in_(table_ids),
            ChatSession.is_open == True,
        )
    )
    sessions_map = {row.table_id: row.id for row in sessions_result.all()}

    unread_by_session = {}
    if sessions_map:
        unread_result = await db.execute(
            select(ChatMessage.session_id, func.count(ChatMessage.id))
            .where(
                ChatMessage.session_id.in_(sessions_map.values()),
                ChatMessage.sender == MessageSender.customer,
                ChatMessage.is_read == False,
            )
            .group_by(ChatMessage.session_id)
        )
        unread_by_session = {row.session_id: row[1] for row in unread_result.all()}

    for o in orders:
        if o.table_id and o.table_id in tables_map:
            o.table_qr, o.table_number = tables_map[o.table_id]
        if o.table_id and o.table_id in sessions_map:
            o.has_active_chat = True
            o.active_chat_session_id = sessions_map[o.table_id]
            o.unread_count = unread_by_session.get(o.active_chat_session_id, 0)


async def _attach_table_info(order: Order, db: AsyncSession):
    await _attach_table_info_bulk([order], db)

@router.post("/", response_model=OrderOut, status_code=201)
async def create_order(data: OrderCreate, db: AsyncSession = Depends(get_db)):
    table_id = None
    restaurant_id = data.restaurant_id

    if data.order_type == "dine_in":
        if not data.table_qr:
            raise HTTPException(status_code=400, detail="Se requiere el QR de la mesa")
        result = await db.execute(select(Table).where(Table.qr_code == data.table_qr))
        table = result.scalar_one_or_none()
        if not table:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        table_id = table.id
        restaurant_id = table.restaurant_id
        table.is_occupied = True

    if not restaurant_id:
        restaurant_id = 1  # Fallback para compatibilidad con pedidos pickup antiguos

    if not data.items:
        raise HTTPException(status_code=400, detail="El pedido no tiene productos")

    order = Order(restaurant_id=restaurant_id, table_id=table_id, customer_name=data.customer_name, order_type=data.order_type, status=OrderStatus.pending, notes=data.notes)
    db.add(order)
    await db.flush()

    total = 0.0
    for item_data in data.items:
        prod_result = await db.execute(select(Product).where(Product.id == item_data.product_id, Product.restaurant_id == restaurant_id))
        product = prod_result.scalar_one_or_none()
        if not product or not product.is_available:
            raise HTTPException(status_code=400, detail=f"Producto {item_data.product_id} no disponible")
        unit_price = product.promo_price if product.is_promoted and product.promo_price else product.price
        item = OrderItem(order_id=order.id, product_id=product.id, quantity=item_data.quantity, unit_price=unit_price, observations=item_data.observations)
        db.add(item)
        total += unit_price * item_data.quantity

    order.total = total
    history = OrderStatusHistory(order_id=order.id, restaurant_id=restaurant_id, status=OrderStatus.pending)
    db.add(history)
    await db.commit()
    await db.refresh(order)

    result = await db.execute(select(Order).where(Order.id == order.id).options(selectinload(Order.items).selectinload(OrderItem.product)))
    order = result.scalar_one()
    await _attach_table_info(order, db)
    return order

@router.get("/", response_model=List[OrderOut])
async def list_orders(status: Optional[OrderStatus] = None, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    query = select(Order).options(selectinload(Order.items).selectinload(OrderItem.product)).order_by(Order.created_at.desc())
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(Order.restaurant_id == current_user["restaurant_id"])
    if current_user["role"] == UserRole.kitchen.value:
        query = query.where(Order.status.in_([OrderStatus.confirmed, OrderStatus.preparing]))
    elif status:
        query = query.where(Order.status == status)

    orders = (await db.execute(query)).scalars().all()
    await _attach_table_info_bulk(orders, db)
    return orders

@router.get("/kitchen", response_model=List[KitchenOrderOut])
async def kitchen_panel(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    allowed = [UserRole.kitchen.value, UserRole.waiter.value, UserRole.admin.value, UserRole.superadmin.value]
    if current_user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    query = select(Order).where(Order.status.in_([OrderStatus.confirmed, OrderStatus.preparing])).options(selectinload(Order.items).selectinload(OrderItem.product)).order_by(Order.created_at)
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(Order.restaurant_id == current_user["restaurant_id"])
    
    orders = (await db.execute(query)).scalars().all()
    await _attach_table_info_bulk(orders, db)
    return orders

@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.items).selectinload(OrderItem.product)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    await _attach_table_info(order, db)
    return order

@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(order_id: int, data: OrderStatusUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = await db.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.items).selectinload(OrderItem.product)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if current_user["role"] != UserRole.superadmin.value and order.restaurant_id != current_user["restaurant_id"]:
        raise HTTPException(status_code=403, detail="Acceso denegado a este pedido")

    role = current_user["role"]
    if role == UserRole.waiter.value and data.status not in {OrderStatus.confirmed, OrderStatus.delivered, OrderStatus.cancelled}:
        raise HTTPException(status_code=403, detail="Mesero no puede asignar ese estado")
    if role == UserRole.kitchen.value and data.status not in {OrderStatus.preparing, OrderStatus.ready}:
        raise HTTPException(status_code=403, detail="Cocina no puede asignar ese estado")

    order.status = data.status
    if data.status == OrderStatus.delivered and order.table_id:
        table_result = await db.execute(select(Table).where(Table.id == order.table_id))
        table = table_result.scalar_one_or_none()
        if table:
            table.is_occupied = False
        chat_result = await db.execute(select(ChatSession).where(ChatSession.table_id == order.table_id, ChatSession.is_open == True))
        chat_session = chat_result.scalar_one_or_none()
        if chat_session:
            chat_session.is_open = False
            chat_session.closed_at = datetime.utcnow()

    history = OrderStatusHistory(order_id=order.id, restaurant_id=order.restaurant_id, status=data.status, changed_by=int(current_user["id"]))
    db.add(history)
    await db.commit()
    await db.refresh(order)
    await _attach_table_info(order, db)
    return order

@router.delete("/{order_id}", status_code=204)
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.waiter.value, UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    result = await db.execute(select(Order).where(Order.id == order_id).options(selectinload(Order.items), selectinload(Order.status_history)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if current_user["role"] != UserRole.superadmin.value and order.restaurant_id != current_user["restaurant_id"]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    if order.status not in [OrderStatus.delivered, OrderStatus.cancelled]:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar pedidos entregados o cancelados")
    for item in order.items:
        await db.delete(item)
    for h in order.status_history:
        await db.delete(h)
    await db.delete(order)
    await db.commit()


@router.get("/export")
async def export_orders_csv(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Exporta los pedidos del restaurante del admin autenticado como CSV."""
    if current_user["role"] != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Solo administradores pueden exportar")
    restaurant_id = current_user["restaurant_id"]
    if not restaurant_id:
        raise HTTPException(status_code=400, detail="El admin no tiene restaurante asignado")

    query = select(Order).where(Order.restaurant_id == restaurant_id).options(
        selectinload(Order.items).selectinload(OrderItem.product),
    )

    if from_date:
        try:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d")
            query = query.where(Order.created_at >= from_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="from_date debe ser YYYY-MM-DD")
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.where(Order.created_at <= to_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="to_date debe ser YYYY-MM-DD")

    query = query.order_by(Order.created_at.desc())
    orders = (await db.execute(query)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "fecha", "mesa", "tipo", "estado", "items", "total", "notas",
    ])
    for o in orders:
        items_str = " | ".join(
            f"{i.quantity}x {i.product.name if i.product else '?'} (${i.unit_price})"
            for i in o.items
        )
        writer.writerow([
            o.id,
            o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else "",
            o.table.number if o.table else (o.customer_name or ""),
            o.order_type.value if o.order_type else "",
            o.status.value if o.status else "",
            items_str,
            f"{o.total:.2f}",
            (o.notes or "").replace("\n", " "),
        ])

    filename_parts = ["pedidos"]
    if from_date:
        filename_parts.append(from_date)
    if to_date:
        filename_parts.append(to_date)
    filename = "_".join(filename_parts) + ".csv"

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )