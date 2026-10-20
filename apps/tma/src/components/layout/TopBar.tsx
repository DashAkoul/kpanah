import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';
import { haptic } from '../../lib/telegram';

/**
 * Top bar: streak + theme toggle.
 *
 * The Telegram Stars balance used to live here, but the store already
 * shows the price in ⭐ — a persistent balance chip up top just added
 * noise (and invited "why can't I spend it here?" questions). It has
 * been replaced by a minimal, icon-only theme switch.
 */
export function TopBar() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const themeMode = useUiStore((s) => s.themeMode);
  const setThemeMode = useUiStore((s) => s.setThemeMode);

  const streak = user?.streakCount ?? 0;
  const coins = user?.starsBalance ?? 0;

  const cycleTheme = () => {
    haptic('select');
    const next = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(next);
  };

  const themeIcon = themeMode === 'auto' ? '🌗' : themeMode === 'light' ? '☀️' : '🌙';
  const themeLabel =
    themeMode === 'auto'
      ? t('settings.themeAuto')
      : themeMode === 'light'
        ? t('settings.themeLight')
        : t('settings.themeDark');

  return (
    <header className="safe-top sticky top-0 z-30 glass-nav border-b border-border">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="chip bg-warning-100 text-warning-500">
            🔥 <span className="font-semibold">{streak}</span>
          </span>
          <span className="text-xs text-text-hint">{t('learn.streak')}</span>

          {/* موجودی «سکه» (واحد درون‌برنامه‌ای) */}
          <span className="chip bg-brand-50 text-brand-700" title={t('coins.name')}>
            🪙 <span className="font-semibold">{coins}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={cycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
          className="glass-chip flex h-9 w-9 items-center justify-center rounded-full text-base transition active:scale-95"
        >
          {themeIcon}
        </button>
      </div>
    </header>
  );
}
