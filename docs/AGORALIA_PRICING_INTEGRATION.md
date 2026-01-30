# Integrazione Pricing Config Centralizzato in Agoralia Backend

## Obiettivo

Centralizzare la configurazione costi/margini in `catalogues/pricing/agoralia-config.json` invece di usare env vars sparsi. Include logica per stimare i costi Vapi (che non pubblica i dettagli).

---

## File di configurazione

`catalogues/pricing/agoralia-config.json`:

```json
{
  "version": "1.1.0",
  "updated_at": "2026-01-30T10:15:00Z",
  "updated_by": "Alice",

  "platform_costs": {
    "vapi_base_cost_cents_per_minute": 5,
    "comment": "VAPI mandatory platform fee"
  },

  "vapi_cost_estimation": {
    "method": "retell_plus_buffer",
    "use_retell_as_variable": true,
    "buffer_percent": 10,
    "comment": "Vapi = 5¢ base + (Retell × 1.1)"
  },

  "agoralia_margins": {
    "markup_percent": 20,
    "number_surcharge_percent": 20
  },

  "fallback_costs": {
    "llm_cents_per_minute": 7,
    "voice_cents_per_minute": 10,
    "telephony_cents_per_minute": 5
  },

  "quote_defaults": {
    "estimated_call_duration_minutes": 3,
    "default_provider": "retell"
  },

  "cost_overrides": {
    "retell": { "enabled": false, "multiplier": 1.0 },
    "vapi": { "enabled": false, "multiplier": 1.0 }
  }
}
```

---

## Modifiche richieste al backend

### 1. Aggiungere loader in `backend/utils/catalogues_loader.py`

```python
from pathlib import Path
import json
from functools import lru_cache
from typing import Optional

CATALOGUES_DIR = Path(__file__).parent.parent.parent / "catalogues"

_agoralia_config_cache: Optional[dict] = None

def get_agoralia_pricing_config() -> dict:
    """
    Get Agoralia pricing configuration from catalogues/pricing/agoralia-config.json
    Returns config with defaults merged in.
    """
    global _agoralia_config_cache
    
    if _agoralia_config_cache is not None:
        return _agoralia_config_cache
    
    config = {}
    path = CATALOGUES_DIR / "pricing" / "agoralia-config.json"
    
    if path.exists():
        try:
            config = json.loads(path.read_text())
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to load agoralia-config.json: {e}")
    
    # Merge with defaults
    defaults = {
        "platform_costs": {"vapi_base_cost_cents_per_minute": 5},
        "vapi_cost_estimation": {
            "method": "retell_plus_buffer",
            "use_retell_as_variable": True,
            "buffer_percent": 10
        },
        "agoralia_margins": {"markup_percent": 20, "number_surcharge_percent": 20},
        "fallback_costs": {
            "llm_cents_per_minute": 7,
            "voice_cents_per_minute": 10,
            "telephony_cents_per_minute": 5
        },
        "quote_defaults": {
            "estimated_call_duration_minutes": 3,
            "default_provider": "retell"
        },
        "cost_overrides": {
            "retell": {"enabled": False, "multiplier": 1.0},
            "vapi": {"enabled": False, "multiplier": 1.0}
        }
    }
    
    for key, default_value in defaults.items():
        if key not in config:
            config[key] = default_value
        elif isinstance(default_value, dict):
            for subkey, subvalue in default_value.items():
                if subkey not in config[key]:
                    config[key][subkey] = subvalue
    
    _agoralia_config_cache = config
    return config


def invalidate_agoralia_config_cache():
    """Call this to reload config after changes"""
    global _agoralia_config_cache
    _agoralia_config_cache = None
```

### 2. Modificare `backend/services/pricing.py`

