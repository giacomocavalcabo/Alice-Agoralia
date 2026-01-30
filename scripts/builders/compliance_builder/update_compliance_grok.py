#!/usr/bin/env python3
"""
Aggiorna compliance.v3.json usando Grok API.
Script ottimizzato per costi e velocità con resume automatico.
"""

import json
import time
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Set
from datetime import datetime, timezone
from openai import OpenAI
import argparse

# ===================== CONFIGURAZIONE =====================
BASE_DIR = Path(__file__).parent
INPUT_FILE = BASE_DIR / "compliance.v3.json"
OUTPUT_FILE = BASE_DIR / "compliance.v3.updated.json"
PROGRESS_FILE = BASE_DIR / "progress_grok.json"
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

# Paesi da elaborare (lascia vuoto = tutti)
# Esempi per test rapidi: ONLY_COUNTRIES = ["AD", "AE", "IT", "DE"]
ONLY_COUNTRIES: List[str] = []

# Modelli disponibili per test
MODEL_FAST = "grok-4-fast-non-reasoning"  # ~5x più economico, veloce
MODEL_POWERFUL = "grok-4-1-fast-reasoning"  # più intelligente, trova più errori (con reasoning)
# o se vuoi il top assoluto:
# MODEL_POWERFUL = "grok-4-0709"  # se disponibile nel tuo account

MODEL = MODEL_POWERFUL  # Default: usa modello reasoning per massima accuratezza

# Quanti paesi processare per batch
# Per modello reasoning: batch più piccoli (2) per evitare troncamenti JSON
# Per modello veloce: batch più grandi (4) vanno bene
# Se ci sono errori JSON troncati, usa BATCH_SIZE = 1 per processare un paese alla volta
BATCH_SIZE = 1  # Ridotto a 1 per paesi problematici (massima sicurezza, evita JSON troncati)

# ===================== CLIENT API =====================
def get_client() -> OpenAI:
    # Prova prima da variabile d'ambiente
    api_key = os.getenv("GROK_API_KEY")
    
    # Se non trovata, prova a leggere da file .env nella directory corrente
    if not api_key:
        env_file = BASE_DIR / ".env"
        if env_file.exists():
            try:
                with env_file.open("r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GROK_API_KEY="):
                            api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
            except Exception:
                pass
    
    if not api_key:
        raise ValueError(
            "GROK_API_KEY non trovata. Esportala con: export GROK_API_KEY='your-key'\n"
            "Oppure crea un file .env nella directory compliance_builder con: GROK_API_KEY=your-key"
        )
    return OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")

def validate_api_key(client: OpenAI) -> bool:
    """Valida l'API key facendo una chiamata di test."""
    try:
        # Prova una chiamata molto semplice per validare la chiave
        response = client.chat.completions.create(
            model="grok-4-fast-non-reasoning",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5
        )
        return True
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "unauthorized" in error_msg.lower() or "invalid" in error_msg.lower():
            print(f"❌ API key non valida: {error_msg[:200]}")
            return False
        else:
            # Altri errori potrebbero essere temporanei, ma comunque segnaliamo
            print(f"⚠️  Errore validazione API: {error_msg[:200]}")
            return False

