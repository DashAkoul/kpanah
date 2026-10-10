import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { PlanType } from '@kpanah/shared';
import { PLAN_DEFINITIONS } from '@kpanah/shared';
import { Card, Button, Chip, Skeleton, EmptyState } from '../../components/ui';
import { useAdminUsers, useAdminGift, useAdminStats } from '../../hooks/useApi';
import { useUiStore } from '../../store/ui';
import { haptic, showConfirm } from '../../lib/telegram';
import { api } from '../../lib/api';
import { AiProvidersPanel } from './AiProvidersPanel';

/**
 * Admin console (in-app).
 *
 * Two surfaces:
 *   • Users      — browse/search, gift a subscription from any plan, revoke
 *   • AI Engines — the provider pool: add, reorder, test, enable/disable
 *
 * The gifting operations are also available via the admin Telegram bot;
 * this panel is the richer surface. Provider management lives only here.
 */
type AdminTab = 'users' | 'ai';

export function AdminPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('users');

  return (
    <div className="space-y-3">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 rounded-xl bg-[var(--surface-sunken)] p-1">
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          {t('admin.tabUsers')}
        </TabButton>
        <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
          {t('admin.tabAi')}
        </TabButton>
      </div>

      {tab === 'users' ? <UsersPanel /> : <AiProvidersPanel />}
    </div>
  );
}

function TabButton({
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
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={clsx(
        'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition',
        active ? 'bg-card text-text shadow-card' : 'text-text-hint'
      )}
    >
      {children}
    </button>
  );
}

function UsersPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [giftTarget, setGiftTarget] = useState<number | null>(null);

  const { data: stats } = useAdminStats();
  const { data, isLoading, refetch } = useAdminUsers({ limit: 30, q: query || undefined });

  const s = (stats as { stats?: Record<string, number> } | undefined)?.stats;

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label={t('admin.totalUsers')} value={s?.totalUsers ?? 0} />
        <MiniStat label={t('admin.activeSubscriptions')} value={s?.activeSubscriptions ?? 0} />
        <MiniStat label="Trials" value={s?.trialsActive ?? 0} />
      </div>

      {/* Search */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('admin.search')}
        className="input"
      />

      {/* Users */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !data?.users?.length ? (
        <EmptyState icon="🔍" title={t('admin.noUsers')} />
      ) : (
        <div className="space-y-2">
          {(data.users as AdminUser[]).map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onGift={() => setGiftTarget(u.telegramId)}
              onRevoke={async () => {
                const ok = await showConfirm(
                  `لغو اشتراک ${u.displayName}؟`
                );
                if (!ok) return;
                try {
                  await api.adminRevoke(u.telegramId);
                  haptic('success');
                  void refetch();
                } catch {
                  // پیام خطا در توست
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Gift sheet */}
      {giftTarget !== null && (
        <GiftSheet
          telegramId={giftTarget}
          onClose={() => setGiftTarget(null)}
          onSuccess={() => {
            setGiftTarget(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

interface AdminUser {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  skillLevel: string;
  planType: string | null;
  daysRemaining: number;
  streakCount: number;
  cycleNumber: number | null;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-2.5 text-center">
      <p className="text-lg font-bold text-text">{value}</p>
      <p className="truncate text-[10px] text-text-hint">{label}</p>
    </Card>
  );
}

function UserRow({
  user,
  onGift,
  onRevoke,
}: {
  user: AdminUser;
  onGift: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const hasActive = user.daysRemaining > 0;

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{user.displayName}</p>
          <p className="truncate text-[11px] text-text-hint target-text" dir="ltr">
            {user.username ? `@${user.username}` : '—'} · {user.telegramId}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip>{user.skillLevel}</Chip>
            {user.planType ? (
              <Chip tone={hasActive ? 'success' : 'neutral'}>
                {user.planType} · {user.daysRemaining}d
              </Chip>
            ) : (
              <Chip tone="danger">—</Chip>
            )}
            {user.cycleNumber && <Chip tone="brand">C{user.cycleNumber}</Chip>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <Button size="sm" onClick={onGift}>
            🎁 {t('admin.gift')}
          </Button>
          {hasActive && (
            <Button size="sm" variant="ghost" onClick={onRevoke}>
              {t('admin.revoke')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────

function GiftSheet({
  telegramId,
  onClose,
  onSuccess,
}: {
  telegramId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const showToast = useUiStore((s) => s.showToast);
  const gift = useAdminGift();

  const [planType, setPlanType] = useState<PlanType>('1_MONTH');
  const [extend, setExtend] = useState(true);
  const [note, setNote] = useState('');

  const submit = async () => {
    try {
      await gift.mutateAsync({ telegramId, planType, note: note || undefined, extend });
      haptic('success');
      showToast(t('admin.giftSuccess'), 'success');
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.generic');
      showToast(message, 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-slide-up safe-bottom w-full max-w-lg rounded-t-2xl bg-bg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-text">{t('admin.giftTitle')}</h3>
          <button type="button" onClick={onClose} className="text-text-hint">
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-text-hint target-text" dir="ltr">
          telegram_id: {telegramId}
        </p>

        {/* Plan picker */}
        <p className="mb-2 text-xs font-medium text-text">{t('admin.selectPlan')}</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PLAN_DEFINITIONS.map((p) => (
            <button
              key={p.planType}
              type="button"
              onClick={() => setPlanType(p.planType)}
              className={clsx(
                'rounded-xl border p-2.5 text-start transition',
                planType === p.planType
                  ? 'border-accent bg-accent-soft ring-accent-soft'
                  : 'border-border bg-card'
              )}
            >
              <p className="text-xs font-semibold text-text">{p.titleFa}</p>
              <p className="text-[10px] text-text-hint">{p.durationDays} روز</p>
            </button>
          ))}
        </div>

        {/* Extend toggle */}
        <label className="mb-3 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={extend}
            onChange={(e) => setExtend(e.target.checked)}
            className="h-4 w-4 accent-[var(--tg-theme-button-color,#2563eb)]"
          />
          <span className="text-xs text-text">{t('admin.extendHint')}</span>
        </label>

        {/* Note */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('admin.note')}
          className="input mb-4"
          maxLength={200}
        />

        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth loading={gift.isPending} onClick={() => void submit()}>
            🎁 {t('admin.gift')}
          </Button>
        </div>
      </div>
    </div>
  );
}
