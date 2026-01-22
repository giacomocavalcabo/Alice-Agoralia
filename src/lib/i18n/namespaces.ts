/**
 * Definizione dei namespace disponibili per i18n
 * Usa questi per il code splitting dei JSON
 */

export const namespaces = {
  // Namespace globali (sempre caricati)
  common: 'common', // nav, footer, elementi globali
  
  // Namespace per pagine/sezioni
  home: 'home',
  pricing: 'pricing',
  tryCall: 'tryCall',
  solutions: 'solutions',
  product: 'product',
  resources: 'resources',
  legal: 'legal',
  contact: 'contact',
  earlyAccess: 'earlyAccess',
  compliance: 'compliance',
  integrations: 'integrations',
  languageAvailability: 'languageAvailability',
  
  // Namespace per componenti
  modularSolutions: 'modularSolutions',
  ctaSection: 'ctaSection',
  betaCountdown: 'betaCountdown',
  pilotPlaybooks: 'pilotPlaybooks',
  blog: 'blog',
} as const;

export type Namespace = (typeof namespaces)[keyof typeof namespaces];

/**
 * Namespace sempre necessari (caricati in ogni pagina)
 */
export const requiredNamespaces: Namespace[] = [namespaces.common];

/**
 * Mapping pagina -> namespace necessari
 * Usato per determinare quali namespace caricare per ogni pagina
 */
export const pageNamespaces: Record<string, Namespace[]> = {
  '/': [namespaces.common, namespaces.home, namespaces.ctaSection, namespaces.modularSolutions, namespaces.betaCountdown],
  '/pricing': [namespaces.common, namespaces.pricing],
  '/try-call': [namespaces.common, namespaces.tryCall],
  '/solutions': [namespaces.common, namespaces.solutions],
  '/product': [namespaces.common, namespaces.product],
  '/resources': [namespaces.common, namespaces.resources],
  '/contact': [namespaces.common, namespaces.contact],
  '/early-access': [namespaces.common, namespaces.earlyAccess],
  '/compliance': [namespaces.common, namespaces.compliance],
  '/integrations': [namespaces.common, namespaces.integrations],
  '/language-availability': [namespaces.common, namespaces.languageAvailability],
  '/privacy': [namespaces.common, namespaces.legal],
  '/terms': [namespaces.common, namespaces.legal],
  '/cookies': [namespaces.common, namespaces.legal],
};

/**
 * Helper per ottenere i namespace necessari per una pagina
 */
export function getNamespacesForPage(pathname: string): Namespace[] {
  // Normalizza pathname (rimuovi locale se presente)
  const normalized = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/') || '/';
  
  // Cerca match esatto
  if (pageNamespaces[normalized]) {
    return [...requiredNamespaces, ...pageNamespaces[normalized]];
  }
  
  // Match parziale per sottopagine (es: /solutions/exporters-suppliers)
  for (const [path, ns] of Object.entries(pageNamespaces)) {
    if (normalized.startsWith(path)) {
      return [...requiredNamespaces, ...ns];
    }
  }
  
  // Default: solo namespace comuni
  return requiredNamespaces;
}

