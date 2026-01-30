# Istruzioni Pricing per Sito Agoralia

## Problema Attuale

Il sito ha:
1. Tariffe "per minuto" diverse per piano → **INVENTATE, NON ESISTONO**
2. Cost calculator che mescola subscription + consumo → **CONFUSO**
3. Manca distinzione costi Agoralia vs costi telephony → **MANCANTE**

---

## Come Funziona Realmente

### SUBSCRIPTION (mensile/annuale)
I piani sbloccano **funzionalità e limiti**, NON cambiano il costo per minuto.

| Piano | Prezzo | Cosa Sblocca |
|-------|--------|--------------|
| Free | €0 | 1 agent, 1 lingua, limiti base |
| Core | €149/mese | 5 agent, 3 lingue, priority support |
| Pro | €299/mese | 20 agent, unlimited, analytics |
| Enterprise | Custom | Unlimited, SLA, dedicated support |

### CONSUMO CHIAMATE (pay-as-you-go)
Il costo per minuto è **UGUALE per tutti i piani**. Non dipende dal piano.

```
Costo Agoralia = LLM + Voice + Platform markup
               ≈ 15-25¢/minuto (varia per modello/voce scelti)
               
Questo scala dal CREDITO dell'utente.
```

### COSTI TELEPHONY (separati)
```
Costo telephony = dipende dal provider dell'utente (Telnyx, Twilio, Zadarma, SIP)
                = varia per paese (chiamate nazionali vs internazionali)
                
Questo NON scala da credito Agoralia.
L'utente lo paga direttamente al suo provider.
```

---

## Cosa Modificare nel Sito

### 1. RIMUOVERE tariffe per minuto dai piani

```typescript
// SBAGLIATO - da rimuovere
const DEFAULT_PRICING = {
  free: { perMinute: 0.15 },  // ❌ NON ESISTE
  core: { perMinute: 0.12 },  // ❌ NON ESISTE
  pro: { perMinute: 0.10 },   // ❌ NON ESISTE
};

// CORRETTO - non c'è perMinute
// I piani hanno solo: price.monthly, price.yearly, features, limits
```

### 2. MODIFICARE il Cost Calculator

Il calculator attuale è sbagliato. Ecco come dovrebbe funzionare:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Cost Estimator                                                             │
│  Stima i tuoi costi mensili                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COSTI SUBSCRIPTION                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Piano: [ Core ▼ ]                                                  │   │
│  │  Fatturazione: ○ Mensile  ● Annuale (-15%)                         │   │
│  │                                                                     │   │
│  │  Costo subscription: €149/mese (o €1.490/anno)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  COSTI CHIAMATE (pay-as-you-go)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Minuti stimati al mese: [ 1000 ]                                  │   │
│  │                                                                     │   │
│  │  Lingua chiamate: [ Italiano ▼ ] (opzionale)                       │   │
│  │  └─ Se non selezionata: usa costi RetellAI                         │   │
│  │  └─ Se selezionata: mostra costi in base al provider supportato    │   │
│  │                                                                     │   │
│  │  Costo Agoralia (LLM + Voice + Platform):                          │   │
│  │    ~€0.18/minuto × 1000 min = €180/mese                           │   │
│  │    └─ Questo scala dal tuo credito Agoralia                        │   │
│  │                                                                     │   │
│  │  Costo telephony (provider esterno):                               │   │
│  │    Dipende dal tuo provider (Telnyx, Twilio, etc.)                │   │
│  │    └─ Verifica i costi col tuo provider                           │   │
│  │    └─ NON incluso nel credito Agoralia                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  RIEPILOGO                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Subscription:        €149/mese                                    │   │
│  │  Consumo Agoralia:    ~€180/mese (1000 min)                        │   │
│  │  ────────────────────────────────                                  │   │
│  │  Totale Agoralia:     ~€329/mese                                   │   │
│  │                                                                     │   │
│  │  + Costi telephony (verifica col tuo provider)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⓘ I costi chiamata sono uguali per tutti i piani.                        │
│  ⓘ Il piano sblocca funzionalità e limiti, non cambia il costo/minuto.   │
│  ⓘ I costi telephony dipendono dal tuo provider e non sono inclusi.      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. API da usare per i costi

Il sito deve chiamare Alice per i costi:

