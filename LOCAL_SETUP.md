# Setup Sviluppo Locale

Guida per runnare il progetto in localhost.

## Prerequisiti

- Node.js 20+
- Python 3.11+ (per Config Service)
- PostgreSQL (opzionale, puoi usare Railway)
- Redis (opzionale, puoi usare Railway)

## Setup Config Service (FastAPI)

```bash
cd services/config

# Crea virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configura .env
# Il file .env è già creato con le credenziali Railway
# ⚠️ NOTA: DATABASE_URL usa URL interno Railway che non funziona da localhost
# Ottieni l'URL pubblico da Railway Dashboard → PostgreSQL → Connect → Public Network
# Sostituisci postgres.railway.internal con l'host pubblico

# Run migrations (se necessario)
alembic upgrade head

# Start server
uvicorn main:app --reload --port 8000
```

Il servizio sarà disponibile su: http://localhost:8000

## Setup Dashboard Next.js

```bash
# Root del progetto
cd /Users/macbook/Desktop/Alice-Agoralia

# Install dependencies
npm install

# Il file .env.local è già creato
# Modifica se necessario:
# - NEXT_PUBLIC_CONFIG_API_URL=http://localhost:8000 (per usare Config Service locale)
# - CONFIG_API_ADMIN_KEY=... (chiave admin)

# Start dev server
npm run dev
```

La dashboard sarà disponibile su: http://localhost:3000

## Variabili d'Ambiente

### Config Service (.env in services/config/)

- `DATABASE_URL` - PostgreSQL connection string (usa URL pubblico Railway per localhost)
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret per JWT tokens
- `ADMIN_API_KEY` - Chiave per autenticazione admin
- `ENVIRONMENT` - `development` per locale

### Dashboard Next.js (.env.local)

- `NEXT_PUBLIC_CONFIG_API_URL` - URL del Config Service (localhost:8000 o Vercel)
- `CONFIG_API_ADMIN_KEY` - Chiave admin per chiamate API

## Troubleshooting

### Errore: "Cannot find module scripts/i18n-sync.mjs"

✅ Risolto: Il file è stato creato come placeholder.

### Errore: Database connection failed

- Verifica che DATABASE_URL usi l'URL pubblico Railway (non `postgres.railway.internal`)
- Controlla che il database Railway permetta connessioni esterne

### Errore: Redis connection failed

- Verifica REDIS_URL
- Redis Railway dovrebbe essere accessibile pubblicamente

## Test

### Test Config Service

```bash
curl http://localhost:8000/health
```

Dovresti vedere:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### Test Dashboard

Visita http://localhost:3000/admin e verifica che le pagine carichino correttamente.
