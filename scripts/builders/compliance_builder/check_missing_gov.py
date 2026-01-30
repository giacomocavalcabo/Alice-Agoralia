#!/usr/bin/env python3
"""Verifica paesi senza fonti governative."""

import json
from pathlib import Path

with open('compliance.v3.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Verifica Germania e Francia in dettaglio
for iso in ['DE', 'FR']:
    country_data = data['fused_by_iso'].get(iso, {})
    sources = country_data.get('sources', {})
    country_name = country_data.get('country', iso)
    
    print(f"\n{'='*80}")
    print(f"{country_name} ({iso}) - ANALISI DETTAGLIATA")
    print('='*80)
    
    gov = sources.get('governamental', [])
    non_gov = sources.get('non-governamental', [])
    
    print(f"\nFonti governative: {len(gov)}")
    print(f"Fonti non-governative: {len(non_gov)}")
    
    print(f"\n🔍 Fonti non-governative (dovrebbero essere governative?):")
    for i, src in enumerate(non_gov[:5], 1):
        name = src.get('name')
        url = src.get('url')
        print(f"\n  {i}. name: {name[:70] if name else 'N/A'}")
        if url:
            print(f"     url: {url[:70]}")
            # Verifica se l'URL sembra governativo
            url_lower = url.lower()
            if any(x in url_lower for x in ['.gov', '.gouv', 'bundesnetzagentur', 'service-public', 'bloctel']):
                print(f"     ⚠️  Sembra essere una fonte governativa!")

