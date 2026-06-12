# FoodStore — Parcial 2 (Fullstack FastAPI + React)

Integrantes:
- Jeremías Bontorno
- Luciano Mas
- Valentino Vernier

App fullstack para la materia **Programación 4**. Un backend FastAPI con PostgreSQL y dos frontends en React + TypeScript: uno para clientes (Store) y otro para personal interno (Admin).

## Estructura

```
parcial-prog4/
├── backend/      FastAPI + SQLModel + PostgreSQL
├── frontend/     Admin (puerto 5173)
└── store/        Store (puerto 5174)
```

## Stack

**Backend**: FastAPI · SQLModel · PostgreSQL · PyJWT · bcrypt · Pydantic v2
**Frontend**: React 19 · TypeScript · Vite · TanStack Query · TanStack Form · React Router · Axios · Tailwind CSS 4

## Funcionalidad
### Backend (`/api/v1/...`)
- Auth con cookie JWT HttpOnly (30 min), bcrypt cost 12.
- RBAC con 4 roles: `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`. Relación M:N usuario-rol.
- Catálogo: categorías jerárquicas (parent_id recursivo) + ingredientes con flag `es_alergeno` por producto + productos con `stock_cantidad`/`disponible`.
- Pedidos con máquina de estados (6 estados), Snapshot Pattern en items y dirección, Audit Trail append-only en historial.
- Direcciones de entrega con principal por usuario.
- Panel de administración para gestionar usuarios y asignar roles.
- Stock se descuenta al crear pedido y se restaura al cancelar.
- Seed obligatorio al arrancar: roles, estados, formas de pago, admin por defecto.

### Frontend Admin (puerto 5173)
- Login y `ProtectedRoute` por rol.
- ADMIN: CRUD de categorías, ingredientes, productos, usuarios.
- STOCK: ajustar stock y disponibilidad.
- PEDIDOS: pantalla "Cajero" tipo kanban para avanzar estados.
- Polling cada 5 s para ver nuevos pedidos sin recargar.

### Frontend Store (puerto 5174)
- Catálogo público con filtros (categoría, precio, búsqueda).
- Carrito en `localStorage` (sobrevive a refresh).
- Refresh automático de precios contra el backend.
- Registro + login del cliente.
- Direcciones propias con CRUD y dirección principal.
- Checkout con selector de dirección y forma de pago.
- "Mis pedidos" con polling de estado en vivo.

## Patrones arquitectónicos

| Patrón | Implementación |
|---|---|
| Unit of Work | `backend/uow/unit_of_work.py`. Único lugar del proyecto que ejecuta commit/rollback. |
| Repository | `BaseRepository[T]` genérico + repos específicos. Soft delete y eager loading transparentes. |
| Service Layer | Lógica de negocio en `backend/services/`. Routers solo orquestan. |
| Soft Delete | Campo `deleted_at` en todas las entidades de negocio. |
| Snapshot Pattern | `DetallePedido` copia `producto_nombre` y `producto_precio`. Pedido guarda `direccion_snapshot` textual. |
| Audit Trail Append-Only | `HistorialEstadoPedidoRepository` solo expone `add()` y `list_by_pedido()`. |
| Máquina de Estados | Validada en `PedidoService._validate_transition`, nunca en el router. |

Flujo obligatorio en cada mutación: **Router → Service → UnitOfWork → Repository**.

---

## Cómo correrlo

### 1. PostgreSQL

Asegurate de tener PostgreSQL local. Crear la base con pgAdmin o:

```sql
CREATE DATABASE parcial_db;
```

Si tu usuario/password no es `postgres/postgres`, exportá `DATABASE_URL` antes de arrancar el backend:

```powershell
$env:DATABASE_URL = "postgresql://usuario:password@localhost:5432/parcial_db"
```

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Al arrancar se crean las tablas y corre el seed. API en `http://localhost:8000`, Swagger en `/docs`.

**Usuario admin por defecto** (creado por el seed):
- email: `admin@admin.com`
- password: `admin12345`

### 3. Admin

```powershell
cd frontend
npm install
npm run dev
```

Disponible en `http://localhost:5173`. Login con el admin del seed.

### 4. Store

```powershell
cd store
npm install
npm run dev
```

Disponible en `http://localhost:5174`. Registrate como cliente nuevo desde la UI.

---

## Endpoints principales

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/categorias/         (público, paginado, filtro parent_id)
GET    /api/v1/categorias/tree
CRUD   /api/v1/categorias/         (ADMIN)

GET    /api/v1/productos/          (público, filtros)
CRUD   /api/v1/productos/          (ADMIN)
PATCH  /api/v1/productos/{id}/disponibilidad   (ADMIN, STOCK)

CRUD   /api/v1/ingredientes/       (ADMIN)

POST   /api/v1/pedidos/            (autenticado)
GET    /api/v1/pedidos/me          (autenticado, propios)
GET    /api/v1/pedidos/            (ADMIN, PEDIDOS)
PATCH  /api/v1/pedidos/{id}/estado (ADMIN, PEDIDOS)
POST   /api/v1/pedidos/{id}/cancelar

CRUD   /api/v1/direcciones/        (autenticado, propias)
PATCH  /api/v1/direcciones/{id}/principal

GET    /api/v1/admin/usuarios      (ADMIN)
PUT    /api/v1/admin/usuarios/{id}/roles
DELETE /api/v1/admin/usuarios/{id}

GET    /api/v1/lookups/estados-pedido
GET    /api/v1/lookups/formas-pago
```

## Notas

- La base se crea automáticamente al arrancar (`SQLModel.metadata.create_all`). Para resetear, dropear la base desde pgAdmin y volver a arrancar.
- Si venís del Parcial 1 con datos viejos, dropear y recrear la base es obligatorio porque cambió el schema.
