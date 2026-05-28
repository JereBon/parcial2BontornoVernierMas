from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session
import jwt
from ..database import get_session
from ..models import Usuario
from ..repositories.usuario_repository import UsuarioRepository
from .config import settings
from .security import decode_access_token

_UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado"
)
_FORBIDDEN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes"
)


def _read_token(request: Request) -> str:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        raise _UNAUTH
    return token


def get_current_user(
    request: Request, session: Session = Depends(get_session)
) -> Usuario:
    token = _read_token(request)
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise _UNAUTH
    sub = payload.get("sub")
    if sub is None:
        raise _UNAUTH
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise _UNAUTH
    repo = UsuarioRepository(session)
    user = repo.get_with_roles(user_id)
    if user is None:
        raise _UNAUTH
    return user


def require_roles(*codigos: str):
    allowed = set(codigos)

    def _checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if not user.has_any_role(*allowed):
            raise _FORBIDDEN
        return user

    return _checker
