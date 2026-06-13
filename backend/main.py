import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, engine
from .core.config import settings
from .core.seed import seed_all
from .core.middleware import RateLimitMiddleware, LoggingMiddleware, TimingMiddleware
from .core.exceptions import register_exception_handlers
from .routers import (
    auth,
    categorias,
    ingredientes,
    productos,
    pedidos,
    direcciones,
    lookups,
    admin,
    uploads,
    ws,
    pagos,
)
from sqlmodel import Session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_all(session)
    yield


app = FastAPI(title="FoodStore API", lifespan=lifespan, version="3.0.0")

# Register exception handlers BEFORE middleware
register_exception_handlers(app)

# Middleware order (applied in reverse — last added = outermost):
# Request flow: CORS → RateLimit → Logging → Timing → route
# CORS must be outermost so ALL responses (including 429s) carry the header.
app.add_middleware(TimingMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(categorias.router, prefix=API_PREFIX)
app.include_router(ingredientes.router, prefix=API_PREFIX)
app.include_router(productos.router, prefix=API_PREFIX)
app.include_router(pedidos.router, prefix=API_PREFIX)
app.include_router(direcciones.router, prefix=API_PREFIX)
app.include_router(lookups.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(uploads.router, prefix=API_PREFIX)
app.include_router(ws.router)  # WS endpoints don't use /api/v1 prefix
app.include_router(pagos.router, prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "FoodStore API v3", "docs": "/docs"}
