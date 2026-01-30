#!/usr/bin/env python3
"""
Script per estrarre e strutturare i dati di pricing da Retell AI
https://www.retellai.com/pricing
"""

import httpx
from bs4 import BeautifulSoup
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List

BASE_DIR = Path(__file__).parent
OUTPUT_JSON = BASE_DIR / "pricing.json"
URL = "https://www.retellai.com/pricing"


def parse_price(price_str: str) -> Dict[str, Any]:
    """Estrae valore numerico e unità da una stringa di prezzo"""
    if not price_str:
        return {"value": None, "unit": None, "raw": price_str}
    
    # Pattern per prezzi: $0.07/minute, $0.002+/msg, +$0.005/minute, etc.
    price_str = price_str.strip()
    
    # Rimuovi simboli + e $ all'inizio
    has_plus = price_str.startswith("+")
    price_str = price_str.lstrip("+$")
    
    # Estrai numero (può avere virgole per migliaia)
    match = re.search(r'([\d,]+\.?\d*)', price_str)
    if not match:
        return {"value": None, "unit": None, "raw": price_str}
    
    value_str = match.group(1).replace(",", "")
    try:
        value = float(value_str)
    except ValueError:
        return {"value": None, "unit": None, "raw": price_str}
    
    # Estrai unità (minute, msg, dial, call, month, etc.)
    unit_match = re.search(r'/(\w+)', price_str)
    unit = unit_match.group(1) if unit_match else None
    
    return {
        "value": value,
        "unit": unit,
        "raw": price_str,
        "has_plus": has_plus
    }


