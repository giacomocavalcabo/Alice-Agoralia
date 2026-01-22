/**
 * Source of truth per la configurazione del sito
 * Usa questa costante ovunque invece di hardcodare URL
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agoralia.com';

// Export anche per retrocompatibilità (se altri file usano siteUrl)
export const siteUrl = SITE_URL;
export const siteDomain = 'agoralia.com';
export const siteName = 'Agoralia';
export const siteTagline = 'Voice AI for cross-border B2B trade';
export const siteLogo = '/favicon.ico';
export const socialLinks = ['https://www.linkedin.com'];

// Typography scale
export const typeScale = {
  h1: 'text-[40px] leading-[44px] font-bold',
  h2: 'text-[28px] leading-[32px] font-bold',
  h3: 'text-[20px] leading-[28px] font-semibold',
  body: 'text-[16px] leading-[26px]',
  caption: 'text-[12px] leading-[16px] font-medium uppercase tracking-wide'
};

