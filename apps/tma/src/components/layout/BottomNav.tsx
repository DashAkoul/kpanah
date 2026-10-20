import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/telegram';

export type TabKey = 'profile' | 'store' | 'learn' | 'panel' | 'settings';

/**
 * ترتیب آرایه = راست→چپ در RTL:
 * کاربری، فروشگاه، آموزش، پنل، تنظیمات
 */
const TABS: { key: TabKey; icon: string }[] = [
  { key: 'profile', icon: '👤' },
  { key: 'store', icon: '🛒' },
  { key: 'learn', icon: '🎓' },
  { key: 'panel', icon: '🗂' },
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
                // ⚠️ کلیک روی تبِ فعال نباید کاری کند (قبلاً نویز/پرش می‌داد)
                if (isActive) return;
                haptic('select');
                onChange(key);
              }}
              className={clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                isActive ? 'text-accent' : 'text-text-hint'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={clsx('text-lg transition-transform', isActive && 'scale-110')}>
                {icon}
              </span>
              <span className={clsx('text-[10px]', isActive && 'font-semibold')}>
                {t(`tabs.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
