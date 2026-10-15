import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button, Chip, Skeleton, EmptyState } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { haptic, showConfirm } from '../../lib/telegram';
import { useSessionStore } from '../../store/session';
import { useUiStore } from '../../store/ui';
import { effectiveRole } from '../../lib/roles';
import { findLanguage } from '@kpanah/shared';
import { Portal } from '../../components/Portal';

/**
 * پنل ادمین — صف تیکت‌های پشتیبانی + مدیریت نقش‌ها (RBAC).
 */

/** استایل/آیکن هر نوع پیام — مشترک با صندوق پیام کاربر */
const KIND_STYLE: Record<string, { icon: string; cls: string }> = {
  INFO: { icon: 'ℹ️', cls: 'border-border' },
  PROMO: { icon: '🎁', cls: 'border-accent' },
  UPDATE: { icon: '🚀', cls: 'border-border' },
  WARNING: { icon: '⚠️', cls: 'border-danger-soft' },
};

const KIND_KEYS = ['INFO', 'PROMO', 'UPDATE', 'WARNING'] as const;

// ─────────────────────────────────────────────────────────────────────
// صف تیکت‌های پشتیبانی
// ─────────────────────────────────────────────────────────────────────

interface AdminTicket {
  id: string;
  telegram_id: number;
  subject: string;
  category: string;
  status: string;
  last_message: string | null;
  last_at: string;
  unread_for_admin: boolean;
}

