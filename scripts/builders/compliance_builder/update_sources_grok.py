#!/usr/bin/env python3
"""
Aggiorna le sources usando Grok API.
- Classifica fonti esistenti (governamental vs non-governamental)
- Cerca nuove fonti ufficiali (web search in inglese e lingua locale)
- Cerca link per fonti senza link
- Cerca nomi per link senza nome
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
INPUT_FILE = BASE_DIR / "compliance.v3.migrated.json"
OUTPUT_FILE = BASE_DIR / "compliance.v3.sources_updated.json"
PROGRESS_FILE = BASE_DIR / "progress_sources.json"
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

MODEL = "grok-4-1-fast-reasoning"  # Modello con reasoning per web search
BATCH_SIZE = 1  # Un paese alla volta per evitare troncamenti

# ===================== CLIENT API =====================
def get_client() -> OpenAI:
    api_key = os.getenv("GROK_API_KEY")
    
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
    """Valida l'API key."""
    try:
        response = client.chat.completions.create(
            model="grok-4-fast-non-reasoning",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5
        )
        return True
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "unauthorized" in error_msg.lower():
            print(f"❌ API key non valida: {error_msg[:200]}")
            return False
        return False


# ===================== PROMPT =====================
def build_prompt(country_name: str, iso: str, existing_sources: List[Dict]) -> str:
    """Costruisce il prompt per Grok."""
    
    # Prepara lista fonti esistenti
    sources_text = ""
    for i, src in enumerate(existing_sources, 1):
        name = src.get("name", "")
        url = src.get("url", "")
        if name and url:
            sources_text += f"{i}. {name} - {url}\n"
        elif name:
            sources_text += f"{i}. {name} (senza link)\n"
        elif url:
            sources_text += f"{i}. {url} (senza nome)\n"
    
    return f"""Sei un esperto di ricerca di fonti ufficiali per compliance telemarketing.

Il tuo compito è analizzare e migliorare le fonti per {country_name} ({iso}).

FONTI ESISTENTI (attualmente tutte in non-governamental):
{sources_text if sources_text else "Nessuna fonte esistente"}

COMPITI:

1. CLASSIFICAZIONE FONTI ESISTENTI:
   - Analizza ogni fonte esistente
   - Cerca su internet se è governativa o no
   - Classifica in "governamental" o "non-governamental"
   - Per fonti governative, verifica che il dominio sia effettivamente ufficiale

2. COMPLETAMENTO FONTI ESISTENTI:
   - Per fonti con solo nome (senza link): cerca il link ufficiale su internet
   - Per link senza nome: cerca il nome/titolo ufficiale del documento/pagina
   - Usa web search per trovare informazioni accurate

3. RICERCA NUOVE FONTI UFFICIALI:
   - Cerca su internet fonti ufficiali per {country_name} ({iso})
   - Cerca sia in INGLESE che nella LINGUA LOCALE del paese
   - Cerca:
     * Leggi e regolamenti ufficiali sul telemarketing
     * Autorità di regolamentazione (data protection, telecom, consumer protection)
     * Database ufficiali Do Not Call (se esistono)
     * Landing page ufficiali di autorità governative
     * Documenti ufficiali pubblicati da ministeri/agenzie
   - SOLO fonti ufficiali (.gov, .gouv, autorità governative, ecc.)
   - NON includere blog, articoli di news, siti commerciali

4. STRUTTURA OUTPUT:
   Ogni fonte deve avere:
   - "name": nome/titolo del documento o pagina (se disponibile)
   - "url": link ufficiale (se disponibile)
   - Se una fonte ha solo nome o solo URL, cerca di completarla

FONTI UFFICIALI DA CERCARE:
- Siti governativi (.gov, .gouv, .govt, ecc.)
- Autorità di regolamentazione ufficiali
- Leggi e regolamenti pubblicati su siti governativi
- Database ufficiali (es. Do Not Call registries)
- Documenti ufficiali di ministeri/agenzie

NON includere:
- Blog, siti commerciali, articoli di news
- Siti di consulenza o marketing
- Fonti non verificate

IMPORTANTE:
- Usa web search per verificare ogni fonte
- Cerca sia in inglese che nella lingua locale
- Per {country_name}, cerca anche termini nella lingua locale
- Massimizza il numero di fonti ufficiali trovate
- Completa nome/URL quando possibile

Output JSON:
{{
  "governamental": [
    {{"name": "Nome documento", "url": "https://..."}},
    {{"name": "Altro documento", "url": "https://..."}}
  ],
  "non-governamental": [
    {{"name": "Nome", "url": "https://..."}}
  ],
  "new_sources_found": ["Lista di nuove fonti trovate"],
  "sources_completed": ["Lista di fonti completate (nome o URL aggiunto)"]
}}

Restituisci SOLO JSON valido, senza markdown, senza commenti."""


def extract_json_from_response(content: str) -> Dict[str, Any]:
    """Estrae JSON dalla risposta."""
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


