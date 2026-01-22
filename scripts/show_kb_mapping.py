#!/usr/bin/env python3
"""
Mostra il mapping delle lingue ristrette per KB
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
MAPPING_FILE = ROOT_DIR / "web" / "src" / "config" / "kb-locale-mapping.json"

def main():
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    reduced = data['reduced_locales']
    mapping = data['mapping']
    
    print("=" * 80)
    print("📋 ELENCO LINGUE RISTRETTE PER KB")
    print("=" * 80)
    print(f"\n✅ Totale lingue da tradurre: {len(reduced)}")
    print(f"   (da 103 originali)\n")
    
    print("Elenco completo:")
    for i, locale in enumerate(sorted(reduced), 1):
        print(f"  {i:2}. {locale}")
    
    print("\n" + "=" * 80)
    print("🔗 MAPPING: 103 Lingue Originali → Lingue Ristrette")
    print("=" * 80)
    
    # Raggruppa per lingua di destinazione
    by_target = {}
    for original, target in sorted(mapping.items()):
        if target not in by_target:
            by_target[target] = []
        by_target[target].append(original)
    
    # Mostra mapping raggruppato
    for target in sorted(by_target.keys()):
        sources = by_target[target]
        if len(sources) == 1 and sources[0] == target:
            print(f"\n✅ {target}")
            print(f"   → (nessun mapping, lingua principale)")
        else:
            main_source = target if target in sources else sources[0]
            other_sources = [s for s in sources if s != main_source]
            
            print(f"\n🔗 {target}")
            print(f"   Principale: {main_source}")
            if other_sources:
                print(f"   Accorpate ({len(other_sources)}): {', '.join(sorted(other_sources))}")
    
    # Statistiche
    print("\n" + "=" * 80)
    print("📊 STATISTICHE")
    print("=" * 80)
    
    variants_merged = sum(1 for orig, target in mapping.items() if orig != target)
    single_languages = sum(1 for orig, target in mapping.items() if orig == target)
    
    print(f"\n✅ Lingue principali (nessun mapping): {single_languages}")
    print(f"🔗 Varianti accorpate: {variants_merged}")
    print(f"📉 Riduzione: {len(mapping)} → {len(reduced)} lingue ({100 - (len(reduced)/len(mapping)*100):.1f}% in meno)")
    print(f"💰 Risparmio stimato: ~{variants_merged * 0.18:.2f} dollari (se tutte le varianti fossero state tradotte separatamente)")

if __name__ == "__main__":
    main()

