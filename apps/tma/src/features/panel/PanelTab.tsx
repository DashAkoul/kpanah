import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Button } from '../../components/ui';
import { MessagesInbox } from '../profile/MessagesInbox';
import { SupportPanel } from '../support/SupportPanel';
import { AdminPanel } from '../admin/AdminPanel';
import { useSessionStore } from '../../store/session';
import { useHome } from '../../hooks/useApi';
import { api } from '../../lib/api';

type PanelView = 'coins' | 'messages' | 'support' | 'admin';

/**
 * «پنل» — امتیازات (سکه) + پیام‌ها + پشتیبانی + مدیریت.
 *
 * ⚠️ قبلاً این سه بخش داخل «کاربری» بودند و صفحهٔ کاربری شلوغ می‌شد.
 */
export function PanelTab({ onGoStore }: { onGoStore: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const [view, setView] = useState<PanelView>('coins');

  const coins = user?.starsBalance ?? 0;

  // ارزش هر سکه (تنظیم مدیر) — پایهٔ آیندهٔ تبدیل سکه
  const { data: home, refetch } = useHome();
  const [stepInput, setStepInput] = useState(
    String(home?.coinDiscount?.coinsPerStep ?? 1000)
  );
  const [pctInput, setPctInput] = useState(
    String(home?.coinDiscount?.percentPerStep ?? 5)
  );
  const [savingRate, setSavingRate] = useState(false);

  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-sunken)] p-1">
        <Tab active={view === 'coins'} onClick={() => setView('coins')}>
          🪙 {t('panel.coins')}
        </Tab>
        <Tab active={view === 'messages'} onClick={() => setView('messages')}>
          ✉️ {t('messages.title')}
        </Tab>
        <Tab active={view === 'support'} onClick={() => setView('support')}>
          💬 {t('support.tab')}
        </Tab>
        {user?.isAdmin && (
          <Tab active={view === 'admin'} onClick={() => setView('admin')}>
            🛠 {t('settings.adminPanel')}
          </Tab>
        )}
      </div>

      {view === 'coins' && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-hint">{t('coins.balance')}</p>
                <p className="mt-1 text-3xl font-bold text-text">
                  🪙 {coins}
                </p>
              </div>
              <Chip tone="brand">{t('coins.name')}</Chip>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-text-hint">
              {t('coins.explain')}
            </p>

            <Button fullWidth size="sm" className="mt-3" onClick={onGoStore}>
              {t('coins.spendInStore')}
            </Button>
          </Card>

          {/* تنظیم ارزش سکه — فقط مدیر */}
          {user?.isAdmin && (
            <Card>
              <p className="mb-1 text-xs font-semibold text-text">{t('coins.adminRate')}</p>
              <p className="mb-2 text-[11px] leading-relaxed text-text-hint">
                {t('coins.adminRateHint')}
              </p>
              <p className="mt-4 mb-1 text-xs font-semibold text-text">
                {t('coins.adminDiscount')}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed text-text-hint">
                {t('coins.adminDiscountHint')}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-[10px] text-text-hint">{t('coins.coinsPerStep')}</p>
                  <input
                    type="number"
                    min={1}
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
                    dir="ltr"
                  />
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[10px] text-text-hint">{t('coins.percentPerStep')}</p>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={pctInput}
                    onChange={(e) => setPctInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
                    dir="ltr"
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-text-muted">
                {t('coins.adminDiscountExample', { step: stepInput, pct: pctInput })}
              </p>
            </Card>
          )}

          <Card>
            <p className="mb-2 text-xs font-semibold text-text">{t('coins.convert')}</p>
            <div className="space-y-2">
              {[
                { icon: '⭐', label: t('coins.toStars') },
                { icon: '💎', label: t('coins.toTon') },
                { icon: '🏧', label: t('coins.withdraw') },
              ].map((opt) => (
                <div
                  key={opt.label}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 opacity-60"
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="flex-1 text-xs text-text">{opt.label}</span>
                  <Chip>{t('store.soon')}</Chip>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {view === 'messages' && <MessagesInbox />}
      {view === 'support' && <SupportPanel />}
      {view === 'admin' && user?.isAdmin && <AdminPanel />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex-1 whitespace-nowrap rounded-lg bg-card px-3 py-2 text-xs font-semibold text-text shadow-sm transition'
          : 'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium text-text-hint transition'
      }
    >
      {children}
    </button>
  );
}
