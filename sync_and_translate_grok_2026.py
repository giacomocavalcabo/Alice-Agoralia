#!/usr/bin/env python3
"""
Script OTTIMIZZATO 2026 per sincronizzare e tradurre JSON i18n usando Grok API (xAI)

OTTIMIZZAZIONI 2026:
1. Prompt differenziati per progetto:
   - site/app: linguaggio business-friendly, marketing, engaging (es. "Transform your sales")
   - kb: linguaggio neutro, legale, preciso (no marketing, solo fatti)

2. KB: filtra ricorsivamente vuoti/null PRIMA di inviare a Grok (riduce token 50%)
   - Merge finale con JSON original per preservare tutte chiavi vuote

3. Chunking KB: dividi fused_by_iso in 6 batch (~34 paesi ciascuno) per 6 chiamate totali

4. Parallel async per batch (asyncio.gather, max 5 concorrenti)

5. Log token usati + costo stimato per batch

6. Retry con backoff esponenziale (max 3 tentativi)

7. Mantieni logica esistente: diff, memoria, merge_preserving_structure, glossario, context

8. Usa grok-4-fast-non-reasoning

LOGICA:
1. en-gb.json è sempre source of truth
2. Per ogni lingua:
   - Se non esiste, crea copia da EN
   - Sincronizza struttura (chiavi) con EN
   - Identifica blocchi da tradurre (valori identici a EN = non tradotto)
   - Traduce blocco per blocco con Grok API
   - Verifica completezza finale
3. Garantisce che tutti i JSON abbiano stessa struttura di EN
"""

import json
import sys
import os
import time
import asyncio
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from openai import AsyncOpenAI

# ============================================================================
# CONFIGURAZIONE
# ============================================================================
ROOT_DIR = Path(__file__).parent.parent
PROJECTS_CONFIG = ROOT_DIR / "config" / "i18n-projects.json"
GLOSSARY_PATH = ROOT_DIR / "data" / "GLOSSARY.json"
CONTEXT_PATH = ROOT_DIR / "data" / "TRANSLATION_CONTEXT.md"
CONFIG_FILE = ROOT_DIR / "model_language_config.json"

# Carica variabili d'ambiente dal file .env se esiste
ENV_FILE = ROOT_DIR / ".env"
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and value:
                        os.environ.setdefault(key, value)
    except Exception as e:
        print(f"⚠️  Errore caricamento .env: {e}")

# Default project paths (per retrocompatibilità)
I18N_DIR = ROOT_DIR / "web" / "src" / "i18n"
EN_SNAPSHOT_PATH = I18N_DIR / "en-gb.snapshot.json"
MEMORY_PATH = ROOT_DIR / "scripts" / "translation_memory.json"

# Grok API - Configura la tua API key
GROK_API_KEY = os.getenv("GROK_API_KEY", "")
GROK_BASE_URL = "https://api.x.ai/v1"
GROK_MODEL = "grok-4-fast-non-reasoning"  # OTTIMIZZAZIONE 2026: modello fisso

# Costi per token (DEPRECATO - non più usato per calcolo reale)
# Il calcolo del costo ora usa i prezzi ufficiali Grok separati:
# - Input: $0.20 per 1M token
# - Output: $0.50 per 1M token
# Queste costanti sono mantenute solo per retrocompatibilità
COST_PER_TOKEN_APP = 0.7 / 1_000_000  # $0.70 per 1M token for app/site
COST_PER_TOKEN_KB = 0.35 / 1_000_000   # $0.35 effective for 1M token (50% reduction for empty filter)

# ============================================================================
# UTILITY BASE
# ============================================================================

def load_json(filepath: Path) -> Dict:
    """Carica un file JSON"""
    if not filepath.exists():
        return {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"   ⚠️  Errore caricamento {filepath.name}: {e}")
        return {}

def save_json(filepath: Path, data: Dict):
    """Salva un file JSON, creando la cartella se non esiste"""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

def flatten_json(data: Dict, prefix: str = "") -> Dict[str, object]:
    """Flatten JSON in path -> value (dot notation, liste con indice)"""
    flat = {}
    if isinstance(data, dict):
        for k, v in data.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            flat.update(flatten_json(v, new_prefix))
    elif isinstance(data, list):
        for idx, v in enumerate(data):
            new_prefix = f"{prefix}[{idx}]"
            flat.update(flatten_json(v, new_prefix))
    else:
        flat[prefix] = data
    return flat

def load_memory(project_id: str = "site") -> Dict[str, Dict[str, object]]:
    """Carica la memoria traduzioni per lingua (path -> valore tradotto)"""
    memory_path = ROOT_DIR / "scripts" / f"translation_memory_{project_id}.json"
    if not memory_path.exists():
        return {}
    try:
        with open(memory_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"   ⚠️  Errore caricamento memoria {project_id}: {e}")
        return {}

def save_memory(memory: Dict[str, Dict[str, object]], project_id: str = "site"):
    """Salva la memoria traduzioni"""
    memory_path = ROOT_DIR / "scripts" / f"translation_memory_{project_id}.json"
    save_json(memory_path, memory)

def load_en_snapshot(project: Dict) -> Dict:
    """Carica snapshot precedente del file EN"""
    source_locale = project.get("sourceLocale", "en-GB")
    snapshot_file = get_snapshot_file_for_locale(project, source_locale)
    snapshot_path = resolve_project_path(project, snapshot_file)
    return load_json(snapshot_path)

def diff_en(en_current: Dict, en_snapshot: Dict) -> Tuple[set, set, set]:
    """
    Ritorna (nuove_path, cambiate_path, rimosse_path) tra EN attuale e snapshot.
    Le path sono flatten (dot / [idx]).
    """
    cur_flat = flatten_json(en_current)
    snap_flat = flatten_json(en_snapshot) if en_snapshot else {}

    cur_keys = set(cur_flat.keys())
    snap_keys = set(snap_flat.keys())

    new_paths = cur_keys - snap_keys
    removed_paths = snap_keys - cur_keys
    changed_paths = {p for p in cur_keys & snap_keys if cur_flat[p] != snap_flat[p]}

    return new_paths, changed_paths, removed_paths

def remove_paths(target: Dict, paths: set):
    """Rimuove le chiavi specificate (flatten path) dal target"""
    for path in paths:
        segments = []
        tmp = ""
        i = 0
        while i < len(path):
            if path[i] == '[':
                j = path.find(']', i)
                idx = int(path[i+1:j])
                segments.append(idx)
                i = j + 1
            elif path[i] == '.':
                i += 1
            else:
                j = i
                while j < len(path) and path[j] not in '.[':
                    j += 1
                segments.append(path[i:j])
                i = j
        # walk
        ref = target
        for seg in segments[:-1]:
            if isinstance(seg, int):
                if isinstance(ref, list) and 0 <= seg < len(ref):
                    ref = ref[seg]
                else:
                    ref = None
                    break
            else:
                if isinstance(ref, dict) and seg in ref:
                    ref = ref.get(seg)
                else:
                    ref = None
                    break
        if ref is None:
            continue
        last = segments[-1]
        if isinstance(last, int):
            if isinstance(ref, list) and 0 <= last < len(ref):
                ref.pop(last)
        else:
            if isinstance(ref, dict) and last in ref:
                ref.pop(last)

def merge_preserving_structure(original: any, translated: any) -> any:
    """
    Merge dei dati tradotti con quelli originali preservando TUTTE le chiavi.
    - Se una chiave esiste in translated, usa quella (tradotta)
    - Se una chiave esiste solo in original, mantienila (anche se vuota/null)
    - Preserva la struttura completa di original
    """
    if not isinstance(original, dict) or not isinstance(translated, dict):
        if translated is not None and translated != original:
            return translated
        return original

    merged = {}

    for key, original_value in original.items():
        if key in translated:
            translated_value = translated[key]

            if isinstance(original_value, dict) and isinstance(translated_value, dict):
                merged[key] = merge_preserving_structure(original_value, translated_value)
            elif isinstance(original_value, list) and isinstance(translated_value, list):
                merged[key] = translated_value
            else:
                merged[key] = translated_value
        else:
            merged[key] = original_value

    for key, translated_value in translated.items():
        if key not in merged:
            merged[key] = translated_value

    return merged

def sync_structure(en_data: Dict, target_data: Dict) -> Dict:
    """
    Sincronizza la struttura di target_data con en_data.
    - Aggiunge chiavi mancanti (copia da EN)
    - Mantiene valori esistenti tradotti
    """
    synced = {}

    def sync_recursive(en_dict: Dict, target_dict: Dict, result: Dict):
        """Sincronizza ricorsivamente"""
        for key, en_value in en_dict.items():
            if isinstance(en_value, dict):
                if key not in target_dict or not isinstance(target_dict[key], dict):
                    result[key] = json.loads(json.dumps(en_value))
                else:
                    result[key] = {}
                    sync_recursive(en_value, target_dict[key], result[key])
            elif isinstance(en_value, list):
                if key in target_dict and isinstance(target_dict[key], list):
                    result[key] = target_dict[key]
                else:
                    result[key] = json.loads(json.dumps(en_value))
            else:
                if key in target_dict:
                    result[key] = target_dict[key]
                else:
                    result[key] = en_value

    sync_recursive(en_data, target_data, synced)
    return synced

def values_match(en_value, target_value) -> bool:
    """Verifica se due valori sono identici (non tradotto)"""
    if type(en_value) != type(target_value):
        return False

    if isinstance(en_value, dict):
        if not isinstance(target_value, dict):
            return False
        if set(en_value.keys()) != set(target_value.keys()):
            return False
        return all(values_match(en_value[k], target_value[k]) for k in en_value.keys())

    elif isinstance(en_value, list):
        if not isinstance(target_value, list) or len(en_value) != len(target_value):
            return False
        return all(values_match(en_item, target_item) for en_item, target_item in zip(en_value, target_value))

    else:
        return en_value == target_value

