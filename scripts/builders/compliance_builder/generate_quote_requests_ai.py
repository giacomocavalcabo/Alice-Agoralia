#!/usr/bin/env python3
"""
Genera un JSON piccolo e focalizzato SOLO su AI disclosure per quote requests.
Struttura semplice: iso, country, info su quote requests, fonti.
"""

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

import httpx

BASE_DIR = Path(__file__).parent
OUTPUT_JSON = BASE_DIR / "quote_requests_ai.json"


def call_perplexity_for_quote_requests(country_name: str, iso: str, model: str = "sonar") -> Dict[str, Any]:
    """
    Chiama Perplexity per cercare SOLO informazioni su AI disclosure per quote requests.
    
    Returns:
        Dict con: allowed, exceptions, note, sources
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY environment variable not set")

    prompt = f"""Search the internet for CURRENT regulations in {country_name} ({iso}) regarding AI disclosure requirements for telemarketing calls when the purpose is a QUOTE REQUEST (richiesta preventivo).

Specifically search for:
1. Whether AI disclosure is REQUIRED for quote requests/inquiries
2. Whether AI disclosure is NOT REQUIRED (exceptions) for quote requests
3. Whether rules differ for EXISTING CUSTOMERS vs cold calling for quote requests
4. Official government sources, regulatory authority websites, or official legal documents

IMPORTANT:
- Use ONLY official government sources (.gov, regulatory authorities, official legal documents)
- If you find that AI disclosure is NOT required for quote requests, document this clearly
- If no specific rules are found, state that clearly
- Include URLs of official sources you found

Return your findings as a JSON object with this structure:
{{
  "allowed_without_disclosure": true/false/null,
  "exceptions": ["exception1", "exception2"],
  "note": "Brief explanation of findings",
  "sources": ["url1", "url2"]
}}

Examples:
- If AI disclosure is NOT required for quote requests: "allowed_without_disclosure": true, "exceptions": ["quote requests"]
- If AI disclosure IS required: "allowed_without_disclosure": false
- If unclear: "allowed_without_disclosure": null

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
                "content": "You are a legal assistant that returns ONLY valid JSON, without any additional text. Always search the internet for up-to-date information from official sources.",
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
    
    # Fix trailing commas
    import re
    content = re.sub(r',(\s*[}\]])', r'\1', content)
    
    try:
        result = json.loads(content)
        
        # Extract sources from citations if available
        citations = data.get("citations", [])
        if citations and "sources" not in result:
            result["sources"] = citations
        
        return {
            "allowed_without_disclosure": result.get("allowed_without_disclosure"),
            "exceptions": result.get("exceptions", []),
            "note": result.get("note", ""),
            "sources": result.get("sources", [])
        }
    except json.JSONDecodeError as e:
        return {
            "allowed_without_disclosure": None,
            "exceptions": [],
            "note": f"Error parsing response: {str(e)[:100]}",
            "sources": []
        }


def load_countries() -> List[Dict[str, str]]:
    """Load countries from CSV."""
    csv_path = BASE_DIR / "countries.csv"
    countries = []
    
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)  # Skip header
        for row in reader:
            if not row or len(row) < 2:
                continue
            country = row[0].strip()
            iso = row[1].strip().upper()
            if iso and country:
                countries.append({
                    "iso": iso,
                    "country": country
                })
    
    return countries


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate JSON with AI disclosure info for quote requests only"
    )
    parser.add_argument(
        "--iso",
        type=str,
        help="Process only a specific country by ISO2 code",
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
        "--resume",
        action="store_true",
        help="Resume from existing file",
    )
    
    args = parser.parse_args()
    
    # Load countries
    all_countries = load_countries()
    print(f"📖 Caricati {len(all_countries)} paesi da countries.csv")
    
    # Filter countries
    countries_to_process = all_countries
    if args.iso:
        iso_filter = args.iso.upper()
        countries_to_process = [c for c in all_countries if c["iso"].upper() == iso_filter]
        if not countries_to_process:
            print(f"❌ Paese {iso_filter} non trovato")
            return
    elif args.limit:
        countries_to_process = countries_to_process[:args.limit]
    
    # Load existing data if resuming
    existing_data = {}
    if args.resume and OUTPUT_JSON.exists():
        print(f"📖 Caricamento file esistente per resume: {OUTPUT_JSON}")
        with OUTPUT_JSON.open(encoding="utf-8") as f:
            existing_data = json.load(f)
        print(f"✅ Trovati {len(existing_data.get('countries', {}))} paesi già processati")
    
    # Initialize output structure
    output = {
        "schema_version": "1.0",
        "description": "AI disclosure requirements for quote requests only",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "countries": existing_data.get("countries", {})
    }
    
    print(f"\n🚀 Processando {len(countries_to_process)} paesi...")
    print(f"📊 Model: {args.model}")
    if args.resume:
        print("🔄 Resume mode: True\n")
    
    processed = 0
    skipped = 0
    
    for idx, country_seed in enumerate(countries_to_process, 1):
        iso = country_seed["iso"]
        name = country_seed["country"]
        
        # Skip if already processed (in resume mode)
        if args.resume and iso in output["countries"]:
            skipped += 1
            continue
        
        print(f"[{idx}/{len(countries_to_process)}] {name} ({iso})...", flush=True)
        
        try:
            result = call_perplexity_for_quote_requests(name, iso, args.model)
            
            output["countries"][iso] = {
                "iso": iso,
                "country": name,
                "allowed_without_disclosure": result["allowed_without_disclosure"],
                "exceptions": result["exceptions"],
                "note": result["note"],
                "sources": result["sources"]
            }
            
            if result["allowed_without_disclosure"] is True:
                print(f"  ✅ Allowed without disclosure: {result['exceptions']}", flush=True)
            elif result["allowed_without_disclosure"] is False:
                print(f"  ❌ Disclosure required", flush=True)
            else:
                print(f"  ⚠️  Unclear/No data", flush=True)
            
            processed += 1
            
        except Exception as e:
            print(f"  ⚠️  Errore: {str(e)[:100]}", flush=True)
            output["countries"][iso] = {
                "iso": iso,
                "country": name,
                "allowed_without_disclosure": None,
                "exceptions": [],
                "note": f"Error: {str(e)[:100]}",
                "sources": []
            }
            continue
        
        # Save periodically
        if idx % 10 == 0:
            output["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            with OUTPUT_JSON.open("w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
            print(f"  💾 Progress saved ({idx}/{len(countries_to_process)})", flush=True)
    
    # Final save
    output["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Completato!")
    print(f"  Processati: {processed}")
    print(f"  Saltati (resume): {skipped}")
    print(f"  Totale nel file: {len(output['countries'])}")
    print(f"💾 File salvato: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