def load_json() -> Dict[str, Any]:
    """Carica il file JSON."""
    with INPUT_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_progress(data: Dict, processed: Set[str], costs: Dict[str, Dict] = None):
    """Salva progresso e backup."""
    # Backup
    backup_path = BACKUP_DIR / f"backup_sources_{int(time.time())}.json"
    with backup_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Aggiorna generated_at
    data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Salva file aggiornato
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Salva progresso con costi
    progress = {
        "processed": sorted(list(processed)),
        "last_update": datetime.now(timezone.utc).isoformat()
    }
    
    if costs:
        progress["costs"] = costs
        total_cost = sum(c.get("total_cost", 0) for c in costs.values())
        progress["total_cost"] = total_cost
    
    with PROGRESS_FILE.open("w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)
    
    print(f"\n💾 Progresso salvato → {len(processed)} paesi elaborati\n")


def main():
    parser = argparse.ArgumentParser(description="Update sources using Grok API")
    parser.add_argument("--iso", type=str, action="append", help="Process only specific country (ISO2). Can be used multiple times")
    parser.add_argument("--limit", type=int, help="Process only first N countries")
    parser.add_argument("--resume", action="store_true", help="Resume from progress.json")
    parser.add_argument("--model", type=str, default=MODEL, help="Grok model to use")
    
    args = parser.parse_args()
    
    print("📖 Carico compliance.v3.migrated.json…")
    data = load_json()
    
    # Riprendi da dove eri rimasto
    processed: Set[str] = set()
    
    if args.resume and PROGRESS_FILE.exists():
        try:
            with PROGRESS_FILE.open("r", encoding="utf-8") as f:
                prog = json.load(f)
            processed = set(prog.get("processed", []))
            print(f"🔄 Riprendo da {len(processed)} paesi già processati")
        except Exception as e:
            print(f"⚠️  Errore caricamento progress: {e}")
    
    # Filtra paesi
    countries = list(data.get("fused_by_iso", {}).keys())
    
    if args.iso:
        if isinstance(args.iso, list):
            filter_iso = [iso.upper() for iso in args.iso]
        else:
            filter_iso = [args.iso.upper()]
        countries = [c for c in countries if c in filter_iso]
    
    if args.limit:
        countries = countries[:args.limit]
    
    to_process = [c for c in countries if c not in processed]
    print(f"🚀 Paesi da elaborare: {len(to_process)} / {len(countries)}")
    
    if not to_process:
        print("❌ Nessun paese da processare.")
        return
    
    # Valida API key
    print("🔑 Validazione API key...", end=" ", flush=True)
    client = get_client()
    if not validate_api_key(client):
        print("❌ API key non valida. Interruzione.")
        return
    print("✅ API key valida\n")
    
    fused = data.get("fused_by_iso", {})
    
    # Traccia costi
    costs = {}
    total_cost = 0.0
    
    # Processa paesi
    for i, iso in enumerate(to_process, 1):
        country_data = fused[iso]
        country_name = country_data.get("country", iso)
        
        print(f"\n[{i}/{len(to_process)}] {country_name} ({iso})...", flush=True)
        
        # Prepara fonti esistenti
        sources = country_data.get("sources", {})
        existing_sources = sources.get("non-governamental", [])
        
        print(f"  Fonti esistenti: {len(existing_sources)}")
        
        try:
            prompt = build_prompt(country_name, iso, existing_sources)
            
            response = client.chat.completions.create(
                model=args.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=16000
            )
            
            # Traccia token e costi
            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            # Prezzi Grok API (per grok-4-1-fast-reasoning, simile a grok-4)
            # Input: $3.00 per 1M token, Output: $15.00 per 1M token
            input_cost = (prompt_tokens / 1_000_000) * 3.00
            output_cost = (completion_tokens / 1_000_000) * 15.00
            total_cost = input_cost + output_cost
            
            result_content = response.choices[0].message.content
            result = extract_json_from_response(result_content)
            
            # Aggiorna sources
            updated_governamental = result.get("governamental", [])
            updated_non_governamental = result.get("non-governamental", [])
            
            country_data["sources"] = {
                "governamental": updated_governamental,
                "non-governamental": updated_non_governamental,
                "recent_changes": sources.get("recent_changes"),
                "source_last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            }
            
            new_count = len(updated_governamental) - len(sources.get("governamental", []))
            print(f"  ✅ Fonti governative: {len(updated_governamental)} (+{new_count})")
            print(f"  ✅ Fonti non-governative: {len(updated_non_governamental)}")
            
            if result.get("new_sources_found"):
                print(f"  📝 Nuove fonti trovate: {len(result['new_sources_found'])}")
            if result.get("sources_completed"):
                print(f"  🔗 Fonti completate: {len(result['sources_completed'])}")
            
            print(f"  💰 Costo: ${total_cost:.4f} (Input: {prompt_tokens:,} tokens, Output: {completion_tokens:,} tokens)")
            
            # Salva costi per questo paese
            costs[iso] = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "input_cost": input_cost,
                "output_cost": output_cost,
                "total_cost": total_cost
            }
            total_cost_all = sum(c.get("total_cost", 0) for c in costs.values())
            
            processed.add(iso)
            
        except json.JSONDecodeError as e:
            print(f"  ⚠️  Errore parsing JSON: {str(e)[:100]}")
            if 'result_content' in locals():
                print(f"    Response preview: {result_content[:500]}")
        except Exception as e:
            print(f"  ⚠️  Errore: {str(e)[:100]}")
        
        # Salva ogni paese
        save_progress(data, processed, costs)
        time.sleep(2)  # Gentile coi rate limit
    
    # Calcola totale
    total_cost_all = sum(c.get("total_cost", 0) for c in costs.values())
    total_tokens_all = sum(c.get("total_tokens", 0) for c in costs.values())
    
    print("\n" + "="*70)
    print("✅ COMPLETATO!")
    print("="*70)
    print(f"📁 File aggiornato: {OUTPUT_FILE}")
    print(f"📊 Paesi processati: {len(processed)}")
    print(f"💰 Costo totale: ${total_cost_all:.4f}")
    print(f"📈 Token totali: {total_tokens_all:,}")
    if len(processed) > 0:
        avg_cost = total_cost_all / len(processed)
        print(f"📊 Costo medio per paese: ${avg_cost:.4f}")


if __name__ == "__main__":
    main()

