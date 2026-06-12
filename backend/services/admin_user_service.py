from fastapi import HTTPException
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload
from ..models import Usuario, UsuarioRol, Rol
from ..repositories.usuario_repository import UsuarioRepository
from ..repositories.lookups import RolRepository
from ..schemas.admin import UsuarioAdminCreate, UsuarioAdminUpdate, UsuarioRolesUpdate
from ..core.security import hash_password


class AdminUserService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = UsuarioRepository(session)
        self.rol_repo = RolRepository(session)

    def list_paginated(
        self, *, skip: int, limit: int, rol_codigo: str | None, busqueda: str | None = None
    ) -> tuple[list[Usuario], int]:
        stmt = select(Usuario).where(Usuario.deleted_at.is_(None))
        if rol_codigo:
            stmt = (
                stmt.join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
                .join(Rol, Rol.id == UsuarioRol.rol_id)
                .where(Rol.codigo == rol_codigo)
            )
        if busqueda:
            like = f"%{busqueda}%"
            stmt = stmt.where(
                (Usuario.email.ilike(like)) | (Usuario.nombre.ilike(like))
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.session.exec(count_stmt).one())
        stmt = (
            stmt.options(selectinload(Usuario.roles))
            .order_by(Usuario.id)
            .offset(skip)
            .limit(limit)
        )
        items = list(self.session.exec(stmt).unique().all())
        return (items, total)

    def get(self, user_id: int) -> Usuario:
        u = self.repo.get_with_roles(user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return u

    def create(self, payload: UsuarioAdminCreate) -> Usuario:
        existing = self.repo.get_by_email(payload.email, include_deleted=True)
        if existing is not None:
            raise HTTPException(status_code=409, detail="El email ya esta registrado")
        roles_objs = self.rol_repo.get_by_codigos(payload.roles)
        missing = set(payload.roles) - {r.codigo for r in roles_objs}
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Roles inexistentes: {sorted(missing)}"
            )
        user = Usuario(
            email=payload.email,
            nombre=payload.nombre,
            apellido=payload.apellido,
            celular=payload.celular,
            password_hash=hash_password(payload.password),
        )
        self.session.add(user)
        self.session.flush()
        for r in roles_objs:
            self.session.add(UsuarioRol(usuario_id=user.id, rol_id=r.id))
        self.session.flush()
        return self.repo.get_with_roles(user.id)

    def update(self, user_id: int, payload: UsuarioAdminUpdate) -> Usuario:
        u = self.get(user_id)
        data = payload.model_dump(exclude_unset=True)
        for k in ("nombre", "apellido", "celular"):
            if k in data:
                setattr(u, k, data[k])
        if "password" in data and data["password"]:
            u.password_hash = hash_password(data["password"])
        self.session.add(u)
        self.session.flush()
        return self.repo.get_with_roles(u.id)

    def replace_roles(self, user_id: int, payload: UsuarioRolesUpdate) -> Usuario:
        u = self.get(user_id)
        roles_objs = self.rol_repo.get_by_codigos(payload.roles)
        missing = set(payload.roles) - {r.codigo for r in roles_objs}
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Roles inexistentes: {sorted(missing)}"
            )
        for ur in self.session.exec(
            select(UsuarioRol).where(UsuarioRol.usuario_id == u.id)
        ).all():
            self.session.delete(ur)
        self.session.flush()
        for r in roles_objs:
            self.session.add(UsuarioRol(usuario_id=u.id, rol_id=r.id))
        self.session.flush()
        return self.repo.get_with_roles(u.id)

    def soft_delete(self, user_id: int) -> None:
        u = self.get(user_id)
        self.repo.delete(u)
