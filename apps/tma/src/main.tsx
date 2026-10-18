import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupI18n, applyDocumentDirection } from './locales';
import { initTelegram, getTelegramLanguage, getWebApp } from './lib/telegram';
import { readThemeMode, applyThemeMode } from './lib/theme';
import { languageFromTelegramCode } from '@kpanah/shared';
import './styles/index.css';

/**
 * Bootstrap sequence matters:
 *   1. init Telegram SDK (theme, viewport, header colour)
 *   2. resolve the initial language — Telegram's, unless the user has
 *      already chosen one (persisted in the session store)
 *   3. init i18n and set document direction BEFORE first paint, so we
 *      never flash the wrong layout direction
 *   4. mount React
 */
async function bootstrap(): Promise<void> {
  initTelegram();

  // تم را بلافاصله اعمال کن (auto = از تلگرام) تا اولین رنگ‌آمیزی درست باشد
  const wa = getWebApp();
  applyThemeMode(readThemeMode(), wa?.colorScheme ?? null, wa?.themeParams ?? null);

  // زبان ذخیره‌شده کاربر اولویت دارد؛ وگرنه از تلگرام
  const stored = readStoredLanguage();
  const telegramLang = getTelegramLanguage();
  const initialLanguage = stored ?? languageFromTelegramCode(telegramLang);

  await setupI18n(initialLanguage);
  applyDocumentDirection(initialLanguage);

  const root = document.getElementById('root');
  if (!root) throw new Error('#root element not found');

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // اسپلش درون‌خطی را پس از اولین رندر محو کن
  requestAnimationFrame(() => {
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.style.transition = 'opacity .25s ease';
      splash.style.opacity = '0';
      window.setTimeout(() => splash.remove(), 300);
    }
  });
}

function readStoredLanguage(): ReturnType<typeof languageFromTelegramCode> | null {
  try {
    const raw = localStorage.getItem('kpanah.lang');
    if (!raw) return null;
    return raw as ReturnType<typeof languageFromTelegramCode>;
  } catch {
    return null;
  }
}

void bootstrap();
