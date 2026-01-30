/**
 * i18n Configuration - All supported languages
 * 
 * Based on languages.json from Sito Agoralia
 * - 103 UI languages total (35 with voice + 68 UI only)
 * - 53 languages for KB/Compliance
 */

export interface Language {
  code: string;
  name: string;
  flag: string;
  country: string;
  ui: boolean;
  voice: boolean;
  rtl: boolean;
}

// All 103 UI languages
export const ALL_LANGUAGES: Language[] = [
  // Voice languages (35)
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸', country: 'United States', ui: true, voice: true, rtl: false },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧', country: 'United Kingdom', ui: true, voice: true, rtl: false },
  { code: 'en-AU', name: 'English (Australia)', flag: '🇦🇺', country: 'Australia', ui: true, voice: true, rtl: false },
  { code: 'en-NZ', name: 'English (New Zealand)', flag: '🇳🇿', country: 'New Zealand', ui: true, voice: true, rtl: false },
  { code: 'en-IN', name: 'English (India)', flag: '🇮🇳', country: 'India', ui: true, voice: true, rtl: false },
  { code: 'es-ES', name: 'Español (Spain)', flag: '🇪🇸', country: 'Spain', ui: true, voice: true, rtl: false },
  { code: 'es-MX', name: 'Español (Latin America)', flag: '🇲🇽', country: 'Mexico', ui: true, voice: true, rtl: false },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷', country: 'France', ui: true, voice: true, rtl: false },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪', country: 'Germany', ui: true, voice: true, rtl: false },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹', country: 'Italy', ui: true, voice: true, rtl: false },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹', country: 'Portugal', ui: true, voice: true, rtl: false },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷', country: 'Brazil', ui: true, voice: true, rtl: false },
  { code: 'nl-NL', name: 'Nederlands', flag: '🇳🇱', country: 'Netherlands', ui: true, voice: true, rtl: false },
  { code: 'nl-BE', name: 'Nederlands (Belgium)', flag: '🇧🇪', country: 'Belgium', ui: true, voice: true, rtl: false },
  { code: 'pl-PL', name: 'Polski', flag: '🇵🇱', country: 'Poland', ui: true, voice: true, rtl: false },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺', country: 'Russia', ui: true, voice: true, rtl: false },
  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳', country: 'China', ui: true, voice: true, rtl: false },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵', country: 'Japan', ui: true, voice: true, rtl: false },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷', country: 'South Korea', ui: true, voice: true, rtl: false },
  { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳', country: 'India', ui: true, voice: true, rtl: false },
  { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷', country: 'Turkey', ui: true, voice: true, rtl: false },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳', country: 'Vietnam', ui: true, voice: true, rtl: false },
  { code: 'th-TH', name: 'ไทย', flag: '🇹🇭', country: 'Thailand', ui: true, voice: true, rtl: false },
  { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩', country: 'Indonesia', ui: true, voice: true, rtl: false },
  { code: 'ms-MY', name: 'Bahasa Melayu', flag: '🇲🇾', country: 'Malaysia', ui: true, voice: true, rtl: false },
  { code: 'sv-SE', name: 'Svenska', flag: '🇸🇪', country: 'Sweden', ui: true, voice: true, rtl: false },
  { code: 'no-NO', name: 'Norsk', flag: '🇳🇴', country: 'Norway', ui: true, voice: true, rtl: false },
  { code: 'da-DK', name: 'Dansk', flag: '🇩🇰', country: 'Denmark', ui: true, voice: true, rtl: false },
  { code: 'fi-FI', name: 'Suomi', flag: '🇫🇮', country: 'Finland', ui: true, voice: true, rtl: false },
  { code: 'el-GR', name: 'Ελληνικά', flag: '🇬🇷', country: 'Greece', ui: true, voice: true, rtl: false },
  { code: 'ro-RO', name: 'Română', flag: '🇷🇴', country: 'Romania', ui: true, voice: true, rtl: false },
  { code: 'hu-HU', name: 'Magyar', flag: '🇭🇺', country: 'Hungary', ui: true, voice: true, rtl: false },
  { code: 'sk-SK', name: 'Slovenčina', flag: '🇸🇰', country: 'Slovakia', ui: true, voice: true, rtl: false },
  { code: 'bg-BG', name: 'Български', flag: '🇧🇬', country: 'Bulgaria', ui: true, voice: true, rtl: false },
  { code: 'ca-ES', name: 'Català', flag: '🇪🇸', country: 'Spain', ui: true, voice: true, rtl: false },

  // UI-only languages (68)
  { code: 'en-CA', name: 'English (Canada)', flag: '🇨🇦', country: 'Canada', ui: true, voice: false, rtl: false },
  { code: 'es-AR', name: 'Español (Argentina)', flag: '🇦🇷', country: 'Argentina', ui: true, voice: false, rtl: false },
  { code: 'fr-CA', name: 'Français (Canada)', flag: '🇨🇦', country: 'Canada', ui: true, voice: false, rtl: false },
  { code: 'de-AT', name: 'Deutsch (Österreich)', flag: '🇦🇹', country: 'Austria', ui: true, voice: false, rtl: false },
  { code: 'de-CH', name: 'Deutsch (Schweiz)', flag: '🇨🇭', country: 'Switzerland', ui: true, voice: false, rtl: false },
  { code: 'ar-AE', name: 'العربية (الإمارات)', flag: '🇦🇪', country: 'UAE', ui: true, voice: false, rtl: true },
  { code: 'ar-EG', name: 'العربية (مصر)', flag: '🇪🇬', country: 'Egypt', ui: true, voice: false, rtl: true },
  { code: 'ar-SA', name: 'العربية (السعودية)', flag: '🇸🇦', country: 'Saudi Arabia', ui: true, voice: false, rtl: true },
  { code: 'ar-MA', name: 'العربية (المغرب)', flag: '🇲🇦', country: 'Morocco', ui: true, voice: false, rtl: true },
  { code: 'he-IL', name: 'עברית', flag: '🇮🇱', country: 'Israel', ui: true, voice: false, rtl: true },
  { code: 'fa-IR', name: 'فارسی', flag: '🇮🇷', country: 'Iran', ui: true, voice: false, rtl: true },
  { code: 'ur-PK', name: 'اردو', flag: '🇵🇰', country: 'Pakistan', ui: true, voice: false, rtl: true },
  { code: 'zh-TW', name: '中文 (繁體)', flag: '🇹🇼', country: 'Taiwan', ui: true, voice: false, rtl: false },
  { code: 'zh-HK', name: '中文 (香港)', flag: '🇭🇰', country: 'Hong Kong', ui: true, voice: false, rtl: false },
  { code: 'uk-UA', name: 'Українська', flag: '🇺🇦', country: 'Ukraine', ui: true, voice: false, rtl: false },
  { code: 'cs-CZ', name: 'Čeština', flag: '🇨🇿', country: 'Czech Republic', ui: true, voice: false, rtl: false },
  { code: 'hr-HR', name: 'Hrvatski', flag: '🇭🇷', country: 'Croatia', ui: true, voice: false, rtl: false },
  { code: 'sr-RS', name: 'Српски', flag: '🇷🇸', country: 'Serbia', ui: true, voice: false, rtl: false },
  { code: 'sl-SI', name: 'Slovenščina', flag: '🇸🇮', country: 'Slovenia', ui: true, voice: false, rtl: false },
  { code: 'et-EE', name: 'Eesti', flag: '🇪🇪', country: 'Estonia', ui: true, voice: false, rtl: false },
  { code: 'lv-LV', name: 'Latviešu', flag: '🇱🇻', country: 'Latvia', ui: true, voice: false, rtl: false },
  { code: 'lt-LT', name: 'Lietuvių', flag: '🇱🇹', country: 'Lithuania', ui: true, voice: false, rtl: false },
  { code: 'is-IS', name: 'Íslenska', flag: '🇮🇸', country: 'Iceland', ui: true, voice: false, rtl: false },
  { code: 'gl-ES', name: 'Galego', flag: '🇪🇸', country: 'Spain', ui: true, voice: false, rtl: false },
  { code: 'eu-ES', name: 'Euskara', flag: '🇪🇸', country: 'Spain', ui: true, voice: false, rtl: false },
  { code: 'sq-AL', name: 'Shqip', flag: '🇦🇱', country: 'Albania', ui: true, voice: false, rtl: false },
  { code: 'mk-MK', name: 'Македонски', flag: '🇲🇰', country: 'North Macedonia', ui: true, voice: false, rtl: false },
  { code: 'mt-MT', name: 'Malti', flag: '🇲🇹', country: 'Malta', ui: true, voice: false, rtl: false },
  { code: 'ga-IE', name: 'Gaeilge', flag: '🇮🇪', country: 'Ireland', ui: true, voice: false, rtl: false },
  { code: 'cy-GB', name: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', country: 'Wales', ui: true, voice: false, rtl: false },
  { code: 'bs-BA', name: 'Bosanski', flag: '🇧🇦', country: 'Bosnia', ui: true, voice: false, rtl: false },
  { code: 'bn-BD', name: 'বাংলা', flag: '🇧🇩', country: 'Bangladesh', ui: true, voice: false, rtl: false },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'ta-IN', name: 'தமிழ்', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'te-IN', name: 'తెలుగు', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'mr-IN', name: 'मराठी', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'gu-IN', name: 'ગુજરાતી', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'kn-IN', name: 'ಕನ್ನಡ', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'ml-IN', name: 'മലയാളം', flag: '🇮🇳', country: 'India', ui: true, voice: false, rtl: false },
  { code: 'fil-PH', name: 'Filipino', flag: '🇵🇭', country: 'Philippines', ui: true, voice: false, rtl: false },
  { code: 'tl-PH', name: 'Tagalog', flag: '🇵🇭', country: 'Philippines', ui: true, voice: false, rtl: false },
  { code: 'sw-KE', name: 'Kiswahili', flag: '🇰🇪', country: 'Kenya', ui: true, voice: false, rtl: false },
  { code: 'ha-NG', name: 'Hausa', flag: '🇳🇬', country: 'Nigeria', ui: true, voice: false, rtl: false },
  { code: 'yo-NG', name: 'Yorùbá', flag: '🇳🇬', country: 'Nigeria', ui: true, voice: false, rtl: false },
  { code: 'am-ET', name: 'አማርኛ', flag: '🇪🇹', country: 'Ethiopia', ui: true, voice: false, rtl: false },
  { code: 'zu-ZA', name: 'isiZulu', flag: '🇿🇦', country: 'South Africa', ui: true, voice: false, rtl: false },
  { code: 'af-ZA', name: 'Afrikaans', flag: '🇿🇦', country: 'South Africa', ui: true, voice: false, rtl: false },
  { code: 'ka-GE', name: 'ქართული', flag: '🇬🇪', country: 'Georgia', ui: true, voice: false, rtl: false },
  { code: 'hy-AM', name: 'Հայdelays', flag: '🇦🇲', country: 'Armenia', ui: true, voice: false, rtl: false },
  { code: 'az-AZ', name: 'Azərbaycan', flag: '🇦🇿', country: 'Azerbaijan', ui: true, voice: false, rtl: false },
  { code: 'kk-KZ', name: 'Қазақ', flag: '🇰🇿', country: 'Kazakhstan', ui: true, voice: false, rtl: false },
  { code: 'uz-UZ', name: 'Oʻzbek', flag: '🇺🇿', country: 'Uzbekistan', ui: true, voice: false, rtl: false },
  { code: 'mn-MN', name: 'Монгол', flag: '🇲🇳', country: 'Mongolia', ui: true, voice: false, rtl: false },
  { code: 'my-MM', name: 'မြန်မာ', flag: '🇲🇲', country: 'Myanmar', ui: true, voice: false, rtl: false },
  { code: 'km-KH', name: 'ខ្មែរ', flag: '🇰🇭', country: 'Cambodia', ui: true, voice: false, rtl: false },
  { code: 'lo-LA', name: 'ລາວ', flag: '🇱🇦', country: 'Laos', ui: true, voice: false, rtl: false },
  { code: 'ne-NP', name: 'नेपाली', flag: '🇳🇵', country: 'Nepal', ui: true, voice: false, rtl: false },
  { code: 'si-LK', name: 'සිංහල', flag: '🇱🇰', country: 'Sri Lanka', ui: true, voice: false, rtl: false },
  { code: 'lb-LU', name: 'Lëtzebuergesch', flag: '🇱🇺', country: 'Luxembourg', ui: true, voice: false, rtl: false },
  { code: 'fo-FO', name: 'Føroyskt', flag: '🇫🇴', country: 'Faroe Islands', ui: true, voice: false, rtl: false },
  { code: 'kl-GL', name: 'Kalaallisut', flag: '🇬🇱', country: 'Greenland', ui: true, voice: false, rtl: false },
  { code: 'mi-NZ', name: 'Te Reo Māori', flag: '🇳🇿', country: 'New Zealand', ui: true, voice: false, rtl: false },
  { code: 'haw-US', name: 'ʻŌlelo Hawaiʻi', flag: '🇺🇸', country: 'Hawaii', ui: true, voice: false, rtl: false },
  { code: 'sm-WS', name: 'Gagana Samoa', flag: '🇼🇸', country: 'Samoa', ui: true, voice: false, rtl: false },
  { code: 'to-TO', name: 'Lea faka-Tonga', flag: '🇹🇴', country: 'Tonga', ui: true, voice: false, rtl: false },
  { code: 'jv-ID', name: 'Basa Jawa', flag: '🇮🇩', country: 'Indonesia', ui: true, voice: false, rtl: false },
  { code: 'gv-IM', name: 'Gaelg', flag: '🇮🇲', country: 'Isle of Man', ui: true, voice: false, rtl: false },
];

// Projects configuration
export interface ProjectConfig {
  id: string;
  name: string;
  basePath: string;
  sourceLocale: string;
  files: {
    pattern: string;
    snapshotPattern: string;
  }[];
}

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'site',
    name: 'Sito Agoralia',
    basePath: '/Users/macbook/Desktop/Sito Agoralia/src/i18n',
    sourceLocale: 'en-gb',  // lowercase as used in file names
    files: [
      { pattern: '{locale}.json', snapshotPattern: '{locale}.snapshot.json' }
    ]
  },
  {
    id: 'app',
    name: 'Agoralia App',
    basePath: '/Users/macbook/Desktop/Agoralia/frontend/src/locales',
    sourceLocale: 'en-GB',  // folder uses en-GB
    files: [
      // UI Files (~3113 keys total)
      { pattern: '{locale}/common.json', snapshotPattern: '{locale}/common.snapshot.json' },         // 386 keys - UI comuni, errori, labels
      { pattern: '{locale}/dashboard.json', snapshotPattern: '{locale}/dashboard.snapshot.json' },   // 75 keys - Dashboard e KPI
      { pattern: '{locale}/agents.json', snapshotPattern: '{locale}/agents.snapshot.json' },         // 489 keys - Editor agenti, voci, modelli
      { pattern: '{locale}/campaigns.json', snapshotPattern: '{locale}/campaigns.snapshot.json' },   // 428 keys - Wizard campagne
      { pattern: '{locale}/leads.json', snapshotPattern: '{locale}/leads.snapshot.json' },           // 220 keys - Gestione contatti
      { pattern: '{locale}/numbers.json', snapshotPattern: '{locale}/numbers.snapshot.json' },       // 139 keys - Numeri telefonici
      { pattern: '{locale}/billing.json', snapshotPattern: '{locale}/billing.snapshot.json' },       // 213 keys - Fatturazione e piani
      { pattern: '{locale}/settings.json', snapshotPattern: '{locale}/settings.snapshot.json' },     // 594 keys - Impostazioni
      { pattern: '{locale}/compliance-ui.json', snapshotPattern: '{locale}/compliance-ui.snapshot.json' }, // 160 keys - UI compliance
      { pattern: '{locale}/auth.json', snapshotPattern: '{locale}/auth.snapshot.json' },             // 151 keys - Login, registrazione, quotes
      { pattern: '{locale}/misc.json', snapshotPattern: '{locale}/misc.snapshot.json' },             // 258 keys - Calls, knowledge, history
      { pattern: '{locale}/email.json', snapshotPattern: '{locale}/email.snapshot.json' },           // Template email
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance (KB)',
    basePath: '/Users/macbook/Desktop/Agoralia/frontend/src/locales',
    sourceLocale: 'en-GB',
    files: [
      { pattern: '{locale}/compliance.json', snapshotPattern: '{locale}/compliance.snapshot.json' }  // Dati compliance per paese
    ]
  }
];

