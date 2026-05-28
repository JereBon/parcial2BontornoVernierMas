from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session
from ..database import get_session
from ..schemas.auth import UsuarioCreate, UsuarioLogin, UsuarioRead, TokenResponse
from ..services.auth_service import AuthService
from ..repositories.usuario_repository import UsuarioRepository
from ..uow.unit_of_work import UnitOfWork
from ..core.config import settings
from ..core.deps import get_current_user
from ..models import Usuario

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
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
    user, token = service.login(payload)
    user = UsuarioRepository(session).get_with_roles(user.id)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, user=UsuarioRead.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key=settings.COOKIE_NAME, path="/")


@router.get("/me", response_model=UsuarioRead)
def me(user: Usuario = Depends(get_current_user)) -> Usuario:
    return user
