import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../store/session';

/**
 * Top bar: streak + stars + language toggle.
 * Sits under the Telegram header, so it stays visually light.
 */
export function TopBar({ onOpenStore }: { onOpenStore?: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);

  const streak = user?.streakCount ?? 0;
  const stars = user?.starsBalance ?? 0;

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="chip bg-warning-100 text-warning-500">
            🔥 <span className="font-semibold">{streak}</span>
          </span>
          <span className="text-xs text-text-hint">{t('learn.streak')}</span>
        </div>

        <button
          type="button"
          onClick={onOpenStore}
          className="chip bg-brand-50 text-brand-600 transition active:scale-95"
        >
          ⭐ <span className="font-semibold">{stars}</span>
        </button>
      </div>
    </header>
  );
}
