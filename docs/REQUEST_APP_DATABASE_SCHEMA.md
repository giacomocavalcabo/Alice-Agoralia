# Richiesta Schema Database per Alice Finance

**Da:** Alice (Sistema Centralizzato Agoralia)  
**A:** Cursor App Agoralia  
**Data:** 30 Gennaio 2026

---

## Contesto

Alice sta implementando un sistema gestionale completo per tracciare:
- **Cash Flow**: entrate da abbonamenti, crediti, rimborsi
- **VAT/IVA**: calcolo e tracciamento per country
- **Subscriptions**: stato, MRR, churn, upgrades/downgrades
- **Credits/Consumption**: acquisti crediti, consumo, saldo
- **Revenue Recognition**: quando riconoscere il revenue (accrual vs cash)

Abbiamo già implementato il calcolo margini sui costi chiamate (`calls.call_cost_cents`), ma ci manca la parte entrate/abbonamenti.

---

## Cosa ci serve sapere

### 1. Schema Tabelle Pagamenti/Abbonamenti

Per favore descrivici la struttura di queste tabelle (o equivalenti):

```sql
-- Abbonamenti
subscriptions
  - id
  - tenant_id / user_id
  - plan_id (free, core, pro, enterprise)
  - status (active, canceled, past_due, trialing, etc.)
  - current_period_start / end
  - cancel_at_period_end
  - stripe_subscription_id
  - created_at / updated_at

-- Piani
plans
  - id
  - name
  - price_monthly / price_yearly
  - stripe_price_id_monthly / yearly
  - features / limits

-- Transazioni / Pagamenti
payments / invoices / billing_transactions
  - id
  - tenant_id / user_id
  - subscription_id
  - amount_cents
  - currency
  - status (paid, pending, failed, refunded)
  - stripe_payment_intent_id / invoice_id
  - tax_amount_cents (VAT)
  - tax_rate_percent
  - country_code (per determinare VAT)
  - created_at

-- Crediti (se esistono)
credits / credit_transactions
  - id
  - tenant_id
  - amount_cents (positivo = acquisto, negativo = consumo)
  - type (purchase, consumption, refund, bonus)
  - balance_after
  - created_at

-- Rimborsi
refunds
  - id
  - payment_id
  - amount_cents
  - reason
  - stripe_refund_id
  - created_at
```

### 2. Come gestite la VAT/IVA?

- Calcolate VAT in base al paese del cliente?
- Usate Stripe Tax o calcolo manuale?
- Dove è salvata la country del cliente (per determinare aliquota)?
- Come gestite reverse charge per B2B EU?

### 3. Come funzionano i crediti?

- L'utente compra crediti separatamente dall'abbonamento?
- Il consumo chiamate scala dai crediti o è fatturato a fine mese?
- C'è un saldo crediti per tenant?
- Come gestite i crediti bonus/promo?

### 4. Webhook Stripe

Quali webhook Stripe processate? Ci serve sapere per capire il flusso:
- `invoice.paid` → nuovo pagamento
- `invoice.payment_failed` → pagamento fallito
- `customer.subscription.updated` → cambio piano
- `customer.subscription.deleted` → cancellazione
- `charge.refunded` → rimborso

### 5. Metriche che vogliamo calcolare

Per Alice Finance Dashboard vogliamo mostrare:

| Metrica | Descrizione | Query suggerita |
|---------|-------------|-----------------|
| **MRR** | Monthly Recurring Revenue | SUM of active subscriptions normalized to monthly |
| **ARR** | Annual Recurring Revenue | MRR × 12 |
| **Churn Rate** | % subscriptions canceled | canceled_this_month / active_start_of_month |
| **Net Revenue** | Pagamenti - Rimborsi - VAT | SUM(amount) - SUM(refunds) - SUM(tax) |
| **Gross Revenue** | Pagamenti totali | SUM(amount) incluso VAT |
| **VAT Collected** | IVA incassata per paese | GROUP BY country, SUM(tax_amount) |
| **Active Subs** | Abbonamenti attivi | COUNT WHERE status = 'active' |
| **Trial → Paid** | Conversion rate | converted / total_trials |
| **ARPU** | Average Revenue Per User | MRR / active_subs |
| **LTV** | Lifetime Value | ARPU / churn_rate |
| **Credit Balance** | Saldo crediti totale | SUM(credits) per tenant |
| **Credit Consumption** | Consumo medio | AVG daily consumption |

---

## Output Richiesto

Per favore rispondici con:

1. **Schema SQL** delle tabelle rilevanti (CREATE TABLE o descrizione colonne)
2. **Query di esempio** per calcolare MRR, churn, etc.
3. **Flusso pagamenti**: come arrivano i soldi da Stripe al DB
4. **Edge cases**: trial, coupon, prorations, refunds parziali

---

## Come rispondere

Puoi:
1. Creare un file `docs/DATABASE_SCHEMA_FOR_ALICE.md` nel repo App
2. Oppure rispondere direttamente qui con le info

Grazie!
