import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

import httpx

BASE_DIR = Path(__file__).parent

COUNTRIES_CSV = BASE_DIR / "countries.csv"
V2_JSON = BASE_DIR / "compliance.v2.json"  # optional
OUTPUT_JSON = BASE_DIR / "compliance.v3.json"


def load_countries() -> list[dict]:
    countries: list[dict] = []
    with COUNTRIES_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            countries.append(row)
    return countries


def load_v2() -> Dict[str, Any]:
    if not V2_JSON.exists():
        return {}
    with V2_JSON.open(encoding="utf-8") as f:
        data = json.load(f)
    # Assumes v2 is keyed by ISO2; adapt if needed
    return data


def build_seed(country_row: dict, v2_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build a seed object for the country to give to the model."""
    iso = country_row["ISO2"]
    seed: Dict[str, Any] = {
        "continent": None,  # you can enrich via external mapping if you want
        "country": country_row["Country"],
        "iso": iso,
    }

    # If you have v2 data, attach it as a block for the model
    if iso in v2_data:
        seed["v2"] = v2_data[iso]

    return seed


def build_prompt(country_seed: Dict[str, Any]) -> str:
    country_name = country_seed["country"]
    iso = country_seed["iso"]

    # Load template to include exact structure
    template_path = BASE_DIR / "template_country.json"
    with template_path.open(encoding="utf-8") as f:
        template = json.load(f)

    instructions = f"""
Sei un assistente legale che compila un oggetto JSON di compliance
per le chiamate di telemarketing e chiamate AI per il paese {country_name} ({iso}).

IMPORTANTE: Cerca informazioni aggiornate e specifiche su internet riguardo alle normative
di telemarketing, privacy, telecomunicazioni e consumer law per {country_name} ({iso}).

FONTI RICHIESTE - SOLO FONTI UFFICIALI O AFFIDABILI:
Usa ESCLUSIVAMENTE fonti ufficiali o altamente affidabili:
- Siti governativi (.gov, .gouv, .govt, ecc.)
- Autorità di regolamentazione ufficiali (agenzie di protezione dati, autorità telecom, ecc.)
- Leggi e regolamenti ufficiali pubblicati su siti governativi
- Associazioni professionali riconosciute (es. ordini degli avvocati, bar association)
- Organizzazioni internazionali ufficiali (UE, ONU, OECD, ecc.)
- Università e istituzioni accademiche riconosciute (.edu, .ac.uk, ecc.)

NON usare:
- Blog, siti commerciali, siti di marketing/SEO
- Siti generici di business o consulenza
- Fonti non verificate o non ufficiali

Cerca ESPLICITAMENTE:
- Leggi sulla protezione dei dati personali di {country_name} (solo da siti ufficiali)
- Autorità di protezione dati di {country_name} (solo siti ufficiali dell'autorità)
- Regolamenti sul telemarketing di {country_name} (solo da fonti governative)
- Leggi sulle telecomunicazioni di {country_name} (solo da fonti ufficiali)
- Consumer protection laws di {country_name} (solo da fonti governative)
- Regole su AI disclosure per chiamate di richiesta preventivo (quote requests) o per existing customers
- Se le regole AI disclosure cambiano per existing customers vs cold calling
- Eccezioni per AI disclosure quando c'è una relazione commerciale esistente o contratto in corso

Regole fondamentali CRITICHE:
- NON inventare informazioni che non trovi nelle fonti. Se non trovi una regola specifica, lascia il campo a null.
- NON assumere regole da altri paesi. Se trovi riferimenti a normative di altri paesi (es. FTC TSR USA, regole EU di altri stati), NON applicarle a {country_name} a meno che non siano esplicitamente menzionate come applicabili a {country_name}.
- FOCUS SOLO su normative specifiche di {country_name} ({iso}). Se una legge è di un altro paese, non usarla.
- Se una cosa NON è specificata o vietata da una legge di {country_name}, considerala COME PERMESSA.
- In quei casi lascia i campi strutturati a null e, se utile, scrivi una nota tipo:
  "No explicit rule found; falls under general law".
- Se trovi informazioni contraddittorie, usa quelle più recenti o da fonti più autorevoli (siti governativi > agenzie > articoli).
- Per boolean: usa true SOLO se trovi una regola esplicita che lo richiede; usa false SOLO se trovi una regola esplicita che lo vieta; altrimenti usa null.

Devi:
- CERCARE ATTIVAMENTE informazioni aggiornate su internet per {country_name} ({iso}) usando le tue capacità di web search.
- USA il web search per trovare siti governativi, autorità di regolamentazione, e documenti legali ufficiali.
- Cerca PRIMA normative specifiche di telemarketing, poi leggi sulla privacy/protezione dati, poi leggi sulle telecomunicazioni.
- Se non trovi leggi specifiche di telemarketing, cerca come le leggi sulla privacy/protezione dati si applicano al telemarketing.
- Usare le informazioni di "seed_data" come base (possono contenere descrizioni da CSV/v2).
- Basarti su fonti normative reali e aggiornate (telemarketing, telecom, privacy, consumer law).
- Compilare un oggetto JSON che DEVE rispettare ESATTAMENTE la struttura del template fornito sotto.
- IMPORTANTE: Non dire che non puoi cercare - usa sempre il web search per trovare informazioni.

CRITICO - STRUTTURA OBBLIGATORIA:
Devi usare ESATTAMENTE questa struttura JSON. Non inventare nuovi campi, non cambiare i nomi dei campi.
Se un campo non ha informazioni, lascialo a null o array vuoto come nel template.

Template JSON (struttura esatta richiesta):
{json.dumps(template, ensure_ascii=False, indent=2)}

ISTRUZIONI SPECIFICHE PER CAMPO:

1. "regime": DEVE avere struttura {{"b2b": {{"description": ..., "type": ...}}, "b2c": {{"description": ..., "type": ...}}}}
   - "description": descrizione del regime legale (es. "Opt-in consent required", "GDPR-like framework")
   - "type": tipo di regime (es. "opt-in", "opt-out", "permission-based")

2. "relationship_requirements": DEVE avere struttura b2b/b2c con campi specifici:
   - "requires_existing_relationship": boolean o null
   - "opt_in_always_required": boolean o null
   - "soft_opt_in_allowed": boolean o null
   - Altri campi come nel template

3. "existing_customer_exemption": DEVE avere struttura b2b/b2c con:
   - "exemption_applies": boolean o null
   - "exemption_type": string o null
   - "exemption_conditions": array
   - Altri campi come nel template

4. "dnc": DEVE avere esattamente questi campi:
   - "api_available": boolean o null
   - "check_required": boolean o null
   - "existing_customer_exemption": boolean o null
   - "has_registry": boolean o null (se non esiste registry, DEVE essere false, non null)
   - "name": string o null
   - "url": string o null

5. "ai_disclosure": DEVE avere:
   - "required": boolean o null (true se disclosure AI è richiesta, false se esplicitamente non richiesta, null se non specificato)
   - "mandatory": boolean o null (true se disclosure AI è obbligatoria, false se non obbligatoria, null se non specificato)
   - "timing": string o null (es. "at the beginning of the call", "before call", "during call")
   - "text_suggested": string o null (testo suggerito per la disclosure)
   - "exceptions": array di stringhe (es. ["existing customers", "quote requests", "inquiry calls"])
   - IMPORTANTE: Cerca ESPLICITAMENTE se ci sono eccezioni per quote requests o existing customers. Se trovi che AI disclosure NON è richiesta per quote requests o existing customers, aggiungi queste eccezioni nell'array "exceptions".
   - Se trovi che le regole AI cambiano per existing customers, documentalo in "exceptions" o "note".

6. "recording": DEVE avere:
   - "allowed": boolean o null
   - "basis": string o null (es. "legal obligation", "consent")
   - "notification_timing": string o null
   - "notification_required": boolean o null
   - "consent_required": boolean o null
   - "retention": {{"max_duration": ..., "notes": ...}}

7. "quiet_hours": DEVE avere:
   - "enabled": boolean o null
   - "weekdays": {{"start": ..., "end": ..., "timezone": ...}}
   - "saturday": boolean o null
   - "sunday": boolean o null
   - "holidays": boolean o null

8. "caller_id_requirements": DEVE avere:
   - "mandatory": boolean o null (usa null se non trovi una regola esplicita che lo richiede)
   - "prefix_required": boolean o null
   - "company_name_required": boolean o null
   - "spoofing_prohibited": boolean o null (usa null se non trovi una regola esplicita che lo vieta)
   - "anonymous_calls_prohibited": boolean o null
   - IMPORTANTE: Se trovi solo "principi generali di trasparenza" senza regole specifiche, metti tutti i campi a null, NON assumere true.

9. "frequency_limits": DEVE avere:
   - "max_calls_per_day": number o null
   - "max_calls_per_week": number o null
   - "max_calls_per_month": number o null

10. "legal_restrictions": DEVE essere array di OGGETTI con struttura:
   {{"type": ..., "description": ..., "value": ..., "applies_to": ..., "enforcement_level": ...}}
   NON array di stringhe semplici.

11. "enforcement": DEVE avere:
    - "max_fine": {{"amount": number (es. 100000), "currency": string (es. "EUR"), "per_violation": boolean, "notes": string}}
    - "regulator": {{"name": string, "url": string o null, "type": string}}
    - "risk_level": "low" | "medium" | "high" | null
    - Se trovi informazioni su multe, inseriscile in max_fine.amount (es. se dice "fino a €100.000", metti 100000)
    - "risk_level": valuta in base a: multe basse (<€10k) = "low", medie (€10k-50k) = "medium", alte (>€50k) = "high"

12. "sources": DEVE avere:
    - "primary": array di stringhe
    - "recent_changes": string o null
    - "source_last_updated": string o null

13. "extra_unstructured_rules": DEVE essere array di OGGETTI con:
    {{"topic": string, "text": string, "reason_not_structured": string, "source": string}}

14. "rules": DEVE avere solo:
    - "caller_id": string o null
    - "exceptions": string o null

Linee guida CRITICHE:
- NON inventare date, scadenze, o regole temporali se non le trovi esplicitamente nelle fonti.
- Se non trovi informazioni per un campo, lascialo a null (o array vuoto per array).
- Per "regime.b2b" e "regime.b2c": se le regole sono identiche per B2B e B2C, ripeti le stesse informazioni in entrambi.
- Per "relationship_requirements": se non c'è distinzione B2B/B2C, valuta se le regole sono diverse o uguali.
- Se la verifica dice "NON esiste esenzione per clienti esistenti", allora existing_customer_exemption.exemption_applies DEVE essere false, non null.
- "legal_restrictions" deve essere array di oggetti strutturati, non stringhe.
- "extra_unstructured_rules" deve essere array di oggetti con topic/text/reason/source.
- Se trovi che il recording è richiesto per documentare il consenso, allora recording.allowed=true, recording.basis="legal obligation", recording.consent_required=true.
- Il JSON DEVE essere valido: nessun commento, nessun testo fuori dal JSON.

Ora ti fornisco i dati seed (v2/CSV) per questo paese.
Compila il JSON finale rispettando ESATTAMENTE la struttura del template sopra:

seed_data:
{json.dumps(country_seed, ensure_ascii=False)}
"""

    return instructions.strip()


def call_llm_for_country(prompt: str, model: str = "sonar") -> tuple[Dict[str, Any], list[str]]:
    """Call Perplexity API (Grounded LLM) and return the JSON dict for the country and citations.
    
    Args:
        prompt: The prompt to send to the model
        model: Perplexity model to use. Options: "sonar" (cheaper) or "sonar-pro" (better quality)
    
    Returns:
        Tuple of (country_json_dict, citations_list)
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY environment variable not set")

    # Perplexity API endpoint for chat completions (Grounded LLM)
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,  # "sonar" (cheaper) or "sonar-pro" (better quality)
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a legal assistant that returns ONLY valid JSON, "
                    "without any additional text, explanations, or comments. "
                    "You MUST search the internet for up-to-date information using web search. "
                    "Use your web search capabilities to find official government sources, "
                    "regulatory authority websites, and official legal documents. "
                    "Your response must start with '{' and end with '}'. "
                    "Do not include any text before or after the JSON object. "
                    "If you cannot find information, use null values but still return valid JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "return_citations": True,  # Get source citations
    }

    with httpx.Client(timeout=120.0) as client:  # 2 minutes timeout (reduced from 5 to avoid long waits)
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    
    # Extract citations if available
    citations = []
    if "citations" in data:
        citations = data["citations"]
    elif "citations" in data.get("choices", [{}])[0].get("message", {}):
        citations = data["choices"][0]["message"]["citations"]
    
    # Try to extract JSON if wrapped in markdown code blocks
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.find("```", start)
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.find("```", start)
        content = content[start:end].strip()
    
    # Try to find JSON object in content if it's not pure JSON
    if not content.strip().startswith("{"):
        # Look for first { and last }
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx + 1]
        else:
            # If no JSON found, check if it's an error message
            content_lower = content.lower() if isinstance(content, str) else ""
            if content_lower and any(phrase in content_lower for phrase in [
                "non è possibile", "non posso", "cannot", "unable", 
                "non disponibile", "not available", "non ho accesso", "no access",
                "non disponibile l'accesso", "accesso agli strumenti esterni"
            ]):
                raise ValueError(
                    f"LLM returned error message instead of JSON. "
                    f"This usually means Perplexity cannot access web search. "
                    f"Content: {content[:300]}"
                )
    
    # Try to parse JSON, with error handling
    try:
        country_json = json.loads(content)
    except json.JSONDecodeError as e:
        # Try to fix common JSON issues
        # Remove trailing commas before closing braces/brackets
        import re
        content = re.sub(r',(\s*[}\]])', r'\1', content)
        # Remove comments (// or /* */)
        content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        try:
            country_json = json.loads(content)
        except json.JSONDecodeError:
            # If still fails, raise with more context
            raise ValueError(f"Failed to parse JSON from response: {str(e)}\nContent preview: {content[:500]}")
    
    return country_json, citations


