from fastapi import HTTPException, status
from sqlmodel import Session
from ..models import Usuario, Rol
from ..models.rol import RolCodigo
from ..repositories.usuario_repository import UsuarioRepository
from ..repositories.lookups import RolRepository
from ..schemas.auth import UsuarioCreate, UsuarioLogin
from ..core.security import hash_password, verify_password, create_access_token


class AuthService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = UsuarioRepository(session)
        self.rol_repo = RolRepository(session)

    def register(
        self, payload: UsuarioCreate, *, roles_codigos: list[str] | None = None
    ) -> Usuario:
        existing = self.repo.get_by_email(payload.email, include_deleted=True)
        if existing is not None:
            raise HTTPException(status_code=409, detail="El email ya esta registrado")
        codes = roles_codigos or [RolCodigo.CLIENT.value]
        roles_objs = self.rol_repo.get_by_codigos(codes)
        missing = set(codes) - {r.codigo for r in roles_objs}
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Roles inexistentes: {', '.join(sorted(missing))}",
            )
        user = Usuario(
            email=payload.email,
            nombre=payload.nombre,
            password_hash=hash_password(payload.password),
        )
        self.session.add(user)
        self.session.flush()
        from ..models import UsuarioRol

        for r in roles_objs:
            self.session.add(UsuarioRol(usuario_id=user.id, rol_id=r.id))
        self.session.flush()
        return self.repo.get_with_roles(user.id)

    def authenticate(self, payload: UsuarioLogin) -> Usuario:
        user = self.repo.get_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Credenciales invalidas")
        return user

    def issue_token(self, user: Usuario) -> str:
        return create_access_token(
            subject=user.id,
            extra_claims={"email": user.email, "roles": list(user.role_codes())},
        )

    def login(self, payload: UsuarioLogin) -> tuple[Usuario, str]:
        user = self.authenticate(payload)
        token = self.issue_token(user)
        return (user, token)
