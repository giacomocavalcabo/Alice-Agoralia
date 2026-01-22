import {getMessages, getTranslations} from 'next-intl/server';

export async function getSafeStrings(locale: string, ns?: string) {
  const t = await getTranslations({locale, namespace: ns});
  const safe = (key: string, fallback = '') => {
    try { return t(key); } catch { return fallback; }
  };
  return { t, safe };
}

export async function getSafeRaw<T = unknown>(
  locale: string,
  path: string,
  fallback: T
): Promise<T> {
  try {
    const msgs = await getMessages({locale});
    // cammina dentro path tipo "solutions.supplier.features"
    const v = path.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), msgs as any);
    return (v === undefined ? fallback : (v as T));
  } catch {
    return fallback;
  }
}

export function ensureArray<T = unknown>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

export function ensureObject<T extends Record<string, any>>(v: unknown, fallback: T): T {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;
}