# ============================================================================
# CARICAMENTO CONFIGURAZIONE PROGETTI
# ============================================================================

def load_project_config(project_id: str = "site") -> Optional[Dict]:
    """Carica configurazione progetto da i18n-projects.json"""
    if not PROJECTS_CONFIG.exists():
        return None

    try:
        with open(PROJECTS_CONFIG, 'r', encoding='utf-8') as f:
            config = json.load(f)
            projects = config.get("projects", [])
            for project in projects:
                if project.get("id") == project_id:
                    return project
    except Exception as e:
        print(f"   ⚠️  Errore caricamento config progetto: {e}")

    return None

def resolve_project_path(project: Dict, relative_path: str = "") -> Path:
    """Risolve il path completo per un progetto"""
    base_path = project.get("basePath", "")
    if base_path.startswith("../"):
        workspace_root = ROOT_DIR
        parts = base_path.split("/")
        up_levels = 0
        clean_parts = []
        for part in parts:
            if part == "..":
                up_levels += 1
            else:
                clean_parts.append(part)
        for _ in range(up_levels):
            workspace_root = workspace_root.parent
        clean_path = "/".join(clean_parts)
        return workspace_root / clean_path / relative_path
    else:
        # Per progetti diversi da site, non aggiungere "web/"
        if project.get("id") == "site":
            return ROOT_DIR / "web" / base_path / relative_path
        else:
            return ROOT_DIR / base_path / relative_path

def get_file_for_locale(project: Dict, locale: str) -> str:
    """Genera il nome file per una locale usando il pattern del progetto"""
    pattern = project.get("filePattern", "{locale}.json")
    if "/" in pattern:
        normalized_locale = locale
    else:
        normalized_locale = locale.lower()
    return pattern.replace("{locale}", normalized_locale)

def get_snapshot_file_for_locale(project: Dict, locale: str) -> str:
    """Genera il nome file snapshot per una locale"""
    pattern = project.get("snapshotPattern", "{locale}.snapshot.json")
    if "/" in pattern:
        normalized_locale = locale
    else:
        normalized_locale = locale.lower()
    return pattern.replace("{locale}", normalized_locale)

def get_files_for_locale(project: Dict, locale: str) -> List[Dict[str, str]]:
    """Ottiene tutti i file per una locale (supporta progetti multi-file)"""
    files_config = project.get("files", [])
    if files_config:
        use_original_format = any("/" in f.get("pattern", "") for f in files_config)
        locale_for_pattern = locale if use_original_format else locale.lower()
        return [
            {
                "file": f["pattern"].replace("{locale}", locale_for_pattern),
                "snapshot": f["snapshotPattern"].replace("{locale}", locale_for_pattern)
            }
            for f in files_config
        ]

    return [{
        "file": get_file_for_locale(project, locale),
        "snapshot": get_snapshot_file_for_locale(project, locale)
    }]

def get_source_files(project: Dict) -> List[Dict[str, str]]:
    """Ottiene tutti i file sorgente (EN) per un progetto"""
    normalized_locale = project.get("sourceLocale", "en-GB").lower()

    files_config = project.get("files", [])
    if files_config:
        return [
            {
                "file": f["pattern"].replace("{locale}", normalized_locale),
                "snapshot": f["snapshotPattern"].replace("{locale}", normalized_locale)
            }
            for f in files_config
        ]

    return [{
        "file": project.get("sourceFile", ""),
        "snapshot": project.get("snapshotPattern", "{locale}.snapshot.json").replace("{locale}", normalized_locale)
    }]

# ============================================================================
# CARICAMENTO CONFIGURAZIONE
# ============================================================================

