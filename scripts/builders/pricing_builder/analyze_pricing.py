#!/usr/bin/env python3
"""Analizza la struttura del pricing.json"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
PRICING_JSON = BASE_DIR / "pricing.json"

with open(PRICING_JSON, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("="*80)
print("ANALISI PRICING BUILDER")
print("="*80)

print(f"\n📊 Struttura dati:")
print(f"  - Source: {data.get('source', {}).get('url', 'N/A')}")
print(f"  - Scraped at: {data.get('source', {}).get('scraped_at', 'N/A')}")

print(f"\n🔊 Voice Engines: {len(data.get('voice_engines', []))}")
for ve in data.get('voice_engines', [])[:3]:
    print(f"  - {ve.get('name', 'N/A')}: ${ve.get('pricing', {}).get('value', 'N/A')}/{ve.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n🤖 LLMs Voice: {len(data.get('llms', {}).get('voice', []))}")
for llm in data.get('llms', {}).get('voice', [])[:5]:
    print(f"  - {llm.get('name', 'N/A')}: ${llm.get('pricing', {}).get('value', 'N/A')}/{llm.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n💬 LLMs Chat: {len(data.get('llms', {}).get('chat', []))}")
for llm in data.get('llms', {}).get('chat', [])[:3]:
    print(f"  - {llm.get('name', 'N/A')}: ${llm.get('pricing', {}).get('value', 'N/A')}/{llm.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n📞 Telephony: {len(data.get('telephony', []))}")
for tel in data.get('telephony', []):
    print(f"  - {tel.get('name', 'N/A')}: ${tel.get('pricing', {}).get('value', 'N/A')}/{tel.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n🌍 Country Pricing: {len(data.get('country_pricing', []))}")
for country in data.get('country_pricing', [])[:5]:
    print(f"  - {country.get('country', 'N/A')}: ${country.get('pricing', {}).get('value', 'N/A')}/{country.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n➕ Addons: {len(data.get('addons', []))}")
for addon in data.get('addons', [])[:5]:
    print(f"  - {addon.get('name', 'N/A')}: ${addon.get('pricing', {}).get('value', 'N/A')}/{addon.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n💳 Monthly Subscriptions: {len(data.get('monthly_subscriptions', []))}")
for sub in data.get('monthly_subscriptions', []):
    print(f"  - {sub.get('name', 'N/A')}: ${sub.get('pricing', {}).get('value', 'N/A')}/{sub.get('pricing', {}).get('unit', 'N/A')}")

print(f"\n📋 Plans: {len(data.get('plans', {}))}")
for plan_name, plan_data in data.get('plans', {}).items():
    print(f"  - {plan_name}: {plan_data.get('description', 'N/A')}")

