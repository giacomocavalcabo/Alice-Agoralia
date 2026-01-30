# Database Schema per Alice Finance

**Da:** Cursor App Agoralia  
**A:** Alice (Sistema Centralizzato Agoralia)  
**Data:** 30 Gennaio 2026  
**Versione:** 1.1 (VAT, Refunds, Country tracking implementati)

---

## Executive Summary

Il sistema Agoralia utilizza un'architettura **multi-provider** (Stripe + dLocal) con un **ledger di crediti** basato su `CostEvent`. 

### Flussi di Entrata
| Tipo | Provider | Tabella | Ledger |
|------|----------|---------|--------|
| **Abbonamenti** | Stripe/dLocal | `BillingTransaction` (purpose=subscription_invoice) | `CostEvent` (component=subscription) |
| **Topup crediti** | Stripe/dLocal | `BillingTransaction` (purpose=topup) | `CostEvent` (component=topup) |
| **Rimborsi** | Stripe/dLocal | `BillingTransaction` (purpose=refund) | `CostEvent` (component=refund) |

### ✅ Implementazioni Completate (v1.1)

| Feature | Stato | Dettagli |
|---------|-------|----------|
| **VAT Tracking** | ✅ Implementato | `tax_amount_cents`, `tax_rate_percent` popolati da Stripe Tax |
| **Country Tracking** | ✅ Implementato | `billing_country` su ogni transazione per reportistica |
| **Refund Handling** | ✅ Implementato | Webhook `charge.refunded` + `refund_of_transaction_id` |
| **Multi-provider** | ✅ Attivo | Stripe (EU/US) + dLocal (LATAM) |
| **Credit Ledger** | ✅ Attivo | `cost_events` con margini tracciati |

---

## 1. Schema Tabelle Principali

### 1.1 Abbonamenti - `billing_subscription`

```sql
CREATE TABLE billing_subscription (
    id INTEGER PRIMARY KEY,
    tenant_id VARCHAR NOT NULL UNIQUE,                    -- FK a workspaces
    provider VARCHAR NOT NULL,                            -- 'stripe' | 'dlocal'
    provider_subscription_id VARCHAR,                     -- Stripe subscription_id o dLocal plan_id
    plan VARCHAR NOT NULL,                                -- 'core' | 'pro'
    tier VARCHAR NOT NULL,                                -- 'tier1' | 'tier2' | 'tier3'
    interval VARCHAR NOT NULL,                            -- 'month' | 'year'
    status VARCHAR NOT NULL,                              -- 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    metadata_json TEXT,                                   -- JSON blob per dati extra
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (provider, provider_subscription_id)
);
```

### 1.2 Customer Billing - `billing_customer`

