import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';
import { loadAllMessages } from './loader';
import { isSupportedLocale } from './config';

export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locale || !isSupportedLocale(locale)) {
    notFound();
  }

  // Per ora carica tutti i messaggi (retrocompatibilità)
  // TODO: Quando i JSON saranno ristrutturati per namespace,
  // usa loadMessages() con i namespace specifici per pagina
  const messages = await loadAllMessages(locale);

  return {
    messages,
    locale
  };
});