// Compliance/KB languages (53 reduced locales)
export const COMPLIANCE_LANGUAGES: string[] = [
  'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT', 'nl-NL', 'pl-PL',
  'ru-RU', 'uk-UA', 'cs-CZ', 'sk-SK', 'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR',
  'sr-RS', 'sl-SI', 'el-GR', 'tr-TR', 'ar-SA', 'he-IL', 'fa-IR', 'hi-IN',
  'bn-BD', 'th-TH', 'vi-VN', 'id-ID', 'ms-MY', 'ko-KR', 'ja-JP', 'zh-CN',
  'sv-SE', 'no-NO', 'da-DK', 'fi-FI', 'et-EE', 'lv-LV', 'lt-LT', 'is-IS',
  'sq-AL', 'mk-MK', 'ka-GE', 'hy-AM', 'az-AZ', 'kk-KZ', 'uz-UZ', 'mn-MN',
  'my-MM', 'km-KH', 'lo-LA', 'ne-NP', 'si-LK'
];

// Grok pricing
export const GROK_PRICING = {
  model: 'grok-4-fast-non-reasoning',
  inputCostPer1M: 0.20,  // $0.20 per 1M input tokens
  outputCostPer1M: 0.50, // $0.50 per 1M output tokens
};

// Estimate tokens from JSON (roughly 4 chars per token)
export function estimateTokens(data: any): number {
  const jsonStr = JSON.stringify(data);
  return Math.ceil(jsonStr.length / 4);
}

// Estimate translation cost
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GROK_PRICING.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * GROK_PRICING.outputCostPer1M;
  return inputCost + outputCost;
}