```typescript
// Costi subscription (già funziona)
GET /api/pricing?country=IT
// Risposta: { plans: [...], currency, tier, ... }

// Costi consumo (DA AGGIUNGERE in Alice se non esiste)
GET /api/pricing/consumption?language=it-IT
// Risposta: {
//   agoralia_cost_per_minute_cents: 18,  // Costo Agoralia medio
//   provider: "retell",  // o "vapi" se lingua richiede vapi
//   breakdown: {
//     llm: 6,
//     voice: 7,
//     platform: 5
//   },
//   note: "I costi telephony dipendono dal tuo provider"
// }
```

### 4. Logica per lingua selezionata

```typescript
// Se utente NON seleziona lingua:
// → Mostra costi RetellAI (default)

// Se utente seleziona lingua:
// → Controlla se lingua supportata da RetellAI
//   → Se sì: mostra costi RetellAI
//   → Se no (richiede Vapi/Azure): mostra costi Vapi (5¢ base + variabile)
```

Lingue RetellAI (31 codici): vedi `catalogues/languages/voice-retell-core.json`
Lingue Vapi/Azure (150+ lingue): vedi `catalogues/voices/azure-vapi-voices.json`

### 5. Chiavi i18n da aggiungere

```json
// en-gb.json
{
  "pricing": {
    "calculator": {
      "title": "Cost Estimator",
      "description": "Estimate your monthly costs",
      
      "subscription": {
        "title": "Subscription Costs",
        "plan": "Plan",
        "billing": "Billing",
        "monthly": "Monthly",
        "annual": "Annual",
        "annualDiscount": "Save 15%"
      },
      
      "consumption": {
        "title": "Call Costs (pay-as-you-go)",
        "minutesPerMonth": "Estimated minutes per month",
        "language": "Call language",
        "languageHint": "Optional - affects which voice provider is used",
        "agoraliaCost": "Agoralia cost (LLM + Voice + Platform)",
        "agoraliaCostNote": "This is deducted from your Agoralia credit",
        "telephonyCost": "Telephony cost (external provider)",
        "telephonyCostNote": "Check with your provider (Telnyx, Twilio, etc.)",
        "notIncluded": "Not included in Agoralia credit"
      },
      
      "summary": {
        "title": "Summary",
        "subscription": "Subscription",
        "consumption": "Agoralia consumption",
        "total": "Total Agoralia",
        "plusTelephony": "+ Telephony costs (check with your provider)"
      },
      
      "notes": {
        "sameCost": "Call costs are the same for all plans.",
        "plansUnlock": "Plans unlock features and limits, not per-minute rates.",
        "telephonySeparate": "Telephony costs depend on your provider and are not included."
      }
    }
  }
}
```

```json
// it-it.json
{
  "pricing": {
    "calculator": {
      "title": "Calcolatore Costi",
      "description": "Stima i tuoi costi mensili",
      
      "subscription": {
        "title": "Costi Subscription",
        "plan": "Piano",
        "billing": "Fatturazione",
        "monthly": "Mensile",
        "annual": "Annuale",
        "annualDiscount": "Risparmia 15%"
      },
      
      "consumption": {
        "title": "Costi Chiamate (pay-as-you-go)",
        "minutesPerMonth": "Minuti stimati al mese",
        "language": "Lingua chiamate",
        "languageHint": "Opzionale - influenza quale provider voce viene usato",
        "agoraliaCost": "Costo Agoralia (LLM + Voice + Platform)",
        "agoraliaCostNote": "Questo viene scalato dal tuo credito Agoralia",
        "telephonyCost": "Costo telephony (provider esterno)",
        "telephonyCostNote": "Verifica col tuo provider (Telnyx, Twilio, etc.)",
        "notIncluded": "Non incluso nel credito Agoralia"
      },
      
      "summary": {
        "title": "Riepilogo",
        "subscription": "Subscription",
        "consumption": "Consumo Agoralia",
        "total": "Totale Agoralia",
        "plusTelephony": "+ Costi telephony (verifica col tuo provider)"
      },
      
      "notes": {
        "sameCost": "I costi chiamata sono uguali per tutti i piani.",
        "plansUnlock": "I piani sbloccano funzionalità e limiti, non le tariffe al minuto.",
        "telephonySeparate": "I costi telephony dipendono dal tuo provider e non sono inclusi."
      }
    }
  }
}
```

---

## Riepilogo Modifiche

