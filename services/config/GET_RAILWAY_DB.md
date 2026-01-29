# Come Ottenere DATABASE_URL da Railway

Guida rapida per ottenere le credenziali del database PostgreSQL dal progetto Railway Agoralia.

## Metodo 1: Via Railway Dashboard (Più Semplice)

1. Vai su [Railway Dashboard](https://railway.app/dashboard)
2. Clicca sul progetto **Agoralia**
3. Trova il servizio **PostgreSQL** (dovrebbe essere già presente)
4. Clicca sul servizio PostgreSQL
5. Vai su **Variables** tab
6. Cerca `DATABASE_URL` o `PGDATABASE`
7. Copia il valore completo

**Formato tipico:**
```
postgresql://postgres:password123@containers-us-west-123.railway.app:5432/railway
```

## Metodo 2: Via Railway CLI

```bash
# Installa Railway CLI se non ce l'hai
npm i -g @railway/cli

# Login
railway login

# Seleziona progetto Agoralia
railway link

# Mostra tutte le variabili
railway variables

# Oppure solo DATABASE_URL
railway variables | grep DATABASE_URL
```

## Metodo 3: Via Railway API

```bash
# Installa jq per parsing JSON
brew install jq  # macOS
# oppure apt-get install jq  # Linux

# Ottieni token API da Railway Settings → Tokens
RAILWAY_TOKEN="your-token-here"
PROJECT_ID="your-project-id"  # Trovalo nell'URL del progetto

# Ottieni DATABASE_URL
curl -H "Authorization: Bearer $RAILWAY_TOKEN" \
  https://api.railway.app/v1/projects/$PROJECT_ID/variables \
  | jq '.variables[] | select(.name == "DATABASE_URL") | .value'
```

## Metodo 4: Connettiti Direttamente

```bash
# Usa Railway CLI per connetterti
railway connect postgres

# Questo aprirà una shell psql connessa al database
# Puoi verificare la connessione con:
\conninfo
```

## Per Redis

Stesso processo, ma cerca il servizio **Redis** invece di PostgreSQL:

1. Railway Dashboard → Progetto Agoralia → Redis
2. Variables tab → `REDIS_URL`

**Formato tipico:**
```
redis://default:password123@containers-us-west-123.railway.app:6379
```

## Importante: Sicurezza

⚠️ **NON committare mai** `DATABASE_URL` o `REDIS_URL` nel codice!

- Usa sempre variabili d'ambiente
- Aggiungi `.env` al `.gitignore`
- Usa Vercel/Railway environment variables per produzione

## Prossimo Step

Una volta ottenuto `DATABASE_URL`:

1. Aggiungilo alle Environment Variables di Vercel
2. Oppure al `.env` locale per sviluppo
3. Testa la connessione con `alembic upgrade head`
