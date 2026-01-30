#!/usr/bin/env python3
"""
Script per aggiornare SOLO le informazioni su AI disclosure per quote requests.
Non rigenera tutto il file, solo aggiorna ai_disclosure.exceptions dove trova informazioni.
"""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

import httpx

BASE_DIR = Path(__file__).parent
OUTPUT_JSON = BASE_DIR / "compliance.v3.json"


def call_perplexity_for_ai_quote_requests(country_name: str, iso: str, model: str = "sonar") -> tuple[list[str], str]:
    """
    Chiama Perplexity per cercare SOLO informazioni su AI disclosure per quote requests.
    
    Returns:
        Tuple of (exceptions_list, note_text)
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY environment variable not set")

    prompt = f"""You are a legal research assistant. Search the internet for CURRENT regulations in {country_name} ({iso}) regarding:

1. AI disclosure requirements for telemarketing calls when the purpose is a QUOTE REQUEST (richiesta preventivo)
2. Whether AI disclosure rules differ for EXISTING CUSTOMERS vs cold calling
3. Any EXCEPTIONS to AI disclosure requirements for quote requests or existing customers

IMPORTANT:
- Search ONLY for AI disclosure rules specific to quote requests/inquiries
- Search for exceptions for existing customers
- Use ONLY official government sources, regulatory authority websites, or official legal documents
- If you find that AI disclosure is NOT required for quote requests or existing customers, document this as an exception
- If no specific rules are found, return empty exceptions

Return your findings as a JSON object with this structure:
{{
  "exceptions": ["exception1", "exception2"],
  "note": "Brief explanation of findings"
}}

Examples of exceptions:
- "quote requests" if AI disclosure not required for quote requests
- "existing customers" if AI disclosure not required for existing customers
- "inquiry calls" if AI disclosure not required for inquiry calls

Return ONLY valid JSON, no additional text."""

    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a legal assistant that returns ONLY valid JSON, without any additional text. Always search the internet for up-to-date information.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "return_citations": True,
    }

    with httpx.Client(timeout=120.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    
    # Extract JSON
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.find("```", start)
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.find("```", start)
        content = content[start:end].strip()
    
    if not content.strip().startswith("{"):
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        if start_idx != -1 and end_idx != -1:
            content = content[start_idx:end_idx + 1]
    
    try:
        result = json.loads(content)
        exceptions = result.get("exceptions", [])
        note = result.get("note", "")
        return exceptions, note
    except json.JSONDecodeError:
        # Se non riesce a parsare, ritorna vuoto
        return [], ""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update ONLY AI disclosure exceptions for quote requests"
    )
    parser.add_argument(
        "--iso",
        type=str,
        help="Update only a specific country by ISO2 code",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process only first N countries (for testing)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="sonar",
        choices=["sonar", "sonar-pro"],
        help="Perplexity model to use",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes",
    )
    
    args = parser.parse_args()
    
    # Load existing file
    if not OUTPUT_JSON.exists():
        print(f"❌ File non trovato: {OUTPUT_JSON}")
        return
    
    print(f"📖 Caricamento file esistente: {OUTPUT_JSON}")
    with OUTPUT_JSON.open(encoding="utf-8") as f:
        data = json.load(f)
    
    countries = data.get("fused_by_iso", {})
    print(f"✅ Caricati {len(countries)} paesi")
    
    # Filter countries
    countries_to_process = list(countries.items())
    if args.iso:
        iso_filter = args.iso.upper()
        countries_to_process = [(iso, c) for iso, c in countries_to_process if iso.upper() == iso_filter]
        if not countries_to_process:
            print(f"❌ Paese {iso_filter} non trovato")
            return
    elif args.limit:
        countries_to_process = countries_to_process[:args.limit]
    
    print(f"\n🚀 Processando {len(countries_to_process)} paesi...")
    print(f"📊 Model: {args.model}")
    if args.dry_run:
        print("🔍 DRY RUN - Nessuna modifica verrà fatta\n")
    
    updated_count = 0
    for idx, (iso, country) in enumerate(countries_to_process, 1):
        name = country.get("country", iso)
        print(f"\n[{idx}/{len(countries_to_process)}] {name} ({iso})...", flush=True)
        
        try:
            exceptions, note = call_perplexity_for_ai_quote_requests(name, iso, args.model)
            
            if exceptions or note:
                print(f"  ✅ Trovate {len(exceptions)} exceptions: {exceptions}", flush=True)
                
                if not args.dry_run:
                    # Update ai_disclosure
                    if "ai_disclosure" not in country:
                        country["ai_disclosure"] = {}
                    
                    # Merge exceptions (avoid duplicates)
                    existing_exceptions = set(country["ai_disclosure"].get("exceptions", []))
                    new_exceptions = set(exceptions)
                    country["ai_disclosure"]["exceptions"] = sorted(list(existing_exceptions | new_exceptions))
                    
                    # Update note if provided
                    if note:
                        existing_note = country["ai_disclosure"].get("note", "")
                        if existing_note and note not in existing_note:
                            country["ai_disclosure"]["note"] = f"{existing_note}\n\n{note}".strip()
                        elif not existing_note:
                            country["ai_disclosure"]["note"] = note
                    
                    updated_count += 1
            else:
                print(f"  ℹ️  Nessuna exception trovata", flush=True)
                
        except Exception as e:
            print(f"  ⚠️  Errore: {str(e)[:100]}", flush=True)
            continue
        
        # Save periodically
        if not args.dry_run and (idx % 10 == 0):
            with OUTPUT_JSON.open("w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  💾 Progress saved ({idx}/{len(countries_to_process)})", flush=True)
    
    # Final save
    if not args.dry_run:
        data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with OUTPUT_JSON.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Completato! Aggiornati {updated_count} paesi")
        print(f"💾 File salvato: {OUTPUT_JSON}")
    else:
        print(f"\n🔍 DRY RUN completato. {updated_count} paesi sarebbero stati aggiornati")


if __name__ == "__main__":
    main()