| Cosa | Azione |
|------|--------|
| `perMinute` nei piani | **RIMUOVERE** - non esiste |
| Cost calculator | **RIFARE** - separare subscription + consumo + telephony |
| Card Enterprise | **AGGIUNGERE** - con CTA "Contact Sales" |
| Chiavi i18n legal | **AGGIUNGERE** |
| Chiavi i18n calculator | **AGGIUNGERE** (vedi sopra) |
| Nota "piani vs consumo" | **AGGIUNGERE** sotto toggle |
| Tabella confronto | **AGGIUNGERE** colonna Enterprise |

---

## API Alice - Endpoint Disponibili

### 1. Pricing Plans (già esistente)

```typescript
GET https://alice.agoralia.com/api/pricing?country=IT

Response:
{
  "plans": [...],
  "currency": "EUR",
  "currency_symbol": "€",
  "tier": "tier2",
  // ...
}
```

### 2. Consumption Pricing (aggiornato)

```typescript
GET https://alice.agoralia.com/api/pricing/consumption
GET https://alice.agoralia.com/api/pricing/consumption?language=it-IT
GET https://alice.agoralia.com/api/pricing/consumption?language=it-IT&llm=gpt-4o&tts=elevenlabs

Query Parameters:
- language: ISO locale (es. it-IT) - determina se serve Retell o Vapi
- llm: ID modello LLM (default: gpt-4o-mini)
- tts: ID provider TTS (default: deepgram)

Response:
{
  "agoralia_cost_per_minute_cents": 20.4,
  "provider": "retell",
  "language": "it-IT",
  "llm": "gpt-4o-mini",
  "tts": "deepgram",
  "breakdown": {
    "llm_cents": 7,
    "llm_multiplier": 1.0,
    "voice_cents": 4,
    "platform_cents": 0,
    "markup_percent": 20
  },
  "config_version": "1.0.0",
  "note": "Telephony costs depend on your provider and are NOT included."
}
```

### 3. Consumption Options (nuovo)

```typescript
GET https://alice.agoralia.com/api/pricing/consumption/options

Response:
{
  "llms": [
    { "id": "gpt-4o-mini", "name": "GPT-4o Mini (Default)", "cost_multiplier": 1.0, "default": true },
    { "id": "gpt-4o", "name": "GPT-4o", "cost_multiplier": 1.5 },
    { "id": "gpt-4-turbo", "name": "GPT-4 Turbo", "cost_multiplier": 1.8 },
    { "id": "claude-3-haiku", "name": "Claude 3 Haiku", "cost_multiplier": 1.0 },
    { "id": "claude-3-sonnet", "name": "Claude 3.5 Sonnet", "cost_multiplier": 1.6 },
    { "id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "cost_multiplier": 0.9 },
    { "id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "cost_multiplier": 1.4 }
  ],
  "tts": [
    { "id": "deepgram", "name": "Deepgram (Default)", "cost_cents_per_minute": 4, "default": true },
    { "id": "elevenlabs", "name": "ElevenLabs", "cost_cents_per_minute": 12 },
    { "id": "playht", "name": "PlayHT", "cost_cents_per_minute": 8 },
    { "id": "azure", "name": "Azure TTS", "cost_cents_per_minute": 6 },
    { "id": "openai", "name": "OpenAI TTS", "cost_cents_per_minute": 10 },
    { "id": "cartesia", "name": "Cartesia", "cost_cents_per_minute": 7 }
  ],
  "version": "1.0.0"
}
```

---

## Caching

Tutti gli endpoint Alice hanno **cache Vercel Edge di 5 minuti**:

```
Cache-Control: s-maxage=300, stale-while-revalidate=300
```

Questo significa:
- Le risposte sono cachate per 5 minuti sulla CDN Vercel
- Dopo 5 minuti, viene servita la cache stale mentre si rigenera in background
- Il Sito/App Agoralia non deve implementare cache lato client

---

## Implementazione nel Sito Agoralia

### 1. Route API Proxy (consigliato)

Crea route Next.js che fanno da proxy ad Alice, così puoi:
- Nascondere l'URL di Alice
- Aggiungere logging
- Gestire errori in modo centralizzato

```typescript
// src/app/api/pricing/route.ts (Sito Agoralia)
import { NextRequest, NextResponse } from 'next/server';

const ALICE_URL = process.env.ALICE_API_URL || 'https://alice.agoralia.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country') || 'IT';
  
  const res = await fetch(`${ALICE_URL}/api/pricing?country=${country}`);
  const data = await res.json();
  
  return NextResponse.json(data, {
    headers: {
      // Rispetta la cache di Alice
      'Cache-Control': 's-maxage=300, stale-while-revalidate=300',
    }
  });
}
```

