# Deploy Config Service su Vercel

Guida per deployare il Config Service su Vercel e collegarlo al database PostgreSQL di Railway.

## Prerequisiti

1. Account Vercel
2. Accesso al progetto Railway "Agoralia" con database PostgreSQL
3. GitHub repo collegato

## Step 1: Ottieni DATABASE_URL da Railway

1. Vai su [Railway Dashboard](https://railway.app)
2. Apri il progetto **Agoralia**
3. Trova il servizio **PostgreSQL**
4. Vai su **Variables** tab
5. Copia il valore di `DATABASE_URL` (o `PGDATABASE`, `PGHOST`, etc.)

**Formato tipico:**
```
postgresql://postgres:password@host.railway.app:5432/railway
```

## Step 2: Crea Redis su Railway (se non esiste)

1. Nel progetto Railway Agoralia
2. Clicca **+ New** → **Database** → **Redis**
3. Una volta creato, vai su **Variables** tab
4. Copia `REDIS_URL`

## Step 3: Crea Progetto Vercel

### Opzione A: Via Dashboard Vercel

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Clicca **Add New** → **Project**
3. Importa il repo GitHub `Alice-Agoralia`
4. Configura:
   - **Root Directory**: `services/config`
   - **Framework Preset**: Other
   - **Build Command**: (lascia vuoto o `pip install -r requirements.txt`)
   - **Output Directory**: (lascia vuoto)

### Opzione B: Via CLI

```bash
cd services/config
vercel login
vercel link  # Collega a progetto esistente o crea nuovo
```

## Step 4: Configura Environment Variables

Nel progetto Vercel, vai su **Settings** → **Environment Variables** e aggiungi:

### Variabili Richieste

```bash
# Database (da Railway PostgreSQL)
DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway

# Redis (da Railway Redis)
REDIS_URL=redis://default:password@host.railway.app:6379

# JWT Secret (usa stesso del backend Agoralia)
JWT_SECRET=your-jwt-secret-from-agoralia-backend

# Admin API Key (genera una chiave sicura)
ADMIN_API_KEY=your-secure-admin-api-key-here

# Environment
ENVIRONMENT=production
```

### Come ottenere JWT_SECRET dal backend Agoralia

1. Vai su Railway → Progetto Agoralia → Backend service
2. Vai su **Variables**
3. Cerca `JWT_SECRET` o `SECRET_KEY`
4. Copia il valore (o usa lo stesso se vuoi condivisione)

## Step 5: Deploy

### Via Dashboard
1. Vai su **Deployments**
2. Clicca **Redeploy** dopo aver aggiunto le env vars

### Via CLI
```bash
vercel --prod
```

## Step 6: Verifica Deploy

1. Vai su **Deployments** in Vercel
2. Clicca sul deployment più recente
3. Copia l'URL (es: `config-service.vercel.app`)
4. Testa:
   ```bash
   curl https://config-service.vercel.app/health
   ```

Dovresti vedere:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

## Step 7: Esegui Migrazioni Database

Le migrazioni Alembic devono essere eseguite manualmente la prima volta:

### Opzione A: Via Railway CLI

```bash
# Installa Railway CLI se non ce l'hai
npm i -g @railway/cli

# Connettiti al progetto
railway link

# Connettiti al database PostgreSQL
railway connect postgres

# In un altro terminale, esegui migrazioni
cd services/config
export DATABASE_URL="postgresql://..." # dalla Railway
alembic upgrade head
```

### Opzione B: Via Script Locale

```bash
cd services/config

# Configura DATABASE_URL
export DATABASE_URL="postgresql://..." # dalla Railway

# Esegui migrazioni
alembic upgrade head
```

## Step 8: Configura CORS

Assicurati che il Config Service permetta richieste dal dominio Vercel:

Il file `config.py` già include:
- `https://agoralia.com`
- `https://www.agoralia.com`
- `https://app.agoralia.com`

Se usi un dominio Vercel custom, aggiungilo a `cors_origins` in `config.py`.

## Step 9: Aggiorna Dashboard

Nella dashboard (`src/app/admin/`), aggiorna `.env.local`:

```bash
NEXT_PUBLIC_CONFIG_API_URL=https://config-service.vercel.app
CONFIG_API_ADMIN_KEY=your-admin-api-key-here
```

## Troubleshooting

### Errore: "Database connection failed"

- Verifica che `DATABASE_URL` sia corretto
- Verifica che il database Railway sia accessibile pubblicamente
- Controlla che il database non abbia restrizioni IP (Railway di default permette tutte le connessioni)

### Errore: "Redis connection failed"

- Verifica `REDIS_URL`
- Redis su Railway potrebbe richiedere autenticazione, controlla il formato dell'URL

### Errore: "Module not found"

- Vercel potrebbe non installare tutte le dipendenze
- Aggiungi `requirements.txt` nella root di `services/config`
- Verifica che tutte le dipendenze siano elencate

### Timeout su Vercel

- Vercel ha limiti di timeout per serverless functions (10s per Hobby, 60s per Pro)
- Considera di usare Railway invece di Vercel per questo servizio (FastAPI con connessioni persistenti)

## Note Importanti

⚠️ **Vercel Serverless Limitations:**
- Vercel è ottimizzato per serverless functions
- FastAPI con SQLAlchemy e connessioni persistenti potrebbe avere problemi
- Considera Railway per questo servizio se hai problemi di performance

✅ **Alternativa Consigliata:**
- Deploy su Railway (già configurato con `railway.json`)
- Usa dominio custom o Railway domain
- Più stabile per applicazioni con connessioni DB persistenti

## Prossimi Passi

1. ✅ Deploy completato
2. ✅ Database collegato
3. ⏳ Testa endpoint `/pricing` e `/i18n`
4. ⏳ Configura webhook Stripe/dLocal per finance tracking
5. ⏳ Integra chiamate realtime
