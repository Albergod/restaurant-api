from typing import List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user, decode_token
from app.models.models import ChatMessage, ChatSession, MessageSender, Table, UserRole
from app.schemas.schemas import ChatMessageCreate, ChatMessageOut, ChatSessionOut, OrderOut

router = APIRouter(prefix="/api/chat", tags=["Chat"])

# Conexiones WebSocket activas: {session_id: [WebSocket]}
active_connections: dict[int, list[WebSocket]] = {}


# ──────────────────────────────────────────
# REST: Sesiones y mensajes
# ──────────────────────────────────────────

@router.post("/sessions/{table_qr}", response_model=ChatSessionOut, status_code=201)
async def open_chat_session(table_qr: str, db: AsyncSession = Depends(get_db)):
    """
    El cliente abre una sesión de chat al escanear el QR.
    Si ya hay una sesión abierta en esa mesa, la devuelve.
    """
    table_result = await db.execute(select(Table).where(Table.qr_code == table_qr))
    table = table_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    # Buscar sesión abierta existente
    existing = await db.execute(
        select(ChatSession)
        .where(ChatSession.table_id == table.id, ChatSession.is_open == True)
        .options(selectinload(ChatSession.messages))
    )
    session = existing.scalar_one_or_none()
    if session:
        return session

    session = ChatSession(table_id=table.id)
    db.add(session)
    await db.commit()

    # Recargar con relaciones para evitar MissingGreenlet en serializacion
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session.id)
        .options(selectinload(ChatSession.messages))
    )
    return result.scalar_one()


@router.get("/sessions/active", response_model=List[dict])
async def list_active_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Listar sesiones de chat abiertas con el número de mesa. Meseros y admin."""
    if current_user["role"] not in [UserRole.waiter, UserRole.admin]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.is_open == True)
        .options(selectinload(ChatSession.messages), selectinload(ChatSession.table))
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "table_id": s.table_id,
            "table_number": s.table.number if s.table else None,
            "created_at": s.created_at,
            "unread_count": sum(1 for m in s.messages if not m.is_read and m.sender == MessageSender.customer),
            "last_message": s.messages[-1].content if s.messages else None,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Ver historial de una sesión de chat. Meseros y admin."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id)
        .options(selectinload(ChatSession.messages))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return session


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageOut)
async def send_message_rest(
    session_id: int,
    data: ChatMessageCreate,
    sender: MessageSender = MessageSender.customer,
    db: AsyncSession = Depends(get_db),
):
    """
    Enviar mensaje por REST (fallback si WebSocket no está disponible).
    sender: 'customer' o 'waiter'
    """
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session or not session.is_open:
        raise HTTPException(status_code=404, detail="Sesión no encontrada o cerrada")

    msg = ChatMessage(session_id=session_id, sender=sender, content=data.content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.patch("/sessions/{session_id}/read", status_code=204)
async def mark_sessions_read(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marcar todos los mensajes no leídos del cliente como leídos. Meseros y admin."""
    if current_user["role"] not in [UserRole.waiter, UserRole.admin, UserRole.kitchen]:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    await db.execute(
        update(ChatMessage)
        .where(
            ChatMessage.session_id == session_id,
            ChatMessage.sender == MessageSender.customer,
            ChatMessage.is_read == False,
        )
        .values(is_read=True)
    )
    await db.commit()


@router.patch("/sessions/{session_id}/close", status_code=204)
async def close_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Cerrar sesión de chat. Solo meseros y admin."""
    from datetime import datetime
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    session.is_open = False
    session.closed_at = datetime.utcnow()
    await db.commit()


# ──────────────────────────────────────────
# WEBSOCKET: Chat en tiempo real
# ──────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: int, token: str = None):
    """
    Conexión WebSocket para chat en tiempo real.
    - Cliente (sin token): sender=customer
    - Mesero (con token JWT): sender=waiter

    Conectar: ws://host/api/chat/ws/{session_id}?token=<JWT>
    Mensajes: enviar texto plano → se transmite a todos en la sesión
    """
    await websocket.accept()

    # Determinar quién está conectado
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

    # Registrar conexión
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    try:
        while True:
            content = await websocket.receive_text()

            # Guardar en DB
            async with AsyncSessionLocal() as db:
                msg = ChatMessage(
                    session_id=session_id,
                    sender=sender,
                    waiter_id=waiter_id,
                    content=content,
                )
                db.add(msg)
                await db.commit()

            # Broadcast a todos en la sesión
            broadcast_data = {
                "sender": sender,
                "content": content,
            }
            dead = []
            for ws in active_connections.get(session_id, []):
                try:
                    await ws.send_json(broadcast_data)
                except Exception:
                    dead.append(ws)

            # Limpiar conexiones muertas
            for ws in dead:
                active_connections[session_id].remove(ws)

    except WebSocketDisconnect:
        active_connections[session_id].remove(websocket)
        if not active_connections[session_id]:
            del active_connections[session_id]
