import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button, Chip, Skeleton } from '../../components/ui';
import {
  useSupportTickets,
  useSupportThread,
  useCreateTicket,
  useReplyTicket,
  useCloseTicket,
} from '../../hooks/useApi';
import { haptic } from '../../lib/telegram';

/**
 * پشتیبانی (تب کاربری).
 *
 * کاربر می‌تواند تیکت بسازد، گفت‌وگو را ببیند، پاسخ بدهد و ببندد.
 * پاسخ‌های ادمین با نشان «پشتیبانی» مشخص می‌شوند.
 */

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'thread'; id: string };

const CATEGORIES = ['GENERAL', 'BILLING', 'TECHNICAL', 'CONTENT', 'REPORT'] as const;

export function SupportPanel() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'new') {
    return <NewTicket onDone={() => setView({ kind: 'list' })} onCancel={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'thread') {
    return <Thread ticketId={view.id} onBack={() => setView({ kind: 'list' })} />;
  }
  return <TicketList onNew={() => setView({ kind: 'new' })} onOpen={(id) => setView({ kind: 'thread', id })} />;
}

// ─────────────────────────────────────────────────────────────────────

function TicketList({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSupportTickets();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text">{t('support.title')}</h2>
          <p className="mt-0.5 text-xs text-text-hint">{t('support.subtitle')}</p>
        </div>
        <Button size="sm" onClick={onNew}>
          ＋ {t('support.new')}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!isLoading && (data?.tickets?.length ?? 0) === 0 && (
        <Card className="py-8 text-center">
          <div className="text-3xl">💬</div>
          <p className="mt-2 text-sm font-medium text-text">{t('support.empty')}</p>
          <p className="mt-1 text-[11px] text-text-hint">{t('support.emptyHint')}</p>
        </Card>
      )}

      {data?.tickets?.map((tk) => (
        <button
          key={tk.id}
          type="button"
          onClick={() => {
            haptic('tap');
            onOpen(tk.id);
          }}
          className="w-full rounded-card border border-border bg-card p-3.5 text-start transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
              {tk.subject}
            </p>
            <StatusChip status={tk.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] text-text-hint">{tk.last_message}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] text-text-muted">
              {new Date(tk.last_at).toLocaleDateString()}
            </span>
            {tk.unread_for_user && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-text">
                {t('support.newReply')}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function NewTicket({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const create = useCreateTicket();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');

  const submit = async () => {
    if (subject.trim().length < 2 || body.trim().length < 2) return;
    haptic('success');
    await create.mutateAsync({ subject: subject.trim(), body: body.trim(), category });
    onDone();
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={onCancel} className="text-xs text-text-hint">
        ‹ {t('common.back')}
      </button>

      <h2 className="text-base font-bold text-text">{t('support.new')}</h2>

      <Card className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-text">{t('support.subject')}</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            className="input"
            placeholder={t('support.subjectPlaceholder')}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-text">{t('support.category')}</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  'rounded-pill border px-3 py-1.5 text-[11px] transition',
                  category === c
                    ? 'border-accent bg-accent text-accent-text font-semibold'
                    : 'border-border bg-card text-text'
                )}
              >
                {t(`support.cat.${c}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-text">{t('support.message')}</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={5}
            className="input resize-none"
            placeholder={t('support.messagePlaceholder')}
          />
        </div>
      </Card>

      <Button
        fullWidth
        size="lg"
        loading={create.isPending}
        disabled={subject.trim().length < 2 || body.trim().length < 2}
        onClick={() => void submit()}
      >
        {t('support.send')}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function Thread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useSupportThread(ticketId);
  const reply = useReplyTicket();
  const close = useCloseTicket();
  const [text, setText] = useState('');
  const [sentFlash, setSentFlash] = useState(false);

  // ورودی همان لحظه پاک می‌شود تا کاربر نداند «ارسال شد یا نه»؛ در صورت
  // خطا متن برمی‌گردد تا داده از دست نرود.
  const send = () => {
    const body = text.trim();
    if (body.length < 1) return;
    haptic('tap');
    const previous = text;
    setText('');
    reply.mutate(
      { ticketId, body },
      {
        onSuccess: () => {
          haptic('success');
          setSentFlash(true);
          setTimeout(() => setSentFlash(false), 1800);
          void refetch();
        },
        onError: () => {
          setText(previous);
          void refetch();
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-xs text-text-hint">
        ‹ {t('common.back')}
      </button>

      {isLoading && <Skeleton className="h-32" />}

      {data && (
        <>
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 text-base font-bold text-text">{data.ticket.subject}</h2>
            <StatusChip status={data.ticket.status} />
          </div>

          <div className="space-y-2">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={clsx(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  m.author === 'ADMIN'
                    ? 'me-auto border border-border bg-card text-text'
                    : 'ms-auto bg-accent text-accent-text'
                )}
              >
                {m.author === 'ADMIN' && (
                  <p className="mb-0.5 text-[10px] font-bold text-accent">🛡 {t('support.fromSupport')}</p>
                )}
                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                <p className="mt-1 text-[9px] opacity-60">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {sentFlash && (
            <p className="animate-fade-in text-center text-[11px] font-medium text-success-500">
              ✓ {t('support.sent')}
            </p>
          )}

          {data.ticket.status !== 'CLOSED' ? (
            <div className="sticky bottom-0 space-y-2 bg-bg pt-2">
              <div className="flex gap-2">
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
              <button
                type="button"
                onClick={async () => {
                  await close.mutateAsync(ticketId);
                  void refetch();
                }}
                className="w-full py-1 text-center text-[11px] text-text-hint underline"
              >
                {t('support.close')}
              </button>
            </div>
          ) : (
            <p className="py-2 text-center text-[11px] text-text-hint">{t('support.closed')}</p>
          )}
        </>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = status === 'CLOSED' ? 'default' : status === 'ANSWERED' ? 'success' : 'warning';
  return <Chip tone={tone as never}>{t(`support.status.${status}`, { defaultValue: status })}</Chip>;
}
