import { NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { getProjectConfig, resolveProjectPath, getFileForLocale, getSourceFiles, getFilesForLocale } from '@/lib/i18n/project-config';

// Carica mapping KB (lingue ristrette)
let kbLocaleMapping: { reduced_locales: string[]; mapping: Record<string, string> } | null = null;
async function loadKbMapping() {
  if (kbLocaleMapping) return kbLocaleMapping;
  try {
    const mappingPath = join(process.cwd(), 'src', 'config', 'kb-locale-mapping.json');
    const content = await readFile(mappingPath, 'utf-8');
    kbLocaleMapping = JSON.parse(content);
    return kbLocaleMapping;
  } catch (error) {
    console.error('Error loading KB locale mapping:', error);
    return null;
  }
}

// Default: progetto "site" per retrocompatibilità
const DEFAULT_PROJECT = 'site';

// Lingue supportate - Lista completa esatta (103 lingue)
const LOCALES = [
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
] as const;

// Nomi lingue - Lista completa esatta (103 lingue)
const LANGUAGE_NAMES: Record<string, string> = {
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
};

export async function GET(request: Request) {
  try {
    // Ottieni il parametro project dalla query string
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project') || DEFAULT_PROJECT;

    // Carica configurazione progetto
    const project = await getProjectConfig(projectId);
    if (!project) {
      return NextResponse.json(
        { error: `Project "${projectId}" not found` },
        { status: 404 }
      );
    }

    // Mappa file vecchi ai nuovi codici (es. de.json -> de-DE)
    const legacyMapping: Record<string, string> = {
      'de': 'de-DE',
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'nl': 'nl-NL',
      'pl': 'pl-PL',
      'ru': 'ru-RU',
      'cs': 'cs-CZ',
      'sk': 'sk-SK',
      'hu': 'hu-HU',
      'ro': 'ro-RO',
      'bg': 'bg-BG',
      'hr': 'hr-HR',
      'sr': 'sr-RS',
      'sl': 'sl-SI',
      'el': 'el-GR',
      'tr': 'tr-TR',
      'ar': 'ar-SA',
      'he': 'he-IL',
      'fa': 'fa-IR',
      'ur': 'ur-PK',
      'hi': 'hi-IN',
      'bn': 'bn-BD',
      'pa': 'pa-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'id': 'id-ID',
      'ms': 'ms-MY',
      'ko': 'ko-KR',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'sv': 'sv-SE',
      'no': 'no-NO',
      'da': 'da-DK',
      'fi': 'fi-FI',
      'et': 'et-EE',
      'lv': 'lv-LV',
      'lt': 'lt-LT',
      'is': 'is-IS',
      'ca': 'ca-ES',
      'gl': 'gl-ES',
      'eu': 'eu-ES',
      'sq': 'sq-AL',
      'mk': 'mk-MK',
      'mt': 'mt-MT',
      'ga': 'ga-IE',
      'cy': 'cy-GB',
      'sw': 'sw-KE',
      'ha': 'ha-NG',
      'yo': 'yo-NG',
      'am': 'am-ET',
      'zu': 'zu-ZA',
      'af': 'af-ZA',
      'ka': 'ka-GE',
      'hy': 'hy-AM',
      'az': 'az-AZ',
      'kk': 'kk-KZ',
      'uz': 'uz-UZ',
      'uk': 'uk-UA'
    };
    
    // Helper per normalizzare i codici lingua
    function normalizeLocale(locale: string): string | null {
      // Rimuovi spazi e converti in minuscolo per matching
      const cleaned = locale.trim().toLowerCase();
      
      // Prova match esatto prima
      const exactMatch = Object.keys(LANGUAGE_NAMES).find(l => l.toLowerCase() === cleaned);
      if (exactMatch) return exactMatch;
      
      // Prova match con formato locale (es. es-es -> es-ES)
      const parts = cleaned.split('-');
      if (parts.length === 2) {
        const lang = parts[0];
        const region = parts[1];
        const candidate = `${lang}-${region.toUpperCase()}`;
        if (LANGUAGE_NAMES[candidate]) {
          return candidate;
        }
        // Prova anche con region maiuscola (es. en-GB)
        const candidate2 = `${lang.toUpperCase()}-${region.toUpperCase()}`;
        if (LANGUAGE_NAMES[candidate2]) {
          return candidate2;
        }
        
        // Se non trova match, prova a cercare nel mapping legacy
        const legacyMatch = Object.entries(legacyMapping).find(([key]) => key.toLowerCase() === cleaned);
        if (legacyMatch) {
          return legacyMatch[1];
        }
        
        // Se non trova nulla, restituisci il formato standardizzato
        return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
      }
      
      // Se non è formato locale (es. solo "es"), prova mapping legacy
      const legacyMatch = Object.entries(legacyMapping).find(([key]) => key.toLowerCase() === cleaned);
      if (legacyMatch) {
        return legacyMatch[1];
      }
      
      return null;
    }

    // Leggi dinamicamente le lingue dai file JSON presenti nella cartella del progetto
    const baseDir = resolveProjectPath(project);
    const detectedLocales = new Set<string>();
    
    try {
      const files = await readdir(baseDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isDirectory()) {
          // Per progetti con cartelle (es. App Desktop: en-GB/, es-ES/)
          const dirName = file.name;
          // Verifica se contiene file JSON (es. pages.json, email.json, compliance.json)
          try {
            const dirFiles = await readdir(join(baseDir, dirName));
            const hasJsonFiles = dirFiles.some(f => 
              f.endsWith('.json') && 
              !f.includes('snapshot') &&
              (project.files?.some(pf => {
                const pattern = pf.pattern.replace(/{locale}/g, dirName.toLowerCase());
                return f === pattern.split('/').pop();
              }) || f === project.filePattern.split('/').pop()?.replace(/{locale}/g, dirName.toLowerCase()))
            );
            if (hasJsonFiles) {
              // Normalizza il codice (es. en-gb -> en-GB)
              const normalized = normalizeLocale(dirName);
              if (normalized) {
                detectedLocales.add(normalized);
              }
            }
          } catch {
            // Ignora errori di lettura sottocartelle
          }
        } else if (file.isFile() && file.name.endsWith('.json')) {
          // Per progetti con file diretti (es. Sito: es-es.json, de-de.json)
          const fileName = file.name;
          // Escludi file speciali
          if (fileName.includes('snapshot') || 
              fileName === 'code_keys.json' ||
              fileName.toLowerCase() === project.sourceFile.toLowerCase()) {
            continue;
          }
          
          // Estrai il codice lingua dal nome file
          // Es. es-es.json -> es-ES, de-de.json -> de-DE
          const localeMatch = fileName.match(/^(.+?)\.json$/i);
          if (localeMatch) {
            const normalized = normalizeLocale(localeMatch[1]);
            if (normalized) {
              detectedLocales.add(normalized);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${baseDir}:`, err);
    }
    
    // Aggiungi sempre la lingua sorgente
    detectedLocales.add(project.sourceLocale);
    
    // Per KB: carica mapping e usa solo lingue ristrette (53)
    // Per App/Site: usa tutte le 103 lingue
    let availableLocales: readonly string[] = LOCALES;
    if (project.id === 'kb') {
      const kbMapping = await loadKbMapping();
      if (kbMapping && kbMapping.reduced_locales) {
        availableLocales = kbMapping.reduced_locales;
      }
    }
    
    // Crea config per le lingue supportate (filtrare in base al progetto)
    // Questo permette di vedere anche le lingue traducibili che non hanno ancora un file
    const config: Record<string, { name: string }> = {};
    
    // Aggiungi solo le lingue disponibili per questo progetto
    availableLocales.forEach(locale => {
      config[locale] = { name: LANGUAGE_NAMES[locale] || locale };
    });
    
    // Poi aggiungi anche le lingue rilevate che potrebbero non essere nella lista (ma solo se sono disponibili)
    detectedLocales.forEach(locale => {
      if (availableLocales.includes(locale) && !config[locale]) {
        config[locale] = { name: LANGUAGE_NAMES[locale] || locale };
      }
    });

    // Carica file sorgente (EN) per contare le chiavi - supporta file multipli
    const sourceFiles = getSourceFiles(project);
    let enData: any = {};
    try {
      // Carica e unisci tutti i file sorgente
      for (const sourceFile of sourceFiles) {
        const sourcePath = resolveProjectPath(project, sourceFile.file);
        try {
          const enContent = await readFile(sourcePath, 'utf-8');
          const fileData = JSON.parse(enContent);
          // Unisci i dati (se ci sono chiavi duplicate, l'ultimo file vince)
          enData = { ...enData, ...fileData };
        } catch (error) {
          console.error(`Error reading source file ${sourcePath}:`, error);
          // Continua con gli altri file
        }
      }
    } catch (error) {
      console.error(`Error loading source files:`, error);
      // Se EN non esiste, restituisci solo config
    }

    // Helpers per token/costi
    const flattenForTokens = (obj: any, acc: Record<string, any> = {}, prefix = ''): Record<string, any> => {
      if (obj === null || obj === undefined) return acc;
      if (typeof obj !== 'object') {
        if (prefix) acc[prefix] = obj;
        return acc;
      }
      if (Array.isArray(obj)) {
        obj.forEach((v, idx) => {
          const key = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
          flattenForTokens(v, acc, key);
        });
      } else {
        Object.entries(obj).forEach(([k, v]) => {
          const key = prefix ? `${prefix}.${k}` : k;
          flattenForTokens(v, acc, key);
        });
      }
      return acc;
    };

    const estimateTokens = (flat: Record<string, any>): number => {
      let chars = 0;
      for (const v of Object.values(flat)) {
        if (v === null || v === undefined) continue;
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        chars += s.length;
      }
      return chars / 4; // approx token count
    };

    // Costi aggiornati da test reali (Grok-4-fast-non-reasoning)
    // Prezzi ufficiali Grok: $0.20/1M input + $0.50/1M output
    // Per app/site: media semplificata per stima rapida
    const COST_PER_TOKEN_APP = 0.7 / 1_000_000; // $0.70 per 1M token (media input+output per app/site)

    const enFlat = flattenForTokens(enData);
    let tokensFull: number;
    let costPerCountry: number | null = null;

    if (project.id === 'kb') {
      // Per KB: calcolo basato su costi reali testati
      // Test reale: 18 paesi = $0.015460 per batch (20,055 input + 22,897 output tokens)
      // Costo per paese: $0.015460 / 18 = ~$0.000859 per paese
      // Per 204 paesi: 204 / 18 = 11.33 batch → ~$0.175 totali
      const costPerBatch = 0.015460; // Costo reale testato per batch di 18 paesi
      const countriesPerBatch = 18;
      
      // Conta paesi reali da fused_by_iso
      let numCountries = 0;
      if (enData && typeof enData === 'object' && 'fused_by_iso' in enData) {
        const fusedData = enData.fused_by_iso;
        if (fusedData && typeof fusedData === 'object') {
          numCountries = Object.keys(fusedData).length;
        }
      }
      
      // Calcolo basato su batch reali
      const numBatches = Math.ceil(numCountries / countriesPerBatch);
      const costFullKB = costPerBatch * numBatches;
      costPerCountry = costPerBatch / countriesPerBatch;
      
      // Usa tokensFull per compatibilità (non usato per KB, ma necessario per il calcolo costMissing)
      tokensFull = numCountries * 10000; // Stima approssimativa per costMissing
    } else {
      // Per app/site: calcolo normale basato sui token
      tokensFull = estimateTokens(enFlat);
    }
    const enKeys = Object.keys(enData).length;

    // Carica memoria traduzioni
    // memoryFile è sempre relativo alla root del workspace, non al basePath del progetto
    let memory: Record<string, Record<string, any>> = {};
    try {
      let memoryPath: string;
      const memoryFile = project.memoryFile;
      if (memoryFile.startsWith('../')) {
        // Rimuovi il prefisso ../ e usa il path relativo alla root del workspace
        // process.cwd() in Next.js è in web/, quindi risali di 1 livello
        const workspaceRoot = join(process.cwd(), '..');
        const cleanPath = memoryFile.replace('../', '');
        memoryPath = join(workspaceRoot, cleanPath);
      } else {
        // Se non inizia con ../, è già relativo alla root
        const workspaceRoot = join(process.cwd(), '..');
        memoryPath = join(workspaceRoot, memoryFile);
      }
      const memoryContent = await readFile(memoryPath, 'utf-8');
      memory = JSON.parse(memoryContent);
    } catch (error) {
      // Memoria non esiste ancora o errore di lettura
      console.error('Error loading memory file:', error);
    }

    // Funzione per contare tutte le chiavi in un oggetto annidato
    const countAllKeys = (obj: any, prefix = ''): number => {
      let count = 0;
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          count += countAllKeys(value, fullKey);
        } else {
          count++;
        }
      }
      return count;
    };

    // Funzione per confrontare valori ricorsivamente
    const compareValues = (val1: any, val2: any): boolean => {
      if (val1 === val2) return true;
      if (typeof val1 !== typeof val2) return false;
      if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
        if (Array.isArray(val1) !== Array.isArray(val2)) return false;
        if (Array.isArray(val1)) {
          return JSON.stringify(val1) === JSON.stringify(val2);
        }
        const keys1 = Object.keys(val1).sort();
        const keys2 = Object.keys(val2).sort();
        if (keys1.length !== keys2.length) return false;
        return keys1.every(key => compareValues(val1[key], val2[key]));
      }
      return false;
    };

    // Funzione per contare chiavi tradotte ricorsivamente
    // Considera tradotte anche le chiavi in memoria (anche se identiche a EN)
    // IMPORTANTE: Itera su SOURCE (EN) per contare tutte le chiavi che dovrebbero essere tradotte
    const countTranslated = (target: any, source: any, locale: string, memory: Record<string, Record<string, any>>, prefix = ''): number => {
      let count = 0;
      const localeMemory = memory[locale] || {};
      
      // Itera su SOURCE (EN) per assicurarsi di contare tutte le chiavi
      for (const [key, sourceValue] of Object.entries(source)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const targetValue = target?.[key];
        
        if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
          // Se è un oggetto annidato, ricorri
          if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
            count += countTranslated(targetValue, sourceValue, locale, memory, fullKey);
          } else {
            // Chiave mancante in target = non tradotta
            // Non contiamo (verrà aggiunta dalla sincronizzazione)
          }
        } else {
          // Chiave foglia
          if (fullKey in localeMemory) {
            // Se è in memoria, è tradotta (anche se identica a EN - termini tecnici)
            count++;
          } else if (targetValue !== undefined) {
            // Se il valore esiste nel target
            if (!compareValues(targetValue, sourceValue)) {
              // Se è diversa da EN, è tradotta
              count++;
            }
            // Se è identica a EN e non è in memoria, non è tradotta (probabilmente copiata da EN)
          }
          // Se targetValue è undefined, la chiave manca = non tradotta
        }
      }
      return count;
    };

    // Per ogni lingua, verifica stato
    const projectBasePath = resolveProjectPath(project);
    const languages = await Promise.all(
      Object.entries(config).map(async ([locale, info]) => {
        // Ottieni tutti i file per questa locale (supporta file multipli come pages.json + email.json)
        const localeFiles = getFilesForLocale(project, locale);
        let exists = false;
        let keys = 0;
        let translated = 0;
        let memoryCount = 0;
        let lastModified: string | undefined;
        let costFull = 0;
        let costMissing = 0;
        let targetData: any = {};

        // Carica e unisci tutti i file per questa locale
        for (const fileInfo of localeFiles) {
          const fileNameLower = fileInfo.file;
          const filePathLower = resolveProjectPath(project, fileNameLower);
          const fileNameOriginal = fileInfo.file.replace(/\b\w/g, l => l.toUpperCase()); // Prova anche con maiuscole
          const filePathOriginal = resolveProjectPath(project, fileNameOriginal);

          // Preferisci lower, ma se non esiste prova quello originale (es. en-GB)
          let filePath = filePathLower;
          let fileExists = false;

          try {
            const stats = await stat(filePath);
            fileExists = true;
            if (!lastModified || stats.mtime > new Date(lastModified)) {
              lastModified = stats.mtime.toISOString();
            }
          } catch {
            // Prova con il path originale (case-sensitive diverso)
            try {
              const stats = await stat(filePathOriginal);
              filePath = filePathOriginal;
              fileExists = true;
              if (!lastModified || stats.mtime > new Date(lastModified)) {
                lastModified = stats.mtime.toISOString();
              }
            } catch {
              // File non esiste
            }
          }

          if (fileExists) {
            exists = true; // Almeno un file esiste
            try {
              const content = await readFile(filePath, 'utf-8');
              const fileData = JSON.parse(content);
              // Unisci i dati (se ci sono chiavi duplicate, l'ultimo file vince)
              targetData = { ...targetData, ...fileData };
            } catch (err) {
              console.error(`Error reading ${filePath}:`, err);
              // Continua con gli altri file
            }
          }
        }

        if (exists && Object.keys(targetData).length > 0) {
          keys = countAllKeys(targetData);
          
          // Se è la lingua sorgente, è al 100%
          if (locale.toLowerCase() === project.sourceLocale.toLowerCase()) {
            translated = keys; // Tutte le chiavi sono "tradotte" (è la lingua di origine)
            costFull = 0;
            costMissing = 0;
          } else {
            translated = countTranslated(targetData, enData, locale, memory);

            // Stima costi
            if (project.id === 'kb' && costPerCountry !== null) {
              // Per KB: usa costo per paese basato su test reali
              // Conta paesi mancanti dal target
              let missingCountries = 0;
              if (enData && typeof enData === 'object' && 'fused_by_iso' in enData) {
                const enFused = enData.fused_by_iso || {};
                const targetFused = targetData.fused_by_iso || {};
                missingCountries = Object.keys(enFused).filter(code => !(code in targetFused)).length;
              }
              
              // Costo totale: tutti i paesi
              let totalCountries = 0;
              if (enData && typeof enData === 'object' && 'fused_by_iso' in enData) {
                const enFused = enData.fused_by_iso || {};
                totalCountries = Object.keys(enFused).length;
              }
              
              const countriesPerBatch = 18;
              const numBatchesFull = Math.ceil(totalCountries / countriesPerBatch);
              const numBatchesMissing = Math.ceil(missingCountries / countriesPerBatch);
              const costPerBatch = 0.015460; // Costo reale testato
              
              costFull = Number((costPerBatch * numBatchesFull).toFixed(6));
              costMissing = Number((costPerBatch * numBatchesMissing).toFixed(6));
            } else {
              // Per app/site: calcolo normale basato sui token
              const targetFlat = flattenForTokens(targetData);
              const missingPaths = Object.keys(enFlat).filter(p => !(p in targetFlat));
              const tokensMissing = estimateTokens(
                Object.fromEntries(missingPaths.map(p => [p, enFlat[p]]))
              );
              const COST_PER_TOKEN_APP = 0.7 / 1_000_000;
              costFull = Number((tokensFull * COST_PER_TOKEN_APP).toFixed(4));
              costMissing = Number((tokensMissing * COST_PER_TOKEN_APP).toFixed(4));
            }
          }
        } else {
          // Se il file non esiste, keys = 0 (non il numero di chiavi EN)
          keys = 0;
          translated = 0;
          if (project.id === 'kb' && costPerCountry !== null) {
            // Per KB: usa costo totale per tutti i paesi
            let totalCountries = 0;
            if (enData && typeof enData === 'object' && 'fused_by_iso' in enData) {
              const enFused = enData.fused_by_iso || {};
              totalCountries = Object.keys(enFused).length;
            }
            const countriesPerBatch = 18;
            const numBatchesFull = Math.ceil(totalCountries / countriesPerBatch);
            const costPerBatch = 0.015460;
            costFull = Number((costPerBatch * numBatchesFull).toFixed(6));
            costMissing = costFull;
          } else {
            const COST_PER_TOKEN_APP = 0.7 / 1_000_000;
            costFull = Number((tokensFull * COST_PER_TOKEN_APP).toFixed(4));
            costMissing = costFull;
          }
        }

        // Conta chiavi in memoria per questa lingua
        if (memory[locale]) {
          memoryCount = Object.keys(memory[locale]).length;
        }

        return {
          locale,
          name: info.name || locale,
          exists,
          keys, // Se non esiste, sarà 0
          translated,
          memory: memoryCount,
          lastModified,
          costFull,
          costMissing
        };
      })
    );

    return NextResponse.json(languages);
  } catch (error: any) {
    console.error('Error in /api/admin-translation/i18n/languages:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

