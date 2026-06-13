# FoodStore — Parcial 2 (Fullstack FastAPI + React)

Integrantes:
- Jeremías Bontorno
- Luciano Mas
- Valentino Vernier

App fullstack para la materia **Programación 4**. Backend FastAPI con PostgreSQL y dos frontends en React + TypeScript: uno para clientes (Store) y otro para personal interno (Admin), con comunicación en tiempo real vía WebSockets e integración con Mercado Pago.

## Estructura

```
parcial-prog4/
├── backend/      FastAPI + SQLModel + PostgreSQL  (puerto 8000)
├── frontend/     Admin                            (puerto 5173)
└── store/        Store clientes                   (puerto 5174)
```

## Stack

**Backend**: FastAPI · SQLModel · PostgreSQL · PyJWT · bcrypt · Pydantic v2 · WebSockets  
**Frontend**: React 19 · TypeScript · Vite · TanStack Query · TanStack Form · React Router · Axios · Tailwind CSS 4

---

## Cómo correrlo

Necesitás tener corriendo **tres procesos al mismo tiempo** (abrí una terminal por cada uno).

### 1. PostgreSQL

Creá la base de datos con pgAdmin o con psql:

```sql
CREATE DATABASE parcial_db;
```

Si tu usuario/contraseña no es `postgres/postgres`, modificá `DATABASE_URL` en `backend/.env`.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Al arrancar crea las tablas y ejecuta el seed automáticamente.  
API disponible en `http://localhost:8000` · Swagger en `http://localhost:8000/docs`

**Usuario admin creado por el seed:**
- Email: `admin@admin.com`
- Password: `admin12345`

### 3. Admin (panel interno)

```powershell
cd frontend
npm install
npm run dev
```

Disponible en `http://localhost:5173`

### 4. Store (clientes)

```powershell
cd store
npm install
npm run dev
```

Disponible en `http://localhost:5174`  
Registrate como cliente nuevo desde la UI.

---

## Mercado Pago + ngrok

El checkout con Mercado Pago requiere que el backend sea accesible desde internet para recibir el webhook de pago (IPN). En desarrollo se usa **ngrok** para exponer el puerto local.

### Paso a paso

**1. Instalá ngrok** (si no lo tenés): https://ngrok.com/download  
Creá una cuenta gratuita y autenticá tu token:
```powershell
ngrok config add-authtoken <TU_TOKEN>
```

**2. Levantá el backend** en el puerto 8000 (paso 2 de arriba).

**3. Abrí ngrok** en una terminal aparte:
```powershell
ngrok http 8000
```
Ngrok te mostrará algo como:
```
Forwarding  https://abcd1234.ngrok-free.app -> http://localhost:8000
```

**4. Configurá las variables en `backend/.env`:**
```env
# Mercado Pago (obtenés las credenciales en https://www.mercadopago.com.ar/developers)
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
MP_SANDBOX=True

# URL del frontend store (back_urls de MP)
MP_STORE_URL=http://localhost:5174

# URL pública del backend — la que te da ngrok (sin barra al final)
MP_WEBHOOK_URL=https://abcd1234.ngrok-free.app
```

> Cada vez que reiniciás ngrok te da una URL distinta (en la cuenta gratuita). Actualizá `MP_WEBHOOK_URL` y reiniciá el backend.

**5. Reiniciá el backend** para que tome las nuevas variables.

**6. Probá el checkout** desde la Store: agregá productos al carrito, completá el checkout con Mercado Pago Sandbox y usá las [tarjetas de prueba de MP](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test/test-cards).

---

## Variables de entorno (`backend/.env`)

Todas tienen valor por defecto excepto las de Mercado Pago:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/parcial_db

# JWT
JWT_SECRET=CHANGE_ME_IN_PROD_super_secret_key_32_chars_min
JWT_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mercado Pago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_SANDBOX=True
MP_STORE_URL=http://localhost:5174
MP_WEBHOOK_URL=

# Cloudinary (opcional, para subir imágenes de productos)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Funcionalidades

### Backend
- Auth con cookie JWT HttpOnly + refresh token en cookie.
- RBAC con 4 roles: `ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`.
- Catálogo: categorías jerárquicas + ingredientes con `es_alergeno` + productos con `stock_cantidad` / `disponible`.
- Pedidos con máquina de estados (PENDIENTE → CONFIRMADO → EN_PREP → ENTREGADO / CANCELADO).
- Stock se descuenta al crear pedido y se restaura al cancelar.
- Snapshot Pattern en items del pedido (guarda nombre y precio al momento de la compra).
- Audit Trail append-only en historial de estados.
- Integración Mercado Pago: preferencia de pago, webhook IPN, consulta de estado.
- WebSockets: canal `admin` (nuevos pedidos), `pedido:{id}` (estado del pedido del cliente), `catalogo` (cambios de stock/disponibilidad).
- Rate limiting por IP + middleware de logging y timing.

### Admin (puerto 5173)
- Login protegido por rol.
- **ADMIN**: CRUD de categorías, ingredientes, productos, usuarios y asignación de roles.
- **STOCK**: ajustar stock y disponibilidad de productos e ingredientes. Actualizaciones en tiempo real vía WebSocket.
- **PEDIDOS (Cajero)**: vista kanban para avanzar estados de pedidos. Actualizaciones optimistas + WebSocket en tiempo real.
- Dashboard con resumen.

### Store (puerto 5174)
- Catálogo público con filtros por categoría, disponibilidad, precio y búsqueda.
- Carrito persistido en `localStorage`.
- Registro y login de clientes.
- Direcciones de entrega con CRUD y dirección principal.
- Checkout: selector de dirección, forma de pago (Mercado Pago / Efectivo / Transferencia).
- Redirección a Mercado Pago Checkout Pro y vuelta al pedido con estado del pago.
- "Mis pedidos": historial de pedidos con estado en tiempo real vía WebSocket.

---

## Patrones arquitectónicos

| Patrón | Implementación |
|---|---|
| Unit of Work | `backend/uow/unit_of_work.py`. Único lugar que ejecuta commit/rollback. |
| Repository | `BaseRepository[T]` genérico + repos específicos. Soft delete y eager loading transparentes. |
| Service Layer | Lógica de negocio en `backend/services/`. Routers solo orquestan. |
| Soft Delete | Campo `deleted_at` en todas las entidades de negocio. |
| Snapshot Pattern | `DetallePedido` copia nombre y precio al crear el pedido. |
| Audit Trail Append-Only | `HistorialEstadoPedidoRepository` solo expone `add()` y `list_by_pedido()`. |
| Máquina de Estados | Validada en `PedidoService._validate_transition`, nunca en el router. |

Flujo obligatorio en cada mutación: **Router → Service → UnitOfWork → Repository**

---

## Tests

```powershell
# Crear la base de test (una sola vez)
# En psql o pgAdmin:
# CREATE DATABASE parcial_db_test;

cd backend
.\.venv\Scripts\activate
cd ..
python -m pytest tests/ -v
```

111 tests cubriendo auth, categorías, direcciones, ingredientes, middleware, pedidos y productos.

---

## Notas

- La base se crea automáticamente al arrancar (`SQLModel.metadata.create_all`). Para resetear, droppear la base desde pgAdmin y volver a arrancar.
- Si venís de una versión anterior del proyecto con datos viejos, dropeá y recreá la base porque cambió el schema.
- Los WebSockets del admin se conectan automáticamente al loguearse. El canal del pedido del cliente se conecta al entrar en "Mis pedidos > detalle".
