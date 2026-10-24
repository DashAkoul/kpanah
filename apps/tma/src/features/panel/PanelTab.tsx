import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Button } from '../../components/ui';
import { MessagesInbox } from '../profile/MessagesInbox';
import { SupportPanel } from '../support/SupportPanel';
import { AdminPanel } from '../admin/AdminPanel';
import { useSessionStore } from '../../store/session';
import { useHome } from '../../hooks/useApi';
import { useQuery } from '@tanstack/react-query';
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

  // نقشهٔ خودِ مدیر (بازرسی) — فقط برای ادمین
  const [targetUser, setTargetUser] = useState<string | undefined>(undefined);

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users-picker'],
    enabled: Boolean(user?.isAdmin),
    staleTime: 120_000,
    queryFn: async () => {
      const res = (await api.adminUsers({ limit: 20 })) as {
        users: { id: string; firstName?: string | null; telegramId?: number }[];
      };
      return res.users ?? [];
    },
  });

  const { data: adminMap } = useQuery({
    queryKey: ['admin-map', targetUser],
    enabled: Boolean(user?.isAdmin),
    staleTime: 30_000,
    queryFn: () => api.adminMap(targetUser),
  });

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

          {/* بازرسی نقشه — فقط مدیر */}
          {user?.isAdmin && adminMap && (
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text">🗺 {t('adminMap.title')}</p>
                <Chip tone="brand">v{adminMap.version} · r{adminMap.rulesVersion ?? '—'}</Chip>
              </div>
              <p className="mt-1 text-[11px] text-text-hint">
                {t('adminMap.stage')}: {adminMap.currentStageId}
              </p>

              {/* انتخاب کاربر — بازرسی چندکاربره */}
              {(adminUsers?.length ?? 0) > 0 && (
                <select
                  value={targetUser ?? ''}
                  onChange={(e) => setTargetUser(e.target.value || undefined)}
                  className="mt-2 w-full rounded-xl border border-border bg-card px-2 py-1.5 text-[11px] text-text"
                >
                  <option value="">{t('adminMap.myMap')}</option>
                  {adminUsers!.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName ?? u.telegramId ?? u.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-2 space-y-1">
                {adminMap.stages.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1.5"
                  >
                    <span className="truncate text-[11px] text-text">
                      {st.order}. {st.title}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-text-hint">
                      {t(`adminMap.status.${st.status}`, { defaultValue: st.status })}
                    </span>
                  </div>
                ))}
              </div>

              {(() => {
                const stageId = adminMap.currentStageId;
                const rows = adminMap.objectiveStatus?.[stageId] ?? [];
                if (rows.length === 0) return null;
                return (
                  <>
                    <p className="mt-3 text-[11px] font-semibold text-text-hint">
                      {t('adminMap.objectives')}
                    </p>
                    <div className="mt-1 space-y-1">
                      {rows.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1.5"
                        >
                          <span className="truncate text-[10px] text-text">{r.id}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-text-hint">
                            {r.passed === null
                              ? t('adminMap.unknown')
                              : `${r.pct}% (${r.total})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {adminMap.violations.length > 0 && (
                <>
                  <p className="mt-3 text-[11px] font-semibold text-text-hint">
                    {t('adminMap.violations')} ({adminMap.violations.length})
                  </p>
                  <div className="mt-1 space-y-1">
                    {adminMap.violations.slice(-3).map((v) => (
                      <p key={`${v.at}-${v.rule}`} className="text-[10px] leading-relaxed text-text-muted">
                        • {v.rule}: {v.detail}
                      </p>
                    ))}
                  </div>
                </>
              )}

              {adminMap.decisions.length > 0 && (
                <>
                  <p className="mt-3 text-[11px] font-semibold text-text-hint">
                    {t('adminMap.decisions')} ({adminMap.decisions.length})
                  </p>
                  <div className="mt-1 space-y-1">
                    {adminMap.decisions.slice(-3).map((d) => (
                      <p key={`${d.at}-${d.ruleId}`} className="text-[10px] leading-relaxed text-text-muted">
                        • {d.ruleId} → {d.output}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

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
