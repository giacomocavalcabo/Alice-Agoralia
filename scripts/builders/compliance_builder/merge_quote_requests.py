#!/usr/bin/env python3
"""
Integra le informazioni su quote requests dal file quote_requests_ai.json
nel file principale compliance.v3.json
"""

import argparse
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse

BASE_DIR = Path(__file__).parent
QUOTE_REQUESTS_JSON = BASE_DIR / "quote_requests_ai.json"
COMPLIANCE_JSON = BASE_DIR / "compliance.v3.json"


def normalize_url(url: str) -> str:
    """Normalizza URL per confronto (rimuove trailing slash, lowercase)."""
    if not url:
        return ""
    url = url.strip().lower()
    if url.endswith('/'):
        url = url[:-1]
    return url


def has_explicit_ai_ban(country: dict) -> tuple[bool, str]:
    """
    Verifica se c'è un divieto ESPLICITO di AI nel paese.
    
    Returns:
        (has_ban, reason) - True se c'è divieto esplicito, False altrimenti
    """
    ai = country.get("ai_disclosure", {})
    
    # NOTA: ai_disclosure.required/mandatory NON sono divieti!
    # Significano solo che serve disclosure, non che AI è vietata.
    # Le exceptions per "quote requests" significano che per quote requests NON serve disclosure.
    
    # 1. legal_restrictions - cerca divieti AI espliciti
    legal_restrictions = country.get("legal_restrictions", [])
    for restriction in legal_restrictions:
        if isinstance(restriction, dict):
            desc = restriction.get("description", "").lower()
            type_rest = restriction.get("type", "").lower()
            combined = desc + " " + type_rest
            
            # Cerca menzione esplicita di AI/automated/robot (come parole intere)
            # Usa regex per cercare "ai" come parola intera, non substring
            ai_patterns = [
                r'\bai\b',  # "ai" come parola intera
                r'artificial intelligence',
                r'automated call',
                r'robot call',
                r'bot call',
                r'automated voice',
                r'synthetic voice',
                r'ai-generated',
                r'ai system',
                r'artificial voice',
                r'voice ai',
                r'generative ai'
            ]
            # Questo viene sostituito dalla logica migliorata sotto
            
            # Parole che indicano divieto generale (non solo pratiche specifiche)
            strong_ban_keywords = [
                "prohibited", "banned", "forbidden", "not allowed", "illegal",
                "not permitted", "prohibition", "must not", "cannot use",
                "not permitted to use", "not allowed to use"
            ]
            
            # Parole che indicano solo pratiche specifiche (non divieto generale)
            practice_only_keywords = [
                "prohibited practices", "prohibited ai practices", 
                "banned practices", "forbidden practices"
            ]
            
            has_ai_mention = any(re.search(pattern, combined, re.IGNORECASE) for pattern in ai_patterns)
            has_strong_ban = any(kw in combined for kw in strong_ban_keywords)
            is_practice_only = any(kw in combined for kw in practice_only_keywords)
            
            # Se menziona AI + divieto forte, ma NON è solo "prohibited practices"
            # E menziona telemarketing/calls/quote requests → divieto esplicito
            if has_ai_mention and has_strong_ban:
                # Verifica se è un divieto generale o solo pratiche specifiche
                if is_practice_only and not any(kw in combined for kw in ["telemarketing", "call", "quote", "preventivo"]):
                    # È solo "prohibited AI practices" senza menzione di telemarketing → NON è divieto generale
                    continue
                else:
                    # Divieto esplicito trovato
                    return True, f"legal_restrictions: {restriction.get('type', 'N/A')}"
    
    # 3. extra_unstructured_rules - cerca divieti AI espliciti
    extra_rules = country.get("extra_unstructured_rules", [])
    for rule in extra_rules:
        if isinstance(rule, dict):
            text = rule.get("text", "").lower()
            topic = rule.get("topic", "").lower()
            combined = text + " " + topic
            
            # Cerca menzione esplicita di AI/automated/robot (come parole intere)
            ai_patterns = [
                r'\bai\b',  # "ai" come parola intera
                r'artificial intelligence',
                r'automated call',
                r'robot call',
                r'bot call',
                r'automated voice',
                r'synthetic voice',
                r'ai-generated',
                r'ai system',
                r'artificial voice',
                r'voice ai',
                r'generative ai'
            ]
            ban_keywords = ["prohibited", "banned", "forbidden", "not allowed", "illegal",
                           "not permitted", "prohibition", "must not", "cannot use", "not permitted to use"]
            
            strong_ban_keywords = [
                "prohibited", "banned", "forbidden", "not allowed", "illegal",
                "not permitted", "prohibition", "must not", "cannot use",
                "not permitted to use", "not allowed to use"
            ]
            
            practice_only_keywords = [
                "prohibited practices", "prohibited ai practices",
                "banned practices", "forbidden practices"
            ]
            
            has_ai_mention = any(re.search(pattern, combined, re.IGNORECASE) for pattern in ai_patterns)
            has_strong_ban = any(kw in combined for kw in strong_ban_keywords)
            is_practice_only = any(kw in combined for kw in practice_only_keywords)
            
            if has_ai_mention and has_strong_ban:
                # Verifica se è un divieto generale o solo pratiche specifiche
                if is_practice_only and not any(kw in combined for kw in ["telemarketing", "call", "quote", "preventivo", "disclosure", "must disclose"]):
                    # È solo "prohibited AI practices" senza menzione di telemarketing/disclosure → NON è divieto generale
                    continue
                else:
                    # Divieto esplicito trovato
                    return True, f"extra_unstructured_rules: {rule.get('topic', 'N/A')}"
    
    return False, None


