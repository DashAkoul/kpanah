/**
 * Theme handling.
 *
 * Modes:
 *   'auto'  — follow the Telegram client (default)
 *   'light' — force light
 *   'dark'  — force dark
 *
 * Kept in its own module so both the low-level Telegram wrapper and the
 * Zustand UI store can use it without importing each other (avoids a
 * circular dependency).
 */

export type ThemeMode = 'auto' | 'light' | 'dark';

const THEME_KEY = 'kpanah.theme';

export function readThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function persistThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // حالت خصوصی مرورگر
  }
}

/**
 * Applies a theme mode to the document.
 *
 * In `auto` we mirror Telegram's `colorScheme` and let its theme params
 * drive the colour tokens. In a manual mode we clear Telegram's inline
 * `--tg-theme-*` overrides so our own light/dark palette wins — otherwise
 * picking "light" while the client is dark would still render dark.
 */
export function applyThemeMode(
  mode: ThemeMode,
  telegramScheme?: 'light' | 'dark' | null,
  params?: Record<string, string> | null
): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const resolved: 'light' | 'dark' =
    mode === 'auto' ? (telegramScheme ?? 'light') : mode;

  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');

  if (mode === 'auto') {
    // رنگ‌های تلگرام را اعمال کن (accent و بقیه از کلاینت می‌آید)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
      }
    }
  } else {
    // حالت دستی — overrideهای تلگرام را پاک کن تا پالت ما اعمال شود
    for (const prop of Array.from(root.style)) {
      if (prop.startsWith('--tg-theme-')) root.style.removeProperty(prop);
    }
  }
}

/** برای هماهنگ‌کردن رنگ نوار وضعیت مرورگر */
export function themeColorFor(mode: ThemeMode, telegramBg?: string | null): string {
  const resolved = mode === 'auto' ? null : mode;
  if (resolved === 'light') return '#ffffff';
  if (resolved === 'dark') return '#0f0f10';
  return telegramBg ?? '#ffffff';
}
