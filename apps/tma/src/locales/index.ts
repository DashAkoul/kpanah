import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { SupportedUiLanguage } from '@kpanah/shared';
import { RTL_LANGUAGES, DEFAULT_UI_LANGUAGE } from '@kpanah/shared';

import fa from './fa';
import en from './en';
import ar from './ar';
import tr from './tr';
import ru from './ru';

/**
 * i18n bootstrap.
 *
 * Languages are bundled eagerly: they are small, and lazy-loading
 * translation JSON inside a Mini App adds a visible flash on cold start.
 */

const resources = {
  fa,
  en,
  ar,
  tr,
  ru,
} as const;

export function isRtl(language: string): boolean {
  return (RTL_LANGUAGES as readonly string[]).includes(language);
}

export function applyDocumentDirection(language: string): void {
  const rtl = isRtl(language);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}

export async function setupI18n(initialLanguage?: SupportedUiLanguage): Promise<void> {
  const language = initialLanguage ?? DEFAULT_UI_LANGUAGE;

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyDocumentDirection(language);

  i18n.on('languageChanged', (lng) => {
    applyDocumentDirection(lng);
  });
}

export default i18n;
