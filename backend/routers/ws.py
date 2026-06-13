import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlmodel import Session
from ..database import get_session
from ..core.security import decode_access_token
from ..core.ws_manager import ws_manager
from ..repositories.usuario_repository import UsuarioRepository
from ..repositories.pedido_repository import PedidoRepository

router = APIRouter(tags=["WebSocket"])

_STAFF_ROLES = {"ADMIN", "PEDIDOS"}


async def _auth_ws(websocket: WebSocket, token: str, session: Session) -> object | None:
    """Validate JWT and return user, or close with 4001.
    Must accept() before close() so the browser receives the proper close code."""
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError, ValueError):
        await websocket.accept()
        await websocket.close(code=4001)
        return None
    user = UsuarioRepository(session).get_with_roles(user_id)
    if user is None:
        await websocket.accept()
        await websocket.close(code=4001)
        return None
    return user


@router.websocket("/ws/pedidos")
async def ws_admin_pedidos(
    websocket: WebSocket,
    token: str = Query(...),
    session: Session = Depends(get_session),
):
    """Staff (ADMIN, PEDIDOS) subscribe to all order state changes."""
    user = await _auth_ws(websocket, token, session)
    if user is None:
        return
    if not user.has_any_role(*_STAFF_ROLES):
        await websocket.close(code=4003)
        return

    await ws_manager.connect(websocket, "admin")
    try:
        while True:
            await websocket.receive_text()  # keep-alive / ignore client messages
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "admin")


@router.websocket("/ws/catalogo")
async def ws_catalogo(websocket: WebSocket):
    """Public channel — store clients subscribe to catalog/stock updates."""
    await ws_manager.connect(websocket, "catalogo")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "catalogo")


@router.websocket("/ws/pedidos/{pedido_id}")
async def ws_order_status(
    websocket: WebSocket,
    pedido_id: int,
    token: str = Query(...),
    session: Session = Depends(get_session),
):
    """Customer subscribes to their specific order status."""
    user = await _auth_ws(websocket, token, session)
    if user is None:
        return

    # Verify user owns this order (or is staff)
    pedido = PedidoRepository(session).get(pedido_id)
    if pedido is None:
        await websocket.accept()
        await websocket.close(code=4004)
        return
    is_staff = user.has_any_role(*_STAFF_ROLES)
    if not is_staff and pedido.usuario_id != user.id:
        await websocket.accept()
        await websocket.close(code=4003)
        return

    channel = f"pedido:{pedido_id}"
    await ws_manager.connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel)
