# Guida Integrazione API Centralizzate

Questo documento spiega come i progetti Agoralia e Sito Agoralia sono stati integrati con il sistema centralizzato di configurazione.

## Modifiche Implementate

### ✅ Sito Agoralia (`/Users/macbook/Desktop/Sito Agoralia/`)

**File modificati:**
- `src/lib/pricing.ts` - Nuovo client API per fetchare prezzi dinamici
- `src/app/[locale]/pricing/PricingPageClient.tsx` - Modificato per usare API invece di DEFAULT_PRICING hardcoded

**Come funziona:**
1. Il componente `PricingPageClient` ora chiama `getPricing()` che fetcha dall'API centralizzata
2. Se l'API non è disponibile, usa un fallback ai prezzi di default
3. I prezzi vengono cacheati per 5 minuti (Next.js revalidate)
4. La valuta viene determinata automaticamente dal paese basato sulla locale

**Setup richiesto:**
Aggiungi al `.env.local`:
```bash
NEXT_PUBLIC_CONFIG_API_URL=https://config.agoralia.com  # o URL Railway
```

### ⏳ Agoralia Backend (`/Users/macbook/Desktop/Agoralia/`)

**Stato:** Non ancora modificato

**Nota:** Il file `backend/services/pricing.py` gestisce i costi dei modelli (voice engines, LLM, etc.), non i piani di abbonamento. Questo non necessita integrazione con l'API centralizzata perché è pricing interno per calcolare costi operativi.

**Se necessario in futuro:**
- Creare endpoint nel backend che chiama l'API centralizzata per ottenere prezzi dei piani
- Usare questi prezzi per validare subscription tiers degli utenti

## Architettura

```
┌─────────────────────┐
│  Sito Agoralia      │
│  (Next.js/Vercel)   │
└──────────┬──────────┘
            │
            │ GET /pricing?country=IT
            ▼
┌─────────────────────┐
│  Config Service      │
│  (FastAPI/Railway)  │
└──────────┬──────────┘
            │
            │ Query DB + Cache Redis
            ▼
┌─────────────────────┐
│  PostgreSQL          │
│  (Railway)          │
└─────────────────────┘
```

## Testing

### Test Locale

1. **Avvia Config Service:**
```bash
cd Alice-Agoralia/services/config
uvicorn main:app --reload --port 8000
```

2. **Test API:**
```bash
curl http://localhost:8000/pricing?country=IT
```

3. **Avvia Sito Agoralia:**
```bash
cd "Sito Agoralia"
NEXT_PUBLIC_CONFIG_API_URL=http://localhost:8000 npm run dev
```

4. **Verifica:** Visita `http://localhost:3000/it/pricing` e controlla che i prezzi vengano fetchati dall'API

### Test Produzione

1. Deploy Config Service su Railway
2. Aggiungi `NEXT_PUBLIC_CONFIG_API_URL` alle env vars di Vercel
3. Redeploy Sito Agoralia
4. Verifica che i prezzi siano dinamici

## Prossimi Passi

1. ✅ Integrazione Sito Agoralia completata
2. ⏳ Verificare se Agoralia backend ha bisogno di integrazione (probabilmente no)
3. ⏳ Aggiungere detection IP client-side per prezzi automatici per paese
4. ⏳ Implementare versioning check (frontend controlla versione e ricarica se diversa)

## Troubleshooting

**Problema:** Prezzi non si aggiornano
- Verifica che `NEXT_PUBLIC_CONFIG_API_URL` sia configurato correttamente
- Controlla che il Config Service sia raggiungibile
- Verifica i log del browser per errori di fetch

**Problema:** Prezzi sempre di default
- L'API potrebbe non essere raggiungibile
- Controlla CORS settings nel Config Service
- Verifica che il database abbia dati di pricing
