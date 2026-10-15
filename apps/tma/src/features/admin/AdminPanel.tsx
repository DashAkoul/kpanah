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
import { SupportQueuePanel, AdminsPanel, MessagesPanel, PlansPanel } from './AdminSupportPanel';
import { Portal } from '../../components/Portal';
import { useSessionStore } from '../../store/session';
import { effectiveRole, type AdminRole } from '../../lib/roles';

/**
 * Admin console (in-app).
 *
 * Surfaces:
 *   • Users      — browse/search, gift a subscription, revoke
 *   • Support    — ticket queue with replies
 *   • Messages   — send to one user or broadcast
 *   • Plans      — create/edit/delete subscription plans (main admin + finance)
 *   • Admins     — role management (RBAC, main admin only)
 *   • AI Engines — the provider pool
 */
type AdminTab = 'users' | 'support' | 'messages' | 'plans' | 'admins' | 'ai';

/**
 * کدام نقش‌ها کدام تب را می‌بینند.
 * (آینهٔ سرور در `middleware/auth.ts` — سرور هم مستقل بررسی می‌کند.)
 */
const TAB_ROLES: Record<AdminTab, AdminRole[]> = {
  users: ['SUPER_ADMIN', 'SUPPORT', 'MARKETING', 'FINANCE'],
  support: ['SUPER_ADMIN', 'SUPPORT'],
  messages: ['SUPER_ADMIN', 'MARKETING'],
  plans: ['SUPER_ADMIN', 'FINANCE'],
  admins: ['SUPER_ADMIN'],
  ai: ['SUPER_ADMIN'],
};

export function AdminPanel() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const role = effectiveRole(user);

  const allowedTabs = (Object.keys(TAB_ROLES) as AdminTab[]).filter((tab) =>
    role ? TAB_ROLES[tab].includes(role) : false
  );

  const [tab, setTab] = useState<AdminTab>(allowedTabs[0] ?? 'users');

  // اگر نقش عوض شد و تب فعلی مجاز نبود، به اولین تب مجاز برگرد
  const activeTab = allowedTabs.includes(tab) ? tab : (allowedTabs[0] ?? 'users');

  if (!role || allowedTabs.length === 0) {
    return <EmptyState icon="🔒" title={t('admin.noAccess')} />;
  }

  return (
    <div className="space-y-3">
      {/* Sub-tab switcher — فقط تب‌های مجاز */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-sunken)] p-1">
        {allowedTabs.includes('users') && (
          <TabButton active={activeTab === 'users'} onClick={() => setTab('users')}>
            👥 {t('admin.tabUsers')}
          </TabButton>
        )}
        {allowedTabs.includes('support') && (
          <TabButton active={activeTab === 'support'} onClick={() => setTab('support')}>
            💬 {t('support.tab')}
          </TabButton>
        )}
        {allowedTabs.includes('messages') && (
          <TabButton active={activeTab === 'messages'} onClick={() => setTab('messages')}>
            ✉️ {t('admin.tabMessages')}
          </TabButton>
        )}
        {allowedTabs.includes('plans') && (
          <TabButton active={activeTab === 'plans'} onClick={() => setTab('plans')}>
            💳 {t('admin.tabPlans')}
          </TabButton>
        )}
        {allowedTabs.includes('admins') && (
          <TabButton active={activeTab === 'admins'} onClick={() => setTab('admins')}>
            🛡 {t('admin.tabAdmins')}
          </TabButton>
        )}
        {allowedTabs.includes('ai') && (
          <TabButton active={activeTab === 'ai'} onClick={() => setTab('ai')}>
            🤖 {t('admin.tabAi')}
          </TabButton>
        )}
      </div>

      {activeTab === 'users' && <UsersPanel />}
      {activeTab === 'support' && <SupportQueuePanel />}
      {activeTab === 'messages' && <MessagesPanel />}
      {activeTab === 'plans' && <PlansPanel />}
      {activeTab === 'admins' && <AdminsPanel />}
      {activeTab === 'ai' && <AiProvidersPanel />}
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
  uiLanguage: string;
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
            <Chip>🌐 {user.uiLanguage}</Chip>
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
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-bg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-5">
            <h3 className="text-base font-bold text-text">{t('admin.giftTitle')}</h3>
            <button type="button" onClick={onClose} className="text-text-hint">
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
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
                      ? 'border-accent bg-accent-soft'
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
              className="input"
              maxLength={200}
            />
          </div>

          <div className="flex shrink-0 gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth loading={gift.isPending} onClick={() => void submit()}>
              🎁 {t('admin.gift')}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
