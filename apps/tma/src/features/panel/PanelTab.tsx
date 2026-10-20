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
  const rate = home?.coinValueIrr ?? null;
  const [rateInput, setRateInput] = useState(String(rate ?? 0));
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

            {rate !== null && (
              <p className="mt-2 text-[11px] text-text-hint">
                {t('coins.rate', { value: rate.toLocaleString('fa-IR') })}
              </p>
            )}

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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  loading={savingRate}
                  onClick={async () => {
                    setSavingRate(true);
                    try {
                      await api.setCoinRate(Number(rateInput) || 0);
                      await refetch();
                    } finally {
                      setSavingRate(false);
                    }
                  }}
                >
                  {t('common.save')}
                </Button>
              </div>
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
