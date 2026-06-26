# FoodStore — Parcial 2 (Fullstack FastAPI + React)

Integrantes:
- Jeremías Bontorno
- Luciano Mas
- Valentino Vernier
Link Video: https://youtu.be/JGA0hneEFPc

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

> **Atajo en Linux**: el script `run.sh` hace todo esto automático (crea la base si no existe, genera `.env`, crea el venv, instala dependencias de backend y frontends, libera los puertos 8000/5173/5174 si están ocupados y abre las 3 tabs en `gnome-terminal`):
> ```bash
> ./run.sh
> ```
> Si no usás `gnome-terminal` o preferís controlarlo a mano, seguí los pasos manuales de abajo.

### 1. PostgreSQL

Creá la base de datos con pgAdmin o con psql:

```sql
CREATE DATABASE parcial_db;
```

Si tu usuario/contraseña no es `postgres/postgres`, modificá `DATABASE_URL` en `backend/.env`.

### 2. Backend

Primero creá el archivo `.env` a partir de la plantilla (una sola vez):

**Windows (PowerShell):**
```powershell
cd backend
copy .env.example .env
```

**Linux / macOS (bash):**
```bash
cd backend
cp .env.example .env
```

Después completá `JWT_SECRET` con un valor generado (no dejes el placeholder del `.env.example`):
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```
Pegá el resultado en `JWT_SECRET=` dentro de `backend/.env`. Y si vas a usar el checkout, completá también las variables de Mercado Pago (ver sección de abajo).

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Linux / macOS (bash):**
```bash
python3 -m venv .venv
source .venv/bin/activate
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

**Windows (PowerShell) / Linux / macOS (bash):**
```bash
cd frontend
npm install
npm run dev
```

Disponible en `http://localhost:5173`

### 4. Store (clientes)

```bash
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

- **Windows**: descargá el `.exe` desde el link de arriba.
- **Linux (snap)**: `sudo snap install ngrok`
- **Linux (binario)**:
  ```bash
  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
    && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
    | sudo tee /etc/apt/sources.list.d/ngrok.list \
    && sudo apt update && sudo apt install ngrok
  ```

Creá una cuenta gratuita y autenticá tu token (mismo comando en Windows/Linux/macOS):
```bash
ngrok config add-authtoken <TU_TOKEN>
```

**2. Levantá el backend** en el puerto 8000 (paso 2 de arriba).

**3. Abrí ngrok** en una terminal aparte:
```bash
ngrok http 8000
```
Ngrok te mostrará algo como:
```
Forwarding  https://abcd1234.ngrok-free.app -> http://localhost:8000
```

**4. Configurá las variables en `backend/.env`:**
```env
# Mercado Pago — usá las "Credenciales de prueba" (sandbox) de tu panel de developers,
# NO las de producción. Las dos pueden empezar con APP_USR-, fijate en qué sección del
# panel las copiaste. Nunca las compartas/pegues en chats o commits.
MP_ACCESS_TOKEN=APP_USR-...
MP_PUBLIC_KEY=APP_USR-...
MP_SANDBOX=True

# URL del frontend store (back_urls de MP)
MP_STORE_URL=http://localhost:5174

# URL pública del backend
MP_STORE_NGROK_URL=https://abcd1234.ngrok-free.app

# URL pública del backend + el path del endpoint de webhook (backend/routers/pagos.py: @router.post("/webhook"))
# OJO: el path /api/v1/pagos/webhook es OBLIGATORIO. Si ponés solo la URL de ngrok sin el path,
# Mercado Pago va a pegarle a la raíz "/" y vas a ver errores 405 Method Not Allowed en los logs del backend.
MP_WEBHOOK_URL=https://abcd1234.ngrok-free.app/api/v1/pagos/webhook
```

> Cada vez que reiniciás ngrok te da una URL distinta (en la cuenta gratuita). Actualizá `MP_WEBHOOK_URL` (manteniendo el path `/api/v1/pagos/webhook`) y reiniciá el backend.

**5. Reiniciá el backend** para que tome las nuevas variables.

**6. Probá el checkout** desde la Store: agregá productos al carrito, completá el checkout con Mercado Pago Sandbox y usá las [tarjetas de prueba de MP](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-test/test-cards).

---

## Variables de entorno (`backend/.env`)

Todas tienen valor por defecto excepto las de Mercado Pago:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/parcial_db

# JWT — generá el secreto con: python3 -c "import secrets; print(secrets.token_hex(32))"
# No dejes el placeholder de abajo, con eso cualquiera puede forjar tokens válidos.
JWT_SECRET=CHANGE_ME_IN_PROD_super_secret_key_32_chars_min
JWT_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Mercado Pago — MP_WEBHOOK_URL debe incluir el path completo: <ngrok>/api/v1/pagos/webhook
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_SANDBOX=True
MP_STORE_URL=http://localhost:5174
MP_STORE_NGROK_URL=
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
- **Costeo automático**: cada insumo tiene `precio_costo` por unidad canónica (kg / L / unidad). El precio de venta del producto se **calcula** como `costo_de_insumos · (1 + margen_de_ganancia%)` (margen configurable por producto). Al cambiar el precio-costo de un insumo se **recalcula automáticamente** el precio de todos los productos que lo usan y se notifica por WebSocket (el catálogo se actualiza sin refrescar).
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
| Repository | `BaseRepository[T]` genérico + repos específicos. Soft delete y eager loading transparentes. **Todas las consultas a la DB viven exclusivamente en esta capa**: services y routers nunca ejecutan `select`/`session.get` directo. |
| Service Layer | Lógica de negocio en `backend/services/`. Routers solo orquestan. |
| Soft Delete | Campo `deleted_at` en todas las entidades de negocio. |
| Snapshot Pattern | `DetallePedido` copia nombre y precio al crear el pedido. |
| Audit Trail Append-Only | `HistorialEstadoPedidoRepository` solo expone `add()` y `list_by_pedido()`. |
| Máquina de Estados | Validada en `PedidoService._validate_transition`, nunca en el router. |

Flujo obligatorio en cada mutación: **Router → Service → UnitOfWork → Repository**

---

## Tests

Crear la base de test una sola vez (en psql o pgAdmin): `CREATE DATABASE parcial_db_test;`

**Windows (PowerShell):**
```powershell
cd backend
.\.venv\Scripts\activate
cd ..
python -m pytest tests/ -v
```

**Linux / macOS (bash):**
```bash
cd backend
source .venv/bin/activate
cd ..
python3 -m pytest tests/ -v
```

111 tests cubriendo auth, categorías, direcciones, ingredientes, middleware, pedidos y productos.

---

## Notas

- La base se crea automáticamente al arrancar (`SQLModel.metadata.create_all`). Para resetear, droppear la base desde pgAdmin y volver a arrancar.
- Si venís de una versión anterior del proyecto con datos viejos, dropeá y recreá la base porque cambió el schema.
- Los WebSockets del admin se conectan automáticamente al loguearse. El canal del pedido del cliente se conecta al entrar en "Mis pedidos > detalle".
