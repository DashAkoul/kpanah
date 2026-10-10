import { create } from 'zustand';
import type { SupportedUiLanguage } from '@kpanah/shared';

/**
 * UI-only state. Server data lives in React Query — mixing them in
 * Zustand is the classic source of stale-cache bugs.
 */

const LANG_STORAGE_KEY = 'kpanah.lang';

/** زبان انتخاب‌شده کاربر را برای اجرای بعدی نگه می‌دارد */
function persistLanguage(lang: SupportedUiLanguage): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore — حالت خصوصی مرورگر
  }
}

function readPersistedLanguage(): SupportedUiLanguage | null {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (!raw) return null;
    const supported = ['fa', 'en', 'ar', 'tr', 'ru'];
    return supported.includes(raw) ? (raw as SupportedUiLanguage) : null;
  } catch {
    return null;
  }
}

interface UiState {
  uiLanguage: SupportedUiLanguage;
  setUiLanguage: (lang: SupportedUiLanguage) => void;

  /** آیا راهنماهای inline دیده شده‌اند */
  hintsSeen: Record<string, boolean>;
  markHintSeen: (key: string) => void;

  /** وضعیت قفل کل برنامه (پس از پایان چرخه ۷) */
  appLocked: boolean;
  lockReason: string | null;
  setAppLocked: (locked: boolean, reason?: string | null) => void;

  /** toast سبک */
  toast: { message: string; kind: 'info' | 'success' | 'error' } | null;
  showToast: (message: string, kind?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  uiLanguage: readPersistedLanguage() ?? 'fa',
  setUiLanguage: (uiLanguage) => {
    persistLanguage(uiLanguage);
    set({ uiLanguage });

    // i18n را هم همگام کن (import دینامیک تا از چرخه import جلوگیری شود)
    void import('../locales').then(({ default: i18n, applyDocumentDirection }) => {
      void i18n.changeLanguage(uiLanguage);
      applyDocumentDirection(uiLanguage);
    });
  },

  hintsSeen: {},
  markHintSeen: (key) =>
    set((state) => ({ hintsSeen: { ...state.hintsSeen, [key]: true } })),

  appLocked: false,
  lockReason: null,
  setAppLocked: (appLocked, lockReason = null) => set({ appLocked, lockReason }),

  toast: null,
  showToast: (message, kind = 'info') => {
    set({ toast: { message, kind } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),
}));