export function SupportQueuePanel() {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-support-list'],
    queryFn: async () =>
      (await api.adminSupportList()) as { tickets: AdminTicket[] },
    staleTime: 15_000,
  });

  if (openId) {
    return <TicketThread ticketId={openId} onBack={() => { setOpenId(null); void refetch(); }} />;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text">{t('admin.tickets')}</h3>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!isLoading && (data?.tickets?.length ?? 0) === 0 && (
        <EmptyState icon="💬" title={t('admin.noTickets')} />
      )}

      {data?.tickets?.map((tk) => (
        <button
          key={tk.id}
          type="button"
          onClick={() => {
            haptic('tap');
            setOpenId(tk.id);
          }}
          className="w-full rounded-card border border-border bg-card p-3.5 text-start transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
              {tk.subject}
            </p>
            <div className="flex shrink-0 gap-1">
              {tk.unread_for_admin && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-text">
                  NEW
                </span>
              )}
              <Chip>{t(`support.status.${tk.status}`, { defaultValue: tk.status })}</Chip>
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] text-text-hint">{tk.last_message}</p>
          <p className="mt-1 text-[10px] text-text-muted">
            #{tk.telegram_id} · {new Date(tk.last_at).toLocaleDateString()}
          </p>
        </button>
      ))}
    </div>
  );
}

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const [text, setText] = useState('');
  const [sentFlash, setSentFlash] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-support-thread', ticketId],
    queryFn: async () =>
      (await api.adminSupportThread(ticketId)) as {
        ticket: AdminTicket;
        messages: { id: string; author: string; body: string; created_at: string }[];
      },
  });

  const reply = useMutation({
    mutationFn: (body: string) => api.adminSupportReply(ticketId, body),
    // ⚠️ ورودی را همان لحظهٔ ارسال پاک می‌کنیم (optimistic) تا مدیر متوجه
    // شود و متن را دوباره نفرستد. در صورت خطا متن برمی‌گردد.
    onMutate: (body) => {
      const previous = text;
      setText('');
      return { previous, body };
    },
    onSuccess: (_d, body) => {
      haptic('success');
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 1800);
      showToast(t('admin.replySent'), 'success');
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['admin-support-list'] });
      void body;
    },
    onError: (err, _body, ctx) => {
      // متن را برگردان تا مدیر داده‌اش را از دست ندهد
      if (ctx?.previous) setText(ctx.previous);
      showToast(err instanceof Error && err.message ? err.message : t('errors.generic'), 'error');
    },
  });

  const send = () => {
    const body = text.trim();
    if (body.length < 1) return;
    haptic('tap');
    reply.mutate(body);
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-xs text-text-hint">
        ‹ {t('common.back')}
      </button>

      {isLoading && <Skeleton className="h-32" />}

      {data && (
        <>
          <div>
            <h3 className="text-sm font-bold text-text">{data.ticket.subject}</h3>
            <p className="text-[10px] text-text-muted">
              #{data.ticket.telegram_id} · {data.ticket.category}
            </p>
          </div>

          <div className="space-y-2">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={clsx(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  m.author === 'ADMIN'
                    ? 'ms-auto bg-accent text-accent-text'
                    : 'me-auto border border-border bg-card text-text'
                )}
              >
                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                <p className="mt-1 text-[9px] opacity-60">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* تأیید بصری ارسال */}
          {sentFlash && (
            <p className="animate-fade-in text-center text-[11px] font-medium text-success-500">
              ✓ {t('admin.replySent')}
            </p>
          )}

          <div className="sticky bottom-0 flex gap-2 bg-bg pt-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="input flex-1"
              placeholder={t('support.replyPlaceholder')}
              disabled={reply.isPending}
            />
            <Button
              size="sm"
              loading={reply.isPending}
              disabled={text.trim().length < 1}
              onClick={send}
            >
              ➤
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// مدیریت نقش‌ها (فقط SUPER_ADMIN)
// ─────────────────────────────────────────────────────────────────────

const ROLES = ['SUPER_ADMIN', 'SUPPORT', 'MARKETING', 'FINANCE'] as const;

interface AdminRow {
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  admin_role: string;
  admin_title: string | null;
  ui_language: string;
  is_env?: boolean;
}

export function AdminsPanel() {
  const { t } = useTranslation();
  const me = useSessionStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const [target, setTarget] = useState('');
  const [newRole, setNewRole] = useState<string>('SUPPORT');
  const [newTitle, setNewTitle] = useState('');
  const [titleDraft, setTitleDraft] = useState<Record<number, string>>({});

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['admin-list-admins'],
    queryFn: async () => (await api.adminListAdmins()) as { admins: AdminRow[] },
    staleTime: 10_000,
    retry: 1,
  });

  const setRole = useMutation({
    mutationFn: ({
      telegramId,
      role,
      title,
    }: {
      telegramId: number;
      role: string | null;
      title?: string | null;
    }) => api.adminSetRole(telegramId, role, title),
    onSuccess: (_d, v) => {
      haptic('success');
      showToast(
        v.title !== undefined
          ? t('admin.titleSaved')
          : v.role
            ? t('admin.roleUpdated')
            : t('admin.roleRemoved'),
        'success'
      );
      void refetch();
    },
    onError: (err) =>
      showToast(err instanceof Error && err.message ? err.message : t('errors.generic'), 'error'),
  });

  // ⚠️ مدیرِ env ممکن است adminRole نداشته باشد → باید SUPER_ADMIN فرض شود
  if (effectiveRole(me) !== 'SUPER_ADMIN') {
    return <EmptyState icon="🔒" title={t('admin.superOnly')} />;
  }

  const admins = data?.admins ?? [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text">{t('admin.roles')}</h3>
      <p className="text-[11px] leading-relaxed text-text-hint">{t('admin.rolesHint')}</p>

      {/* افزودن مدیر */}
      <Card className="space-y-2">
        <p className="text-xs font-semibold text-text">{t('admin.addAdmin')}</p>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))}
          placeholder={t('admin.telegramIdPlaceholder')}
          className="input"
          inputMode="numeric"
        />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          maxLength={60}
          placeholder={t('admin.titlePlaceholder')}
          className="input"
        />
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNewRole(r)}
              className={clsx(
                'rounded-pill border px-3 py-1.5 text-[11px] transition active:scale-95',
                newRole === r
                  ? 'border-accent bg-accent text-accent-text font-semibold'
                  : 'border-border bg-card text-text'
              )}
            >
              {t(`admin.role.${r}`)}
            </button>
          ))}
        </div>
        <Button
          fullWidth
          size="sm"
          disabled={target.length < 5 || setRole.isPending}
          loading={setRole.isPending}
          onClick={() => {
            setRole.mutate({
              telegramId: Number(target),
              role: newRole,
              title: newTitle.trim() || null,
            });
            setTarget('');
            setNewTitle('');
          }}
        >
          + {t('admin.addAdmin')}
        </Button>
      </Card>

      {isLoading && <Skeleton className="h-16" />}

      {error && <EmptyState icon="⚠️" title={t('errors.generic')} />}

      {!isLoading && admins.length === 0 && (
        <EmptyState icon="🛡" title={t('admin.noAdmins')} />
      )}

      {admins.map((a) => {
        const name =
          [a.first_name, a.last_name].filter(Boolean).join(' ') || a.username || `#${a.telegram_id}`;
        return (
          <Card key={a.telegram_id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {name}
                  {a.username && (
                    <span className="ms-1 text-[11px] text-text-hint">@{a.username}</span>
                  )}
                </p>
                <p className="text-[10px] text-text-muted" dir="ltr">
                  #{a.telegram_id} · 🌐 {langLabel(a.ui_language)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {a.is_env && <Chip tone="brand">{t('admin.envAdmin')}</Chip>}
                {a.admin_title && <Chip>🏷 {a.admin_title}</Chip>}
                <Chip tone="brand">
                  {t(`admin.role.${a.admin_role}`, { defaultValue: a.admin_role })}
                </Chip>
              </div>
            </div>

            {/* لقب — برای همه (حتی ادمین env) قابل ویرایش است */}
            <div className="flex gap-2">
              <input
                value={titleDraft[a.telegram_id] ?? a.admin_title ?? ''}
                onChange={(e) =>
                  setTitleDraft((d) => ({ ...d, [a.telegram_id]: e.target.value }))
                }
                maxLength={60}
                placeholder={t('admin.titlePlaceholder')}
                className="input flex-1 py-2 text-[11px]"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={setRole.isPending}
                onClick={() =>
                  setRole.mutate({
                    telegramId: a.telegram_id,
                    role: a.admin_role as string,
                    title: (titleDraft[a.telegram_id] ?? a.admin_title ?? '').trim() || null,
                  })
                }
              >
                {t('common.save')}
              </Button>
            </div>

            {/* ویرایش نقش — برای ادمین env غیرفعال است */}
            {a.is_env ? (
              <p className="text-[10px] text-text-hint">{t('admin.envAdminHint')}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={setRole.isPending}
                    onClick={() => setRole.mutate({ telegramId: a.telegram_id, role: r })}
                    className={clsx(
                      'rounded-pill border px-2.5 py-1 text-[10px] transition active:scale-95 disabled:opacity-40',
                      a.admin_role === r
                        ? 'border-accent bg-accent text-accent-text font-semibold'
                        : 'border-border bg-card text-text'
                    )}
                  >
                    {t(`admin.role.${r}`)}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={setRole.isPending}
                  onClick={() => setRole.mutate({ telegramId: a.telegram_id, role: null })}
                  className="rounded-pill border border-danger-soft px-2.5 py-1 text-[10px] text-danger-500 transition active:scale-95 disabled:opacity-40"
                >
                  {t('admin.removeAdmin')}
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ارسال پیام به کاربران
// ─────────────────────────────────────────────────────────────────────

export function MessagesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const [broadcast, setBroadcast] = useState(false);
  const [target, setTarget] = useState<AdminUserLite | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('INFO');
  const [viaBot, setViaBot] = useState(true);

  // لیست کاربران برای انتخاب سریع — همراه زبان رابط هر کاربر
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', 'message-picker', userQuery],
    enabled: !broadcast,
    queryFn: async () =>
      (await api.adminUsers({ limit: 50, q: userQuery || undefined })) as {
        users: AdminUserLite[];
      },
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: () =>
      api.adminMessageSend({
        telegramId: broadcast ? null : target?.telegramId,
        broadcast,
        title: title.trim() || undefined,
        body: body.trim(),
        kind,
        sendViaBot: viaBot,
      }),
    onSuccess: () => {
      haptic('success');
      setTitle('');
      setBody('');
      setTarget(null);
      setUserQuery('');
      void queryClient.invalidateQueries({ queryKey: ['admin-messages-list'] });
    },
    onError: (err) =>
      showToast(err instanceof Error && err.message ? err.message : t('errors.generic'), 'error'),
  });

  const canSend =
    body.trim().length >= 2 && (broadcast || Boolean(target?.telegramId));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text">{t('admin.sendMessage')}</h3>

      <Card className="space-y-3">
        {/* حالت: یک کاربر / همگانی */}
        <div className="flex gap-1.5 rounded-xl bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            onClick={() => setBroadcast(false)}
            className={clsx(
              'flex-1 rounded-lg py-1.5 text-[11px] font-medium transition',
              !broadcast ? 'bg-card text-text shadow-card' : 'text-text-hint'
            )}
          >
            👤 {t('admin.toOne')}
          </button>
          <button
            type="button"
            onClick={() => setBroadcast(true)}
            className={clsx(
              'flex-1 rounded-lg py-1.5 text-[11px] font-medium transition',
              broadcast ? 'bg-card text-text shadow-card' : 'text-text-hint'
            )}
          >
            📢 {t('admin.toAll')}
          </button>
        </div>

        {/* انتخاب کاربر */}
        {!broadcast && (
          <div className="space-y-2">
            {target ? (
              <div className="flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text">
                    {target.displayName}
                  </p>
                  <p className="truncate text-[10px] text-text-hint" dir="ltr">
                    #{target.telegramId} · 🌐 {langLabel(target.uiLanguage)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="shrink-0 text-[11px] text-accent underline"
                >
                  {t('common.change')}
                </button>
              </div>
            ) : (
              <>
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={t('admin.pickUser')}
                  className="input"
                />
                <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                  {usersLoading && <Skeleton className="h-12" />}
                  {!usersLoading && (usersData?.users?.length ?? 0) === 0 && (
                    <p className="py-4 text-center text-[11px] text-text-hint">
                      {t('admin.noUsers')}
                    </p>
                  )}
                  {usersData?.users?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        haptic('select');
                        setTarget(u);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-start transition active:scale-[0.99]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-text">
                          {u.displayName}
                        </span>
                        <span className="block truncate text-[10px] text-text-hint" dir="ltr">
                          {u.username ? `@${u.username} · ` : ''}
                          {u.telegramId}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-text-hint">
                        🌐 {langLabel(u.uiLanguage)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* نوع پیام */}
        <div className="flex flex-wrap gap-1.5">
          {['INFO', 'PROMO', 'UPDATE', 'WARNING'].map((k) => (
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
              {t(`admin.msgKind.${k}`)}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder={t('admin.msgTitle')}
          className="input"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={3000}
          placeholder={t('admin.msgBody')}
          className="input resize-none"
        />

        <label className="flex items-center justify-between">
          <span className="text-[11px] text-text-hint">{t('admin.sendViaBot')}</span>
          <input
            type="checkbox"
            checked={viaBot}
            onChange={(e) => setViaBot(e.target.checked)}
            className="h-4 w-4 accent-[var(--tg-theme-button-color,#2563eb)]"
          />
        </label>
      </Card>

      <Button
        fullWidth
        size="lg"
        disabled={!canSend}
        loading={send.isPending}
        onClick={() => send.mutate()}
      >
        {broadcast ? `📢 ${t('admin.sendAll')}` : `➤ ${t('admin.send')}`}
      </Button>

      {/* تاریخچهٔ پیام‌های ارسالی — همراه با ادمین فرستنده */}
      <MessageHistory />
    </div>
  );
}

interface SentMessage {
  id: string;
  telegram_id: number | null;
  title: string | null;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
  sender_name: string | null;
  sent_via_bot: boolean;
}

function MessageHistory() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [kind, setKind] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-messages-list'],
    queryFn: async () => (await api.adminMessagesList()) as { messages: SentMessage[] },
    staleTime: 15_000,
  });

  const all = data?.messages ?? [];

  const counts = {
    all: all.length,
    unread: all.filter((m) => !m.read_at).length,
    read: all.filter((m) => m.read_at).length,
  };

  const visible = all.filter((m) => {
    if (status === 'unread' && m.read_at) return false;
    if (status === 'read' && !m.read_at) return false;
    if (kind !== 'all' && m.kind !== kind) return false;
    return true;
  });

  return (
    <div className="space-y-3 pt-1">
      <h3 className="text-sm font-bold text-text">{t('admin.sentHistory')}</h3>

      {isLoading && <Skeleton className="h-16" />}

      {!isLoading && all.length === 0 && <EmptyState icon="✉️" title={t('admin.noSent')} />}

      {!isLoading && all.length > 0 && (
        <>
          {/* فیلتر وضعیت */}
          <div className="flex gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
            {(
              [
                { key: 'all', label: t('admin.filterAll'), n: counts.all },
                { key: 'unread', label: t('admin.filterUnread'), n: counts.unread },
                { key: 'read', label: t('admin.filterRead'), n: counts.read },
              ] as const
            ).map((o) => (
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
                {o.label} <span className="text-[9px] opacity-70">{o.n}</span>
              </button>
            ))}
          </div>

          {/* فیلتر نوع */}
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
              {t('admin.filterAll')}
            </button>
            {KIND_KEYS.map((k) => (
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
                {KIND_STYLE[k]!.icon} {t(`admin.msgKind.${k}`)}
              </button>
            ))}
          </div>

          {visible.length === 0 && <EmptyState icon="🔍" title={t('messages.noMatch')} />}

          {visible.map((m) => {
            const style = KIND_STYLE[m.kind] ?? KIND_STYLE.INFO!;
            return (
              <Card key={m.id} className={clsx('border', style.cls)}>
                <div className="flex items-start gap-2.5">
                  <span className="text-base">{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.title && <p className="text-xs font-bold text-text">{m.title}</p>}
                      {m.telegram_id === null ? (
                        <Chip tone="brand">{t('admin.broadcast')}</Chip>
                      ) : (
                        <Chip>{`#${m.telegram_id}`}</Chip>
                      )}
                      {m.read_at ? (
                        <Chip tone="success">{t('admin.filterRead')}</Chip>
                      ) : (
                        <Chip tone="warning">{t('admin.filterUnread')}</Chip>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-text-hint">
                      {m.body}
                    </p>
                    <p className="mt-1 text-[10px] text-text-muted">
                      👤 {m.sender_name ?? '—'} · {new Date(m.created_at).toLocaleString()}
                      {m.sent_via_bot ? ' · 🤖' : ''}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

interface AdminUserLite {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  uiLanguage: string;
}

/** برچسب خوانا برای کد زبان (نام بومی + نام انگلیسی) */
function langLabel(code: string): string {
  const lang = findLanguage(code);
  return lang ? `${lang.nativeName} · ${lang.labelEn}` : code;
}

// ─────────────────────────────────────────────────────────────────────
// مدیریت اشتراک‌ها (CRUD) — فقط SUPER_ADMIN و FINANCE
// ─────────────────────────────────────────────────────────────────────

interface AdminPlan {
  id: string;
  planType: string;
  titleFa: string;
  titleEn: string;
  durationDays: number;
  priceIrr: number;
  priceStars: number;
  discountPercent: number;
  finalPriceIrr: number;
  finalPriceStars: number;
  badge: string | null;
  isActive: boolean;
}

const EMPTY_PLAN: AdminPlan = {
  id: '',
  planType: '',
  titleFa: '',
  titleEn: '',
  durationDays: 30,
  priceIrr: 0,
  priceStars: 0,
  discountPercent: 0,
  finalPriceIrr: 0,
  finalPriceStars: 0,
  badge: null,
  isActive: true,
};

export function PlansPanel() {
  const { t } = useTranslation();
  const showToast = useUiStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminPlan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => (await api.adminPlans()) as { plans: AdminPlan[] },
    staleTime: 20_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
  };

  const save = useMutation({
    // ⚠️ در حالت «جدید»، فیلد id نباید اصلاً فرستاده شود.
    // اگر `id: ''` برود، اعتبارسنجی سرور (min 1) رد می‌کند → «خطایی رخ داد».
    mutationFn: (plan: AdminPlan) =>
      plan.id
        ? api.adminPlanUpdate(plan)
        : api.adminPlanCreate({ ...plan, id: undefined }),
    onSuccess: () => {
      haptic('success');
      showToast(t('admin.planSaved'), 'success');
      setEditing(null);
      invalidate();
    },
    onError: (err) =>
      showToast(err instanceof Error && err.message ? err.message : t('errors.generic'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.adminPlanDelete(id),
    onSuccess: () => {
      haptic('success');
      showToast(t('admin.planDeleted'), 'success');
      invalidate();
    },
    onError: () => showToast(t('errors.generic'), 'error'),
  });

  const toggleActive = useMutation({
    mutationFn: (plan: AdminPlan) =>
      api.adminPlanUpdate({ ...plan, isActive: !plan.isActive }),
    onSuccess: () => invalidate(),
    onError: () => showToast(t('errors.generic'), 'error'),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">{t('admin.plans')}</h3>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_PLAN })}>
          + {t('admin.newPlan')}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-text-hint">{t('admin.plansHint')}</p>

      {isLoading && <Skeleton className="h-20" />}

      {data?.plans?.map((plan) => (
        <Card key={plan.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                {plan.titleFa}
                {plan.badge && <Chip tone="brand">{plan.badge}</Chip>}
                {!plan.isActive && <Chip tone="danger">{t('admin.inactive')}</Chip>}
              </p>
              <p className="text-[10px] text-text-muted" dir="ltr">
                {plan.planType} · {plan.durationDays}d
              </p>
              <p className="mt-1 text-[11px] text-text-hint">
                {plan.discountPercent > 0 ? (
                  <>
                    <span className="line-through">{plan.priceStars} ⭐</span>{' '}
                    <span className="font-semibold text-text">{plan.finalPriceStars} ⭐</span>{' '}
                    · -{plan.discountPercent}%
                  </>
                ) : (
                  <span className="font-semibold text-text">{plan.finalPriceStars} ⭐</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Button size="sm" onClick={() => setEditing(plan)}>
                ✏️ {t('common.edit')}
              </Button>
              <button
                type="button"
                onClick={() => toggleActive.mutate(plan)}
                className="text-[10px] text-text-hint underline"
              >
                {plan.isActive ? t('admin.disable') : t('admin.enable')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await showConfirm(t('admin.planDeleteConfirm'));
                  if (ok) remove.mutate(plan.id);
                }}
                className="text-[10px] text-danger-500 underline"
              >
                {t('common.remove')}
              </button>
            </div>
          </div>
        </Card>
      ))}

      {editing && (
        <PlanEditor
          plan={editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(p) => save.mutate(p)}
        />
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  saving,
  onClose,
  onSave,
}: {
  plan: AdminPlan;
  saving: boolean;
  onClose: () => void;
  onSave: (p: AdminPlan) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AdminPlan>(plan);

  const set = <K extends keyof AdminPlan>(key: K, value: AdminPlan[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isNew = !draft.id;
  const valid =
    draft.planType.trim().length > 0 &&
    draft.titleFa.trim().length > 0 &&
    draft.titleEn.trim().length > 0 &&
    draft.durationDays > 0 &&
    draft.priceStars > 0;

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
            <h3 className="text-base font-bold text-text">
              {isNew ? t('admin.newPlan') : t('admin.editPlan')}
            </h3>
            <button type="button" onClick={onClose} className="text-text-hint">
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-4">
            <Field label={t('admin.planTypeLabel')}>
              <input
                value={draft.planType}
                disabled={!isNew}
                onChange={(e) =>
                  set('planType', e.target.value.toUpperCase().replace(/\s+/g, '_'))
                }
                placeholder="1_MONTH"
                dir="ltr"
                className="input disabled:opacity-60"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t('admin.planTitleFa')}>
                <input
                  value={draft.titleFa}
                  onChange={(e) => set('titleFa', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={t('admin.planTitleEn')}>
                <input
                  value={draft.titleEn}
                  onChange={(e) => set('titleEn', e.target.value)}
                  dir="ltr"
                  className="input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t('admin.planDuration')}>
                <input
                  type="number"
                  value={draft.durationDays}
                  onChange={(e) => set('durationDays', Number(e.target.value) || 0)}
                  dir="ltr"
                  className="input"
                />
              </Field>
              <Field label={t('admin.planStars')}>
                <input
                  type="number"
                  value={draft.priceStars}
                  onChange={(e) => set('priceStars', Number(e.target.value) || 0)}
                  dir="ltr"
                  className="input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t('admin.planIrr')}>
                <input
                  type="number"
                  value={draft.priceIrr}
                  onChange={(e) => set('priceIrr', Number(e.target.value) || 0)}
                  dir="ltr"
                  className="input"
                />
              </Field>
              <Field label={t('admin.planDiscount')}>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={draft.discountPercent}
                  onChange={(e) =>
                    set('discountPercent', Math.min(90, Math.max(0, Number(e.target.value) || 0)))
                  }
                  dir="ltr"
                  className="input"
                />
              </Field>
            </div>

            <Field label={t('admin.planBadge')}>
              <div className="flex gap-1.5">
                {[null, 'POPULAR', 'BEST_VALUE'].map((b) => (
                  <button
                    key={b ?? 'none'}
                    type="button"
                    onClick={() => set('badge', b)}
                    className={clsx(
                      'rounded-pill border px-3 py-1.5 text-[11px] transition',
                      draft.badge === b
                        ? 'border-accent bg-accent text-accent-text font-semibold'
                        : 'border-border bg-card text-text'
                    )}
                  >
                    {b ?? t('admin.badgeNone')}
                  </button>
                ))}
              </div>
            </Field>

            {draft.priceStars > 0 && (
              <p className="rounded-xl bg-[var(--surface-sunken)] px-3 py-2 text-[11px] text-text-hint">
                {t('admin.planPreview')}:{' '}
                {draft.discountPercent > 0 && (
                  <span className="line-through">{draft.priceStars} ⭐ </span>
                )}
                <span className="font-semibold text-text">
                  {Math.round(draft.priceStars * (1 - draft.discountPercent / 100))} ⭐
                </span>
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth loading={saving} disabled={!valid} onClick={() => onSave(draft)}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-text-hint">{label}</span>
      {children}
    </label>
  );
}