```python
from backend.utils.catalogues_loader import get_agoralia_pricing_config

def get_provider_cost(
    session,
    provider: str,
    llm_model: str,
    voice_engine: str,
    country_code: str
) -> dict:
    """
    Calculate per-minute cost for a provider.
    
    For Retell: uses DB pricing directly
    For Vapi: uses Retell as base + buffer (since Vapi doesn't publish detailed costs)
    """
    config = get_agoralia_pricing_config()
    fallback = config["fallback_costs"]
    
    # Get Retell costs from DB (or fallback)
    llm_cost = get_pricing(session, "llm_voice", llm_model) or fallback["llm_cents_per_minute"]
    voice_cost = get_pricing(session, "voice_engine", voice_engine) or fallback["voice_cents_per_minute"]
    telephony_cost = get_pricing(session, "telephony", country_code) or fallback["telephony_cents_per_minute"]
    
    retell_variable_cost = llm_cost + voice_cost + telephony_cost
    
    if provider == "retell":
        return {
            "llm_cost": llm_cost,
            "voice_cost": voice_cost,
            "telephony_cost": telephony_cost,
            "base_cost": 0,
            "total_per_minute": retell_variable_cost,
            "source": "retell_db"
        }
    
    elif provider == "vapi":
        vapi_config = config["vapi_cost_estimation"]
        vapi_base = config["platform_costs"]["vapi_base_cost_cents_per_minute"]
        
        if vapi_config.get("use_retell_as_variable", True):
            buffer = 1 + (vapi_config.get("buffer_percent", 10) / 100)
            vapi_variable = retell_variable_cost * buffer
        else:
            # Could add alternative estimation methods here
            vapi_variable = retell_variable_cost
        
        return {
            "base_cost": vapi_base,
            "variable_cost": vapi_variable,
            "buffer_percent": vapi_config.get("buffer_percent", 10),
            "total_per_minute": vapi_base + vapi_variable,
            "source": "vapi_estimated_from_retell"
        }
    
    else:
        raise ValueError(f"Unknown provider: {provider}")


def estimate_call_cost(
    session,
    provider: str,
    llm_model: str,
    voice_engine: str,
    country_code: str,
    duration_minutes: float,
    use_agoralia_number: bool = False
) -> dict:
    """
    Estimate total cost for a call including Agoralia markup.
    """
    config = get_agoralia_pricing_config()
    margins = config["agoralia_margins"]
    
    # Get provider cost
    provider_cost = get_provider_cost(session, provider, llm_model, voice_engine, country_code)
    
    base_cost = provider_cost["total_per_minute"] * duration_minutes
    
    # Apply cost override if enabled (for promotions/testing)
    override = config["cost_overrides"].get(provider, {})
    if override.get("enabled"):
        base_cost *= override.get("multiplier", 1.0)
    
    # Apply Agoralia markup
    markup_percent = margins["markup_percent"]
    marked_up_cost = base_cost * (1 + markup_percent / 100)
    
    # Apply number surcharge if using Agoralia number
    if use_agoralia_number:
        number_surcharge_percent = margins["number_surcharge_percent"]
        marked_up_cost *= (1 + number_surcharge_percent / 100)
    
    return {
        "provider": provider,
        "duration_minutes": duration_minutes,
        "provider_cost_per_minute": provider_cost["total_per_minute"],
        "provider_cost_total": base_cost,
        "markup_percent": markup_percent,
        "number_surcharge_percent": margins["number_surcharge_percent"] if use_agoralia_number else 0,
        "final_cost_cents": round(marked_up_cost, 2),
        "cost_breakdown": provider_cost
    }


def estimate_campaign_cost(
    session,
    agent_id: str,
    lead_country_codes: list[str],
    provider: str = None
) -> dict:
    """
    Estimate total cost for a campaign.
    """
    config = get_agoralia_pricing_config()
    defaults = config["quote_defaults"]
    
    if provider is None:
        provider = defaults["default_provider"]
    
    duration = defaults["estimated_call_duration_minutes"]
    
    # Get agent config for LLM and voice
    agent = get_agent(session, agent_id)
    llm_model = agent.llm_model or "GPT 4o mini"
    voice_engine = agent.voice_engine or "With Elevenlabs/Cartesia voices"
    
    total_cost = 0
    cost_by_country = {}
    
    for country_code in lead_country_codes:
        call_cost = estimate_call_cost(
            session, provider, llm_model, voice_engine, country_code, duration
        )
        total_cost += call_cost["final_cost_cents"]
        
        if country_code not in cost_by_country:
            cost_by_country[country_code] = {
                "count": 0,
                "cost_per_call": call_cost["final_cost_cents"],
                "total": 0
            }
        cost_by_country[country_code]["count"] += 1
        cost_by_country[country_code]["total"] += call_cost["final_cost_cents"]
    
    return {
        "provider": provider,
        "total_leads": len(lead_country_codes),
        "estimated_duration_per_call": duration,
        "total_cost_cents": round(total_cost, 2),
        "total_cost_display": f"${total_cost / 100:.2f}",
        "cost_by_country": cost_by_country,
        "config_version": config.get("version", "unknown")
    }
```

