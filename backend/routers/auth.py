import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlmodel import Session
from ..database import get_session
from ..schemas.auth import UsuarioCreate, UsuarioLogin, UsuarioRead, TokenResponse
from ..services.auth_service import AuthService
from ..repositories.usuario_repository import UsuarioRepository
from ..uow.unit_of_work import UnitOfWork
from ..core.config import settings
from ..core.deps import get_current_user
from ..core.security import create_access_token, create_refresh_token, decode_refresh_token
from ..models import Usuario


class RefreshRequest(BaseModel):
    refresh_token: str | None = None

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/api/v1/auth/refresh",
    )


@router.post(
    "/register", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED
)
def register(
    payload: UsuarioCreate, session: Session = Depends(get_session)
) -> Usuario:
    with UnitOfWork(session) as uow:
        service = AuthService(uow.session)
        return service.register(payload)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UsuarioLogin, response: Response, session: Session = Depends(get_session)
) -> TokenResponse:
    service = AuthService(session)
    user, access_token = service.login(payload)
    user = UsuarioRepository(session).get_with_roles(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UsuarioRead.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    body: RefreshRequest = RefreshRequest(),
) -> TokenResponse:
    token = request.cookies.get(settings.REFRESH_COOKIE_NAME) or body.refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token no encontrado")
    try:
        payload = decode_refresh_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    user_id = int(payload["sub"])
    user = UsuarioRepository(session).get_with_roles(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    _set_access_cookie(response, new_access)
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=UsuarioRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key=settings.COOKIE_NAME, path="/")
    response.delete_cookie(key=settings.REFRESH_COOKIE_NAME, path="/api/v1/auth/refresh")


@router.get("/me", response_model=UsuarioRead)
def me(user: Usuario = Depends(get_current_user)) -> Usuario:
    return user
