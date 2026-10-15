import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Chip, ProgressBar } from '../../components/ui';
import { FREE_TRIAL_DAYS } from '@kpanah/shared';
import { ProgressPanel } from './ProgressPanel';
import { StorePanel } from '../store/StorePanel';
import { SupportPanel } from '../support/SupportPanel';
import { MessagesInbox } from './MessagesInbox';
import { useSessionStore } from '../../store/session';
import { AdminPanel } from '../admin/AdminPanel';
import { api } from '../../lib/api';

type SubView = 'overview' | 'store' | 'messages' | 'support' | 'admin';

/**
 * Profile & Store tab — combines identity, stats, and the store,
 * matching the spec's "کاربری (User Profile & Store)" section.
 */
export function ProfileTab() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const [view, setView] = useState<SubView>('overview');

  // تعداد پیام‌های خوانده‌نشده — از همان کشِ بنر استفاده می‌کند
  const { data: msgData } = useQuery({
    queryKey: ['messages-list'],
    queryFn: async () => (await api.messagesList()) as { messages: { read_at: string | null }[] },
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const unreadCount = (msgData?.messages ?? []).filter((m) => !m.read_at).length;

  if (!user) return null;

  const sub = user.subscription;
  const initials = (user.firstName ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-4 p-4">
      {/* Identity card */}
      <Card>
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-text">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-text">
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
            </p>
            {user.username && (
              <p className="truncate text-xs text-text-hint target-text" dir="ltr">
                @{user.username}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip tone="brand">{user.skillLevel}</Chip>
              {user.learningGoal && (
                <Chip>{t(`goals.${user.learningGoal}`, { defaultValue: user.learningGoal })}</Chip>
              )}
            </div>
          </div>
        </div>

        {/* Subscription status */}
        <div className="mt-4 rounded-xl bg-[var(--surface-sunken)] p-3">
          {sub ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-hint">
                  {sub.planType === 'TRIAL' ? t('profile.trialActive') : t('profile.subscription')}
                </span>
                <Chip tone={sub.daysRemaining <= 3 ? 'warning' : 'success'}>
                  {t('profile.expiresIn', { count: sub.daysRemaining })}
                </Chip>
              </div>

              <div className="mt-2">
                <ProgressBar
                  value={sub.daysRemaining}
                  max={planDays(sub.planType)}
                  height={6}
                  color={
                    sub.daysRemaining <= 3
                      ? 'var(--warning-500, #d97706)'
                      : 'var(--success-500, #16a34a)'
                  }
                />
              </div>

              <p className="mt-2 text-[11px] text-text-muted">
                {t('profile.sourceTrial') === 'Trial' ? 'Source' : 'منبع'}:{' '}
                {sub.source === 'TRIAL'
                  ? t('profile.sourceTrial')
                  : sub.source === 'ADMIN_GIFT'
                    ? t('profile.sourceGift')
                    : t('profile.sourceStars')}
              </p>
            </>
          ) : user.hasAccess ? (
            // کاربر در دورهٔ آزمایشی است (بدون ردیف اشتراک)
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-hint">
                  {t('profile.trialActive')}
                </span>
                {trialDaysRemaining(user.createdAt) > 0 && (
                  <Chip tone={trialDaysRemaining(user.createdAt) <= 3 ? 'warning' : 'success'}>
                    {t('profile.expiresIn', { count: trialDaysRemaining(user.createdAt) })}
                  </Chip>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                {t('profile.trialHint')}
              </p>
            </>
          ) : (
            // اشتراک کاربر منقضی شده است
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-hint">{t('profile.noSubscription')}</span>
              <Chip tone="danger">{t('profile.expired')}</Chip>
            </div>
          )}

          <Button
            fullWidth
            size="sm"
            className="mt-3"
            onClick={() => setView('store')}
          >
            {sub && sub.planType !== 'TRIAL'
              ? t('profile.upgrade')
              : t('profile.buySubscription')}
          </Button>
        </div>
      </Card>

      {/* Sub-view switcher */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-sunken)] p-1">
        <SubTab active={view === 'overview'} onClick={() => setView('overview')}>
          📊 {t('profile.stats')}
        </SubTab>
        <SubTab active={view === 'store'} onClick={() => setView('store')}>
          🛒 {t('profile.store')}
        </SubTab>
        <SubTab active={view === 'messages'} onClick={() => setView('messages')}>
          ✉️ {t('messages.title')}
          {unreadCount > 0 && (
            <span className="ms-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-text">
              {unreadCount}
            </span>
          )}
        </SubTab>
        <SubTab active={view === 'support'} onClick={() => setView('support')}>
          💬 {t('support.tab')}
        </SubTab>
        {user.isAdmin && (
          <SubTab active={view === 'admin'} onClick={() => setView('admin')}>
            🛠 {t('settings.adminPanel')}
          </SubTab>
        )}
      </div>

      {view === 'overview' && <ProgressPanel />}
      {view === 'store' && <StorePanel />}
      {view === 'messages' && <MessagesInbox />}
      {view === 'support' && <SupportPanel />}
      {view === 'admin' && user.isAdmin && <AdminPanel />}
    </div>
  );
}

function SubTab({
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
          ? 'flex-1 rounded-lg bg-card px-3 py-2 text-xs font-semibold text-text shadow-sm transition'
          : 'flex-1 rounded-lg px-3 py-2 text-xs font-medium text-text-hint transition'
      }
    >
      {children}
    </button>
  );
}

function planDays(planType: string): number {
  const map: Record<string, number> = {
    TRIAL: 7,
    '2_WEEKS': 14,
    '1_MONTH': 30,
    '3_MONTHS': 90,
    '6_MONTHS': 180,
    '1_YEAR': 365,
  };
  return map[planType] ?? 30;
}

/** روزهای باقی‌ماندهٔ دورهٔ آزمایشی بر اساس تاریخ عضویت */
function trialDaysRemaining(createdAt: string): number {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const elapsedDays = Math.floor((Date.now() - start) / 86_400_000);
  return Math.max(0, FREE_TRIAL_DAYS - elapsedDays);
}
