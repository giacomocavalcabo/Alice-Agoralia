/**
 * Loader per i18n - carica JSON unificati per lingua
 */

import type { Locale } from './config';

/**
 * Mappa codici locale ai nomi file
 * Mantiene retrocompatibilità con i file esistenti
 */
const localeFileMap: Record<string, string> = {
  'en': 'en-gb',
  'it': 'it-it',
};

/**
 * Carica tutti i messaggi per una lingua
 */
export async function loadAllMessages(locale: Locale): Promise<Record<string, unknown>> {
  try {
    // Usa mappatura se esiste, altrimenti usa il locale direttamente
    const fileLocale = localeFileMap[locale] || locale;
    const mod = await import(`@/i18n/${fileLocale}.json`);
    return mod.default as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    return {};
  }
}

