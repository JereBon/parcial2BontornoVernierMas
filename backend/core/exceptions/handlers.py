from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger("foodstore.exceptions")


def _error(code: str, message: str, status_code: int, request_id: str | None = None, **extra) -> JSONResponse:
    body: dict = {"detail": message, "code": code}
    if request_id:
        body["request_id"] = request_id
    body.update(extra)
    return JSONResponse(status_code=status_code, content=body)


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


async def _http_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = getattr(exc, "code", None) or f"HTTP_{exc.status_code}"
    return _error(code, str(exc.detail), exc.status_code, _request_id(request))


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [
        {"field": ".".join(str(loc) for loc in e["loc"]), "msg": e["msg"]}
        for e in exc.errors()
    ]
    return _error("VALIDATION_ERROR", "Error de validación", 422, _request_id(request), fields=fields)


async def _sqlalchemy_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error("Database error [id=%s]: %s", _request_id(request), exc)
    return _error("DATABASE_ERROR", "Error de base de datos", 500, _request_id(request))


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error [id=%s]", _request_id(request))
    return _error("INTERNAL_ERROR", "Error interno del servidor", 500, _request_id(request))


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, _http_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(SQLAlchemyError, _sqlalchemy_handler)
    app.add_exception_handler(Exception, _unhandled_handler)
