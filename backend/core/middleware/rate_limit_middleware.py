import json
import time
import threading
from dataclasses import dataclass, field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from ..config import settings


@dataclass
class _TokenBucket:
    capacity: float
    refill_rate: float  # tokens per second
    tokens: float = field(init=False)
    last_refill: float = field(init=False)
    _lock: threading.Lock = field(init=False)

    def __post_init__(self) -> None:
        self.tokens = self.capacity
        self.last_refill = time.perf_counter()
        self._lock = threading.Lock()

    def try_consume(self) -> bool:
        with self._lock:
            now = time.perf_counter()
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
            self.last_refill = now
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return True
            return False


class _RateLimiter:
    def __init__(self, capacity: int, refill_rate_per_minute: float) -> None:
        self.capacity = float(capacity)
        self.refill_rate = refill_rate_per_minute / 60.0
        self._buckets: dict[str, _TokenBucket] = {}
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        with self._lock:
            if key not in self._buckets:
                self._buckets[key] = _TokenBucket(
                    capacity=self.capacity, refill_rate=self.refill_rate
                )
        return self._buckets[key].try_consume()

    def seconds_until_next(self) -> int:
        if self.refill_rate <= 0:
            return 900
        return max(1, int(1.0 / self.refill_rate))


_AUTH_PATHS = ("/api/v1/auth/login", "/api/v1/auth/register")
_EXCLUDED_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/health"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._default = _RateLimiter(
            settings.RATE_LIMIT_DEFAULT_BURST,
            settings.RATE_LIMIT_DEFAULT_PER_MINUTE,
        )
        self._auth = _RateLimiter(
            settings.RATE_LIMIT_AUTH_BURST,
            settings.RATE_LIMIT_AUTH_PER_MINUTE,
        )

    @staticmethod
    def _client_key(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.scope["type"] == "websocket":
            return await call_next(request)

        path = request.url.path
        if path in _EXCLUDED_PATHS:
            return await call_next(request)

        is_auth = any(path.startswith(p) for p in _AUTH_PATHS)
        limiter = self._auth if is_auth else self._default
        key = self._client_key(request)

        if not limiter.is_allowed(key):
            retry = limiter.seconds_until_next()
            return Response(
                content=json.dumps({
                    "detail": "Demasiadas solicitudes. Intente más tarde.",
                    "code": "RATE_LIMIT_EXCEEDED",
                }),
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(retry)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(int(limiter.capacity))
        return response
