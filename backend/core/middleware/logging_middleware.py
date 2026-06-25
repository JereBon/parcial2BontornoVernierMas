import logging
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("foodstore.http")

_EXCLUDED = {"/health", "/docs", "/redoc", "/openapi.json"}


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)
        if request.url.path in _EXCLUDED:
            return await call_next(request)

        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()

        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )

        logger.info("→ %s %s [id=%s] from=%s", request.method, request.url.path, request_id, client_ip)

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "✗ %s %s [id=%s] EXCEPTION after %.1fms: %s",
                request.method, request.url.path, request_id, duration_ms, exc,
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        status = response.status_code
        log = logger.error if status >= 500 else logger.warning if status >= 400 else logger.info
        log("← %s %s [id=%s] %d in %.1fms", request.method, request.url.path, request_id, status, duration_ms)

        response.headers["X-Request-ID"] = request_id
        return response
