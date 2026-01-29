# Agoralia Config Service

Microservizio centralizzato per gestire:
- Prezzi dinamici con geolocalizzazione
- Traduzioni i18n con versioning
- Monitoraggio finanziario (revenue + expenses)
- Chiamate in corso realtime

## Stack

- FastAPI (Python 3.11+)
- PostgreSQL (Railway)
- Redis (Railway) - cache + pub/sub
- Alembic per migrazioni

## Setup Locale

```bash
cd services/config

# Crea virtual environment
python3 -m venv .venv
source .venv/bin/activate  # su Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env con:
# - DATABASE_URL (da Railway PostgreSQL)
# - REDIS_URL (da Railway Redis)
# - JWT_SECRET (stesso del backend principale)
# - ADMIN_API_KEY (chiave per autenticazione admin)

# Run migrations
alembic upgrade head

# Start dev server
uvicorn main:app --reload --port 8000
```

## Deploy

### Opzione 1: Deploy su Vercel (Consigliato per sempre attivo)

Vedi [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) per istruzioni complete.

**Quick start:**
1. Crea progetto Vercel, root directory: `services/config`
2. Ottieni `DATABASE_URL` da Railway (vedi [GET_RAILWAY_DB.md](./GET_RAILWAY_DB.md))
3. Aggiungi env vars in Vercel:
   - `DATABASE_URL` (da Railway PostgreSQL)
   - `REDIS_URL` (da Railway Redis)
   - `JWT_SECRET`, `ADMIN_API_KEY`, `ENVIRONMENT=production`
4. Deploy e testa `/health`

### Opzione 2: Deploy su Railway

1. Crea nuovo servizio Railway nel progetto Agoralia
2. Collega il repo GitHub
3. Railway rileva automaticamente il `railway.json`
4. Aggiungi variabili ambiente:
   - `DATABASE_URL` (da PostgreSQL service esistente)
   - `REDIS_URL` (da Redis service)
   - `JWT_SECRET`
   - `ADMIN_API_KEY`
   - `ENVIRONMENT=production`

## API Endpoints

- `GET /pricing?country=IT&ip=...` - Prezzi dinamici
- `GET /i18n/{locale}.json` - Traduzioni cached
- `GET /configs/version` - Versione corrente configs
- `POST /pricing/update` - Aggiorna prezzi (admin)
- `POST /i18n/update` - Aggiorna traduzioni (admin)
- `GET /finance/revenue` - Revenue analytics
- `GET /finance/expenses` - Expenses analytics
- `GET /realtime/calls` - Chiamate attive
- `WS /realtime/ws` - WebSocket per chiamate live

## Integrazione con Dashboard

La dashboard Next.js in `src/app/admin/` si connette a questo servizio tramite:
- `NEXT_PUBLIC_CONFIG_API_URL` (env var)
- `CONFIG_API_ADMIN_KEY` (env var)
