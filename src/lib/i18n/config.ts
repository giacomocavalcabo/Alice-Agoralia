/**
 * Configurazione centralizzata per i18n
 * Source of truth per le lingue supportate
 */

// Lingue attualmente implementate con file di traduzione
export const locales = ['en', 'it'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const rtlLocales: Locale[] = [];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

export function isSupportedLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

