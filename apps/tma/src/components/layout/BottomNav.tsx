import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/telegram';

export type TabKey = 'learn' | 'profile' | 'settings';

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'profile', icon: '👤' },
  { key: 'learn', icon: '🎓' },
  { key: 'settings', icon: '⚙️' },
];

/**
 * Bottom navigation — the 3-part bar from the spec (Learn / Profile / Settings).
 * The Store lives inside the Profile tab, per the spec.
 */
export function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className="safe-bottom sticky bottom-0 z-30 glass-nav border-t border-border">
      <div className="flex items-stretch">
        {TABS.map(({ key, icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                haptic('select');
                onChange(key);
              }}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors',
                isActive ? 'text-accent' : 'text-text-hint'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={clsx('text-xl transition-transform', isActive && 'scale-110')}>
                {icon}
              </span>
              <span className={clsx('text-[11px]', isActive && 'font-semibold')}>
                {t(`tabs.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
