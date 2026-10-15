import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { haptic } from '../../lib/telegram';

/**
 * صندوق پیام‌های کاربر.
 *
 * همهٔ پیام‌های مدیر (خوانده و خوانده‌نشده) با فیلتر:
 *   • وضعیت: همه / خوانده‌نشده / خوانده‌شده
 *   • نوع:   همه / اطلاع‌رسانی / تخفیف / آپدیت / هشدار
 *
 * در ورود به اپ فقط خوانده‌نشده‌ها به‌صورت بنر ظاهر می‌شوند (MessageBanner)
 * و اینجا تاریخچهٔ کامل در دسترس است.
 */

export interface UserMessage {
  id: string;
  title: string | null;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
  sender_name?: string | null;
}

export const KIND_STYLE: Record<string, { icon: string; cls: string }> = {
  INFO: { icon: 'ℹ️', cls: 'border-border' },
  PROMO: { icon: '🎁', cls: 'border-accent' },
  UPDATE: { icon: '🚀', cls: 'border-border' },
  WARNING: { icon: '⚠️', cls: 'border-danger-soft' },
};

export const MESSAGE_KINDS = ['INFO', 'PROMO', 'UPDATE', 'WARNING'] as const;

/**
 * نوار فیلتر مشترک (وضعیت + نوع) — در صندوق کاربر و تاریخچهٔ مدیر استفاده می‌شود.
 */
export function MessageFilterBar({
  status,
  setStatus,
  kind,
  setKind,
  counts,
}: {
  status: 'all' | 'unread' | 'read';
  setStatus: (s: 'all' | 'unread' | 'read') => void;
  kind: string;
  setKind: (k: string) => void;
  counts?: { all: number; unread: number; read: number };
}) {
  const { t } = useTranslation();

  const statusOptions: { key: 'all' | 'unread' | 'read'; label: string }[] = [
    { key: 'all', label: t('messages.all') },
    { key: 'unread', label: t('messages.unread') },
    { key: 'read', label: t('messages.read') },
  ];

  return (
    <div className="space-y-2">
      {/* وضعیت */}
      <div className="flex gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
        {statusOptions.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              haptic('tap');
              setStatus(o.key);
            }}
            className={clsx(
              'flex-1 rounded-lg py-1.5 text-[11px] font-medium transition',
              status === o.key ? 'bg-card text-text shadow-card' : 'text-text-hint'
            )}
          >
            {o.label}
            {counts && o.key !== 'all' && (
              <span className="ms-1 text-[9px] opacity-70">{counts[o.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* نوع */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setKind('all')}
          className={clsx(
            'rounded-pill border px-3 py-1.5 text-[11px] transition',
            kind === 'all'
              ? 'border-accent bg-accent text-accent-text font-semibold'
              : 'border-border bg-card text-text'
          )}
        >
          {t('messages.byKind')}: {t('messages.all')}
        </button>
        {MESSAGE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={clsx(
              'rounded-pill border px-3 py-1.5 text-[11px] transition',
              kind === k
                ? 'border-accent bg-accent text-accent-text font-semibold'
                : 'border-border bg-card text-text'
            )}
          >
            {KIND_STYLE[k]?.icon} {t(`admin.msgKind.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessagesInbox() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [kind, setKind] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['messages-list'],
    queryFn: async () => (await api.messagesList()) as { messages: UserMessage[] },
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.messagesRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['messages-list'] }),
  });

  const all = data?.messages ?? [];

  const counts = useMemo(
    () => ({
      all: all.length,
      unread: all.filter((m) => !m.read_at).length,
      read: all.filter((m) => m.read_at).length,
    }),
    [all]
  );

  const visible = useMemo(
    () =>
      all.filter((m) => {
        if (status === 'unread' && m.read_at) return false;
        if (status === 'read' && !m.read_at) return false;
        if (kind !== 'all' && m.kind !== kind) return false;
        return true;
      }),
    [all, status, kind]
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (all.length === 0) {
    return <EmptyState icon="✉️" title={t('messages.empty')} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text">{t('messages.title')}</h2>
        {counts.unread > 0 && (
          <button
            type="button"
            onClick={() => markRead.mutate(all.filter((m) => !m.read_at).map((m) => m.id))}
            className="text-[11px] text-accent underline"
          >
            {t('messages.markAllRead')}
          </button>
        )}
      </div>

      <MessageFilterBar
        status={status}
        setStatus={setStatus}
        kind={kind}
        setKind={setKind}
        counts={counts}
      />

      {visible.length === 0 && <EmptyState icon="🔍" title={t('messages.noMatch')} />}

      {visible.map((m) => {
        const style = KIND_STYLE[m.kind] ?? KIND_STYLE.INFO!;
        return (
          <Card
            key={m.id}
            className={clsx('border', style.cls, !m.read_at && 'ring-accent-soft')}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg">{style.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {m.title && <p className="text-sm font-bold text-text">{m.title}</p>}
                  {!m.read_at && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-text">
                      NEW
                    </span>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-text-hint">
                  {m.body}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-text-muted">
                    {m.sender_name ? `${m.sender_name} · ` : ''}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  {!m.read_at && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate([m.id])}
                      className="shrink-0 text-[10px] text-accent underline"
                    >
                      {t('messages.markRead')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