def validate_json_structure(country_json: Dict[str, Any], template: Dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate that country_json has the same structure as template.
    
    Args:
        country_json: The JSON to validate
        template: The template to validate against
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    def check_structure(actual: Any, expected: Any, path: str = "") -> None:
        if isinstance(expected, dict):
            if not isinstance(actual, dict):
                errors.append(f"{path}: Expected dict, got {type(actual).__name__}")
                return
            for key in expected:
                full_path = f"{path}.{key}" if path else key
                if key not in actual:
                    errors.append(f"{full_path}: Missing required field")
                else:
                    check_structure(actual[key], expected[key], full_path)
        elif isinstance(expected, list):
            if not isinstance(actual, list):
                errors.append(f"{path}: Expected list, got {type(actual).__name__}")
                return
            if expected and isinstance(expected[0], dict):
                # Array of objects - check first element structure
                for i, item in enumerate(actual):
                    if isinstance(item, dict):
                        check_structure(item, expected[0], f"{path}[{i}]")
                    else:
                        errors.append(f"{path}[{i}]: Expected object, got {type(item).__name__}")
        # For null/primitive types, we don't validate values, only structure
    
    check_structure(country_json, template)
    return len(errors) == 0, errors


def post_process_country_data(country_json: Dict[str, Any], iso: str, country_name: str, citations: list[str] = None) -> Dict[str, Any]:
    """Post-process and validate country data to fix common issues.
    
    Args:
        country_json: The JSON data returned by the LLM
        iso: ISO2 code of the country
        country_name: Name of the country
    
    Returns:
        Validated and corrected country JSON
    """
    # Ensure iso and country are correct
    country_json["iso"] = iso
    country_json["country"] = country_name
    
    # Fix caller_id_requirements: if only general principles mentioned, set to null
    if "caller_id_requirements" in country_json:
        cid = country_json["caller_id_requirements"]
        # If note mentions "general principles" or "no explicit rule", set booleans to null
        note_value = cid.get("note")
        note = note_value.lower() if isinstance(note_value, str) else ""
        if note and "general" in note and ("principle" in note or "no explicit" in note or "not specified" in note):
            if cid.get("mandatory") is True and "explicit" not in note:
                cid["mandatory"] = None
            if cid.get("spoofing_prohibited") is True and "explicit" not in note:
                cid["spoofing_prohibited"] = None
    
    # Fix ai_disclosure: if note says "no explicit" or "general", set required/mandatory to null
    if "ai_disclosure" in country_json:
        ai_disc = country_json["ai_disclosure"]
        note_value = ai_disc.get("note")
        note = note_value.lower() if isinstance(note_value, str) else ""
        if note and ("no explicit" in note or ("general" in note and "specific" not in note)):
            if ai_disc.get("required") is True:
                ai_disc["required"] = None
            if ai_disc.get("mandatory") is True:
                ai_disc["mandatory"] = None
    
    # Fix enforcement.risk_level based on max_fine amount if available
    if "enforcement" in country_json:
        enforcement = country_json["enforcement"]
        if "max_fine" in enforcement and "amount" in enforcement["max_fine"]:
            amount = enforcement["max_fine"]["amount"]
            if isinstance(amount, (int, float)):
                # Adjusted thresholds: €100k max is medium-high, but per verification should be "medium"
                if amount < 10000:
                    enforcement["risk_level"] = "low"
                elif amount <= 100000:
                    enforcement["risk_level"] = "medium"
                else:
                    enforcement["risk_level"] = "high"
    
    # Add citations to sources if available
    if citations:
        if "sources" not in country_json:
            country_json["sources"] = {"primary": [], "recent_changes": None, "source_last_updated": None}
        if "primary" not in country_json["sources"]:
            country_json["sources"]["primary"] = []
        
        # Add citations that are URLs
        existing_sources = set(country_json["sources"]["primary"])
        for citation in citations:
            if isinstance(citation, str) and (citation.startswith("http://") or citation.startswith("https://")):
                if citation not in existing_sources:
                    country_json["sources"]["primary"].append(citation)
                    existing_sources.add(citation)
    
    # Remove references to other countries' laws from sources if they're not applicable
    if "sources" in country_json and "primary" in country_json["sources"]:
        sources = country_json["sources"]["primary"]
        # Filter out obvious non-applicable references (FTC TSR, Dutch law, etc.)
        filtered_sources = []
        country_name_lower = country_name.lower() if country_name else ""
        iso_lower = iso.lower() if iso else ""
        for source in sources:
            if not isinstance(source, str):
                continue
            source_lower = source.lower()
            # Keep if it mentions the country name or is clearly about the country
            if any(keyword in source_lower for keyword in [
                country_name_lower, iso_lower, "national", "local", "domestic"
            ]):
                filtered_sources.append(source)
            # Remove obvious foreign law references unless they're about alignment/comparison
            elif any(keyword in source_lower for keyword in [
                "ftc", "telemarketing sales rule", "dutch telecommunications", 
                "us law", "american law", "federal trade commission"
            ]):
                # Only keep if it's about alignment/comparison
                if "align" not in source_lower and "compar" not in source_lower:
                    continue
                filtered_sources.append(source)
            else:
                filtered_sources.append(source)
        country_json["sources"]["primary"] = filtered_sources
    
    # Clean up extra_unstructured_rules: remove entries that reference other countries' laws
    if "extra_unstructured_rules" in country_json:
        rules = country_json["extra_unstructured_rules"]
        filtered_rules = []
        for rule in rules:
            if isinstance(rule, dict):
                text_value = rule.get("text", "")
                source_value = rule.get("source", "")
                text = text_value.lower() if isinstance(text_value, str) else ""
                source = source_value.lower() if isinstance(source_value, str) else ""
                # Remove if it's clearly about another country's law
                if text or source:
                    if any(keyword in text or keyword in source for keyword in [
                        "ftc", "telemarketing sales rule", "dutch", "us law", "american"
                    ]):
                        # Only keep if it's about alignment/comparison
                        if "align" not in text and "compar" not in text:
                            continue
                filtered_rules.append(rule)
            else:
                filtered_rules.append(rule)
        country_json["extra_unstructured_rules"] = filtered_rules
    
    # Ensure legal_restrictions is array of objects, not strings
    if "legal_restrictions" in country_json:
        restrictions = country_json["legal_restrictions"]
        if restrictions and isinstance(restrictions[0], str):
            # Convert strings to objects
            country_json["legal_restrictions"] = [
                {
                    "type": None,
                    "description": r,
                    "value": None,
                    "applies_to": None,
                    "enforcement_level": None
                }
                for r in restrictions
            ]
    
    # Ensure extra_unstructured_rules is array of objects
    if "extra_unstructured_rules" in country_json:
        rules = country_json["extra_unstructured_rules"]
        if rules and isinstance(rules[0], str):
            country_json["extra_unstructured_rules"] = [
                {
                    "topic": None,
                    "text": r,
                    "reason_not_structured": None,
                    "source": None
                }
                for r in rules
            ]
    
    return country_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Build compliance v3 JSON for countries")
    parser.add_argument(
        "--iso",
        type=str,
        help="Process only a specific country by ISO2 code (e.g., AD for Andorra)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process only the first N countries (useful for testing)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from existing compliance.v3.json (skip already processed countries)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="sonar",
        choices=["sonar", "sonar-pro"],
        help="Perplexity model to use: 'sonar' (cheaper) or 'sonar-pro' (better quality). Default: sonar",
    )
    args = parser.parse_args()

    countries = load_countries()
    v2_data = load_v2()

    # Filter by ISO if specified
    if args.iso:
        iso_filter = args.iso.upper()
        countries = [c for c in countries if c["ISO2"].upper() == iso_filter]
        if not countries:
            print(f"ERROR: Country with ISO2 '{iso_filter}' not found in countries.csv")
            return
        print(f"Processing only: {countries[0]['Country']} ({iso_filter})")
    
    # Limit number of countries if specified
    if args.limit:
        countries = countries[:args.limit]
        print(f"Limited to first {args.limit} countries")

    print(f"Using Perplexity model: {args.model}", flush=True)
    print(f"Total countries to process: {len(countries)}", flush=True)
    print(flush=True)

    # Resume from existing file if requested
    if args.resume and OUTPUT_JSON.exists():
        print(f"Resuming from existing {OUTPUT_JSON}...")
        with OUTPUT_JSON.open(encoding="utf-8") as f:
            existing_data = json.load(f)
            fused = existing_data
            already_processed = set(fused.get("fused_by_iso", {}).keys())
            print(f"Found {len(already_processed)} countries already processed: {sorted(already_processed)}")
    else:
        fused: Dict[str, Any] = {
        "schema_version": "3.0",
        "description": "Enhanced compliance model with detailed recording, AI disclosure, quiet hours, enforcement and legal restrictions",
                "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "fused_by_iso": {},
        }
        already_processed = set()

    # Load template for validation
    template_path = BASE_DIR / "template_country.json"
    with template_path.open(encoding="utf-8") as f:
        template = json.load(f)

    total_countries = len(countries)
    print(f"\n🚀 Starting processing of {total_countries} countries...", flush=True)
    print(f"📊 Model: {args.model}", flush=True)
    print(f"🔄 Resume mode: {args.resume}", flush=True)
    if args.resume:
        print(f"✅ Already processed: {len(already_processed)} countries", flush=True)
    print(f"\n{'='*70}\n", flush=True)

    for idx, row in enumerate(countries, start=1):
        iso = row["ISO2"]
        name = row["Country"]
        
        # Skip if already processed and resuming
        if args.resume and iso in already_processed:
            print(f"[{idx}/{total_countries}] ({idx/total_countries*100:.1f}%) Skipping {name} ({iso}) - already processed", flush=True)
            continue
        
        progress_pct = (idx / total_countries) * 100
        print(f"\n[{idx}/{total_countries}] ({progress_pct:.1f}%) Processing {name} ({iso})...", flush=True)

        seed = build_seed(row, v2_data)
        prompt = build_prompt(seed)

        # Retry logic: max 2 attempts (reduced from 3 to save time/API calls)
        max_retries = 2
        country_json = None
        citations = []
        
        for attempt in range(1, max_retries + 1):
            try:
                # Try with specified model first, fallback to sonar if sonar-pro fails
                current_model = args.model
                if attempt > 1 and args.model == "sonar-pro":
                    # If sonar-pro fails, try sonar on retry
                    current_model = "sonar"
                    print(f"  🔄 Retrying with model 'sonar' instead of 'sonar-pro'...", flush=True)
                
                country_json, citations = call_llm_for_country(prompt, model=current_model)
                
                # Post-process first
                country_json = post_process_country_data(country_json, iso, name, citations)
                
                # Validate structure
                is_valid, errors = validate_json_structure(country_json, template)
                
                if is_valid:
                    print(f"  ✓ Valid JSON structure - {name} ({iso}) completed", flush=True)
                    break
                else:
                    if attempt < max_retries:
                        print(f"  ⚠ Attempt {attempt}: JSON structure validation failed ({len(errors)} errors), retrying...", flush=True)
                        if len(errors) <= 5:  # Show errors if not too many
                            for error in errors[:5]:
                                print(f"    - {error}", flush=True)
                    else:
                        print(f"  ⚠ Attempt {attempt}: JSON structure validation failed after {max_retries} attempts", flush=True)
                        print(f"    Continuing anyway with {len(errors)} structural errors", flush=True)
                        # Show first few errors
                        for error in errors[:10]:
                            print(f"    - {error}", flush=True)
                        break
            except Exception as e:
                if attempt < max_retries:
                    print(f"  ⚠ Attempt {attempt}: Error occurred, retrying... ({str(e)[:100]})", flush=True)
                else:
                    print(f"  ✗ ERROR for {iso} after {max_retries} attempts: {e}", flush=True)
                    country_json = None
                    break
        
        if country_json is None:
            print(f"  ✗ Skipping {iso} due to persistent errors", flush=True)
            continue

        # Minimal sanity checks
        if country_json.get("iso") != iso:
            print(f"  WARNING: iso mismatch in response for {iso}, fixing.", flush=True)
            country_json["iso"] = iso
        if country_json.get("country") is None:
            country_json["country"] = name

        fused["fused_by_iso"][iso] = country_json
        
        # Save progress periodically (every 10 countries) to avoid losing data
        if len(fused["fused_by_iso"]) % 10 == 0:
            with OUTPUT_JSON.open("w", encoding="utf-8") as f:
                json.dump(fused, f, ensure_ascii=False, indent=2)
            completed = len(fused["fused_by_iso"])
            print(f"\n📊 Progress saved: {completed}/{total_countries} countries completed ({completed/total_countries*100:.1f}%)\n", flush=True)

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(fused, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Completed! Saved {OUTPUT_JSON}", flush=True)
    print(f"📈 Total countries processed: {len(fused['fused_by_iso'])}", flush=True)


if __name__ == "__main__":
    main()
