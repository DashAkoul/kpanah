import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSessionStore } from '../store/session';
import { haptic } from '../lib/telegram';

/**
 * بنر پیام‌های مدیر.
 *
 * وقتی کاربر اپ را باز می‌کند، پیام‌های خوانده‌نشده را به‌صورت یک بنر
 * بالای اپ نشان می‌دهد. با بستن، «خوانده‌شده» علامت می‌خورند.
 */

interface AdminMessage {
  id: string;
  title: string | null;
  body: string;
  kind: string;
  read_at?: string | null;
  created_at: string;
}

const KIND_STYLE: Record<string, { icon: string; cls: string }> = {
  INFO: { icon: 'ℹ️', cls: 'border-border bg-card' },
  PROMO: { icon: '🎁', cls: 'border-accent bg-accent-soft' },
  UPDATE: { icon: '🚀', cls: 'border-border bg-card' },
  WARNING: { icon: '⚠️', cls: 'border-danger-soft bg-card' },
};

export function MessageBanner() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ['messages-list'],
    queryFn: async () => (await api.messagesList()) as { messages: AdminMessage[] },
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (ids: string[]) => api.messagesRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['messages-list'] }),
  });

  // فقط خوانده‌نشده‌ها را نشان بده (لیست حالا همهٔ پیام‌ها را برمی‌گرداند)
  const messages = (data?.messages ?? []).filter(
    (m) => !m.read_at && !dismissed.includes(m.id)
  );
  if (messages.length === 0) return null;

  const dismiss = (id: string) => {
    haptic('tap');
    setDismissed((d) => [...d, id]);
    markRead.mutate([id]);
  };

  return (
    <div className="space-y-2 p-4 pb-0">
      {messages.map((m) => {
        const style = KIND_STYLE[m.kind] ?? KIND_STYLE.INFO!;
        return (
          <div
            key={m.id}
            className={clsx(
              'animate-fade-in rounded-2xl border p-3.5 backdrop-blur',
              style.cls
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg">{style.icon}</span>
              <div className="min-w-0 flex-1">
                {m.title && <p className="text-sm font-bold text-text">{m.title}</p>}
                <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-text-hint">
                  {m.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(m.id)}
                aria-label={t('common.close')}
                className="shrink-0 text-text-hint"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