def load_kb_locale_mapping() -> Dict:
    """Carica mapping lingue ristrette per KB"""
    mapping_file = ROOT_DIR / "web" / "src" / "config" / "kb-locale-mapping.json"
    if mapping_file.exists():
        try:
            with open(mapping_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        except Exception as e:
            print(f"⚠️  Errore caricamento mapping KB: {e}")
    return None

def load_language_config(project_id: str = "site") -> Dict:
    """Carica configurazione lingue - filtra per progetto (KB = 53 lingue, altri = 103)"""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                full_config = config.get("language_model_config", {})
                
                # Per KB: usa solo le 53 lingue ristrette
                if project_id == "kb":
                    kb_mapping = load_kb_locale_mapping()
                    if kb_mapping and kb_mapping.get("reduced_locales"):
                        reduced_locales = set(kb_mapping["reduced_locales"])
                        # Filtra config mantenendo solo le lingue ristrette
                        filtered_config = {
                            locale: info 
                            for locale, info in full_config.items() 
                            if locale in reduced_locales
                        }
                        return filtered_config
                
                # Per App/Site: restituisci tutte le lingue
                return full_config
        except Exception as e:
            print(f"⚠️  Errore caricamento config: {e}")

    # Lista completa 103 lingue (fallback)
    # Per KB: filtra solo le 53 lingue ristrette
    kb_mapping = None
    if project_id == "kb":
        kb_mapping = load_kb_locale_mapping()
    
    all_locales = [
        'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
        'es-ES', 'es-MX', 'es-AR',
        'fr-FR', 'fr-CA',
        'de-DE', 'de-AT', 'de-CH',
        'it-IT',
        'pt-PT', 'pt-BR',
        'nl-NL', 'nl-BE',
        'pl-PL',
        'ru-RU',
        'uk-UA',
        'cs-CZ',
        'sk-SK',
        'hu-HU',
        'ro-RO',
        'bg-BG',
        'hr-HR',
        'sr-RS',
        'sl-SI',
        'el-GR',
        'tr-TR',
        'ar-SA', 'ar-AE', 'ar-EG', 'ar-MA',
        'he-IL',
        'fa-IR',
        'ur-PK',
        'hi-IN',
        'bn-BD',
        'pa-IN',
        'ta-IN',
        'te-IN',
        'mr-IN',
        'gu-IN',
        'kn-IN',
        'ml-IN',
        'th-TH',
        'vi-VN',
        'id-ID',
        'ms-MY',
        'fil-PH',
        'ko-KR',
        'ja-JP',
        'zh-CN', 'zh-TW', 'zh-HK',
        'sv-SE',
        'no-NO',
        'da-DK',
        'fi-FI',
        'et-EE',
        'lv-LV',
        'lt-LT',
        'is-IS',
        'ca-ES',
        'gl-ES',
        'eu-ES',
        'sq-AL',
        'mk-MK',
        'mt-MT',
        'ga-IE',
        'cy-GB',
        'sw-KE',
        'ha-NG',
        'yo-NG',
        'am-ET',
        'zu-ZA',
        'af-ZA',
        'ka-GE',
        'hy-AM',
        'az-AZ',
        'kk-KZ',
        'uz-UZ',
        'mn-MN',
        'my-MM',
        'km-KH',
        'lo-LA',
        'ne-NP',
        'si-LK',
        'bs-BA',
        'lb-LU',
        'gv-IM',
        'fo-FO',
        'kl-GL',
        'sm-WS',
        'to-TO',
        'haw-US',
        'mi-NZ',
        'tl-PH',
        'jv-ID'
    ]

    names = {
        'en-US': 'Inglese (Stati Uniti)',
        'en-GB': 'Inglese (Regno Unito)',
        'en-AU': 'Inglese (Australia)',
        'en-CA': 'Inglese (Canada)',
        'en-IN': 'Inglese (India)',
        'es-ES': 'Spagnolo (Spagna)',
        'es-MX': 'Spagnolo (Messico / America Latina)',
        'es-AR': 'Spagnolo (Argentina)',
        'fr-FR': 'Francese (Francia)',
        'fr-CA': 'Francese (Canada)',
        'de-DE': 'Tedesco (Germania)',
        'de-AT': 'Tedesco (Austria)',
        'de-CH': 'Tedesco (Svizzera)',
        'it-IT': 'Italiano',
        'pt-PT': 'Portoghese (Portogallo)',
        'pt-BR': 'Portoghese (Brasile)',
        'nl-NL': 'Olandese (Paesi Bassi)',
        'nl-BE': 'Olandese (Belgio)',
        'pl-PL': 'Polacco',
        'ru-RU': 'Russo',
        'uk-UA': 'Ucraino',
        'cs-CZ': 'Ceco',
        'sk-SK': 'Slovacco',
        'hu-HU': 'Ungherese',
        'ro-RO': 'Rumeno',
        'bg-BG': 'Bulgaro',
        'hr-HR': 'Croato',
        'sr-RS': 'Serbo (latino)',
        'sl-SI': 'Sloveno',
        'el-GR': 'Greco',
        'tr-TR': 'Turco',
        'ar-SA': 'Arabo (Arabia Saudita – MSA)',
        'ar-AE': 'Arabo (Emirati)',
        'ar-EG': 'Arabo (Egitto)',
        'ar-MA': 'Arabo (Marocco)',
        'he-IL': 'Ebraico',
        'fa-IR': 'Persiano (Farsi)',
        'ur-PK': 'Urdu',
        'hi-IN': 'Hindi',
        'bn-BD': 'Bengalese',
        'pa-IN': 'Punjabi (Gurmukhi)',
        'ta-IN': 'Tamil',
        'te-IN': 'Telugu',
        'mr-IN': 'Marathi',
        'gu-IN': 'Gujarati',
        'kn-IN': 'Kannada',
        'ml-IN': 'Malayalam',
        'th-TH': 'Thai',
        'vi-VN': 'Vietnamita',
        'id-ID': 'Indonesiano',
        'ms-MY': 'Malese',
        'fil-PH': 'Tagalog / Filippino',
        'ko-KR': 'Coreano',
        'ja-JP': 'Giapponese',
        'zh-CN': 'Cinese semplificato (Cina)',
        'zh-TW': 'Cinese tradizionale (Taiwan)',
        'zh-HK': 'Cinese (Hong Kong)',
        'sv-SE': 'Svedese',
        'no-NO': 'Norvegese Bokmål',
        'da-DK': 'Danese',
        'fi-FI': 'Finlandese',
        'et-EE': 'Estone',
        'lv-LV': 'Lettone',
        'lt-LT': 'Lituano',
        'is-IS': 'Islandese',
        'ca-ES': 'Catalano',
        'gl-ES': 'Galiziano',
        'eu-ES': 'Basco',
        'sq-AL': 'Albanese',
        'mk-MK': 'Macedone',
        'mt-MT': 'Maltese',
        'ga-IE': 'Irlandese',
        'cy-GB': 'Gallese',
        'sw-KE': 'Swahili',
        'ha-NG': 'Hausa',
        'yo-NG': 'Yoruba',
        'am-ET': 'Amarico',
        'zu-ZA': 'Zulu',
        'af-ZA': 'Afrikaans',
        'ka-GE': 'Georgiano',
        'hy-AM': 'Armeno',
        'az-AZ': 'Azeri',
        'kk-KZ': 'Kazako',
        'uz-UZ': 'Uzbeco',
        'mn-MN': 'Mongolo',
        'my-MM': 'Birmano',
        'km-KH': 'Khmer',
        'lo-LA': 'Lao',
        'ne-NP': 'Nepalese',
        'si-LK': 'Singalese',
        'bs-BA': 'Bosniaco',
        'lb-LU': 'Lussemburghese',
        'gv-IM': 'Mannese (Isola di Man)',
        'fo-FO': 'Faroese',
        'kl-GL': 'Groenlandese',
        'sm-WS': 'Samoano',
        'to-TO': 'Tongano',
        'haw-US': 'Hawaiano',
        'mi-NZ': 'Maori',
        'tl-PH': 'Tagalog (variante Filippine)',
        'jv-ID': 'Giavanese'
    }

    # Per KB: filtra solo le 53 lingue ristrette
    if project_id == "kb" and kb_mapping and kb_mapping.get("reduced_locales"):
        reduced_locales = set(kb_mapping["reduced_locales"])
        filtered_locales = [locale for locale in all_locales if locale in reduced_locales]
        return {locale: {'name': names.get(locale, locale)} for locale in filtered_locales}
    
    # Per App/Site: restituisci tutte le lingue
    return {locale: {'name': names.get(locale, locale)} for locale in all_locales}

def load_glossary() -> Dict:
    """Carica il glossario"""
    if GLOSSARY_PATH.exists():
        try:
            with open(GLOSSARY_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def load_context() -> str:
    """Carica il contesto"""
    if CONTEXT_PATH.exists():
        try:
            with open(CONTEXT_PATH, 'r', encoding='utf-8') as f:
                return f.read()
        except:
            pass
    return ""

# ============================================================================
# OTTIMIZZAZIONI 2026 - KB SPECIFICHE
# ============================================================================

def filter_empty_values_recursive(data: Dict) -> Dict:
    """OTTIMIZZAZIONE 2026: Filtra ricorsivamente vuoti/null per KB (riduce token 50%)"""
    if not isinstance(data, dict):
        return data

    filtered = {}
    for key, value in data.items():
        # Salta completamente le sezioni che NON devono essere tradotte
        if key in ["sources", "last_verified", "confidence"]:
            continue  # NON includere queste sezioni nel filtraggio

        # Salta null, None, stringhe vuote
        if value is None or value == "":
            continue

        if isinstance(value, dict):
            filtered_dict = filter_empty_values_recursive(value)
            # Includi solo se dopo il filtro ha contenuto
            if filtered_dict:
                filtered[key] = filtered_dict
        elif isinstance(value, list):
            filtered_list = []
            for item in value:
                if isinstance(item, dict):
                    filtered_item = filter_empty_values_recursive(item)
                    if filtered_item:  # Solo se ha contenuto
                        filtered_list.append(filtered_item)
                elif item is not None and item != "":
                    filtered_list.append(item)
            if filtered_list:
                filtered[key] = filtered_list
        else:
            filtered[key] = value

    return filtered

def calculate_tokens_for_json(data: Dict) -> int:
    """Calcola token stimati per un dict JSON (~4 caratteri per token)"""
    json_str = json.dumps(data, ensure_ascii=False)
    return int(len(json_str) / 4)

def chunk_kb_countries(fused_dict: Dict, batch_size: int = 20, max_tokens_per_batch: int = None) -> List[Dict]:
    """
    OTTIMIZZAZIONE 2026: Filtra vuoti PRIMA, poi chunking per batch ottimali
    
    Args:
        fused_dict: Dict con dati paesi
        batch_size: Se max_tokens_per_batch è None, usa numero fisso di paesi
        max_tokens_per_batch: Se specificato, crea batch basati su token (default: 110000)
    
    Returns:
        Lista di batch (ogni batch è un dict di paesi)
    """

    # 1. FILTRA TUTTI I PAESI VUOTI PRIMA del chunking
    print(f"      🔍 Filtrando paesi con contenuto...")
    filtered_countries = {}
    for country_code, country_data in fused_dict.items():
        clean_data = filter_empty_values_recursive(country_data)
        if clean_data:  # Solo paesi con dati effettivi
            filtered_countries[country_code] = clean_data

    print(f"      ✅ {len(filtered_countries)}/{len(fused_dict)} paesi hanno contenuto")

    # 2. CHUNKING: usa token-based se specificato, altrimenti numero fisso
    if max_tokens_per_batch is None:
        # Metodo vecchio: chunking per numero di paesi
        filtered_items = list(filtered_countries.items())
        filtered_batches = []
        for i in range(0, len(filtered_items), batch_size):
            batch_dict = dict(filtered_items[i:i+batch_size])
            filtered_batches.append(batch_dict)
        return filtered_batches
    
    # NUOVO METODO: chunking basato su token (~110k token per batch)
    print(f"      📊 Creando batch basati su token (max {max_tokens_per_batch:,} token/batch)...")
    
    # Calcola token per ogni paese
    country_tokens = {}
    for country_code, country_data in filtered_countries.items():
        country_tokens[country_code] = calculate_tokens_for_json(country_data)
    
    # Ordina paesi per token (dal più grande al più piccolo) per ottimizzazione
    sorted_countries = sorted(country_tokens.items(), key=lambda x: x[1], reverse=True)
    
    filtered_batches = []
    current_batch = {}
    current_tokens = 0
    
    for country_code, tokens in sorted_countries:
        # Se aggiungere questo paese supererebbe il limite, crea nuovo batch
        if current_tokens + tokens > max_tokens_per_batch and current_batch:
            # Salva batch corrente
            filtered_batches.append(current_batch)
            print(f"         📦 Batch {len(filtered_batches)}: {len(current_batch)} paesi, ~{current_tokens:,} token")
            # Inizia nuovo batch
            current_batch = {}
            current_tokens = 0
        
        # Aggiungi paese al batch corrente (NON lo tagliamo mai!)
        current_batch[country_code] = filtered_countries[country_code]
        current_tokens += tokens
    
    # Aggiungi ultimo batch se non vuoto
    if current_batch:
        filtered_batches.append(current_batch)
        print(f"         📦 Batch {len(filtered_batches)}: {len(current_batch)} paesi, ~{current_tokens:,} token")
    
    print(f"      ✅ {len(filtered_batches)} batch creati (token-based)")
    return filtered_batches


def build_prompt_by_project(project_id: str, block_name: str, batch_data, locale: str, lang_name: str, glossary: Dict, context: str) -> str:
    """OTTIMIZZAZIONE 2026: Prompt differenziati per progetto"""

    if project_id in ["site", "app"]:
        # BUSINESS-FRIENDLY: marketing, engaging
        prompt = f"""Translate to {lang_name} ({locale}).
Make it engaging and business-friendly. Use compelling language that drives action.

Return ONLY JSON with EXACT structure.
Do NOT wrap in extra fields. Do NOT add comments.

{('Glossary: ' + '\n'.join([f'"{k}" → "{v.get(locale, k)}"' for k, v in glossary.items()][:10])) if glossary else ''}

JSON:
{json.dumps(batch_data, ensure_ascii=False)}"""

    elif project_id == "kb":
        # LEGALE, PRECISO: no marketing, solo fatti
        # Estrai i codici paese dal batch per essere esplicito - FIX: mostra TUTTI i codici, non solo [:10]
        country_codes = list(batch_data.keys()) if isinstance(batch_data, dict) else []
        country_codes_str = ", ".join(country_codes) if country_codes else "N/A"  # FIX: rimosso [:10]
        
        prompt = f"""Replace EVERY English text string in the JSON below with its {lang_name} translation.

CRITICAL REQUIREMENTS - READ CAREFULLY:
1. Translate ALL string values to {lang_name} ({locale})
2. The JSON MUST contain EXACTLY these country codes as top-level keys (no more, no less): {country_codes_str}
3. Do NOT add any other top-level keys (like "caller_id_requirements", "frequency_limits", etc.)
4. Do NOT move internal country fields to top-level
5. Keep all keys (including country codes like "AD", "FR", etc.) UNCHANGED
6. Keep all numbers, booleans, and null values UNCHANGED
7. Preserve legal terminology accuracy
8. Do NOT add or remove any fields
9. Do NOT change the structure - return the SAME object with ONLY country codes as top-level keys
10. Keep neutral professional tone

STRUCTURE REQUIREMENT:
- Input structure: {{"COUNTRY_CODE1": {{"field": "value", ...}}, "COUNTRY_CODE2": {{...}}, "COUNTRY_CODE3": {{...}}, ...}}
- Output structure: {{"COUNTRY_CODE1": {{"field": "translated_value", ...}}, "COUNTRY_CODE2": {{...}}, "COUNTRY_CODE3": {{...}}, ...}}
- The top-level object must have ONLY country codes as keys, nothing else.
- You MUST translate ALL {len(country_codes)} countries in this batch

Return ONLY the JSON object with the EXACT same structure. Do NOT wrap it in any other field.
IMPORTANT: Return a JSON with EXACTLY these top-level keys: {country_codes_str}
Each key contains the full country object from the input. Return ALL {len(country_codes)} countries, no more, no less!

Example: If input contains {{"AD": {{"country": "Andorra", ...}}, "FR": {{"country": "France", ...}}, "IT": {{"country": "Italy", ...}}}}, 
you must return ALL three: {{"AD": {{"country": "Andorre", ...}}, "FR": {{"country": "France", ...}}, "IT": {{"country": "Italie", ...}}}} with ALL strings in ALL countries translated.

{('Glossary: ' + '\n'.join([f'"{k}" → "{v.get(locale, k)}"' for k, v in glossary.items()][:10])) if glossary else ''}

JSON to translate:
{json.dumps(batch_data, ensure_ascii=False)}"""

    else:
        # Fallback generico
        prompt = f"""Translate to {lang_name} ({locale}).

Return ONLY JSON with EXACT structure.
Do NOT wrap in extra fields. Do NOT add comments.

JSON:
{json.dumps(batch_data, ensure_ascii=False)}"""

    return prompt

# ============================================================================
# TRADUZIONE CON GROK - VERSIONE OTTIMIZZATA 2026
# ============================================================================

def init_grok_client() -> Optional[OpenAI]:
    """Inizializza il client Grok (sincrono)"""
    if not GROK_API_KEY:
        print("❌ GROK_API_KEY non configurata!")
        print("   Imposta: export GROK_API_KEY='la_tua_api_key'")
        return None

    try:
        client = OpenAI(
            api_key=GROK_API_KEY,
            base_url=GROK_BASE_URL
        )
        return client
    except Exception as e:
        print(f"❌ Errore inizializzazione Grok: {e}")
        return None

def init_async_grok_client() -> Optional[AsyncOpenAI]:
    """Inizializza il client Grok asincrono"""
    if not GROK_API_KEY:
        return None

    try:
        client = AsyncOpenAI(
            api_key=GROK_API_KEY,
            base_url=GROK_BASE_URL
        )
        return client
    except Exception as e:
        print(f"❌ Errore inizializzazione Grok async: {e}")
        return None

def translate_batch_with_cost_tracking_sync(batch_data: Dict, locale: str, lang_name: str, project_id: str, glossary: Dict, context: str, client: OpenAI, max_retries: int = 3, cost_per_token: float = 0.00000035, batch_idx: int = None) -> Tuple[Optional[Dict], float, int, Dict]:
    """Versione sincrona per ambienti con problemi asyncio"""
    prompt = build_prompt_by_project(project_id, "batch", batch_data, locale, lang_name, glossary, context)

    input_tokens = len(prompt) / 4  # Stima token input

    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                print(f"      🔄 Retry {attempt}/{max_retries}...", flush=True)
                time.sleep(2 + random.uniform(0, 2))  # Sleep sincrono

            print(f"      ⏳ Invio a Grok (batch)...", flush=True)

            # OTTIMIZZAZIONE 2026: max_tokens dinamico per progetto
            # KB: 200k (per batch grandi ~110k input, output può essere ~140k+ per 57 paesi)
            # Altri: 16k (sufficiente per batch piccoli)
            # Nota: max_tokens limita l'OUTPUT, non l'input. Grok deve solo tradurre tutto.
            max_output_tokens = 200000 if project_id == "kb" else 16000

            # Usa client sincrono invece di async
            # OTTIMIZZAZIONE 2026: Rimuoviamo response_format per batch KB grandi
            # response_format può causare problemi con JSON molto grandi
            use_json_format = project_id != "kb"  # Solo per site/app, non per KB batch grandi
            request_params = {
                "model": GROK_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": max_output_tokens,
            }
            if use_json_format:
                request_params["response_format"] = {"type": "json_object"}
            
            response = client.chat.completions.create(**request_params)

            print(f"      📥 Risposta ricevuta", flush=True)

            # Usa token reali di Grok se disponibili, altrimenti stima
            if hasattr(response, 'usage') and response.usage:
                input_tokens_real = response.usage.prompt_tokens
                output_tokens_real = response.usage.completion_tokens
                total_tokens_real = response.usage.total_tokens
                print(f"      📊 Token reali Grok: {input_tokens_real:,} input + {output_tokens_real:,} output = {total_tokens_real:,} total", flush=True)
            else:
                # Fallback a stime se non disponibili
                input_tokens_real = int(input_tokens)
                output_tokens_real = len(response.choices[0].message.content) / 4
                total_tokens_real = input_tokens_real + output_tokens_real
                print(f"      ⚠️  Token stimati (Grok non ha restituito usage): {input_tokens_real:,} input + {output_tokens_real:,.0f} output = {total_tokens_real:,.0f} total", flush=True)

            content = response.choices[0].message.content.strip()

            # Parse JSON (stesso codice della versione async)
            import re
            content = re.sub(r'```json\s*', '', content)
            content = re.sub(r'```\s*$', '', content, flags=re.MULTILINE)
            content = content.strip()

            # DEBUG: Salva risposta SUBITO per ogni tentativo (così puoi interrompere e vedere)
            debug_dir = ROOT_DIR / "debug_grok_responses"
            debug_dir.mkdir(exist_ok=True)
            batch_suffix = f"_batch{batch_idx}" if batch_idx else ""
            debug_file = debug_dir / f"attempt_{attempt}{batch_suffix}_raw.txt"
            try:
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(f"=== RAW RESPONSE (tentativo {attempt}) ===\n")
                    f.write(content)
                    f.write(f"\n\n=== RESPONSE LENGTH ===\n")
                    f.write(f"Characters: {len(content)}\n")
                    f.write(f"Estimated tokens: {len(content) / 4:.0f}\n")
                print(f"      💾 Risposta raw salvata in {debug_file}", flush=True)
            except Exception as e:
                pass

            first_brace = content.find('{')
            if first_brace == -1:
                print(f"      ❌ ERRORE: Nessun JSON trovato nella risposta (lunghezza: {len(content)} char)", flush=True)
                print(f"      📄 Primi 500 caratteri della risposta:", flush=True)
                print(f"      {content[:500]}", flush=True)
                if attempt == 2:
                    print(f"      🛑 FERMANDO al primo retry per analisi", flush=True)
                    return None, 0, attempt, {}
                continue

            brace_count = 0
            end_pos = -1
            for i in range(first_brace, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i + 1
                        break

            if end_pos == -1:
                print(f"      ⚠️  Avviso: Algoritmo bilanciamento non ha trovato fine JSON (lunghezza: {len(content)} char)", flush=True)
                
                # Salva risposta completa per analisi
                debug_dir = ROOT_DIR / "debug_grok_responses"
                debug_dir.mkdir(exist_ok=True)
                debug_file = debug_dir / f"batch_unbalanced_response_attempt_{attempt}.txt"
                try:
                    with open(debug_file, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"      💾 Risposta completa salvata in {debug_file}", flush=True)
                except Exception as e:
                    pass
                
                # Prova comunque a parsare l'intero content (forse è completo)
                try:
                    print(f"      🔍 Provo a parsare l'intera risposta come JSON...", flush=True)
                    result = json.loads(content)
                    print(f"      ✅ JSON valido! Lunghezza: {len(content)} char", flush=True)
                    # Se funziona, continua normalmente
                except json.JSONDecodeError as json_err:
                    print(f"      ❌ JSON non valido. Errore a pos {json_err.pos}: {str(json_err)[:200]}", flush=True)
                    print(f"      📄 Ultimi 500 caratteri: {content[-500:]}", flush=True)
                    
                    # Conta paesi nella risposta (cerca pattern "CODICE":{"continent)
                    import re
                    country_codes_found = re.findall(r'"([A-Z]{2})"\s*:\s*\{', content)
                    print(f"      🔍 Paesi trovati nella risposta: {len(country_codes_found)} - {country_codes_found[:10]}...", flush=True)
                    
                    if attempt == 2:
                        print(f"      🛑 FERMANDO al primo retry per analisi", flush=True)
                        return None, 0, attempt, {}
                    continue

            json_str = content[first_brace:end_pos]
            try:
                result = json.loads(json_str)
            except json.JSONDecodeError as json_err:
                print(f"      ❌ ERRORE: Parsing JSON fallito (pos {json_err.pos}): {str(json_err)[:200]}", flush=True)
                print(f"      📄 JSON estratto (primi 1000 char): {json_str[:1000]}", flush=True)
                if attempt == 2:
                    print(f"      🛑 FERMANDO al primo retry per analisi", flush=True)
                    return None, 0, attempt, {}
                continue

            # Calcola costo usando prezzi ufficiali Grok: $0.20/1M input + $0.50/1M output
            input_cost = (input_tokens_real / 1_000_000) * 0.20
            output_cost = (output_tokens_real / 1_000_000) * 0.50
            cost = input_cost + output_cost
            print(f"      💰 Costo batch: ${cost:.6f} (input: ${input_cost:.6f} + output: ${output_cost:.6f})", flush=True)

            token_usage = {
                "input_tokens": int(input_tokens_real),
                "output_tokens": int(output_tokens_real),
                "total_tokens": int(total_tokens_real)
            }

            return result, cost, attempt, token_usage

        except Exception as e:
            error_msg = str(e)
            error_type = type(e).__name__
            print(f"      ⚠️  Errore tentativo {attempt}/{max_retries}: {error_type}: {error_msg[:200]}", flush=True)
            
            # Al primo retry (attempt == 2), fermati per analisi
            if attempt == 2:
                print(f"      🛑 FERMANDO al primo retry per analisi", flush=True)
                print(f"      📊 Dettagli errore:", flush=True)
                print(f"         Tipo: {error_type}", flush=True)
                print(f"         Messaggio completo: {error_msg}", flush=True)
                if hasattr(e, '__cause__') and e.__cause__:
                    print(f"         Causa: {e.__cause__}", flush=True)
                return None, 0, attempt, {}
            
            if attempt == max_retries:
                print(f"      ❌ Batch fallito dopo {max_retries} tentativi: {error_type}: {error_msg[:100]}")
                return None, 0, max_retries, {}
            continue

def translate_batch_with_cost_tracking(client: AsyncOpenAI, batch_data: Dict, locale: str, lang_name: str, project_id: str, glossary: Dict, context: str, max_retries: int = 3) -> Tuple[Optional[Dict], float, int, Dict]:
    """OTTIMIZZAZIONE 2026: Traduci batch con retry backoff e tracking costi"""
    prompt = build_prompt_by_project(project_id, "batch", batch_data, locale, lang_name, glossary, context)

    input_tokens = len(prompt) / 4  # Stima token input

    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                backoff = 2 ** (attempt - 1) + random.uniform(0, 1)  # Backoff esponenziale + jitter
                print(f"      🔄 Retry {attempt}/{max_retries} in {backoff:.1f}s...", flush=True)
                asyncio.run(asyncio.sleep(backoff))

            # OTTIMIZZAZIONE 2026: max_tokens dinamico per progetto
            # KB: 200k (per batch grandi ~110k input, output può essere ~140k+ per 57 paesi)
            # Altri: 16k (sufficiente per batch piccoli)
            # Nota: max_tokens limita l'OUTPUT, non l'input. Grok deve solo tradurre tutto.
            max_output_tokens = 200000 if project_id == "kb" else 16000

            response = asyncio.run(client.chat.completions.create(
                model=GROK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=max_output_tokens,
            ))

            content = response.choices[0].message.content.strip()

            # Parse JSON
            import re
            content = re.sub(r'```json\s*', '', content)
            content = re.sub(r'```\s*$', '', content, flags=re.MULTILINE)
            content = content.strip()

            # Trova JSON bilanciato
            first_brace = content.find('{')
            if first_brace == -1:
                continue

            brace_count = 0
            end_pos = -1
            for i in range(first_brace, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i + 1
                        break

            if end_pos == -1:
                continue

            json_str = content[first_brace:end_pos]
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)

            result = json.loads(json_str)

            # Log token reali se disponibili - DEBUG ESTESO
            print(f"      🔍 Debug response object: {type(response)}")
            print(f"      🔍 Has usage attr: {hasattr(response, 'usage')}")
            if hasattr(response, 'usage'):
                print(f"      🔍 Usage object: {response.usage}")
                if response.usage:
                    print(f"      🔍 Usage dict: {dict(response.usage) if hasattr(response.usage, '__dict__') else str(response.usage)}")

            token_usage = {
                "prompt_tokens": getattr(getattr(response, 'usage', {}), 'prompt_tokens', int(input_tokens)),
                "completion_tokens": getattr(getattr(response, 'usage', {}), 'completion_tokens', int(len(json_str) / 4)),
                "total_tokens": getattr(getattr(response, 'usage', {}), 'total_tokens', int(input_tokens + len(json_str) / 4))
            }

            print(f"      📊 Token reali: {token_usage['total_tokens']} total ({token_usage['prompt_tokens']} in + {token_usage['completion_tokens']} out)")

            # Calcola costo usando prezzi ufficiali Grok: $0.20/1M input + $0.50/1M output
            input_cost = (token_usage['prompt_tokens'] / 1_000_000) * 0.20
            output_cost = (token_usage['completion_tokens'] / 1_000_000) * 0.50
            cost = input_cost + output_cost
            print(f"      💰 Costo batch: ${cost:.6f} (input: ${input_cost:.6f} + output: ${output_cost:.6f})")

            return result, cost, attempt, token_usage

        except Exception as e:
            if attempt == max_retries:
                print(f"      ❌ Batch fallito dopo {max_retries} tentativi: {str(e)[:100]}")
                return None, 0, max_retries, {}
            continue

    return None, 0, max_retries, {}

# ============================================================================
# LOGICA TRADUZIONE PRINCIPALE
# ============================================================================

def find_blocks_to_translate(
    locale: str,
    en_data: Dict,
    target_data: Dict,
    new_paths: set,
    changed_paths: set,
    memory: Dict[str, Dict[str, object]],
    project_id: str
) -> List[Tuple[str, Dict]]:
    """
    Trova i blocchi da tradurre considerando:
    - path nuove o cambiate in EN
    - path mancanti nel target
    - valori identici a EN ma non marcati in memoria
    """
    blocks_to_translate = []
    mem_for_locale = memory.get(locale, {})

    for block_name, block_data in en_data.items():
        # Per KB: filtra vuoti ricorsivamente PRIMA del confronto
        if project_id == "kb":
            filtered_block_data = filter_empty_values_recursive(block_data)
            if not filtered_block_data:
                continue
        else:
            filtered_block_data = block_data

        if block_name not in target_data:
            blocks_to_translate.append((block_name, filtered_block_data))
            continue

        target_block = target_data[block_name]

        en_flat = flatten_json({block_name: filtered_block_data})
        target_flat = flatten_json({block_name: target_block})

        missing_paths = set(en_flat.keys()) - set(target_flat.keys())

        needs_translation = set()

        for path in en_flat.keys():
            if path in new_paths or path in changed_paths or path in missing_paths:
                needs_translation.add(path)
                continue

            if path not in target_flat:
                needs_translation.add(path)
                continue

            if en_flat[path] == target_flat[path]:
                # Controlla memoria (supporta nuova struttura con metadata)
                mem_value = None
                if path in mem_for_locale:
                    mem_entry = mem_for_locale[path]
                    if isinstance(mem_entry, dict):
                        mem_value = mem_entry.get("value")
                    else:
                        mem_value = mem_entry

                # se memoria dice che va bene così, salta
                if mem_value is not None and mem_value == target_flat[path]:
                    continue
                # altrimenti richiede traduzione
                needs_translation.add(path)

        if needs_translation:
            blocks_to_translate.append((block_name, filtered_block_data))

    return blocks_to_translate

def translate_locale(
    locale: str,
    en_data: Dict,
    client: OpenAI,
    new_paths: set,
    changed_paths: set,
    removed_paths: set,
    memory: Dict[str, Dict[str, object]],
    project_config: Dict,
    dry_run: bool = False,
    args: any = None
) -> Tuple[bool, Dict, Dict[str, Dict[str, object]], float]:
    """
    Traduce una lingua completa.
    Returns: (success, translated_data, memory, total_cost)
    """
    project_id = project_config.get("id", "site")
    config = load_language_config(project_id)
    lang_info = config.get(locale, {'name': locale})
    lang_name = lang_info.get('name', locale)

    print(f"\n🌍 {locale} ({lang_name})")

    # Carica tutti i file target per questa locale
    locale_files = get_files_for_locale(project_config, locale)
    target_data = {}

    for file_info in locale_files:
        target_file = resolve_project_path(project_config, file_info["file"])
        if target_file.exists():
            file_data = load_json(target_file)
            target_data = {**target_data, **file_data}

    # Rimuovi path eliminati in EN
    if removed_paths:
        remove_paths(target_data, removed_paths)
        if locale in memory:
            mem = memory[locale]
            for p in list(mem.keys()):
                if p in removed_paths:
                    mem.pop(p, None)

    # Sincronizza struttura con EN
    print(f"   🔄 Sincronizzando struttura...")
    synced_data = sync_structure(en_data, target_data)

    # Trova blocchi da tradurre
    print(f"   🔍 Cercando blocchi da tradurre...")
    blocks_to_translate = find_blocks_to_translate(
        locale,
        en_data,
        synced_data,
        new_paths,
        changed_paths,
        memory,
        project_id
    )


    if not blocks_to_translate:
        print(f"   ✅ Già completo e tradotto!")
        return True, synced_data, memory, 0.0

    print(f"   📦 Blocchi da tradurre: {len(blocks_to_translate)}/{len(en_data)}")

    glossary = load_glossary()
    context = load_context()

    translated_count = 0
    failed_blocks = []
    total_cost = 0.0

    # File di progresso
    progress_file = ROOT_DIR / "scripts" / f"translation_progress_{project_id}_{locale.lower()}.json"

    def update_progress(current: int, total: int, block_name: str = ""):
        try:
            progress_data = {
                "locale": locale,
                "current": current,
                "total": total,
                "percentage": round((current / total) * 100, 1) if total > 0 else 0,
                "block_name": block_name,
                "timestamp": time.time()
            }
            with open(progress_file, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f)
        except Exception as e:
            pass

    update_progress(0, len(blocks_to_translate), "Inizio traduzione...")

    for idx, (block_name, block_data) in enumerate(blocks_to_translate, 1):
        print(f"\n   [{idx}/{len(blocks_to_translate)}] {block_name}...")
        update_progress(idx - 1, len(blocks_to_translate), block_name)

        # OTTIMIZZAZIONE 2026: Chunking speciale per KB fused_by_iso
        if project_id == "kb" and block_name == "fused_by_iso":
            print(f"      📍 Traduco fused_by_iso in batch paralleli...")

            # Crea batch per fused_by_iso (dict di paesi) - TRADUCI TUTTO!
            # OTTIMIZZAZIONE 2026: Batch fissi di 18 paesi (limitazione pratica Grok ~46k token output)
            # 18 paesi = ~46k token output (limite osservato), input ~30k token = ~76k totale (ben dentro 256k)
            all_batches = chunk_kb_countries(block_data, batch_size=18)  # 18 paesi per batch
            batches = all_batches  # Traduciamo tutti i batch
            if batches:
                avg_countries = sum(len(b) for b in batches) / len(batches)
                print(f"      📦 {len(batches)} batch creati (~{avg_countries:.0f} paesi/batch in media)")

            # Traduzione parallela con max 5 concorrenti
            async def translate_batches_parallel():
                async_client = init_async_grok_client()
                if not async_client:
                    return []

                semaphore = asyncio.Semaphore(5)  # Max 5 concorrenti

                async def translate_single_batch(batch_idx: int, batch: Dict):
                    async with semaphore:
                        result, cost, attempts, token_usage = await translate_batch_with_cost_tracking(
                            async_client, batch, locale, lang_name, project_id, glossary, context
                        )
                        return batch_idx, result, cost, list(batch.keys()), token_usage

                tasks = [translate_single_batch(idx + 1, batch) for idx, batch in enumerate(batches)]
                return await asyncio.gather(*tasks, return_exceptions=True)

            # Per ora, esegui sempre sequenzialmente per evitare problemi asyncio
            print(f"      📋 Eseguo traduzione sequenziale dei batch...")

            if dry_run:
                # In dry-run, simula la traduzione senza chiamare l'API
                translated_countries = {}
                original_countries_data = en_data.get(block_name, {})
                for batch_idx, batch in enumerate(batches, 1):
                    print(f"      🔹 Batch {batch_idx}/{len(batches)} (DRY-RUN)...")
                    # Simula traduzione riuscita
                    result = batch  # In dry-run, restituisci i dati originali
                    for country_iso, country_data in result.items():
                        if country_iso in original_countries_data:
                            translated_countries[country_iso] = country_data
                synced_data[block_name] = translated_countries
                translated_count += 1
                print(f"      ✅ fused_by_iso completato (dry-run)")
            else:
                sync_client = init_grok_client()
                if not sync_client:
                    print(f"      ❌ Client Grok non disponibile")
                    synced_data[block_name] = en_data.get(block_name, {})
                else:
                    translated_countries = {}
                    original_countries_data = en_data.get(block_name, {})

                    for batch_idx, batch in enumerate(batches, 1):
                        print(f"      🔹 Batch {batch_idx}/{len(batches)}...")
                        # Traduci sequenzialmente invece di parallelamente
                        cost_per_token = COST_PER_TOKEN_KB if project_id == 'kb' else COST_PER_TOKEN_APP
                        batch_result = translate_batch_with_cost_tracking_sync(
                            batch, locale, lang_name, project_id, glossary, context, sync_client, cost_per_token=cost_per_token, batch_idx=batch_idx
                        )
                        if batch_result is None:
                            result, cost, attempts, token_usage = None, 0, 3, {}
                        else:
                            result, cost, attempts, token_usage = batch_result

                        if result:
                            # DEBUG: Verifica struttura risultato
                            result_keys = list(result.keys())[:10] if isinstance(result, dict) else []
                            print(f"      🔍 Result type: {type(result)}, Keys: {result_keys}")
                            
                            # Grok potrebbe restituire il JSON direttamente o wrappato
                            # Se result ha le stesse chiavi del batch, usa direttamente
                            # Altrimenti cerca in sottosezioni comuni
                            translated_batch = result
                            if isinstance(result, dict):
                                # Cerca nelle chiavi comuni che Grok potrebbe usare
                                # Quando response_format={"type": "json_object"}, Grok potrebbe wrappare in "json" o altre chiavi
                                possible_keys = ['json', 'translated_data', 'data', 'result', 'output', 'content', 'translation']
                                for key in possible_keys:
                                    if key in result and isinstance(result[key], dict):
                                        # Verifica se contiene chiavi paese
                                        if any(k in result[key] for k in batch.keys()):
                                            translated_batch = result[key]
                                            print(f"      🔍 Trovato dati tradotti in chiave: {key}")
                                            break
                                
                                # Se non trovato, verifica se result stesso ha le chiavi paese
                                if translated_batch == result and any(k in result for k in batch.keys()):
                                    translated_batch = result
                                    print(f"      🔍 Usando result direttamente (contiene chiavi paese)")
                            
                            # Verifica se le chiavi corrispondono ai codici paese attesi
                            expected_country_codes = set(batch.keys())
                            if isinstance(translated_batch, dict):
                                actual_keys = set(translated_batch.keys())
                                matching_keys = actual_keys & expected_country_codes
                                extra_keys = actual_keys - expected_country_codes
                                missing_keys = expected_country_codes - actual_keys
                                
                                # PROBLEMA 1: Nessuna chiave corrisponde
                                if not matching_keys:
                                    print(f"      ⚠️  ERRORE: Nessuna chiave paese trovata!")
                                    print(f"         Attese: {sorted(list(expected_country_codes))[:5]}")
                                    print(f"         Ricevute: {sorted(list(actual_keys))[:5]}")
                                    
                                    # Salva risposta raw per debug
                                    debug_file = f"debug_grok_response_batch_{batch_idx}.json"
                                    try:
                                        with open(debug_file, 'w', encoding='utf-8') as f:
                                            json.dump({
                                                "batch_idx": batch_idx,
                                                "expected_keys": list(expected_country_codes),
                                                "actual_keys": list(actual_keys),
                                                "grok_response": translated_batch,
                                                "original_batch_keys": list(batch.keys())
                                            }, f, indent=2, ensure_ascii=False)
                                        print(f"      💾 Risposta salvata in {debug_file}")
                                    except Exception as e:
                                        print(f"      ❌ Errore salvataggio debug: {e}")
                                    
                                    # Fallback: usa dati originali per questo batch
                                    for country_iso in batch.keys():
                                        if country_iso in original_countries_data:
                                            translated_countries[country_iso] = original_countries_data[country_iso]
                                    continue
                                
                                # PROBLEMA 2: Ci sono chiavi extra (non sono codici paese)
                                if extra_keys:
                                    print(f"      ⚠️  ATTENZIONE: Chiavi extra trovate: {sorted(list(extra_keys))[:5]}")
                                    print(f"         Filtro chiavi extra prima del merge...")
                                    # Filtra: mantieni solo le chiavi che sono codici paese attesi
                                    filtered_translated_batch = {
                                        k: v for k, v in translated_batch.items() 
                                        if k in expected_country_codes
                                    }
                                    translated_batch = filtered_translated_batch
                                    print(f"         ✅ Mantenute {len(filtered_translated_batch)}/{len(expected_country_codes)} chiavi paese")
                                
                                # PROBLEMA 3: Mancano alcune chiavi paese
                                if missing_keys:
                                    print(f"      ⚠️  ATTENZIONE: Chiavi paese mancanti: {sorted(list(missing_keys))[:5]}")
                                    print(f"         Uso dati originali per i paesi mancanti...")
                                    # Per i paesi mancanti, usa i dati originali (non tradotti)
                                    for country_iso in missing_keys:
                                        if country_iso in original_countries_data:
                                            translated_batch[country_iso] = original_countries_data[country_iso]
                            
                            # Merge con dati originali EN per preservare chiavi vuote
                            if isinstance(translated_batch, dict):
                                merged_count = 0
                                for country_iso, country_data in translated_batch.items():
                                    if country_iso in original_countries_data:
                                        merged_country_data = merge_preserving_structure(
                                            original_countries_data[country_iso], country_data
                                        )
                                        translated_countries[country_iso] = merged_country_data
                                        update_memory_for_block(locale, f"{block_name}.{country_iso}", merged_country_data, memory, token_usage)
                                        merged_count += 1
                                print(f"      ✅ Merge completato: {merged_count}/{len(batch)} paesi")
                            else:
                                print(f"      ⚠️  Struttura risultato non valida: {type(translated_batch)}")
                                # Fallback per questo batch
                                for country_iso in batch.keys():
                                    if country_iso in original_countries_data:
                                        translated_countries[country_iso] = original_countries_data[country_iso]
                        else:
                            # Fallback: usa originali per questo batch
                            print(f"      ⚠️  Batch fallito, uso dati originali per {len(batch)} paesi")
                            for country_iso in batch.keys():
                                if country_iso in original_countries_data:
                                    translated_countries[country_iso] = original_countries_data[country_iso]

                        total_cost += cost

                    synced_data[block_name] = translated_countries
                    translated_count += 1
                    print(f"      ✅ fused_by_iso completato - Costo totale: ${total_cost:.4f}")

        else:
            # Traduzione normale per altri blocchi (con chunking automatico se necessario)
            result = translate_block_chunks(client, locale, lang_name, block_name, block_data, glossary, context, dry_run=dry_run)

            if result and block_name in result:
                original_block_data = en_data.get(block_name, block_data)
                translated_block_data = result[block_name]
                merged_block_data = merge_preserving_structure(original_block_data, translated_block_data)

                synced_data[block_name] = merged_block_data
                update_memory_for_block(locale, block_name, merged_block_data, memory)
                translated_count += 1
                print(f"      ✅ Tradotto")
            else:
                failed_blocks.append(block_name)
                synced_data[block_name] = en_data.get(block_name, block_data)
                print(f"      ❌ Fallito - mantengo originale da EN")

        update_progress(idx, len(blocks_to_translate), block_name)

        if idx < len(blocks_to_translate):
            time.sleep(1)

    update_progress(len(blocks_to_translate), len(blocks_to_translate), "Completato")

    # Verifica completezza
    en_keys = set(en_data.keys())
    result_keys = set(synced_data.keys())

    if en_keys != result_keys:
        print(f"\n   ⚠️  Struttura non allineata!")
        synced_data = sync_structure(en_data, synced_data)

    # Salva
    locale_files = get_files_for_locale(project_config, locale)
    if len(locale_files) > 1:
        # Multi-file: dividi dati
        source_files = get_source_files(project_config)
        key_to_file_map = {}
        for source_file_info in source_files:
            source_file_path = resolve_project_path(project_config, source_file_info["file"])
            if source_file_path.exists():
                source_file_data = load_json(source_file_path)
                for key in source_file_data.keys():
                    key_to_file_map[key] = source_file_info["file"]

        file_data_map = {}
        for file_info in locale_files:
            file_data_map[file_info["file"]] = {}

        for key, value in synced_data.items():
            source_file = key_to_file_map.get(key)
            if source_file:
                for file_info in locale_files:
                    source_pattern = source_file.split("/")[-1]
                    target_pattern = file_info["file"].split("/")[-1]
                    if source_pattern == target_pattern:
                        file_data_map[file_info["file"]][key] = value
                        break
            else:
                first_file = list(file_data_map.keys())[0]
                file_data_map[first_file][key] = value

        for file_info in locale_files:
            target_file = resolve_project_path(project_config, file_info["file"])
            file_data = file_data_map.get(file_info["file"], {})
            save_json(target_file, file_data)
    else:
        # Single-file
        target_file = resolve_project_path(project_config, locale_files[0]["file"])
        save_json(target_file, synced_data)

    # Rimuovi file progresso
    try:
        if progress_file.exists():
            progress_file.unlink()
    except:
        pass

    success = len(failed_blocks) == 0
    return success, synced_data, memory, total_cost

def update_memory_for_block(locale: str, block_name: str, block_data: Dict, memory: Dict[str, Dict[str, object]], token_usage: Dict = None):
    """Aggiorna la memoria per tutte le path del blocco con timestamp e token"""
    import time
    mem = memory.setdefault(locale, {})
    flat = flatten_json({block_name: block_data})

    # Aggiungi metadata per audit
    for path in flat.keys():
        if path not in mem or mem[path] != flat[path]:
            mem[path] = {
                "value": flat[path],
                "last_translated_at": time.time(),
                "token_usage": token_usage or {}
            }
        elif isinstance(mem[path], dict):
            # Aggiorna timestamp se già esistente
            mem[path]["last_translated_at"] = time.time()
            if token_usage:
                mem[path]["token_usage"] = token_usage
        else:
            # Converti valore semplice in dict con metadata
            mem[path] = {
                "value": flat[path],
                "last_translated_at": time.time(),
                "token_usage": token_usage or {}
            }

def split_block_into_chunks(block_data: Dict, max_tokens_per_chunk: int = 8000) -> List[Dict]:
    """Divide un blocco grande in chunk più piccoli per evitare limiti di token"""
    import json

    # Se il blocco è piccolo, non dividere
    total_chars = len(json.dumps(block_data, ensure_ascii=False))
    total_tokens = total_chars // 4
    if total_tokens <= max_tokens_per_chunk:
        return [block_data]

    chunks = []
    current_chunk = {}
    current_chars = 0

    for key, value in block_data.items():
        # Stima caratteri per questa chiave
        key_chars = len(json.dumps({key: value}, ensure_ascii=False))

        # Se aggiungendo questa chiave superiamo il limite, inizia un nuovo chunk
        if current_chars + key_chars > (max_tokens_per_chunk * 4) and current_chunk:
            chunks.append(current_chunk)
            current_chunk = {}
            current_chars = 0

        current_chunk[key] = value
        current_chars += key_chars

    # Aggiungi l'ultimo chunk se non vuoto
    if current_chunk:
        chunks.append(current_chunk)

    return chunks

def translate_block_chunks(client: OpenAI, locale: str, lang_name: str, block_name: str, block_data: Dict, glossary: Dict, context: str, max_keys_per_chunk: int = 50, dry_run: bool = False) -> Optional[Dict]:
    """Traduce un blocco, dividendolo in chunk se necessario"""
    # Stima token più accurata basata sui caratteri (~4 caratteri per token)
    import json
    total_chars = len(json.dumps(block_data, ensure_ascii=False))
    estimated_tokens = total_chars // 4

    if estimated_tokens <= 10000:  # Soglia per evitare problemi (ridotta per sicurezza)
        # Traduzione normale
        return translate_block(client, locale, lang_name, block_name, block_data, glossary, context, dry_run=dry_run)

    print(f"      📦 Blocco grande ({len(block_data)} chiavi, ~{estimated_tokens} token) - divido in chunk...")

    # Divide in chunk
    chunks = split_block_into_chunks(block_data, max_tokens_per_chunk=6000)
    print(f"      📦 {len(chunks)} chunk creati (~{sum(len(c) for c in chunks)/len(chunks):.0f} chiavi/chunk)")

    translated_data = {}
    total_cost = 0.0

    for chunk_idx, chunk in enumerate(chunks, 1):
        print(f"      🔹 Chunk {chunk_idx}/{len(chunks)}...")
        chunk_result = translate_block(client, locale, lang_name, f"{block_name}_chunk_{chunk_idx}", chunk, glossary, context, dry_run=dry_run)

        if chunk_result and f"{block_name}_chunk_{chunk_idx}" in chunk_result:
            chunk_translated = chunk_result[f"{block_name}_chunk_{chunk_idx}"]
            translated_data.update(chunk_translated)
            print(f"      ✅ Chunk {chunk_idx} tradotto")
        else:
            print(f"      ❌ Chunk {chunk_idx} fallito - uso originali")
            translated_data.update(chunk)

        time.sleep(0.5)  # Piccola pausa tra chunk

    return {block_name: translated_data}

def translate_block(client: OpenAI, locale: str, lang_name: str, block_name: str, block_data: Dict, glossary: Dict, context: str, nearby_blocks: Dict = None, max_retries: int = 2, dry_run: bool = False) -> Optional[Dict]:
    """Traduce un blocco usando Grok API"""
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                print(f"      🔄 Retry {attempt}/{max_retries}...", flush=True)
                time.sleep(2)

            prompt = build_prompt_by_project("generic", block_name, {block_name: block_data}, locale, lang_name, glossary, context)

            if prompt is None:
                print(f"      ⏭️  Blocco vuoto/null, salto", flush=True)
                return {block_name: block_data}

            if dry_run:
                print(f"      🔍 DRY-RUN: Prompt per blocco '{block_name}' ({len(block_data)} chiavi)")
                print(f"         📝 Prompt: {prompt[:200]}..." if len(prompt) > 200 else f"         📝 Prompt: {prompt}")
                print(f"         📊 Dati: {len(str(block_data))} caratteri, {len(block_data)} chiavi")
                return {block_name: block_data}  # Ritorna dati originali in dry-run

            print(f"      ⏳ Invio a Grok...", flush=True)

            response = client.chat.completions.create(
                model=GROK_MODEL,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=8000
            )

            print(f"      📥 Risposta ricevuta", flush=True)

            # Debug token usage per blocchi normali
            if hasattr(response, 'usage') and response.usage:
                token_info = {
                    "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
                    "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
                    "total_tokens": getattr(response.usage, 'total_tokens', 0)
                }
                # Calcola costo usando prezzi ufficiali Grok: $0.20/1M input + $0.50/1M output
                input_cost = (token_info['prompt_tokens'] / 1_000_000) * 0.20
                output_cost = (token_info['completion_tokens'] / 1_000_000) * 0.50
                cost = input_cost + output_cost
                print(f"      📊 Token: {token_info['total_tokens']} total | Costo: ${cost:.6f} (input: ${input_cost:.6f} + output: ${output_cost:.6f})")

            content = response.choices[0].message.content.strip()

            import re
            content = re.sub(r'```json\s*', '', content)
            content = re.sub(r'```\s*$', '', content, flags=re.MULTILINE)
            content = content.strip()

            first_brace = content.find('{')
            if first_brace == -1:
                if attempt < max_retries:
                    continue
                print(f"      ⚠️  Nessun JSON trovato")
                return None

            brace_count = 0
            end_pos = -1
            for i in range(first_brace, len(content)):
                if content[i] == '{':
                    brace_count += 1
                elif content[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i + 1
                        break

            if end_pos == -1:
                if attempt < max_retries:
                    continue
                return None

            json_str = content[first_brace:end_pos]

            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)

            try:
                result = json.loads(json_str)
                return result
            except json.JSONDecodeError as e:
                if attempt < max_retries:
                    continue
                print(f"      ⚠️  JSON non valido: {str(e)[:100]}")
                return None

        except Exception as e:
            if attempt < max_retries:
                continue
            print(f"      ❌ Errore: {str(e)[:100]}")
            return None

    return None

# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Sincronizza e traduce JSON i18n con Grok API - Versione OTTIMIZZATA 2026')
    parser.add_argument('--locale', help='Locale specifico (default: tutti)')
    parser.add_argument('--create-missing', action='store_true', help='Crea file mancanti da EN')
    parser.add_argument('--verify-only', action='store_true', help='Solo verifica, non traduce')
    parser.add_argument('--all', action='store_true', help='Forza tutte le lingue configurate')
    parser.add_argument('--project', default='site', help='ID progetto (site, app, kb) - default: site')
    parser.add_argument('--limit-blocks', help='Limita traduzione a blocchi specifici (comma-separated)')
    parser.add_argument('--dry-run', action='store_true', help='Mostra cosa verrebbe inviato a Grok senza chiamare l\'API')

    args = parser.parse_args()

    # Carica configurazione progetto
    project_config = load_project_config(args.project)
    if not project_config:
        print(f"⚠️  Configurazione progetto '{args.project}' non trovata, uso default 'site'")
        project_config = load_project_config("site") or {
            "id": "site",
            "basePath": "src/i18n",
            "sourceFile": "en-gb.json",
            "sourceLocale": "en-GB",
            "filePattern": "{locale}.json",
            "snapshotPattern": "{locale}.snapshot.json",
            "memoryFile": "../scripts/translation_memory.json"
        }

    project_id = project_config.get("id", "site")

    # FORZA sempre en-GB come source
    project_config["sourceLocale"] = "en-GB"
    # Rimossi override - ora usa il config del progetto

    # Aggiorna percorsi
    global I18N_DIR, EN_SNAPSHOT_PATH, MEMORY_PATH
    I18N_DIR = resolve_project_path(project_config)
    source_locale = "en-GB"
    snapshot_file = get_snapshot_file_for_locale(project_config, source_locale)
    EN_SNAPSHOT_PATH = resolve_project_path(project_config, snapshot_file)
    memory_file = project_config.get("memoryFile", "../scripts/translation_memory.json")
    if memory_file.startswith("../"):
        clean_path = memory_file.replace("../", "", 1)
        MEMORY_PATH = ROOT_DIR / clean_path
    else:
        MEMORY_PATH = ROOT_DIR / memory_file

    # Verifica API key
    if not GROK_API_KEY:
        print("❌ GROK_API_KEY non configurata!")
        print("   Imposta: export GROK_API_KEY='la_tua_api_key'")
        sys.exit(1)

    print("🔍 Inizializzando Grok API...")
    client = init_grok_client()
    if not client:
        sys.exit(1)
    print("✅ Grok API OK\n")

    # Carica EN (source of truth)
    source_files = get_source_files(project_config)
    en_data = {}
    key_to_file_map = {}
    for source_file_info in source_files:
        en_file = resolve_project_path(project_config, source_file_info["file"])
        if en_file.exists():
            file_data = load_json(en_file)
            for key in file_data.keys():
                key_to_file_map[key] = source_file_info["file"]
            en_data = {**en_data, **file_data}
        else:
            print(f"⚠️  {en_file} non trovato, continuo con gli altri file...")

    if not en_data:
        print(f"❌ Nessun file sorgente trovato!")
        sys.exit(1)
    en_keys = set(en_data.keys())
    en_snapshot = load_en_snapshot(project_config)
    new_paths, changed_paths, removed_paths = diff_en(en_data, en_snapshot)
    print(f"📖 EN: {len(en_keys)} blocchi top-level\n")
    if new_paths or changed_paths or removed_paths:
        print(f"   ➕ Nuovi: {len(new_paths)} | ✏️ Cambiati: {len(changed_paths)} | 🗑️ Rimossi: {len(removed_paths)}")
    else:
        print("   ✅ Nessuna differenza rispetto allo snapshot EN")

    # Carica config lingue (filtra per progetto: KB = 53, altri = 103)
    config = load_language_config(project_id)
    if not config:
        print("⚠️  Configurazione lingue non trovata, uso lista completa predefinita")
        config = load_language_config(project_id)

    # Determina lingue
    if args.locale:
        locales = [args.locale] if args.locale in config else []
        if not locales:
            print(f"⚠️  Locale '{args.locale}' non trovato nella configurazione")
    else:
        locales = list(config.keys())

    if not locales:
        print("❌ Nessuna lingua da processare")
        sys.exit(1)

    print(f"📋 Lingue: {len(locales)}")
    print(f"   {', '.join(locales)}\n")

    # Crea file mancanti se richiesto
    if args.create_missing:
        for locale in locales:
            locale_files = get_files_for_locale(project_config, locale)
            source_files = get_source_files(project_config)

            for file_info in locale_files:
                target_file = resolve_project_path(project_config, file_info["file"])
                if not target_file.exists():
                    target_pattern = file_info["file"].split("/")[-1]
                    source_data = {}
                    for source_file_info in source_files:
                        source_pattern = source_file_info["file"].split("/")[-1]
                        if source_pattern == target_pattern:
                            source_file = resolve_project_path(project_config, source_file_info["file"])
                            if source_file.exists():
                                source_data = load_json(source_file)
                                break

                    if source_data:
                        print(f"📝 Creando {file_info['file']} da EN...")
                        save_json(target_file, source_data)
                    else:
                        print(f"⚠️  Nessun file sorgente corrispondente per {file_info['file']}")

    # Verifica solo se richiesto
    if args.verify_only:
        print("\n🔍 VERIFICA STRUTTURA\n")
        for locale in locales:
            locale_files = get_files_for_locale(project_config, locale)
            target_data = {}

            for file_info in locale_files:
                target_file = resolve_project_path(project_config, file_info["file"])
                if target_file.exists():
                    file_data = load_json(target_file)
                    target_data = {**target_data, **file_data}

            if not target_data:
                print(f"❌ {locale}: nessun file trovato")
                continue

            target_keys = set(target_data.keys())

            if en_keys == target_keys:
                print(f"✅ {locale}: struttura OK ({len(target_keys)} chiavi)")
            else:
                missing = en_keys - target_keys
                extra = target_keys - en_keys
                print(f"⚠️  {locale}: struttura non allineata")
                if missing:
                    print(f"   Mancanti: {', '.join(list(missing)[:5])}")
                if extra:
                    print(f"   Extra: {', '.join(list(extra)[:5])}")
        return

    # Memoria traduzioni
    memory = load_memory(project_id)

    # Traduci
    success = []
    failed = []
    total_cost_all_locales = 0.0

    for idx, locale in enumerate(locales, 1):
        print(f"\n{'='*60}")
        print(f"[{idx}/{len(locales)}] {locale}")
        print('='*60)

        file_locale = locale.lower()
        locale_files = get_files_for_locale(project_config, locale)

        # Crea file mancanti
        source_files = get_source_files(project_config)
        for file_info in locale_files:
            target_file = resolve_project_path(project_config, file_info["file"])
            if not target_file.exists():
                target_pattern = file_info["file"].split("/")[-1]
                source_data = {}
                for source_file_info in source_files:
                    source_pattern = source_file_info["file"].split("/")[-1]
                    if source_pattern == target_pattern:
                        source_file = resolve_project_path(project_config, source_file_info["file"])
                        if source_file.exists():
                            source_data = load_json(source_file)
                            break

                if source_data:
                    print(f"⚠️  {file_info['file']} non esiste, creo da EN...")
                    save_json(target_file, source_data)

        ok, translated_data, memory, locale_cost = translate_locale(
            locale,
            en_data,
            client,
            new_paths,
            changed_paths,
            removed_paths,
            memory,
            project_config,
            dry_run=args.dry_run,
            args=args
        )

        total_cost_all_locales += locale_cost

        # Verifica finale
        final_keys = set(translated_data.keys())
        if final_keys == en_keys:
            if ok:
                success.append(locale)
            else:
                failed.append(locale)
        else:
            print(f"   ⚠️  Struttura non allineata dopo traduzione!")
            failed.append(locale)

        # Pausa tra lingue
        if idx < len(locales):
            print(f"\n⏸️  Pausa 3 secondi...")
            time.sleep(3)

    # Riepilogo
    print(f"\n{'='*60}")
    print("📊 RIEPILOGO FINALE")
    print('='*60)
    print(f"✅ Completate: {len(success)}/{len(locales)}")
    if success:
        print(f"   {', '.join(success)}")
    if failed:
        print(f"\n⚠️  Parziali/Falliti: {len(failed)}/{len(locales)}")
        print(f"   {', '.join(failed)}")

    print(f"\n💰 Costo TOTALE: ${total_cost_all_locales:.4f}")

    # Verifica struttura finale
    print(f"\n🔍 Verifica struttura finale...")
    all_ok = True
    for locale in locales:
        locale_files = get_files_for_locale(project_config, locale)
        target_data = {}

        for file_info in locale_files:
            target_file = resolve_project_path(project_config, file_info["file"])
            if target_file.exists():
                file_data = load_json(target_file)
                target_data = {**target_data, **file_data}

        if target_data:
            target_keys = set(target_data.keys())
            if target_keys != en_keys:
                print(f"   ❌ {locale}: {len(target_keys)}/{len(en_keys)} chiavi")
                all_ok = False
        else:
            print(f"   ⚠️  {locale}: nessun file trovato")
            all_ok = False

    if all_ok:
        print(f"   ✅ Tutte le lingue hanno struttura corretta!")

    # Salva memoria e snapshot EN aggiornato
    save_memory(memory, project_id)
    save_json(EN_SNAPSHOT_PATH, en_data)

if __name__ == "__main__":
    main()
