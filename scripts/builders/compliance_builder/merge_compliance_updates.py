#!/usr/bin/env python3
"""
Script per accorpare aggiornamenti di compliance.v3.json
Unisce i dati aggiornati (es. da una run specifica per AI disclosure) 
con il file principale esistente.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any

BASE_DIR = Path(__file__).parent
OUTPUT_JSON = BASE_DIR / "compliance.v3.json"
UPDATED_JSON = BASE_DIR / "compliance.v3.updated.json"


def load_json(filepath: Path) -> Dict[str, Any]:
    """Carica un file JSON"""
    with filepath.open(encoding="utf-8") as f:
        return json.load(f)


def merge_country_data(
    existing: Dict[str, Any], 
    updated: Dict[str, Any],
    merge_strategy: str = "update"
) -> Dict[str, Any]:
    """
    Unisce i dati di un paese.
    
    Args:
        existing: Dati esistenti del paese
        updated: Dati aggiornati del paese
        merge_strategy: "update" (sostituisce campi aggiornati) o "merge" (unisce array)
    
    Returns:
        Dati uniti
    """
    result = existing.copy()
    
    # Per campi semplici, usa i dati aggiornati se presenti
    simple_fields = [
        "continent", "country", "iso", "last_verified", "confidence"
    ]
    
    for field in simple_fields:
        if field in updated and updated[field] is not None:
            result[field] = updated[field]
    
    # Per oggetti annidati, unisci ricorsivamente
    nested_objects = [
        "regime", "relationship_requirements", "existing_customer_exemption",
        "dnc", "recording", "ai_disclosure", "quiet_hours", 
        "caller_id_requirements", "frequency_limits", "enforcement", "rules"
    ]
    
    for field in nested_objects:
        if field in updated:
            if field in result:
                # Unisci oggetti annidati
                result[field] = merge_nested_object(
                    result[field], 
                    updated[field],
                    merge_strategy
                )
            else:
                result[field] = updated[field]
    
    # Per array, unisci o sostituisci
    array_fields = ["legal_restrictions", "special_requirements", "extra_unstructured_rules"]
    
    for field in array_fields:
        if field in updated:
            if merge_strategy == "merge" and field in result:
                # Unisci array, evitando duplicati
                existing_items = {json.dumps(item, sort_keys=True): item for item in result[field]}
                for item in updated[field]:
                    key = json.dumps(item, sort_keys=True)
                    if key not in existing_items:
                        existing_items[key] = item
                result[field] = list(existing_items.values())
            else:
                # Sostituisci array
                result[field] = updated[field]
    
    # Sources: unisci array primary, aggiorna altri campi
    if "sources" in updated:
        if "sources" in result:
            # Unisci primary sources, evitando duplicati
            existing_sources = set(result["sources"].get("primary", []))
            updated_sources = set(updated["sources"].get("primary", []))
            result["sources"]["primary"] = sorted(list(existing_sources | updated_sources))
            
            # Aggiorna altri campi sources
            for key in ["recent_changes", "source_last_updated"]:
                if key in updated["sources"] and updated["sources"][key]:
                    result["sources"][key] = updated["sources"][key]
        else:
            result["sources"] = updated["sources"]
    
    return result


def merge_nested_object(
    existing: Dict[str, Any],
    updated: Dict[str, Any],
    merge_strategy: str
) -> Dict[str, Any]:
    """Unisce oggetti annidati ricorsivamente"""
    result = existing.copy()
    
    for key, value in updated.items():
        if key in result:
            if isinstance(value, dict) and isinstance(result[key], dict):
                result[key] = merge_nested_object(result[key], value, merge_strategy)
            elif isinstance(value, list) and isinstance(result[key], list):
                if merge_strategy == "merge":
                    # Unisci array evitando duplicati
                    existing_items = {json.dumps(item, sort_keys=True): item for item in result[key]}
                    for item in value:
                        item_key = json.dumps(item, sort_keys=True)
                        if item_key not in existing_items:
                            existing_items[item_key] = item
                    result[key] = list(existing_items.values())
                else:
                    result[key] = value
            else:
                # Sostituisci valore
                result[key] = value
        else:
            result[key] = value
    
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Accorpa aggiornamenti di compliance.v3.json"
    )
    parser.add_argument(
        "--updated-file",
        type=str,
        default=str(UPDATED_JSON),
        help="File JSON con aggiornamenti (default: compliance.v3.updated.json)",
    )
    parser.add_argument(
        "--main-file",
        type=str,
        default=str(OUTPUT_JSON),
        help="File JSON principale da aggiornare (default: compliance.v3.json)",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        choices=["update", "merge"],
        default="update",
        help="Strategia di merge: 'update' (sostituisce) o 'merge' (unisce array)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra cosa verrebbe fatto senza modificare i file",
    )
    
    args = parser.parse_args()
    
    updated_file = Path(args.updated_file)
    main_file = Path(args.main_file)
    
    if not updated_file.exists():
        print(f"❌ File aggiornato non trovato: {updated_file}")
        return
    
    if not main_file.exists():
        print(f"❌ File principale non trovato: {main_file}")
        return
    
    print(f"📖 Caricamento file principale: {main_file}")
    main_data = load_json(main_file)
    
    print(f"📖 Caricamento file aggiornato: {updated_file}")
    updated_data = load_json(updated_file)
    
    if "fused_by_iso" not in main_data:
        print("❌ File principale non ha struttura corretta (manca 'fused_by_iso')")
        return
    
    if "fused_by_iso" not in updated_data:
        print("❌ File aggiornato non ha struttura corretta (manca 'fused_by_iso')")
        return
    
    main_countries = main_data["fused_by_iso"]
    updated_countries = updated_data["fused_by_iso"]
    
    print(f"\n📊 Statistiche:")
    print(f"  Paesi nel file principale: {len(main_countries)}")
    print(f"  Paesi nel file aggiornato: {len(updated_countries)}")
    
    # Trova paesi da aggiornare
    countries_to_update = set(updated_countries.keys()) & set(main_countries.keys())
    new_countries = set(updated_countries.keys()) - set(main_countries.keys())
    
    print(f"  Paesi da aggiornare: {len(countries_to_update)}")
    print(f"  Paesi nuovi: {len(new_countries)}")
    
    if args.dry_run:
        print(f"\n🔍 DRY RUN - Nessuna modifica verrà fatta")
        print(f"\nPaesi che verrebbero aggiornati:")
        for iso in sorted(countries_to_update)[:20]:
            name = updated_countries[iso].get("country", iso)
            print(f"  - {name} ({iso})")
        if len(countries_to_update) > 20:
            print(f"  ... e altri {len(countries_to_update) - 20} paesi")
        
        if new_countries:
            print(f"\nPaesi nuovi che verrebbero aggiunti:")
            for iso in sorted(new_countries):
                name = updated_countries[iso].get("country", iso)
                print(f"  - {name} ({iso})")
        return
    
    # Unisci i dati
    print(f"\n🔄 Unione dati...")
    merged_countries = main_countries.copy()
    
    for iso in countries_to_update:
        merged_countries[iso] = merge_country_data(
            main_countries[iso],
            updated_countries[iso],
            args.strategy
        )
    
    # Aggiungi paesi nuovi
    for iso in new_countries:
        merged_countries[iso] = updated_countries[iso]
    
    # Aggiorna metadata
    main_data["fused_by_iso"] = merged_countries
    main_data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if "last_merged_at" not in main_data:
        main_data["last_merged_at"] = []
    main_data["last_merged_at"].append({
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "updated_countries": len(countries_to_update),
        "new_countries": len(new_countries),
        "strategy": args.strategy
    })
    
    # Salva backup
    backup_file = main_file.with_suffix(f".backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    print(f"💾 Creazione backup: {backup_file}")
    with backup_file.open("w", encoding="utf-8") as f:
        json.dump(main_data, f, ensure_ascii=False, indent=2)
    
    # Salva file aggiornato
    print(f"💾 Salvataggio file principale aggiornato: {main_file}")
    with main_file.open("w", encoding="utf-8") as f:
        json.dump(main_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Merge completato!")
    print(f"  Paesi aggiornati: {len(countries_to_update)}")
    print(f"  Paesi aggiunti: {len(new_countries)}")
    print(f"  Totale paesi nel file: {len(merged_countries)}")
    print(f"  Backup salvato: {backup_file.name}")


if __name__ == "__main__":
    main()