# ===================== PROMPT OTTIMIZZATO =====================
def build_prompt(countries_block: str, json_snippet: str) -> str:
    """Costruisce il prompt completo con template JSON incluso."""
    template_path = BASE_DIR / "template_country.json"
    with template_path.open(encoding="utf-8") as f:
        template = json.load(f)
    
    template_json_str = json.dumps(template, ensure_ascii=False, indent=2)
    
    return f"""Sei un esperto mondiale di compliance telemarketing e AI voice calls.
Il tuo compito è AGGIORNARE e VERIFICARE dati esistenti, NON generare da zero.

CRITICO - VERIFICA E CORREGGI ERRORI NEI DATI ESISTENTI:
Anche se non trovi novità dal 2024, DEVI VERIFICARE e CORREGGERE i dati esistenti confrontandoli con fonti ufficiali:

1. VERIFICA ogni campo confrontandolo con fonti ufficiali:
   - Se un campo contiene valori chiaramente errati (es. "TEST MODIFIED", "unregulated" quando dovrebbe essere "opt-in", ecc.), CORREGGILI
   - Se un campo dice "has_registry: true" ma le fonti ufficiali dicono che non esiste registry, CORREGGILO a false
   - Se un campo contiene descrizioni contraddittorie con le leggi ufficiali, CORREGGILE

2. CORREGGI errori evidenti:
   - Nomi paesi modificati o errati → correggi al nome corretto
   - Continent errato → correggi al continente corretto
   - Regime legale errato (es. "unregulated" quando è "opt-in") → correggi
   - Valori boolean errati (es. has_registry: true quando è false) → correggi
   - URL fake o errati → rimuovi o correggi

3. COMPLETA informazioni mancanti se trovi fonti ufficiali

4. AGGIORNA fonti se trovi fonti più recenti o autorevoli

5. Aggiorna sempre "last_verified" con la data di oggi (YYYY-MM-DD)

Priorità di aggiornamento:
1. Novità normative dal 2024-2025 (ALTA PRIORITÀ)
2. Correzioni di dati esistenti se trovi fonti ufficiali che li contraddicono
3. Completamento di campi vuoti (null) se trovi informazioni ufficiali
4. Aggiornamento di fonti se trovi fonti più recenti o autorevoli

Paesi da analizzare:
{countries_block}

JSON attuale (parziale) - struttura completa per ogni paese:
{json_snippet}

FONTI RICHIESTE - SOLO FONTI UFFICIALI O AFFIDABILI:
PREDILIGI ESCLUSIVAMENTE fonti ufficiali o altamente affidabili:
- Siti governativi (.gov, .gouv, .govt, .go, .gov.uk, ecc.)
- Autorità di regolamentazione ufficiali (agenzie di protezione dati, autorità telecom, ecc.)
- Leggi e regolamenti ufficiali pubblicati su siti governativi
- Organizzazioni internazionali ufficiali (UE, ONU, OECD, ecc.)
- Università e istituzioni accademiche riconosciute (.edu, .ac.uk, ecc.)

NON usare:
- Blog, siti commerciali, siti di marketing/SEO
- Siti generici di business o consulenza
- Fonti non verificate o non ufficiali
- Articoli di news o media generalisti (a meno che non citino fonti ufficiali)

Cerca ESPLICITAMENTE su internet (usa web search):
- Leggi sulla protezione dei dati personali (solo da siti ufficiali)
- Autorità di protezione dati (solo siti ufficiali dell'autorità)
- Regolamenti sul telemarketing (solo da fonti governative)
- Leggi sulle telecomunicazioni (solo da fonti ufficiali)
- Consumer protection laws (solo da fonti governative)
- Regole su AI disclosure per quote requests o existing customers
- Novità normative pubblicate nel 2024-2025

Regole fondamentali CRITICHE:
- NON inventare informazioni. Se non trovi una regola specifica, lascia il campo INVARIATO.
- NON assumere regole da altri paesi. Focus SOLO su normative specifiche del paese.
- Se una cosa NON è specificata o vietata, considerala COME PERMESSA (ma non modificare il campo se già presente).
- Per boolean: usa true SOLO se trovi una regola esplicita che lo richiede; usa false SOLO se trovi una regola esplicita che lo vieta; altrimenti usa null.
- Se trovi informazioni contraddittorie, usa quelle più recenti o da fonti più autorevoli (siti governativi > agenzie > articoli).

Regole di aggiornamento CRITICHE:
- Se trovi ERRORI EVIDENTI nei dati esistenti (es. "TEST MODIFIED", valori contraddittori con leggi ufficiali, URL fake) → CORREGGILI IMMEDIATAMENTE
- Se non trovi nulla di nuovo dal 2024 MA i dati esistenti sono corretti → lascia INVARIATO
- Se trovi novità → modifica SOLO il campo specifico e aggiungi in "sources.recent_changes" la data e il link
- Aggiorna sempre "last_verified" con data di oggi (YYYY-MM-DD)
- Se sei sicuro al 100% metti confidence: "high", altrimenti "medium"
- PRESERVA la struttura JSON esistente (non cambiare nomi di campi, non aggiungere campi nuovi, non rimuovere campi esistenti)
- Per ai_disclosure.exceptions: aggiungi "quote requests" solo se trovi fonti ufficiali che lo confermano esplicitamente

DISCLAIMER GENERICI - NON AGGIUNGERLI:
- NON aggiungere frasi generiche tipo "You should consult current laws" o "seek local legal advice" nei campi note
- NON aggiungere frasi tipo "It is not possible to determine" o "not available in this environment"
- Se non trovi informazioni, scrivi semplicemente "No specific [campo] requirements found in [fonte]" senza disclaimer generici
- Le note devono essere CONCISE e INFORMATIVE, non disclaimer legali generici

ESEMPI di correzione errori (CORREGGI SEMPRE):
- "country": "Andorra TEST MODIFIED" → "country": "Andorra"
- "regime.b2b.type": "unregulated" → verifica con fonti e correggi (es. "permission-based with data protection framework")
- "regime.b2c.type": "opt-out only" → verifica con fonti e correggi (es. "opt-in consent required")
- "regime.b2b.description": contiene "unregulated" o "no restrictions" → verifica e correggi con descrizione corretta
- "regime.b2c.description": contiene "NO consent" o "opt-out only" → verifica e correggi con descrizione corretta
- "dnc.has_registry": true ma fonti dicono che non esiste → false
- "ai_disclosure.required": false quando dovrebbe essere null → null
- Qualsiasi campo che contiene "TEST MODIFIED", "fake", o valori chiaramente errati → CORREGGI

ISTRUZIONI SPECIFICHE PER CAMPO (aggiorna solo se trovi novità):

1. "regime": Struttura {{"b2b": {{"description": ..., "type": ...}}, "b2c": {{"description": ..., "type": ...}}}}
   - Aggiorna solo se trovi nuove normative che cambiano il regime legale.

2. "relationship_requirements": Struttura b2b/b2c con campi specifici.
   - Aggiorna solo se trovi nuove regole su existing relationship, opt-in, soft opt-in.

3. "existing_customer_exemption": Struttura b2b/b2c.
   - Aggiorna solo se trovi nuove normative su esenzioni per clienti esistenti.

4. "dnc": Campi: api_available, check_required, existing_customer_exemption, has_registry, name, url.
   - Aggiorna solo se trovi nuove informazioni su registry DNC o API disponibili.

5. "ai_disclosure": Campi: required, mandatory, timing, text_suggested, exceptions, note.
   - IMPORTANTE: Cerca ESPLICITAMENTE se ci sono eccezioni per quote requests o existing customers.
   - Aggiorna "exceptions" solo se trovi fonti ufficiali che confermano eccezioni specifiche.

6. "recording": Campi: allowed, basis, notification_timing, notification_required, consent_required, retention.
   - Aggiorna solo se trovi nuove normative su registrazione chiamate.

7. "quiet_hours": Campi: enabled, weekdays (start, end, timezone), saturday, sunday, holidays.
   - CRITICO: "quiet_hours" sono le ore PROIBITE (NON CONSENTITE) per chiamare, NON le ore consentite.
   - Esempio: se le chiamate sono vietate dalle 20:00 alle 09:00, allora weekdays.start = "20:00" e weekdays.end = "09:00".
   - Se le chiamate sono vietate tutto il sabato, saturday = true (o un range orario se specificato).
   - Aggiorna solo se trovi nuove normative su orari PROIBITI per le chiamate.

8. "caller_id_requirements": Campi: mandatory, prefix_required, company_name_required, spoofing_prohibited, anonymous_calls_prohibited.
   - IMPORTANTE: Se trovi solo "principi generali" senza regole specifiche, NON modificare (lascia invariato).

9. "frequency_limits": Campi: max_calls_per_day, max_calls_per_week, max_calls_per_month.
   - Aggiorna solo se trovi nuove normative su limiti di frequenza.

10. "legal_restrictions": Array di OGGETTI con struttura {{"type": ..., "description": ..., "value": ..., "applies_to": ..., "enforcement_level": ...}}.
    - Aggiorna solo se trovi nuove restrizioni legali.

11. "enforcement": Campi: max_fine (amount, currency, per_violation), regulator (name, url, type), risk_level.
    - Aggiorna solo se trovi nuove informazioni su multe o autorità di regolamentazione.

12. "sources": Campi: primary (array), recent_changes, source_last_updated.
    - Aggiungi nuove fonti ufficiali in "primary" se trovi nuove informazioni.
    - Aggiorna "recent_changes" con data e link se modifichi qualcosa.

13. "extra_unstructured_rules": Array di OGGETTI con {{"topic": ..., "text": ..., "reason_not_structured": ..., "source": ...}}.
    - Aggiungi solo se trovi regole importanti che non si adattano ai campi strutturati.

Template JSON (struttura esatta da rispettare):
{template_json_str}

Output ESATTAMENTE questo formato JSON (niente testo extra, solo JSON valido):
{{
  "updated": {{
    "ISO2": {{ /* JSON completo del paese aggiornato, stessa struttura di input, SOLO campi modificati o tutti se necessario */ }},
    "ISO2": {{ /* ... */ }}
  }},
  "changes": ["ISO2: campo cambiato → nuovo valore (fonte URL)"]
}}

IMPORTANTE: 
- Restituisci SOLO JSON valido, senza markdown, senza commenti.
- In "updated" includi SOLO i paesi per cui hai trovato novità (o tutti se necessario per preservare struttura).
- Se non trovi novità per un paese, NON includerlo in "updated".
- In "changes" elenca tutte le modifiche con formato: "ISO2: campo → nuovo valore (URL fonte)"."""