```sql
CREATE TABLE billing_customer (
    id INTEGER PRIMARY KEY,
    tenant_id VARCHAR NOT NULL UNIQUE,                    -- FK a workspaces
    stripe_customer_id VARCHAR,                           -- cus_xxx
    dlocal_customer_id VARCHAR,                           -- dLocal customer ID
    billing_country VARCHAR(2),                           -- ISO2 country code (IT, ES, BR, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 Transazioni/Pagamenti - `billing_transaction`

```sql
CREATE TABLE billing_transaction (
    id INTEGER PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,                            -- 'stripe' | 'dlocal'
    provider_payment_id VARCHAR NOT NULL,                 -- invoice_id / charge_id / order_id
    purpose VARCHAR NOT NULL,                             -- 'subscription_invoice' | 'topup' | 'refund'
    amount_cents INTEGER NOT NULL,                        -- Importo nella valuta originale
    currency VARCHAR(3) NOT NULL,                         -- EUR, USD, BRL, etc.
    eur_estimate_cents INTEGER,                           -- Stima in EUR per reporting
    status VARCHAR NOT NULL,                              -- 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled'
    period_key VARCHAR,                                   -- YYYY-MM per renewals (idempotenza)
    idempotency_key VARCHAR NOT NULL UNIQUE,              -- Chiave univoca anti-duplicati
    raw_metadata_json TEXT,                               -- Payload completo webhook
    
    -- Campi VAT (esistono ma non popolati - vedi sezione 2)
    tax_amount_cents INTEGER,                             -- Importo IVA in centesimi
    tax_rate FLOAT,                                       -- Aliquota % (es: 22.0)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (provider, provider_payment_id)
);
```

### 1.4 Ledger Crediti - `cost_events`

**Questa è la tabella chiave per il cash flow!**

```sql
CREATE TABLE cost_events (
    id INTEGER PRIMARY KEY,
    tenant_id VARCHAR,
    call_id INTEGER,                                      -- FK a calls.id (nullable)
    campaign_id INTEGER,                                  -- FK a campaigns.id (nullable)
    
    component VARCHAR NOT NULL,                           -- Tipo operazione (vedi sotto)
    amount INTEGER NOT NULL,                              -- NEGATIVO = credito, POSITIVO = costo
    currency VARCHAR(3) DEFAULT 'EUR',
    
    period_key VARCHAR,                                   -- YYYY-MM per idempotenza renewals
    
    -- Dettagli costo (per chiamate)
    model_name VARCHAR,
    voice_engine_name VARCHAR,
    provider VARCHAR,
    country_code VARCHAR(2),
    duration_minutes FLOAT,
    
    -- Margine
    provider_cost_cents INTEGER,                          -- Costo reale pagato a provider
    margin_cents INTEGER,                                 -- Profitto Agoralia
    
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Valori `component`:**
| Component | Significato | Amount |
|-----------|-------------|--------|
| `topup` | Acquisto crediti | **NEGATIVO** (es: -1000 = +10€) |
| `monthly_topup` | Ricarica mensile da subscription | **NEGATIVO** |
| `subscription` | Costo abbonamento mensile | **POSITIVO** |
| `telephony` | Costo telefonia chiamata | **POSITIVO** |
| `llm` | Costo LLM (GPT, Claude, etc.) | **POSITIVO** |
| `stt` | Costo Speech-to-Text | **POSITIVO** |
| `tts` | Costo Text-to-Speech | **POSITIVO** |

### 1.5 Catalogo Prezzi - `price_catalog`

```sql
CREATE TABLE price_catalog (
    id INTEGER PRIMARY KEY,
    plan VARCHAR NOT NULL,                                -- 'core' | 'pro'
    tier VARCHAR NOT NULL,                                -- 'tier1' | 'tier2' | 'tier3'
    interval VARCHAR NOT NULL,                            -- 'month' | 'year'
    base_currency VARCHAR(3) DEFAULT 'EUR',
    base_amount_cents INTEGER NOT NULL,                   -- Prezzo in EUR centesimi
    provider_refs_json TEXT,                              -- {"stripe": {"price_id": "price_xxx"}, "dlocal": {...}}
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (plan, tier, interval)
);
```

### 1.6 Country/Tier Mapping - `country_tier`

```sql
CREATE TABLE country_tier (
    id INTEGER PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL UNIQUE,              -- ISO2
    tier VARCHAR NOT NULL,                                -- 'tier1' | 'tier2' | 'tier3'
    default_provider VARCHAR DEFAULT 'stripe',            -- 'stripe' | 'dlocal'
    country_name VARCHAR,
    currency_display VARCHAR DEFAULT 'EUR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Gestione VAT/IVA

### 2.1 Come funziona attualmente

| Aspetto | Implementazione |
|---------|-----------------|
| **Calcolo VAT** | Stripe Tax (automatico) |
| **Collection VAT Number** | Stripe Tax ID Collection |
| **Reverse Charge B2B EU** | Automatico via Stripe |
| **Country cliente** | `billing_customer.billing_country` |
| **Persistenza VAT** | ⚠️ **NON IMPLEMENTATA** - campi esistono ma non popolati |

---

## 3. Sistema Crediti

### 3.1 Convenzione Ledger

```
NEGATIVO = credito (entrata per l'utente)
POSITIVO = costo (uscita per l'utente)

Balance = -SUM(amount)
```

### 3.2 Componenti

| Component | Amount | Descrizione |
|-----------|--------|-------------|
| `topup` | NEGATIVO | Acquisto crediti |
| `monthly_topup` | NEGATIVO | Ricarica mensile |
| `subscription` | POSITIVO | Costo abbonamento |
| `telephony` | POSITIVO | Costo chiamate |
| `llm` | POSITIVO | Costo AI |

---

## 4. Query Metriche

### MRR

```sql
SELECT SUM(
    CASE 
        WHEN bs.interval = 'year' THEN pc.base_amount_cents / 12
        ELSE pc.base_amount_cents
    END
) AS mrr_cents
FROM billing_subscription bs
JOIN price_catalog pc ON pc.plan = bs.plan 
                      AND pc.tier = bs.tier 
                      AND pc.interval = bs.interval
WHERE bs.status = 'active';
```

### Net Revenue

```sql
SELECT 
    SUM(CASE WHEN purpose != 'refund' THEN amount_cents ELSE 0 END) 
    - SUM(CASE WHEN purpose = 'refund' THEN amount_cents ELSE 0 END)
    - COALESCE(SUM(tax_amount_cents), 0) AS net_revenue_cents
FROM billing_transaction
WHERE status = 'paid'
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
```

### Credit Balance

```sql
SELECT tenant_id, -SUM(amount) AS balance_cents
FROM cost_events
GROUP BY tenant_id;
```

---

## 5. Gap da Colmare

1. **VAT**: `tax_amount_cents` non popolato nei webhook
2. **Refunds**: webhook `charge.refunded` non gestito
3. **Country**: aggiungere `billing_country` su `billing_transaction`