def extract_voice_engine_pricing(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Estrae i prezzi del Conversation Voice Engine"""
    voice_engines = []
    
    # Cerca nella tabella principale
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
            if len(cells) >= 2:
                name = cells[0]
                price_str = cells[1]
                
                # Cerca voci del Voice Engine
                if "Elevenlabs" in name or "Cartesia" in name or "OpenAI voices" in name:
                    price_info = parse_price(price_str)
                    voice_engines.append({
                        "name": name,
                        "pricing": price_info,
                        "note": cells[2] if len(cells) > 2 else None
                    })
    
    return voice_engines


def extract_llm_pricing(soup: BeautifulSoup) -> Dict[str, List[Dict[str, Any]]]:
    """Estrae i prezzi degli LLM, separati per voice e chat"""
    llms_voice = []
    llms_chat = []
    
    # Header da saltare
    skip_headers = {"LLM", "LLMs", "Pricing", "Note", "Speech-to-speech LLM", "Items"}
    
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
            if len(cells) >= 2:
                name = cells[0]
                price_str = cells[1]
                
                # Salta header rows
                if name in skip_headers or not price_str or price_str in skip_headers:
                    continue
                
                # Pattern per identificare LLM (GPT, Claude, Gemini)
                if any(keyword in name for keyword in ["GPT", "Claude", "Gemini", "Realtime"]):
                    price_info = parse_price(price_str)
                    
                    # Se non ha un prezzo valido, salta
                    if price_info["value"] is None:
                        continue
                    
                    # Estrai note per Fast Tier se presente
                    note = cells[2] if len(cells) > 2 else None
                    fast_tier = None
                    if note and "Fast Tier" in note:
                        fast_match = re.search(r'Fast Tier \$?([\d.]+)', note)
                        if fast_match:
                            fast_tier = {
                                "value": float(fast_match.group(1)),
                                "unit": price_info.get("unit")
                            }
                    
                    llm_data = {
                        "name": name,
                        "pricing": price_info,
                        "note": note
                    }
                    
                    if fast_tier:
                        llm_data["fast_tier"] = fast_tier
                    
                    # Distingui tra voice (minute) e chat (msg/AI)
                    unit = price_info.get("unit", "").lower()
                    if unit in ["ai", "msg", "message"]:
                        llms_chat.append(llm_data)
                    elif unit == "minute" or "realtime" in name.lower():
                        llms_voice.append(llm_data)
                    else:
                        # Default: se ha "Realtime" è voice, altrimenti prova a capire dal contesto
                        if "realtime" in name.lower():
                            llms_voice.append(llm_data)
                        else:
                            llms_voice.append(llm_data)  # Default a voice
    
    return {
        "voice": llms_voice,
        "chat": llms_chat
    }


def extract_telephony_pricing(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Estrae i prezzi della telephony"""
    telephony = []
    
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
            if len(cells) >= 2:
                name = cells[0]
                price_str = cells[1]
                
                if "Twilio" in name or "Telnyx" in name or "Telephony" in name:
                    if name in ["Telephony", "Pricing", "Note"]:
                        continue
                    
                    price_info = parse_price(price_str)
                    telephony.append({
                        "name": name,
                        "pricing": price_info,
                        "note": cells[2] if len(cells) > 2 else None
                    })
    
    return telephony


def extract_country_pricing(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Estrae i prezzi per paese"""
    countries = []
    
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        headers = [h.get_text(strip=True) for h in rows[0].find_all(["th", "td"])]
        
        # Cerca tabella con "Country" nell'header
        if "Country" in str(headers):
            for row in rows[1:]:  # Skip header
                cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
                if len(cells) >= 2:
                    country_name = cells[0]
                    price_str = cells[1]
                    
                    if country_name and country_name != "Country":
                        price_info = parse_price(price_str)
                        countries.append({
                            "country": country_name,
                            "pricing": price_info
                        })
    
    return countries


def extract_addon_pricing(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Estrae i prezzi dei componenti aggiuntivi"""
    addons = []
    
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
            if len(cells) >= 2:
                name = cells[0]
                price_str = cells[1]
                
                # Componenti aggiuntivi comuni
                if any(keyword in name for keyword in [
                    "Knowledge Base", "Batch Call", "Branded Call", 
                    "Advanced Denoising", "PII Removal", "SMS"
                ]):
                    price_info = parse_price(price_str)
                    addons.append({
                        "name": name,
                        "pricing": price_info,
                        "note": cells[2] if len(cells) > 2 else None
                    })
    
    return addons


def extract_monthly_subscriptions(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Estrae gli abbonamenti mensili dalla tabella Monthly Subscriptions"""
    subscriptions = []
    
    # Cerca la tabella con "Monthly Subscriptions"
    tables = soup.find_all("table")
    for table in tables:
        # Cerca se questa tabella contiene "Monthly Subscriptions" o "month" nei header
        headers = [h.get_text(strip=True) for h in table.find_all(["th", "td"])]
        table_text = table.get_text()
        
        # Verifica se è la tabella degli abbonamenti mensili
        if "Monthly Subscriptions" in table_text or any("/month" in h.lower() for h in headers):
            rows = table.find_all("tr")
            for row in rows:
                cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th"])]
                if len(cells) >= 2:
                    name = cells[0]
                    price_str = cells[1]
                    
                    # Salta header rows
                    if name in ["Items", "Pricing", "Note"] or price_str in ["Pricing", "Note"]:
                        continue
                    
                    # Verifica se contiene /month
                    if "/month" in price_str.lower():
                        price_info = parse_price(price_str)
                        if price_info["value"] is not None:
                            subscriptions.append({
                                "name": name,
                                "pricing": price_info,
                                "note": cells[2] if len(cells) > 2 else None
                            })
    
    return subscriptions


def fetch_and_parse() -> Dict[str, Any]:
    """Scarica e analizza la pagina di pricing"""
    print(f"Fetching {URL}...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        response = client.get(URL, headers=headers)
        response.raise_for_status()
        html = response.text
    
    print(f"✓ Fetched {len(html)} characters")
    
    soup = BeautifulSoup(html, "html.parser")
    
    print("\nExtracting pricing data...")
    
    data = {
        "source": {
            "url": URL,
            "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "title": soup.find("title").get_text(strip=True) if soup.find("title") else None
        },
        "voice_engines": extract_voice_engine_pricing(soup),
        "llms": extract_llm_pricing(soup),
        "telephony": extract_telephony_pricing(soup),
        "country_pricing": extract_country_pricing(soup),
        "addons": extract_addon_pricing(soup),
        "monthly_subscriptions": extract_monthly_subscriptions(soup),
        "plans": {
            "pay_as_you_go": {
                "description": "Self-serve plan with pay-as-you-go pricing",
                "features": []
            },
            "enterprise": {
                "description": "For companies with large call volumes (over $3k/month)",
                "features": []
            }
        }
    }
    
    return data


def main():
    print("=" * 60)
    print("Retell AI Pricing Builder")
    print("=" * 60)
    print()
    
    try:
        data = fetch_and_parse()
        
        # Salva JSON
        with OUTPUT_JSON.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Saved structured pricing data to {OUTPUT_JSON}")
        print(f"\nSummary:")
        print(f"  - Voice Engines: {len(data['voice_engines'])}")
        print(f"  - LLMs Voice: {len(data['llms']['voice'])}")
        print(f"  - LLMs Chat: {len(data['llms']['chat'])}")
        print(f"  - Telephony: {len(data['telephony'])}")
        print(f"  - Countries: {len(data['country_pricing'])}")
        print(f"  - Addons: {len(data['addons'])}")
        print(f"  - Monthly Subscriptions: {len(data['monthly_subscriptions'])}")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