def merge_quote_requests_data(dry_run: bool = False) -> None:
    """Merge quote requests data into main compliance file."""
    
    if not QUOTE_REQUESTS_JSON.exists():
        print(f"❌ File non trovato: {QUOTE_REQUESTS_JSON}")
        return
    
    if not COMPLIANCE_JSON.exists():
        print(f"❌ File non trovato: {COMPLIANCE_JSON}")
        return
    
    print(f"📖 Caricamento {QUOTE_REQUESTS_JSON}...")
    with QUOTE_REQUESTS_JSON.open(encoding="utf-8") as f:
        quote_data = json.load(f)
    
    print(f"📖 Caricamento {COMPLIANCE_JSON}...")
    with COMPLIANCE_JSON.open(encoding="utf-8") as f:
        compliance_data = json.load(f)
    
    quote_countries = quote_data.get("countries", {})
    compliance_countries = compliance_data.get("fused_by_iso", {})
    
    print(f"\n🔄 Integrazione dati...")
    print(f"  Paesi in quote_requests_ai.json: {len(quote_countries)}")
    print(f"  Paesi in compliance.v3.json: {len(compliance_countries)}")
    
    updated = 0
    not_found = []
    stats = {
        "added_exception": 0,
        "skipped_disclosure_required": 0,
        "skipped_ai_ban": 0,
        "already_present": 0
    }
    
    for iso, quote_info in quote_countries.items():
        if iso not in compliance_countries:
            not_found.append(iso)
            continue
        
        country = compliance_countries[iso]
        name = country.get("country", iso)
        
        # Initialize ai_disclosure if not exists
        if "ai_disclosure" not in country:
            country["ai_disclosure"] = {}
        
        existing_exceptions = set(country["ai_disclosure"].get("exceptions", []))
        allowed = quote_info.get("allowed_without_disclosure")
        quote_exceptions = set(quote_info.get("exceptions", []))
        
        # Decisione: aggiungere "quote requests" a exceptions?
        should_add_quote_request = False
        reason = ""
        
        if allowed is True:
            # Esplicitamente permesso senza disclosure
            should_add_quote_request = True
            reason = "allowed_without_disclosure=true"
        elif allowed is False:
            # Disclosure richiesta
            should_add_quote_request = False
            reason = "disclosure required (allowed_without_disclosure=false)"
            stats["skipped_disclosure_required"] += 1
        else:
            # allowed == null: verificare divieto AI esplicito
            has_ban, ban_reason = has_explicit_ai_ban(country)
            if has_ban:
                should_add_quote_request = False
                reason = f"explicit AI ban found: {ban_reason}"
                stats["skipped_ai_ban"] += 1
            else:
                # Nessun divieto esplicito → permesso per default
                should_add_quote_request = True
                reason = "no explicit AI ban (default: allowed)"
        
        # Aggiungere "quote requests" se necessario
        if should_add_quote_request:
            if "quote requests" not in existing_exceptions:
                existing_exceptions.add("quote requests")
                country["ai_disclosure"]["exceptions"] = sorted(list(existing_exceptions))
                updated += 1
                stats["added_exception"] += 1
                if not dry_run:
                    print(f"  ✅ {name} ({iso}): Aggiunto 'quote requests' - {reason}")
            else:
                stats["already_present"] += 1
                if not dry_run:
                    print(f"  ℹ️  {name} ({iso}): 'quote requests' già presente")
        else:
            if not dry_run:
                print(f"  ⏭️  {name} ({iso}): Saltato - {reason}")
        
        # Merge altre exceptions da quote_requests_ai.json (es. "existing customers")
        for exc in quote_exceptions:
            if exc != "quote requests":  # quote requests già gestito sopra
                existing_exceptions.add(exc)
        
        if existing_exceptions != set(country["ai_disclosure"].get("exceptions", [])):
            country["ai_disclosure"]["exceptions"] = sorted(list(existing_exceptions))
        
        # Update note if we have new information
        quote_note = quote_info.get("note", "")
        if quote_note and ("quote" in quote_note.lower() or "preventivo" in quote_note.lower()):
            existing_note = country["ai_disclosure"].get("note") or ""
            # Evita duplicati
            if existing_note and quote_note not in existing_note and existing_note not in quote_note:
                country["ai_disclosure"]["note"] = f"{existing_note}\n\nQuote requests: {quote_note}".strip()
            elif not existing_note:
                country["ai_disclosure"]["note"] = f"Quote requests: {quote_note}"
        
        # Add sources if available (evita duplicati)
        quote_sources = quote_info.get("sources", [])
        if quote_sources:
            if "sources" not in country:
                country["sources"] = {"primary": [], "recent_changes": None, "source_last_updated": None}
            
            existing_sources = [normalize_url(s) for s in country["sources"].get("primary", [])]
            new_sources = []
            for source in quote_sources:
                normalized = normalize_url(source)
                if normalized and normalized not in existing_sources:
                    new_sources.append(source)
                    existing_sources.append(normalized)
            
            if new_sources:
                country["sources"]["primary"] = sorted(list(set(country["sources"].get("primary", []) + new_sources)))
    
    # Update generated_at
    compliance_data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Save
    if not dry_run:
        print(f"\n💾 Salvataggio...")
        with COMPLIANCE_JSON.open("w", encoding="utf-8") as f:
            json.dump(compliance_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Completato!")
    print(f"  Paesi aggiornati: {updated}")
    print(f"  Statistiche:")
    print(f"    - Aggiunto 'quote requests': {stats['added_exception']}")
    print(f"    - Già presente: {stats['already_present']}")
    print(f"    - Saltato (disclosure richiesta): {stats['skipped_disclosure_required']}")
    print(f"    - Saltato (divieto AI): {stats['skipped_ai_ban']}")
    if not_found:
        print(f"  Paesi non trovati in compliance.v3.json: {len(not_found)}")
        if len(not_found) <= 10:
            print(f"    {', '.join(not_found)}")
    if not dry_run:
        print(f"💾 File aggiornato: {COMPLIANCE_JSON}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge quote requests AI data into main compliance file"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes",
    )
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🔍 DRY RUN - Nessuna modifica verrà fatta\n")
    
    merge_quote_requests_data(dry_run=args.dry_run)


if __name__ == "__main__":
    main()

