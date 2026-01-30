# Gestione Costi Agoralia - Specifica Completa

## Principi Fondamentali

1. **Il credito utente scala SOLO per costi Agoralia** (LLM, Voice, VAPI platform)
2. **I costi telephony provider sono SEPARATI** (l'utente li paga al suo provider)
3. **Il prezzo viene BLOCCATO alla creazione campagna** (non cambia se alziamo i prezzi dopo)
4. **La stima è basata su durata configurabile** (default 2 min, personalizzabile)

---

## Flusso Completo

### 1. STIMA INIZIALE (Creazione Campagna)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CALCOLO STIMA COSTO                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COSTI AGORALIA (scalano credito):                                          │
│  ├─ LLM cost (es. GPT-4o-mini: 0.6¢/min)                                   │
│  ├─ Voice engine cost (es. ElevenLabs: 7¢/min)                             │
│  ├─ VAPI base cost (se VAPI: 5¢/min)                                       │
│  └─ Agoralia markup (20%)                                                  │
│                                                                             │
│  × durata_stimata_minuti (da WorkspaceSettings, default 2 min)             │
│  × numero_lead                                                              │
│  = STIMA COSTO AGORALIA                                                    │
│                                                                             │
│  COSTI TELEPHONY (NON scalano credito):                                    │
│  ├─ Se disponibile via API (Telnyx, Twilio): mostra stima                  │
│  └─ Se non disponibile (SIP/Zadarma): "Prevedi costi provider telefonico"  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Messaggio UI quando telephony non disponibile:**
> "I costi mostrati sono solo quelli di Agoralia. Prevedi anche i costi del tuo provider telefonico per le chiamate."

### 2. BLOCCO PREZZO (Alla Creazione)

```python
# Quando l'utente crea la campagna:

campaign.locked_cost_per_call_cents = stima_costo_agoralia_per_chiamata
campaign.locked_pricing_version = config["version"]  # es. "1.1.0"
campaign.locked_at = datetime.utcnow()
campaign.estimated_duration_minutes = workspace_settings.estimated_call_duration_minutes  # es. 2

# Questo prezzo NON cambia MAI per questa campagna
# Anche se alziamo i prezzi dopo, questa campagna usa il prezzo bloccato
```

### 3. COSTO EFFETTIVO (Dopo Ogni Chiamata)

```python
# Alla fine di ogni chiamata:

# Durata reale dalla chiamata
actual_duration_minutes = call_record.duration_seconds / 60

# Costo Agoralia (scala credito)
# Proporzionale alla durata reale vs stimata
agoralia_cost_cents = (
    campaign.locked_cost_per_call_cents 
    * actual_duration_minutes 
    / campaign.estimated_duration_minutes
)

# Crea CostEvent (scala credito utente)
CostEvent(
    tenant_id=campaign.tenant_id,
    campaign_id=campaign.id,
    call_id=call_record.id,
    component="call_agoralia",
    amount=round(agoralia_cost_cents),  # POSITIVO = scala credito
    duration_minutes=actual_duration_minutes,
    locked_cost_per_minute=campaign.locked_cost_per_call_cents / campaign.estimated_duration_minutes,
)

# Costo provider telephony (NON scala credito, solo per display)
# Se disponibile via API provider
telephony_cost_cents = fetch_telephony_cost_from_provider(call_record)  # Può essere None
call_record.telephony_provider_cost_cents = telephony_cost_cents
```

### 4. VISUALIZZAZIONE (Pagina Chiamata)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dettaglio Costi Chiamata                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Durata: 3 min 24 sec                                                       │
│                                                                             │
│  Costo Agoralia (scalato da credito):          42¢                         │
│    └─ LLM + Voice + Platform × 3.4 min                                     │
│                                                                             │
│  Costo Provider Telefonico:                    12¢  (o "N/A")              │
│    └─ Telnyx IT outbound × 3.4 min                                         │
│    └─ (Se N/A: "Verifica col tuo provider")                                │
│                                                                             │
│  Totale stimato:                               54¢                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modifiche Database

### Tabella `campaigns`

```sql
ALTER TABLE campaigns ADD COLUMN locked_cost_per_call_cents INTEGER;
ALTER TABLE campaigns ADD COLUMN locked_pricing_version VARCHAR(20);
ALTER TABLE campaigns ADD COLUMN locked_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN estimated_duration_minutes FLOAT DEFAULT 2.0;
```

### Tabella `workspace_settings`

```sql
-- Nuova colonna per durata stimata configurabile
ALTER TABLE workspace_settings ADD COLUMN estimated_call_duration_minutes FLOAT DEFAULT 2.0;
```

### Tabella `call_records`

```sql
-- Per tracciare costo telephony separato
ALTER TABLE call_records ADD COLUMN telephony_provider_cost_cents INTEGER;
ALTER TABLE call_records ADD COLUMN telephony_provider VARCHAR(50);  -- 'telnyx', 'twilio', 'zadarma', 'sip_custom'
```

### Tabella `cost_events`

```sql
-- Per tracciare dettagli
ALTER TABLE cost_events ADD COLUMN locked_cost_per_minute FLOAT;
ALTER TABLE cost_events ADD COLUMN duration_minutes FLOAT;
```

---

## Migrazione Campagne Esistenti

```python
# Script per popolare locked_cost da pricing_snapshot_json

from sqlalchemy import text

def migrate_existing_campaigns(session):
    """Popola locked_cost_per_call_cents dalle campagne esistenti"""
    
    campaigns = session.execute(text("""
        SELECT id, pricing_snapshot_json, cost_per_call_cents, created_at
        FROM campaigns
        WHERE locked_cost_per_call_cents IS NULL
          AND pricing_snapshot_json IS NOT NULL
    """)).fetchall()
    
    for c in campaigns:
        try:
            snapshot = json.loads(c.pricing_snapshot_json)
            locked_cost = snapshot.get("estimated_cost_per_call_cents")
            
            if locked_cost:
                session.execute(text("""
                    UPDATE campaigns 
                    SET locked_cost_per_call_cents = :cost,
                        locked_pricing_version = 'migrated',
                        locked_at = :created_at,
                        estimated_duration_minutes = 2.0
                    WHERE id = :id
                """), {
                    "cost": locked_cost,
                    "created_at": c.created_at,
                    "id": c.id
                })
        except (json.JSONDecodeError, TypeError):
            # Fallback a cost_per_call_cents esistente
            if c.cost_per_call_cents:
                session.execute(text("""
                    UPDATE campaigns 
                    SET locked_cost_per_call_cents = :cost,
                        locked_pricing_version = 'migrated_fallback',
                        locked_at = :created_at,
                        estimated_duration_minutes = 2.0
                    WHERE id = :id
                """), {
                    "cost": c.cost_per_call_cents,
                    "created_at": c.created_at,
                    "id": c.id
                })
    
    session.commit()
    print(f"Migrated {len(campaigns)} campaigns")
```

---

## UI Settings (Workspace)

### Nuova Tab "Impostazioni Costi"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Impostazioni Costi                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Durata stimata per chiamata: [  2  ] minuti                               │
│  └─ Usata per calcolare la stima costi delle campagne                      │
│                                                                             │
│  Provider telefonico predefinito: [ Telnyx ▼ ]                             │
│  └─ Per stimare i costi telephony (se disponibile API)                     │
│                                                                             │
│  ⓘ I costi Agoralia (LLM, Voice, Platform) scalano dal tuo credito.       │
│  ⓘ I costi del provider telefonico sono separati e li paghi al provider.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gestione Rimborsi

### Casi di Rimborso Automatico

```python
# In webhook chiamata o job di verifica

def check_and_refund_if_needed(call_record, campaign):
    """Verifica se serve rimborso per errori Agoralia"""
    
    refund_reasons = []
    
    # Caso 1: Chiamata non chiusa correttamente (durata anomala)
    if call_record.duration_seconds > 3600:  # > 1 ora
        if call_record.end_reason in ['error', 'system_error', 'timeout']:
            refund_reasons.append("Chiamata non chiusa correttamente")
    
    # Caso 2: Errore provider nostro
    if call_record.error_code and call_record.error_code.startswith('agoralia_'):
        refund_reasons.append(f"Errore sistema: {call_record.error_code}")
    
    # Caso 3: Chiamata fallita prima di iniziare
    if call_record.status == 'failed' and call_record.duration_seconds == 0:
        refund_reasons.append("Chiamata fallita")
    
    if refund_reasons:
        # Trova il CostEvent originale
        original_cost = session.query(CostEvent).filter(
            CostEvent.call_id == call_record.id,
            CostEvent.component == "call_agoralia"
        ).first()
        
        if original_cost:
            # Crea rimborso (CostEvent negativo)
            refund = CostEvent(
                tenant_id=campaign.tenant_id,
                campaign_id=campaign.id,
                call_id=call_record.id,
                component="refund",
                amount=-original_cost.amount,  # NEGATIVO = aggiunge credito
                notes="; ".join(refund_reasons)
            )
            session.add(refund)
            
            # Notifica utente
            notify_user_refund(campaign.tenant_id, original_cost.amount, refund_reasons)
```

---

## Riepilogo Modifiche Backend

| File | Modifica |
|------|----------|
| `models/campaigns.py` | Aggiungere `locked_cost_per_call_cents`, `locked_pricing_version`, `locked_at`, `estimated_duration_minutes` |
| `models/workspace.py` | Aggiungere `estimated_call_duration_minutes` a WorkspaceSettings |
| `models/calls.py` | Aggiungere `telephony_provider_cost_cents`, `telephony_provider` |
| `routes/campaigns.py` | Popolare locked_cost alla creazione |
| `services/enforcement.py` | Usare `locked_cost_per_call_cents` invece di `cost_per_call_cents` |
| `services/cost_tracking.py` | Calcolare costo proporzionale a durata reale |
| `routes/webhooks.py` | Creare CostEvent con costo bloccato |
| `alembic/versions/` | Migrazione per nuove colonne |

---

## Test Cases

```python
def test_cost_locking():
    # 1. Crea campagna con prezzo 15¢/min
    campaign = create_campaign(cost_per_minute=15)
    assert campaign.locked_cost_per_call_cents == 30  # 15¢ × 2 min
    
    # 2. Alza prezzo a 20¢/min
    update_pricing(cost_per_minute=20)
    
    # 3. Esegui chiamata
    call = execute_call(campaign, duration_minutes=3)
    
    # 4. Verifica che usa prezzo VECCHIO (bloccato)
    cost_event = get_cost_event(call)
    expected_cost = 30 * (3 / 2)  # 45¢ (locked × durata_reale / durata_stimata)
    assert cost_event.amount == 45
    
    # 5. Nuova campagna usa prezzo NUOVO
    campaign2 = create_campaign(cost_per_minute=20)
    assert campaign2.locked_cost_per_call_cents == 40  # 20¢ × 2 min
```
