# Analisi Logica Compliance per Purpose

## Struttura JSON e Variazioni per Purpose

### 1. Campo "Purpose" nella Campagna

**Raccomandazione:**
- **Nome campo**: `purpose` (semplice e chiaro)
- **Valori possibili**:
  - `"quote_request"` - Richiesta preventivo
  - `"cold_calling"` - Cold calling (default)
  - `"inbound"` - Chiamate in entrata (non interessa per compliance, ma va nel DB per tracking)
- **Default**: `"cold_calling"` se non specificato

### 2. Come Varia il Compliance in Base al Purpose

#### 2.1 AI Disclosure (`ai_disclosure`)

**Campo chiave**: `ai_disclosure.exceptions`

- **Se `"quote requests"` è in `exceptions`**:
  - `purpose="quote_request"` → **AI disclosure NON richiesta** (AI permessa senza disclosure)
  - `purpose="cold_calling"` → **AI disclosure richiesta** (se `ai_disclosure.required=true`)

- **Se `"quote requests"` NON è in `exceptions`**:
  - Entrambi i purpose seguono le regole generali (`ai_disclosure.required`)

**Esempio Italia:**
```json
"ai_disclosure": {
  "required": null,
  "exceptions": ["quote requests"]
}
```
- Quote request: AI permessa senza disclosure ✅
- Cold calling: Regole generali (null = permesso di default) ✅

**Esempio South Korea (KR):**
```json
"ai_disclosure": {
  "required": null,
  "exceptions": []  // NO "quote requests"
}
```
- Quote request: AI disclosure richiesta (regole generali)
- Cold calling: AI disclosure richiesta (regole generali)

**Esempio Paesi con divieto (CZ, HR, NL, SI):**
```json
"ai_disclosure": {
  "note": "AI-powered calls for quote requests are prohibited unless prior explicit consent..."
}
```
- Quote request: **AI VIETATA** ❌ (a meno di consenso esplicito)
- Cold calling: Regole generali

#### 2.2 Existing Customer Exemption (`existing_customer_exemption`)

**IMPORTANTE**: Questo campo **NON varia per purpose**. Si applica sempre se:
- C'è una relazione esistente con il cliente
- `existing_customer_exemption.b2c.exemption_applies = true`

**Esempio Francia:**
```json
"existing_customer_exemption": {
  "b2c": {
    "exemption_applies": true,
    "exemption_type": "existing_contract_exemption"
  }
}
```
- Se c'è relazione esistente → exemption si applica per **entrambi** i purpose
- Quote request + existing customer → exemption ✅
- Cold calling + existing customer → exemption ✅

#### 2.3 Regime, Relationship Requirements, DNC

**NON variano per purpose**. Si applicano sempre in base a:
- `nature` (B2B/B2C)
- Presenza di relazione esistente
- Ma **NON** per purpose

### 3. Logica di Valutazione Compliance

```python
def evaluateCompliance(country_data, nature, purpose, has_existing_relationship, use_ai):
    """
    Valuta compliance per una chiamata.
    
    Args:
        country_data: Dati paese da compliance.v3.json
        nature: "b2b" | "b2c"
        purpose: "quote_request" | "cold_calling" | "inbound"
        has_existing_relationship: bool
        use_ai: bool
    
    Returns:
        {
            "allowed": bool,
            "requires_consent": bool,
            "requires_ai_disclosure": bool,
            "restrictions": [...],
            "warnings": [...]
        }
    """
    
    # 1. Verifica divieto AI per quote requests
    if purpose == "quote_request" and use_ai:
        ai_note = country_data.get("ai_disclosure", {}).get("note", "")
        if "prohibited" in ai_note.lower() and "quote" in ai_note.lower():
            return {
                "allowed": False,
                "reason": "AI-powered calls for quote requests are prohibited"
            }
    
    # 2. Verifica AI disclosure
    ai_disclosure = country_data.get("ai_disclosure", {})
    requires_ai_disclosure = False
    
    if use_ai:
        # Se "quote requests" è in exceptions → NO disclosure per quote_request
        if purpose == "quote_request" and "quote requests" in ai_disclosure.get("exceptions", []):
            requires_ai_disclosure = False
        # Altrimenti segue regole generali
        elif ai_disclosure.get("required") is True or ai_disclosure.get("mandatory") is True:
            requires_ai_disclosure = True
    
    # 3. Verifica existing customer exemption
    ec_exemption = country_data.get("existing_customer_exemption", {}).get(nature, {})
    if has_existing_relationship and ec_exemption.get("exemption_applies"):
        # Exemption si applica (consent non richiesto o soft opt-in)
        requires_consent = False  # o soft opt-in
    else:
        # Verifica regime per determinare se serve consent
        regime = country_data.get("regime", {}).get(nature, {})
        regime_type = regime.get("type")
        requires_consent = regime_type in ["opt-in", "permission-based"]
    
    # 4. Verifica DNC
    dnc = country_data.get("dnc", {})
    check_dnc = dnc.get("check_required", False)
    if has_existing_relationship:
        check_dnc = check_dnc and not dnc.get("existing_customer_exemption", False)
    
    # 5. Verifica legal restrictions
    restrictions = []
    legal_restrictions = country_data.get("legal_restrictions", [])
    for lr in legal_restrictions:
        applies_to = lr.get("applies_to", "")
        if applies_to in ["all telemarketing", f"{nature} telemarketing", "all"]:
            restrictions.append(lr)
    
    return {
        "allowed": True,  # Se non ci sono divieti espliciti
        "requires_consent": requires_consent,
        "requires_ai_disclosure": requires_ai_disclosure,
        "check_dnc": check_dnc,
        "restrictions": restrictions,
        "warnings": []
    }
```

