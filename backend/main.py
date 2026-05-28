from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import init_db, engine
from .core.config import settings
from .core.seed import seed_all
from .routers import (
    auth,
    categorias,
    ingredientes,
    productos,
    pedidos,
    direcciones,
    lookups,
    admin,
)
from sqlmodel import Session


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        seed_all(session)
    yield


app = FastAPI(title="FoodStore API", lifespan=lifespan, version="2.0.0")
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


@app.get("/")
def root():
    return {"message": "FoodStore API v2", "docs": "/docs"}