### 2. Dropdown LLM/TTS nel Calculator

```typescript
// Carica opzioni una volta
const [options, setOptions] = useState({ llms: [], tts: [] });
const [llmId, setLlmId] = useState('gpt-4o-mini');
const [ttsId, setTtsId] = useState('deepgram');

useEffect(() => {
  fetch('/api/pricing/consumption/options')
    .then(r => r.json())
    .then(data => {
      setOptions(data);
      // Imposta default
      const defaultLlm = data.llms.find(l => l.default);
      const defaultTts = data.tts.find(t => t.default);
      if (defaultLlm) setLlmId(defaultLlm.id);
      if (defaultTts) setTtsId(defaultTts.id);
    });
}, []);

// Ricalcola costi quando cambiano le selezioni
useEffect(() => {
  if (!llmId || !ttsId) return;
  
  const params = new URLSearchParams({ llm: llmId, tts: ttsId });
  if (selectedLanguage) params.set('language', selectedLanguage);
  
  fetch(`/api/pricing/consumption?${params}`)
    .then(r => r.json())
    .then(data => setCostPerMinute(data.agoralia_cost_per_minute_cents));
}, [llmId, ttsId, selectedLanguage]);
```

### 3. Chiavi i18n aggiuntive

```json
// Aggiungi a en-gb.json
{
  "pricing": {
    "calculator": {
      "consumption": {
        "llm": "AI Model",
        "llmHint": "Choose the AI model for conversations",
        "tts": "Voice Provider",
        "ttsHint": "Choose the text-to-speech provider"
      }
    }
  }
}

// Aggiungi a it-it.json
{
  "pricing": {
    "calculator": {
      "consumption": {
        "llm": "Modello AI",
        "llmHint": "Scegli il modello AI per le conversazioni",
        "tts": "Provider Voce",
        "ttsHint": "Scegli il provider text-to-speech"
      }
    }
  }
}
```

---

## Test di Integrazione

Prima di deployare, eseguire questi test per verificare che l'integrazione con Alice funzioni.

### Test 1: Verifica endpoint Alice (manuale)

Apri questi URL nel browser o con curl per verificare che Alice risponda:

```bash
# 1. Pricing plans
curl "https://alice.agoralia.com/api/pricing?country=IT"
# ✅ Deve ritornare: { plans: [...], currency: "EUR", tier: "tier2", ... }

# 2. Consumption options
curl "https://alice.agoralia.com/api/pricing/consumption/options"
# ✅ Deve ritornare: { llms: [...], tts: [...] }

# 3. Consumption pricing (default)
curl "https://alice.agoralia.com/api/pricing/consumption"
# ✅ Deve ritornare: { agoralia_cost_per_minute_cents: ~20, llm: "gpt-4o-mini", tts: "deepgram", ... }

# 4. Consumption pricing (con parametri)
curl "https://alice.agoralia.com/api/pricing/consumption?language=it-IT&llm=gpt-4o&tts=elevenlabs"
# ✅ Deve ritornare: { agoralia_cost_per_minute_cents: ~38, llm: "gpt-4o", tts: "elevenlabs", ... }

# 5. Test cache (esegui 2 volte, la seconda deve essere più veloce)
time curl "https://alice.agoralia.com/api/pricing/consumption/options"
# Prima: ~200-500ms
# Seconda: ~10-50ms (servita da cache Vercel)
```

### Test 2: Verifica header cache

```bash
curl -I "https://alice.agoralia.com/api/pricing/consumption/options"
# ✅ Deve includere: Cache-Control: s-maxage=300, stale-while-revalidate=300
```

### Test 3: Checklist funzionale nel Sito

| # | Test | Come verificare | Risultato atteso |
|---|------|-----------------|------------------|
| 1 | **Pricing plans caricati** | Apri pagina pricing | Vedi i 4 piani (Free, Core, Pro, Enterprise) con prezzi corretti |
| 2 | **Currency per paese** | Cambia paese (IT→US→GB) | Prezzi cambiano valuta (€→$→£) |
| 3 | **Tier per paese** | Confronta IT vs US | US ha prezzi tier1 (più alti), IT tier2 |
| 4 | **Dropdown LLM appare** | Apri calculator | Vedi dropdown con GPT-4o Mini, GPT-4o, Claude, etc. |
| 5 | **Dropdown TTS appare** | Apri calculator | Vedi dropdown con Deepgram, ElevenLabs, etc. |
| 6 | **Costo cambia con LLM** | Cambia LLM da Mini a GPT-4o | Costo/minuto aumenta (~50%) |
| 7 | **Costo cambia con TTS** | Cambia TTS da Deepgram a ElevenLabs | Costo/minuto aumenta (~3×) |
| 8 | **Costo cambia con lingua** | Seleziona lingua non-Retell (es. Greco) | Provider cambia a "vapi", costo aumenta |
| 9 | **Default selezionati** | Ricarica pagina | LLM=GPT-4o Mini, TTS=Deepgram preselezionati |
| 10 | **Totale calculator** | Inserisci 1000 minuti | Totale = Subscription + (costo/min × 1000) |

