from fastapi import HTTPException
from sqlmodel import Session
from ..models import Categoria
from ..schemas.catalogo import CategoriaCreate, CategoriaUpdate, CategoriaTreeNode
from ..repositories.categoria_repository import CategoriaRepository
from ..repositories.producto_repository import ProductoRepository


class CategoriaService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = CategoriaRepository(session)
        self.prod_repo = ProductoRepository(session)

    def get_by_id(self, categoria_id: int) -> Categoria:
        cat = self.repo.get(categoria_id)
        if cat is None:
            raise HTTPException(status_code=404, detail="Categoria no encontrada")
        return cat

    def list_paginated(
        self, *, skip: int, limit: int, parent_id: int | None, only_roots: bool
    ) -> tuple[list[Categoria], int]:
        return self.repo.search(
            skip=skip, limit=limit, parent_id=parent_id, only_roots=only_roots
        )

    def get_tree(self) -> list[CategoriaTreeNode]:
        flat = self.repo.get_all_active()
        nodes: dict[int, CategoriaTreeNode] = {
            c.id: CategoriaTreeNode(
                id=c.id,
                nombre=c.nombre,
                descripcion=c.descripcion,
                parent_id=c.parent_id,
                children=[],
            )
            for c in flat
        }
        roots: list[CategoriaTreeNode] = []
        for c in flat:
            node = nodes[c.id]
            if c.parent_id is None or c.parent_id not in nodes:
                roots.append(node)
            else:
                nodes[c.parent_id].children.append(node)
        return roots

    def _validate_parent(
        self, parent_id: int | None, *, current_id: int | None = None
    ) -> None:
        if parent_id is None:
            return
        if current_id is not None and parent_id == current_id:
            raise HTTPException(
                status_code=400, detail="Una categoria no puede ser padre de si misma"
            )
        if self.repo.get(parent_id) is None:
            raise HTTPException(status_code=404, detail="parent_id no existe")

    def _would_create_cycle(self, categoria_id: int, new_parent_id: int) -> bool:
        seen: set[int] = set()
        current_id: int | None = new_parent_id
        while current_id is not None:
            if current_id == categoria_id:
                return True
            if current_id in seen:
                return False
            seen.add(current_id)
            node = self.repo.get(current_id)
            if node is None:
                return False
            current_id = node.parent_id
        return False

    def create(self, payload: CategoriaCreate) -> Categoria:
        self._validate_parent(payload.parent_id)
        cat = Categoria(
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            parent_id=payload.parent_id,
        )
        return self.repo.add(cat)

    def update(self, categoria_id: int, payload: CategoriaUpdate) -> Categoria:
        cat = self.get_by_id(categoria_id)
        data = payload.model_dump(exclude_unset=True)
        if "parent_id" in data:
            new_parent = data["parent_id"]
            self._validate_parent(new_parent, current_id=categoria_id)
            if new_parent is not None and self._would_create_cycle(
                categoria_id, new_parent
            ):
                raise HTTPException(
                    status_code=400, detail="parent_id generaria un ciclo"
                )
        for k, v in data.items():
            setattr(cat, k, v)
        return self.repo.add(cat)

    def delete(self, categoria_id: int) -> None:
        cat = self.get_by_id(categoria_id)
        active = self.prod_repo.count_active_by_categoria(cat.id)
        if active > 0:
            raise HTTPException(
                status_code=409,
                detail=f"No se puede eliminar: la categoria tiene {active} producto(s) activo(s)",
            )
        self.repo.delete(cat)
