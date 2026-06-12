#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
STORE="$ROOT/store"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✔]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✘]${NC} $*"; exit 1; }

# ── 1. Verificar dependencias ─────────────────────────────────────────────────
command -v python3  >/dev/null || die "python3 no encontrado"
command -v node     >/dev/null || die "node no encontrado"
command -v psql     >/dev/null || die "psql no encontrado"
command -v npm      >/dev/null || die "npm no encontrado"

# ── 2. Base de datos ──────────────────────────────────────────────────────────
DB_NAME="parcial_db"
DB_USER="${PGUSER:-postgres}"
DB_PASS="${PGPASSWORD:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

info "Verificando base de datos '$DB_NAME'..."
PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -lqt 2>/dev/null \
    | cut -d \| -f 1 | grep -qw "$DB_NAME" \
    || {
        warn "Base '$DB_NAME' no existe, creándola..."
        PGPASSWORD="$DB_PASS" createdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$DB_NAME" \
            || die "No se pudo crear la base de datos. Revisá usuario/password de PostgreSQL."
        info "Base '$DB_NAME' creada."
    }

# ── 3. Archivo .env ───────────────────────────────────────────────────────────
ENV_FILE="$BACKEND/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    warn ".env no encontrado, copiando desde .env.example..."
    cp "$BACKEND/.env.example" "$ENV_FILE"
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s|CHANGE_ME_super_secret_key_minimo_32_chars|$JWT_SECRET|" "$ENV_FILE"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}|" "$ENV_FILE"
    info ".env creado con JWT_SECRET generado."
else
    info ".env ya existe."
fi

# ── 4. Virtualenv del backend ─────────────────────────────────────────────────
VENV="$BACKEND/.venv"
if [[ ! -d "$VENV" ]]; then
    info "Creando virtualenv..."
    python3 -m venv "$VENV"
fi

info "Instalando dependencias del backend..."
"$VENV/bin/pip" install -q -r "$BACKEND/requirements.txt"
info "Dependencias del backend OK."

# ── 5. Dependencias de los frontends ──────────────────────────────────────────
if [[ ! -d "$FRONTEND/node_modules" ]]; then
    info "Instalando dependencias del admin (frontend)..."
    npm --prefix "$FRONTEND" install --silent
fi

if [[ ! -d "$STORE/node_modules" ]]; then
    info "Instalando dependencias de la store..."
    npm --prefix "$STORE" install --silent
fi

info "Dependencias de frontends OK."

# ── 6. Matar procesos existentes en los puertos ───────────────────────────────
port_kill() {
    local port=$1
    local pid
    pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
        warn "Puerto $port ocupado (PID $pid), cerrando..."
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
}

port_kill 8000
port_kill 5173
port_kill 5174

# ── 7. Abrir terminales ───────────────────────────────────────────────────────
echo ""
info "Abriendo los tres servicios en terminales separadas..."
echo ""

gnome-terminal --window \
    --tab --title="Backend :8000" -- bash -c "cd '$ROOT' && '$VENV/bin/uvicorn' backend.main:app --reload --host 0.0.0.0 --port 8000; exec bash" \
    --tab --title="Admin :5173"   -- bash -c "cd '$FRONTEND' && npm run dev; exec bash" \
    --tab --title="Store :5174"   -- bash -c "cd '$STORE' && npm run dev; exec bash"

echo -e "${GREEN}Listo.${NC} Se abrieron 3 tabs en la terminal:"
echo "  • Backend  → http://localhost:8000  (Swagger: /docs)"
echo "  • Admin    → http://localhost:5173  (admin@admin.com / admin12345)"
echo "  • Store    → http://localhost:5174  (registrate como cliente)"
