/**
 * Thin typed wrapper over the Telegram WebApp SDK.
 *
 * Everything is defensive: the SDK is absent in a normal browser, and
 * the app must still boot (dev mode, PWA phase). Callers use the
 * `isAvailable` guard instead of `window.Telegram` directly.
 */

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;

  ready(): void;
  expand(): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(
    url: string,
    callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void
  ): void;
  showPopup(params: {
    title?: string;
    message: string;
    buttons?: { id?: string; type?: string; text?: string }[];
  }): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (ok: boolean) => void): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    setText(text: string): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setParams(params: Record<string, unknown>): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  const wa = getWebApp();
  return Boolean(wa && wa.initData);
}

/** آیا در محیط پیش‌نمایش (بدون امضای تلگرام) هستیم؟ */
export function isPreviewMode(): boolean {
  return !isTelegram();
}

export function initTelegram(): TelegramWebApp | null {
  const wa = getWebApp();
  if (!wa) return null;

  try {
    wa.ready();
    wa.expand();

    // رنگ هدر و پس‌زمینه را با تم هماهنگ کن
    const scheme = wa.colorScheme ?? 'light';
    applyTheme(scheme, wa.themeParams);

    wa.onEvent('themeChanged', () => {
      applyTheme(wa.colorScheme, wa.themeParams);
    });

    // ارتفاع viewport را برای layout درست تنظیم کن
    document.documentElement.style.setProperty(
      '--tg-viewport-height',
      `${wa.viewportStableHeight ?? wa.viewportHeight}px`
    );

    wa.onEvent('viewportChanged', () => {
      document.documentElement.style.setProperty(
        '--tg-viewport-height',
        `${wa.viewportStableHeight ?? wa.viewportHeight}px`
      );
    });
  } catch {
    // SDK ناقص — به کار ادامه بده
  }

  return wa;
}

function applyTheme(scheme: 'light' | 'dark', params: Record<string, string>): void {
  document.documentElement.dataset.theme = scheme;
  document.documentElement.classList.toggle('dark', scheme === 'dark');

  // متغیرهای تلگرام را روی ریشه بگذار تا Tailwind از آن‌ها استفاده کند
  for (const [key, value] of Object.entries(params ?? {})) {
    const cssVar = `--tg-theme-${key.replace(/_/g, '-')}`;
    document.documentElement.style.setProperty(cssVar, value);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', params?.bg_color ?? (scheme === 'dark' ? '#0f0f10' : '#ffffff'));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Convenience actions
// ─────────────────────────────────────────────────────────────────────

export function haptic(type: 'success' | 'error' | 'warning' | 'tap' | 'select'): void {
  const hf = getWebApp()?.HapticFeedback;
  if (!hf) return;
  try {
    if (type === 'tap') hf.impactOccurred('light');
    else if (type === 'select') hf.selectionChanged();
    else hf.notificationOccurred(type);
  } catch {
    // ignore
  }
}

export function openInvoice(
  link: string
): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((resolve) => {
    const wa = getWebApp();
    if (!wa) {
      // در مرورگر عادی، لینک را در تب جدید باز کن
      window.open(link, '_blank');
      resolve('pending');
      return;
    }
    wa.openInvoice(link, (status) => resolve(status));
  });
}

export function showAlert(message: string): void {
  const wa = getWebApp();
  if (wa) wa.showAlert(message);
  else window.alert(message);
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wa = getWebApp();
    if (wa) {
      wa.showConfirm(message, (ok) => resolve(ok));
    } else {
      resolve(window.confirm(message));
    }
  });
}

export function setBackButton(visible: boolean, onClick?: () => void): () => void {
  const wa = getWebApp();
  if (!wa) return () => {};

  try {
    if (visible && onClick) {
      wa.BackButton.onClick(onClick);
      wa.BackButton.show();
    } else {
      wa.BackButton.hide();
    }
  } catch {
    // ignore
  }

  return () => {
    try {
      if (onClick) wa.BackButton.offClick(onClick);
      wa.BackButton.hide();
    } catch {
      // ignore
    }
  };
}

export function getTelegramLanguage(): string | undefined {
  return getWebApp()?.initDataUnsafe?.user?.language_code;
}

export function getStartParam(): string | undefined {
  return getWebApp()?.initDataUnsafe?.start_param;
}
