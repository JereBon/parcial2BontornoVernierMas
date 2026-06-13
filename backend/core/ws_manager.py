import logging
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WSManager:
    def __init__(self) -> None:
        # channel_name → set of active WebSocket connections
        self._channels: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, channel: str) -> None:
        await ws.accept()
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(ws)
        logger.info("WS connected to channel '%s' (total: %d)", channel, len(self._channels[channel]))

    def disconnect(self, ws: WebSocket, channel: str) -> None:
        if channel in self._channels:
            self._channels[channel].discard(ws)
            logger.info("WS disconnected from channel '%s' (remaining: %d)", channel, len(self._channels[channel]))

    async def _broadcast(self, channel: str, data: dict) -> None:
        connections = self._channels.get(channel, set()).copy()
        dead: set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._channels.get(channel, set()).discard(ws)

    async def broadcast_pedido(self, pedido_id: int, evento: dict) -> None:
        """Broadcast to admin channel and to the specific order channel."""
        await self._broadcast("admin", evento)
        await self._broadcast(f"pedido:{pedido_id}", evento)

    async def broadcast_admin(self, evento: dict) -> None:
        """Broadcast only to admin/staff channel."""
        await self._broadcast("admin", evento)

    async def broadcast_catalogo(self, evento: dict) -> None:
        """Broadcast catalog/stock updates to all store clients."""
        await self._broadcast("catalogo", evento)


ws_manager = WSManager()