### Test 4: Test automatizzato (opzionale)

Aggiungi questo test nel Sito per CI/CD:

```typescript
// __tests__/pricing-integration.test.ts
import { describe, it, expect } from 'vitest';

const ALICE_URL = process.env.ALICE_API_URL || 'https://alice.agoralia.com';

describe('Alice Pricing Integration', () => {
  
  it('should fetch pricing plans', async () => {
    const res = await fetch(`${ALICE_URL}/api/pricing?country=IT`);
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.plans).toBeInstanceOf(Array);
    expect(data.plans.length).toBeGreaterThan(0);
    expect(data.currency).toBe('EUR');
    expect(data.tier).toBe('tier2');
  });

  it('should fetch consumption options', async () => {
    const res = await fetch(`${ALICE_URL}/api/pricing/consumption/options`);
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.llms).toBeInstanceOf(Array);
    expect(data.tts).toBeInstanceOf(Array);
    expect(data.llms.length).toBeGreaterThan(0);
    expect(data.tts.length).toBeGreaterThan(0);
    
    // Check defaults exist
    expect(data.llms.some(l => l.default)).toBe(true);
    expect(data.tts.some(t => t.default)).toBe(true);
  });

  it('should calculate consumption with parameters', async () => {
    const res = await fetch(
      `${ALICE_URL}/api/pricing/consumption?language=it-IT&llm=gpt-4o&tts=elevenlabs`
    );
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.agoralia_cost_per_minute_cents).toBeGreaterThan(0);
    expect(data.llm).toBe('gpt-4o');
    expect(data.tts).toBe('elevenlabs');
    expect(data.provider).toBe('retell'); // it-IT is supported by Retell
  });

  it('should use Vapi for unsupported languages', async () => {
    const res = await fetch(
      `${ALICE_URL}/api/pricing/consumption?language=el-GR` // Greek
    );
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.provider).toBe('vapi');
    // Vapi should have platform cost
    expect(data.breakdown.platform_cents).toBeGreaterThan(0);
  });

  it('should have cache headers', async () => {
    const res = await fetch(`${ALICE_URL}/api/pricing/consumption/options`);
    const cacheControl = res.headers.get('cache-control');
    
    expect(cacheControl).toContain('s-maxage=300');
    expect(cacheControl).toContain('stale-while-revalidate');
  });
});
```

### Test 5: Verifica errori e fallback

| Scenario | Come simulare | Comportamento atteso |
|----------|---------------|---------------------|
| Alice down | Blocca temporaneamente Alice | Sito mostra messaggio errore o dati cached |
| LLM sconosciuto | `?llm=invalid-model` | Usa multiplier default (1.0) |
| TTS sconosciuto | `?tts=invalid-provider` | Usa costo voice fallback |
| Paese sconosciuto | `?country=XX` | Usa EUR e tier3 |

### Test 6: Performance

```bash
# Misura latenza media (10 richieste)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    "https://alice.agoralia.com/api/pricing/consumption/options"
done | awk '{sum+=$1} END {print "Average: " sum/NR "s"}'

# ✅ Atteso: <100ms (dopo prima richiesta)
```

---

## Troubleshooting

| Problema | Causa probabile | Soluzione |
|----------|-----------------|-----------|
| CORS error | Browser blocca richiesta | Verifica che Alice abbia `Access-Control-Allow-Origin: *` |
| 500 error da Alice | Config mancante o errore server | Controlla logs Alice su Vercel |
| Prezzi non aggiornati | Cache Vercel | Aspetta 5 minuti o purga cache da dashboard Vercel |
| Dropdown vuoti | Endpoint options non risponde | Verifica `/api/pricing/consumption/options` |
| Costo sempre uguale | Parametri non passati | Verifica query string include `llm` e `tts` |