### 4. Risposte alle Domande

#### 4.1 Campo Purpose
- **Nome**: `purpose`
- **Valori**: `"quote_request"`, `"cold_calling"`, `"inbound"`
- **Default**: `"cold_calling"`

#### 4.2 Differenze Regole per Purpose

**Le regole che VARIANO per purpose:**
1. **`ai_disclosure.exceptions`**:
   - Se contiene `"quote requests"` → per `quote_request` NON serve disclosure AI
   - Per `cold_calling` → segue regole generali

**Le regole che NON variano per purpose:**
- `regime` (opt-in/opt-out) → sempre uguale
- `relationship_requirements` → sempre uguale
- `existing_customer_exemption` → si applica sempre se c'è relazione
- `dnc` → sempre uguale
- `legal_restrictions` → sempre uguale (alcune si applicano a "all telemarketing")

**Esempio combinazione:**
- `nature="b2c"` + `purpose="quote_request"` + `has_existing_relationship=true`:
  - Regime B2C si applica (opt-in/opt-out)
  - Existing customer exemption si applica (se exemption_applies=true)
  - AI disclosure NON richiesta (se "quote requests" in exceptions)
  - DNC check potrebbe essere esente (se existing_customer_exemption=true)

#### 4.3 "Sdoppiare la Colonna" nell'Import

**Raccomandazione**: Due colonne separate
- `"Consequences (Quote Request)"`
- `"Consequences (Cold Calling)"`

**Alternativa**: Una colonna con switch/tab per selezionare purpose (più pulito UI)

#### 4.4 Priorità Purpose vs Nature

**NON c'è priorità**: si **combinano** sempre.

- `nature` determina: regime, relationship_requirements, existing_customer_exemption
- `purpose` determina: solo `ai_disclosure.exceptions` per "quote requests"
- `has_existing_relationship` determina: se si applica existing_customer_exemption

**Esempio:**
```
nature="b2c" + purpose="quote_request" + has_existing_relationship=true
→ 
- Regime B2C (opt-in/opt-out) ✅
- Existing customer exemption ✅ (se applicabile)
- AI disclosure NON richiesta ✅ (se "quote requests" in exceptions)
```

#### 4.5 Migrazione Dati Esistenti

**Default**: `purpose="cold_calling"` per tutte le campagne esistenti.

**Motivo**: È il caso più restrittivo (richiede più compliance), quindi è più sicuro.

### 5. Paesi Speciali

#### 5.1 Paesi con Divieto AI per Quote Requests (4)
- Czech Republic (CZ)
- Croatia (HR)
- The Netherlands (NL)
- Slovenia (SI)

**Nota**: Hanno `ai_disclosure.note` che dice "AI-powered calls for quote requests are prohibited unless prior explicit consent"

**Logica**: Se `purpose="quote_request"` + `use_ai=true` → **VIETATO** (a meno di consenso esplicito)

#### 5.2 South Korea (KR)
- `allowed_without_disclosure=false` in quote_requests_ai.json
- **NON** ha "quote requests" in exceptions
- **Logica**: AI disclosure **sempre richiesta**, anche per quote requests

### 6. Statistiche Finali

- **199 paesi**: hanno "quote requests" in `ai_disclosure.exceptions` → AI permessa senza disclosure per quote requests
- **4 paesi**: divieto AI esplicito per quote requests (a meno di consenso)
- **1 paese**: South Korea - disclosure sempre richiesta
- **18 paesi**: hanno `existing_customer_exemption.b2c.exemption_applies=true`

