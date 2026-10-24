import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button } from '../../components/ui';
import { Portal } from '../../components/Portal';
import { api } from '../../lib/api';
import { haptic } from '../../lib/telegram';
import { useAudio } from '../../hooks/useAudio';
import { useSessionStore } from '../../store/session';

interface Msg {
  role: 'ai' | 'user';
  text: string;
}

interface Start {
  scenario: string;
  aiRole: string;
  userRole: string;
  opening: string;
  goal: string;
}

interface Feedback {
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  score: number;
  strengths: string[];
  corrections: { original: string; fixed: string; note?: string }[];
  summary: string;
}

const MAX_TURNS = 3;

/**
 * نقش‌آفرینی متنی — AI نقش طرف مقابل را بازی می‌کند.
 *
 * ⚠️ در میانهٔ گفت‌وگو **اصلاح خطا نمی‌شود** (روانی می‌شکند)؛ بازخورد
 * دقیق و مبتنی بر همان متن، در پایان داده می‌شود.
 */
export function RoleplayFlow({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { play } = useAudio();
  const targetLanguage = useSessionStore((s) => s.user?.targetLanguage);
  const [start, setStart] = useState<Start | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.roleplayStart();
        setStart(res);
        setMsgs([{ role: 'ai', text: res.opening }]);
      } catch {
        setError(true);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const userTurns = msgs.filter((m) => m.role === 'user').length;

  const send = async () => {
    if (!start || input.trim().length < 2 || busy || feedback) return;
    const text = input.trim();
    const next: Msg[] = [...msgs, { role: 'user', text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.roleplayTurn({
        scenario: start.scenario,
        goal: start.goal,
        aiRole: start.aiRole,
        userRole: start.userRole,
        transcript: next,
      });
      setMsgs([...next, { role: 'ai', text: res.reply }]);
      haptic('tap');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!start || busy) return;
    setBusy(true);
    try {
      const res = await api.roleplayFinish({
        scenario: start.scenario,
        goal: start.goal,
        aiRole: start.aiRole,
        userRole: start.userRole,
        transcript: msgs,
      });
      setFeedback(res);
      haptic('success');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
        <div className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <button type="button" onClick={onClose} className="text-sm text-text-hint">
              ✕
            </button>
            <p className="text-xs font-semibold text-text">🎭 {t('roleplay.title')}</p>
            <span className="w-4" />
          </div>
          {start && (
            <p className="mt-1 text-[10px] leading-relaxed text-text-hint">
              {start.scenario}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {error && <Card className="text-center text-xs text-text">{t('roleplay.failed')}</Card>}

          {start && (
            <Card className="border-brand-200 bg-brand-50/40">
              <p className="text-[11px] text-text">
                🎯 {t('roleplay.goal', { goal: start.goal })}
              </p>
              <p className="mt-1 text-[10px] text-text-hint">
                {start.aiRole} ↔ {start.userRole}
              </p>
            </Card>
          )}

          {msgs.map((m, i) => (
            <div
              key={`${i}-${m.text.slice(0, 8)}`}
              className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={clsx(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'bg-accent text-accent-text'
                    : 'bg-[var(--surface-sunken)] text-text'
                )}
              >
                <p className={m.role === 'ai' ? 'target-text' : ''} dir={m.role === 'ai' ? 'ltr' : 'auto'}>
                  {m.text}
                </p>
                {m.role === 'ai' && (
                  <button
                    type="button"
                    onClick={() => void play(m.text, targetLanguage ?? 'en')}
                    className="mt-1 text-[10px] text-brand-600"
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {feedback ? (
          <div className="max-h-[45dvh] overflow-y-auto border-t border-border p-4">
            <p className="text-sm font-bold text-text">
              {feedback.verdict === 'PASS' ? '✅ ' : feedback.verdict === 'PARTIAL' ? '🟡 ' : '🔴 '}
              {t(`roleplayVerdict.${feedback.verdict}`)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text">{feedback.summary}</p>

            {feedback.strengths.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold text-text-hint">{t('roleplay.strengths')}</p>
                <ul className="mt-1 space-y-0.5">
                  {feedback.strengths.map((s) => (
                    <li key={s} className="text-[11px] text-text">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {feedback.corrections.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] font-semibold text-text-hint">{t('roleplay.corrections')}</p>
                <div className="mt-1 space-y-1">
                  {feedback.corrections.map((c) => (
                    <div key={c.original} className="rounded-lg bg-[var(--surface-sunken)] p-2">
                      <p className="target-text text-[11px] text-text-muted line-through" dir="ltr">
                        {c.original}
                      </p>
                      <p className="target-text text-[11px] font-semibold text-success-500" dir="ltr">
                        {c.fixed}
                      </p>
                      {c.note && <p className="mt-0.5 text-[10px] text-text-hint">{c.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button className="mt-3 w-full" onClick={onClose}>
              {t('common.done')}
            </Button>
          </div>
        ) : (
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                dir="ltr"
                placeholder={t('roleplay.placeholder')}
                className="target-text max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-card p-2.5 text-sm text-text outline-none focus:border-brand-500"
              />
              <Button size="sm" disabled={busy || input.trim().length < 2} onClick={() => void send()}>
                {busy ? '…' : t('roleplay.send')}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-text-hint">
                {t('roleplay.turn', { count: userTurns, max: MAX_TURNS })}
              </span>
              <button
                type="button"
                disabled={busy || userTurns === 0}
                onClick={() => void finish()}
                className="text-[11px] font-semibold text-brand-600 disabled:text-text-muted"
              >
                {t('roleplay.finish')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}
