import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("foodstore.timing")

_SLOW_THRESHOLD_MS = 500.0


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0

        response.headers["Server-Timing"] = f'total;dur={duration_ms:.2f};desc="Total"'
        response.headers["X-Response-Time-ms"] = f"{duration_ms:.2f}"

        if duration_ms > _SLOW_THRESHOLD_MS:
            logger.warning(
                "SLOW %s %s %.1fms", request.method, request.url.path, duration_ms
            )
        return response
