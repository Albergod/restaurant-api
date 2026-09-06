import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user, decode_token
from app.models.models import ChatMessage, ChatSession, MessageSender, Table, UserRole

router = APIRouter(prefix="/api/chat", tags=["Chat"])
active_connections: dict[int, list[WebSocket]] = {}

@router.post("/sessions/{table_qr}", response_model=dict, status_code=201)
async def open_chat_session(table_qr: str, db: AsyncSession = Depends(get_db)):
    table_result = await db.execute(select(Table).where(Table.qr_code == table_qr))
    table = table_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    existing = await db.execute(select(ChatSession).where(ChatSession.table_id == table.id, ChatSession.is_open == True).options(selectinload(ChatSession.messages)))
    session = existing.scalar_one_or_none()
    if session:
        return {"id": session.id, "restaurant_id": session.restaurant_id, "table_id": session.table_id, "is_open": session.is_open, "created_at": session.created_at, "messages": [{"id": m.id, "sender": m.sender.value, "content": m.content, "sent_at": m.sent_at, "is_read": m.is_read} for m in session.messages]}
    session = ChatSession(restaurant_id=table.restaurant_id, table_id=table.id)
    db.add(session)
    await db.commit()
    result = await db.execute(select(ChatSession).where(ChatSession.id == session.id).options(selectinload(ChatSession.messages)))
    s = result.scalar_one()
    return {"id": s.id, "restaurant_id": s.restaurant_id, "table_id": s.table_id, "is_open": s.is_open, "created_at": s.created_at, "messages": [{"id": m.id, "sender": m.sender.value, "content": m.content, "sent_at": m.sent_at, "is_read": m.is_read} for m in s.messages]}

@router.get("/sessions/active", response_model=List[dict])
async def list_active_sessions(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.waiter.value, UserRole.admin.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    query = (
        select(ChatSession, Table.number)
        .outerjoin(Table, ChatSession.table_id == Table.id)
        .where(ChatSession.is_open == True)
    )
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(ChatSession.restaurant_id == current_user["restaurant_id"])
    rows = (await db.execute(query)).all()

    session_ids = [s.id for s, _ in rows]
    unread_map = {}
    last_msg_map = {}
    if session_ids:
        unread_q = (
            select(ChatMessage.session_id, func.count(ChatMessage.id))
            .where(
                ChatMessage.session_id.in_(session_ids),
                ChatMessage.sender == MessageSender.customer,
                ChatMessage.is_read == False,
            )
            .group_by(ChatMessage.session_id)
        )
        unread_map = {sid: cnt for sid, cnt in (await db.execute(unread_q)).all()}

        last_msg_subq = (
            select(
                ChatMessage.session_id,
                ChatMessage.content,
                func.row_number().over(
                    partition_by=ChatMessage.session_id,
                    order_by=ChatMessage.sent_at.desc(),
                ).label("rn"),
            )
            .where(ChatMessage.session_id.in_(session_ids))
            .subquery()
        )
        last_q = select(last_msg_subq.c.session_id, last_msg_subq.c.content).where(last_msg_subq.c.rn == 1)
        last_msg_map = {sid: content for sid, content in (await db.execute(last_q)).all()}

    return [
        {
            "id": s.id,
            "table_id": s.table_id,
            "table_number": tn,
            "created_at": s.created_at,
            "unread_count": unread_map.get(s.id, 0),
            "last_message": last_msg_map.get(s.id),
        }
        for s, tn in rows
    ]

@router.get("/sessions/{session_id}", response_model=dict)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    query = select(ChatSession).where(ChatSession.id == session_id).options(selectinload(ChatSession.messages))
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(ChatSession.restaurant_id == current_user["restaurant_id"])
    session = (await db.execute(query)).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return {"id": session.id, "restaurant_id": session.restaurant_id, "table_id": session.table_id, "is_open": session.is_open, "created_at": session.created_at, "messages": [{"id": m.id, "sender": m.sender.value, "content": m.content, "sent_at": m.sent_at, "is_read": m.is_read} for m in session.messages]}

@router.post("/sessions/{session_id}/messages", response_model=dict)
async def send_message_rest(session_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    sender_str = data.get("sender", "customer")
    sender = MessageSender.customer if sender_str == "customer" else MessageSender.waiter
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or not session.is_open:
        raise HTTPException(status_code=404, detail="Sesión no encontrada o cerrada")
    msg = ChatMessage(session_id=session_id, sender=sender, content=data["content"])
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {"id": msg.id, "sender": msg.sender.value, "content": msg.content, "sent_at": msg.sent_at, "is_read": msg.is_read}

@router.patch("/sessions/{session_id}/read", status_code=204)
async def mark_sessions_read(session_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.waiter.value, UserRole.admin.value, UserRole.kitchen.value, UserRole.superadmin.value]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    await db.execute(update(ChatMessage).where(ChatMessage.session_id == session_id, ChatMessage.sender == MessageSender.customer, ChatMessage.is_read == False).values(is_read=True))
    await db.commit()

@router.patch("/sessions/{session_id}/close", status_code=204)
async def close_session(session_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from datetime import datetime
    query = select(ChatSession).where(ChatSession.id == session_id)
    if current_user["role"] != UserRole.superadmin.value:
        query = query.where(ChatSession.restaurant_id == current_user["restaurant_id"])
    session = (await db.execute(query)).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    session.is_open = False
    session.closed_at = datetime.utcnow()
    await db.commit()

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: int, token: str = None):
    await websocket.accept()
    sender = MessageSender.customer
    waiter_id = None
    if token:
        try:
            payload = decode_token(token)
            sender = MessageSender.waiter
            waiter_id = int(payload["sub"])
        except Exception:
            await websocket.close(code=1008, reason="Token inválido")
            return
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)
    try:
        while True:
            content = await websocket.receive_text()
            async with AsyncSessionLocal() as db:
                msg = ChatMessage(session_id=session_id, sender=sender, waiter_id=waiter_id, content=content)
                db.add(msg)
                await db.commit()
            broadcast_data = {"sender": sender.value, "content": content}
            peers = list(active_connections.get(session_id, []))
            results = await asyncio.gather(
                *[ws.send_json(broadcast_data) for ws in peers],
                return_exceptions=True,
            )
            for ws, res in zip(peers, results):
                if isinstance(res, Exception):
                    try:
                        active_connections[session_id].remove(ws)
                    except ValueError:
                        pass
    except WebSocketDisconnect:
        if session_id in active_connections and websocket in active_connections[session_id]:
            active_connections[session_id].remove(websocket)
        if session_id in active_connections and not active_connections[session_id]:
            del active_connections[session_id]