# ===================== FUNZIONI =====================
def load_json() -> Dict[str, Any]:
    """Carica il file compliance.v3.json."""
    with INPUT_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)

def save_progress(data: Dict, changes: List[str], processed: Set[str]):
    """Salva progresso e backup."""
    # Backup
    backup_path = BACKUP_DIR / f"backup_{int(time.time())}.json"
    with backup_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Aggiorna generated_at
    data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Salva file aggiornato
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Salva progresso per resume
    progress = {
        "processed": sorted(list(processed)),
        "changes": changes,
        "last_update": datetime.now(timezone.utc).isoformat()
    }
    with PROGRESS_FILE.open("w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)
    
    print(f"\n💾 Progresso salvato → {len(processed)} paesi elaborati\n")

def get_countries_to_process(data: Dict, filter_iso: List[str] = None) -> List[str]:
    """Ottiene lista paesi da processare."""
    fused = data.get("fused_by_iso", {})
    all_countries = list(fused.keys())
    
    # Usa filter_iso se fornito, altrimenti ONLY_COUNTRIES, altrimenti tutti
    filter_list = filter_iso if filter_iso is not None else (ONLY_COUNTRIES if ONLY_COUNTRIES else None)
    
    if filter_list:
        filtered = [c for c in filter_list if c in all_countries]
        if not filtered and filter_list:
            # Se il filtro non ha trovato nulla, potrebbe essere un errore
            print(f"⚠️  Nessun paese trovato con ISO: {filter_list}")
        return filtered
    return sorted(all_countries)

def extract_json_from_response(content: str) -> Dict[str, Any]:
    """Estrae JSON dalla risposta, gestendo markdown code blocks."""
    # Rimuovi markdown code blocks
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.find("```", start)
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.find("```", start)
        content = content[start:end].strip()
    
    # Trova primo { e ultimo }
    if not content.strip().startswith("{"):
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        if start_idx != -1 and end_idx != -1:
            content = content[start_idx:end_idx + 1]
    
    # Fix trailing commas
    content = re.sub(r',(\s*[}\]])', r'\1', content)
    
    return json.loads(content)

def main():
    parser = argparse.ArgumentParser(description="Update compliance.v3.json using Grok API")
    parser.add_argument("--iso", type=str, action="append", help="Process only specific country (ISO2). Can be used multiple times: --iso HU --iso ID")
    parser.add_argument("--limit", type=int, help="Process only first N countries")
    parser.add_argument("--model", type=str, default=MODEL, help="Grok model to use")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Countries per batch")
    parser.add_argument("--resume", action="store_true", help="Resume from progress.json")
    parser.add_argument("--test-models", action="store_true", help="Test with both fast and powerful models (only for --iso)")
    parser.add_argument("--compare", type=str, help="Confronta due modelli su un paese: --compare IT")
    parser.add_argument("--fast-only", action="store_true", help="Usa solo modello veloce (default produzione)")
    parser.add_argument("--powerful-only", action="store_true", help="Usa solo modello potente")
    
    args = parser.parse_args()
    
    # Override configurazione con argomenti CLI
    only_countries = ONLY_COUNTRIES.copy()
    model = MODEL
    batch_size = BATCH_SIZE
    models_to_test = []
    
    # Gestione flag per modelli
    if args.compare:
        only_countries = [args.compare.upper()]
        models_to_test = [MODEL_FAST, MODEL_POWERFUL]
        print(f"🧪 Modalità confronto attivata per {args.compare.upper()}")
    elif args.powerful_only:
        model = MODEL_POWERFUL
        models_to_test = [MODEL_POWERFUL]
    elif args.fast_only:
        model = MODEL_FAST
        models_to_test = [MODEL_FAST]
    else:
        if args.iso:
            # Supporta sia singolo che multipli --iso
            if isinstance(args.iso, list):
                only_countries = [iso.upper() for iso in args.iso]
            else:
                only_countries = [args.iso.upper()]
        if args.model:
            model = args.model
        if args.batch_size:
            batch_size = args.batch_size
    
    print("📖 Carico compliance.v3.json…")
    data = load_json()
    
    # Riprendi da dove eri rimasto
    processed: Set[str] = set()
    all_changes: List[str] = []
    
    if args.resume and PROGRESS_FILE.exists():
        try:
            with PROGRESS_FILE.open("r", encoding="utf-8") as f:
                prog = json.load(f)
            processed = set(prog.get("processed", []))
            all_changes = prog.get("changes", [])
            print(f"🔄 Riprendo da {len(processed)} paesi già processati")
        except Exception as e:
            print(f"⚠️  Errore caricamento progress: {e}")
    
    # Filtra paesi in base a --iso o --compare se specificato
    filter_iso = None
    if args.compare:
        filter_iso = [args.compare.upper()]
    elif args.iso:
        # Supporta sia singolo che multipli --iso
        if isinstance(args.iso, list):
            filter_iso = [iso.upper() for iso in args.iso]
        else:
            filter_iso = [args.iso.upper()]
    countries = get_countries_to_process(data, filter_iso=filter_iso)
    
    if args.limit:
        countries = countries[:args.limit]
    
    if not countries:
        print("❌ Nessun paese da processare. Verifica il filtro --iso o --limit.")
        return
    
    to_process = [c for c in countries if c not in processed]
    print(f"🚀 Paesi da elaborare: {len(to_process)} / {len(countries)}")
    if args.iso or args.compare:
        if args.compare:
            iso_filter = args.compare.upper()
        elif args.iso:
            if isinstance(args.iso, list):
                iso_filter = ", ".join([iso.upper() for iso in args.iso])
            else:
                iso_filter = args.iso.upper()
        print(f"🎯 Filtro ISO attivo: {iso_filter}")
    
    # Determina modelli da testare
    if not models_to_test:
        if args.test_models and args.iso:
            models_to_test = [MODEL_FAST, MODEL_POWERFUL]
            print(f"🧪 Modalità test: confronterò {MODEL_FAST} vs {MODEL_POWERFUL}")
        else:
            models_to_test = [model]
    
    print(f"📊 Model(s): {', '.join(models_to_test)}, Batch size: {batch_size}\n")
    
    # Valida API key prima di iniziare
    print("🔑 Validazione API key...", end=" ", flush=True)
    client = get_client()
    if not validate_api_key(client):
        print("❌ API key non valida. Interruzione.")
        return
    print("✅ API key valida\n")
    
    fused = data.get("fused_by_iso", {})
    
    # Se test con due modelli, processa ogni paese con entrambi i modelli
    if len(models_to_test) > 1:
        # MODO CONFRONTO: solo per --iso o --compare
        iso = to_process[0]  # già garantito che sia uno solo
        
        print(f"\n{'='*80}")
        print(f"🧪 TEST CONFRONTO MODELLI PER {iso} – {fused[iso].get('country', 'Unknown')}")
        print(f"{'='*80}\n")
        
        results = {}
        
        for test_model in models_to_test:
            print(f"📊 Modello: {test_model}")
            print(f"{'─'*60}")
            
            try:
                prompt = build_prompt(
                    countries_block=f"- {iso} ({fused[iso].get('country')})",
                    json_snippet=json.dumps({iso: fused[iso]}, ensure_ascii=False, indent=2)
                )
                
                start_time = time.time()
                response = client.chat.completions.create(
                    model=test_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=12000
                )
                elapsed = time.time() - start_time
                
                result = extract_json_from_response(response.choices[0].message.content)
                updated = result.get("updated", {}).get(iso, {})
                changes = result.get("changes", [])
                
                results[test_model] = {
                    "changes_count": len(changes),
                    "changes": changes,
                    "updated_fields": len(updated),
                    "tokens_used": response.usage.total_tokens if response.usage else "N/A",
                    "time_sec": round(elapsed, 2),
                    "confidence": updated.get("confidence", "N/A")
                }
                
                print(f"   ✅ Cambiamenti trovati: {len(changes)}")
                print(f"   📊 Token usati: {results[test_model]['tokens_used']}")
                print(f"   ⏱️  Tempo: {elapsed:.2f}s")
                if changes:
                    for c in changes[:4]:
                        print(f"     • {c}")
                print()
                
            except Exception as e:
                print(f"   ❌ ERRORE: {str(e)[:120]}")
                results[test_model] = {"error": str(e)}
            
            time.sleep(2)
        
        # === CONFRONTO FINALE VISIVO ===
        print(f"{'='*80}")
        print("📊 CONFRONTO FINALE")
        print(f"{'='*80}")
        fast = results.get(MODEL_FAST, {})
        power = results.get(MODEL_POWERFUL, {})
        
        print(f"{'Modello':<35} {'Cambiamenti':<15} {'Token':<12} {'Tempo':<10}")
        print(f"{'─'*80}")
        print(f"{MODEL_FAST:<35} {fast.get('changes_count', 0):<15} {str(fast.get('tokens_used','?')):<12} {str(fast.get('time_sec','?')):<10}")
        print(f"{MODEL_POWERFUL:<35} {power.get('changes_count', 0):<15} {str(power.get('tokens_used','?')):<12} {str(power.get('time_sec','?')):<10}")
        
        if fast.get('changes_count', 0) < power.get('changes_count', 0):
            diff = power['changes_count'] - fast.get('changes_count', 0)
            print(f"\n🎯 Il modello potente ha trovato {diff} errori in più!")
        elif fast.get('changes_count', 0) > power.get('changes_count', 0):
            print(f"\n⚠️  Stranamente il modello veloce ha fatto meglio (raro, ma possibile se il potente ha esitato)")
        else:
            print(f"\n✅ Entrambi i modelli hanno trovato lo stesso numero di cambiamenti")
        
        # Salva confronto su file
        compare_file = BASE_DIR / f"comparison_{iso}_{int(time.time())}.json"
        with open(compare_file, "w", encoding="utf-8") as f:
            json.dump({"country": iso, "results": results}, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Confronto salvato in: {compare_file}")
        
        return  # esce dopo il test singolo
    else:
        # Processamento normale con un solo modello
        for i in range(0, len(to_process), batch_size):
            batch = to_process[i:i+batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(to_process) + batch_size - 1) // batch_size
            
            print(f"[Batch {batch_num}/{total_batches}] {', '.join(batch)}...", end=" ", flush=True)
            
            # Prepara snippet JSON (solo i paesi del batch)
            batch_data = {iso: fused[iso] for iso in batch if iso in fused}
            json_snippet = json.dumps(batch_data, ensure_ascii=False, indent=2)
            
            countries_block = "\n".join([
                f"- {iso} ({fused[iso].get('country', 'Unknown')})"
                for iso in batch if iso in fused
            ])
            
            try:
                prompt = build_prompt(countries_block, json_snippet)
                
                # Aumenta max_tokens per modello reasoning (fa analisi più approfondite)
                max_tokens_value = 20000 if model == MODEL_POWERFUL else 8000
                
                response = client.chat.completions.create(
                    model=model,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=max_tokens_value
                )
                
                result_content = response.choices[0].message.content
                result = extract_json_from_response(result_content)
                
                # Debug: mostra cosa ha restituito Grok
                updated_countries = result.get("updated", {})
                batch_changes = result.get("changes", [])
                
                if not updated_countries:
                    print("⚠️  Grok non ha restituito paesi in 'updated'")
                    print(f"    Response keys: {list(result.keys())}")
                    print(f"    'updated' è vuoto: {updated_countries}")
                    print(f"    'changes': {batch_changes}")
                    # Mostra un sample della risposta per debug
                    if 'result_content' in locals():
                        print(f"    Response preview (primi 500 char): {result_content[:500]}")
                else:
                    print(f"📝 Grok ha processato {len(updated_countries)} paesi: {list(updated_countries.keys())}")
                
                # Merge aggiornamenti
                for iso, updated_country in updated_countries.items():
                    if iso in fused:
                        # Merge preservando struttura esistente
                        fused[iso].update(updated_country)
                        processed.add(iso)
                        print(f"  ✅ {iso} aggiornato e marcato come processato")
                    else:
                        print(f"  ⚠️  {iso} non trovato in fused_by_iso")
                
                # Se non ci sono aggiornamenti ma il paese è nel batch, marcalo comunque come processato
                # (per evitare di riprocessarlo continuamente)
                for iso in batch:
                    if iso not in processed:
                        processed.add(iso)
                        if not updated_countries:
                            print(f"  ℹ️  {iso} marcato come processato (nessun cambiamento trovato)")
                
                # Aggiungi ai cambiamenti
                all_changes.extend(batch_changes)
                
                if batch_changes:
                    print(f"✅ {len(batch_changes)} cambiamenti trovati")
                    for change in batch_changes[:3]:  # Mostra primi 3 cambiamenti
                        print(f"   • {change}")
                else:
                    print("✅ Nessun cambiamento trovato (dati già aggiornati o nessuna novità 2024+)")
                
            except json.JSONDecodeError as e:
                error_msg = str(e)
                print(f"⚠️  Errore parsing JSON: {error_msg[:100]}")
                
                # Verifica se è un JSON troncato
                if "Unterminated" in error_msg or "truncated" in error_msg.lower():
                    print(f"    ⚠️  JSON troncato - max_tokens potrebbe essere troppo basso")
                    print(f"    💡 Suggerimento: riduci batch_size o aumenta max_tokens")
                
                if 'result_content' in locals():
                    preview_len = min(500, len(result_content))
                    print(f"    Response preview (primi {preview_len} char): {result_content[:preview_len]}...")
                    print(f"    Lunghezza totale response: {len(result_content)} caratteri")
                    
                    # Verifica se la risposta è stata troncata
                    if response.choices[0].finish_reason == "length":
                        print(f"    ❌ RISPOSTA TRONCATA - max_tokens insufficiente!")
                        print(f"    Token usati: {response.usage.total_tokens if response.usage else 'N/A'}")
                
                # Continua con prossimo batch (non bloccare tutto il processo)
                print(f"    ⏭️  Saltando questo batch, continuo con il prossimo...")
            except Exception as e:
                print(f"⚠️  Errore: {str(e)[:100]}")
                time.sleep(5)
            
            # Salva ogni batch (progressivo)
            save_progress(data, all_changes, processed)
            time.sleep(1)  # Gentile coi rate limit
    
    print("\n" + "="*70)
    print("✅ COMPLETATO!")
    print("="*70)
    print(f"📁 File aggiornato: {OUTPUT_FILE}")
    print(f"📊 Paesi processati: {len(processed)}")
    print(f"📝 Cambiamenti trovati: {len(all_changes)}")
    
    if all_changes:
        print("\n📋 Elenco cambiamenti:")
        for c in all_changes[:20]:
            print(f"  • {c}")
        if len(all_changes) > 20:
            print(f"  ...e altri {len(all_changes) - 20}")

if __name__ == "__main__":
    main()