### 3. API per ricaricare config (opzionale)

```python
# backend/routes/admin.py

from backend.utils.catalogues_loader import (
    get_agoralia_pricing_config, 
    invalidate_agoralia_config_cache
)

@router.post("/admin/reload-pricing-config")
async def reload_pricing_config(api_key: str = Header(...)):
    """Reload pricing config from file (after Alice modifies it)"""
    if api_key != settings.ADMIN_API_KEY:
        raise HTTPException(401, "Unauthorized")
    
    invalidate_agoralia_config_cache()
    config = get_agoralia_pricing_config()
    
    return {
        "status": "reloaded",
        "version": config.get("version"),
        "vapi_estimation_method": config["vapi_cost_estimation"]["method"],
        "markup_percent": config["agoralia_margins"]["markup_percent"]
    }


@router.get("/admin/pricing-config")
async def get_pricing_config(api_key: str = Header(...)):
    """Get current pricing config"""
    if api_key != settings.ADMIN_API_KEY:
        raise HTTPException(401, "Unauthorized")
    
    return get_agoralia_pricing_config()
```

---

## Env vars da RIMUOVERE (dopo migrazione)

Una volta testato, rimuovere questi env vars (ora nel JSON):

- `VAPI_BASE_COST_CENTS_PER_MINUTE` → `platform_costs.vapi_base_cost_cents_per_minute`
- `AGORALIA_MARKUP_PERCENT` → `agoralia_margins.markup_percent`
- `AGORALIA_NUMBER_SURCHARGE_PERCENT` → `agoralia_margins.number_surcharge_percent`
- `DEFAULT_LLM_COST_CENTS_PER_MINUTE` → `fallback_costs.llm_cents_per_minute`
- `DEFAULT_VOICE_COST_CENTS_PER_MINUTE` → `fallback_costs.voice_cents_per_minute`

---

## Logica costi Vapi

Vapi non pubblica i costi dettagliati come Retell. La logica implementata:

```
Costo Vapi = 5¢ (base fisso) + (Costo Retell × 1.1)
```

- **5¢ base**: Fee piattaforma Vapi (noto)
- **Retell × 1.1**: Usiamo Retell come proxy + 10% buffer di sicurezza

Il buffer del 10% copre l'incertezza. Se Vapi costa meno di Retell, il buffer diventa margine extra.

---

## Testing

```python
# Test config loading
from backend.utils.catalogues_loader import get_agoralia_pricing_config

config = get_agoralia_pricing_config()
print(f"Version: {config['version']}")
print(f"Markup: {config['agoralia_margins']['markup_percent']}%")
print(f"Vapi buffer: {config['vapi_cost_estimation']['buffer_percent']}%")

# Test cost estimation
from backend.services.pricing import estimate_call_cost

cost = estimate_call_cost(
    session=db_session,
    provider="vapi",
    llm_model="GPT 4o mini",
    voice_engine="With Elevenlabs/Cartesia voices",
    country_code="IT",
    duration_minutes=3
)
print(f"Vapi call cost (3 min, IT): {cost['final_cost_cents']}¢")
```

---

## Vantaggi

| Prima (env vars) | Dopo (JSON centralizzato) |
|------------------|---------------------------|
| Sparsi in .env | Un solo file |
| Nessun versioning | Git-tracked con storico |
| Richiede redeploy | Reload a caldo |
| Non documentati | Commenti inline |
| Solo sviluppatori | Alice può modificare |

---

## Struttura finale pricing/

```
catalogues/pricing/
├── retell.json              # Costi GREZZI RetellAI (scraped)
├── vapi.json                # Costi GREZZI Vapi (scraped, parziali)
└── agoralia-config.json     # Config business Agoralia (Alice)
```
