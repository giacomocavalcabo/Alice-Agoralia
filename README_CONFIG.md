# Agoralia - Sistema Centralizzato Config

Questo progetto contiene tutto il sistema centralizzato per gestire configurazioni, prezzi, traduzioni e monitoraggio.

## Struttura

```
Alice-Agoralia/
├── services/
│   └── config/              # Microservizio FastAPI per config centralizzate
│       ├── main.py          # FastAPI app
│       ├── models.py        # Modelli DB (pricing, translations, finance)
│       ├── routes/          # Endpoint API
│       └── alembic/         # Migrazioni DB
│
├── src/
│   └── app/
│       └── admin/           # Dashboard admin Next.js
│           ├── page.tsx     # Dashboard principale
│           ├── pricing/      # Editor prezzi dinamici
│           ├── finance/     # Revenue + expenses
│           ├── calls/       # Chiamate attive realtime
│           └── i18n/        # Gestione traduzioni (esistente)
│
└── data/
    └── pricing.json         # Prezzi attuali (saranno migrati al servizio config)
```

## Setup Completo

### 1. Config Service (FastAPI)

```bash
cd services/config

# Setup Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configura .env
cp .env.example .env
# Aggiungi DATABASE_URL e REDIS_URL da Railway

# Migrazioni DB
alembic upgrade head

# Run locale
uvicorn main:app --reload --port 8000
```

### 2. Dashboard (Next.js)

```bash
# Install dependencies (se non già fatto)
npm install

# Configura .env.local
NEXT_PUBLIC_CONFIG_API_URL=http://localhost:8000
CONFIG_API_ADMIN_KEY=your-admin-key-here

# Run locale
npm run dev
```

### 3. Deploy

**Config Service su Railway:**
1. Crea nuovo servizio nel progetto Railway
2. Collega repo GitHub
3. Railway auto-rileva `services/config/railway.json`
4. Aggiungi env vars (DATABASE_URL, REDIS_URL, etc.)

**Dashboard su Vercel:**
1. Collega repo GitHub a Vercel
2. Aggiungi env vars:
   - `NEXT_PUBLIC_CONFIG_API_URL` (URL del servizio Railway)
   - `CONFIG_API_ADMIN_KEY`

## Flusso di Lavoro

1. **Modifica Prezzi**: Dashboard `/admin/pricing` → Salva → Config Service aggiorna DB → Cache invalidata → Sito/app vedono nuovi prezzi

2. **Modifica Traduzioni**: Dashboard `/admin/i18n` → Salva → Config Service aggiorna DB → Cache invalidata → Sito/app vedono nuove traduzioni

3. **Monitoraggio Finance**: Backend Railway invia webhook a Config Service → Dashboard mostra revenue/expenses

4. **Chiamate Realtime**: Backend Railway pubblica eventi Redis → Config Service traccia → Dashboard mostra chiamate attive

## Prossimi Passi

1. ✅ Microservizio config creato
2. ✅ Dashboard admin integrata
3. ⏳ Modificare Agoralia.site per usare API `/pricing`
4. ⏳ Modificare Agoralia core per usare API `/pricing` e `/i18n`
5. ⏳ Configurare webhook Stripe/dLocal per finance tracking
6. ⏳ Integrare Redis pub/sub per chiamate realtime
