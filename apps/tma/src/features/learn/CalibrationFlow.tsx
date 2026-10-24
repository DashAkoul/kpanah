import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Portal } from '../../components/Portal';
import { api } from '../../lib/api';
import { haptic } from '../../lib/telegram';
import { useAudio } from '../../hooks/useAudio';
import { useSessionStore } from '../../store/session';

interface Item {
  kind: 'MEANING' | 'LISTENING';
  term: string;
  options: string[];
  correctIndex: number;
}

/**
 * آزمون کالیبراسیون — ۱۰ سؤال واژگان از ساده به سخت.
 *
 * ⚠️ هدف: تنظیم **نقطهٔ شروع** بر اساس شواهد، نه خوداظهاری.
 * نتیجه فقط سطح را تخمین می‌زند و هرگز به‌عنوان نمره به کاربر نشان داده
 * نمی‌شود (فقط «سطح تقریبی»).
 */
export function CalibrationFlow({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { play, loading: audioLoading } = useAudio();
  const targetLanguage = useSessionStore((s) => s.user?.targetLanguage);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<
    { term: string; isCorrect: boolean; responseMs: number; kind?: 'MEANING' | 'LISTENING' }[]
  >([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [result, setResult] = useState<{
    estimated: string;
    scorePct: number;
    bySkill?: Record<string, { correct: number; total: number }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  /** مرحلهٔ دوم (tie-breaker) — کالیبراسیون تطبیقی دو مرحله‌ای */
  const [hardMode, setHardMode] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.calibrationTest();
        if (res.alreadyCalibrated || !res.items?.length) {
          onClose();
          return;
        }
        setItems(res.items);
      } catch {
        setError(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = items?.[index];

  const answer = (choice: number) => {
    if (!current || busy) return;
    haptic('tap');
    setSelected(choice);
    const isCorrect = choice === current.correctIndex;
    const next = [
      ...answers,
      {
        term: current.term,
        isCorrect,
        responseMs: Math.min(600_000, Date.now() - startedAt),
        kind: current.kind,
      },
    ];
    setAnswers(next);

    setTimeout(async () => {
      if (index + 1 < (items?.length ?? 0)) {
        setIndex(index + 1);
        setSelected(null);
        setStartedAt(Date.now());
        return;
      }
      setBusy(true);
      try {
        /**
         * کالیبراسیون تطبیقی دو مرحله‌ای: اگر در مرحلهٔ استاندارد ≥۸۰٪ گرفتی،
         * ۶ سؤال سخت‌تر (B1-B2) می‌آید تا سطح دقیق‌تر تعیین شود.
         */
        if (!hardMode && next.filter((a) => a.isCorrect).length / next.length >= 0.8) {
          const hard = await api.calibrationTest('hard');
          if (hard.items?.length) {
            setItems(hard.items);
            setIndex(0);
            setAnswers([]);
            setSelected(null);
            setHardMode(true);
            setStartedAt(Date.now());
            setBusy(false);
            return;
          }
        }

        const res = await api.calibrationSubmit({ answers: next, hard: hardMode });
        setResult({ estimated: res.estimated, scorePct: res.scorePct, bySkill: res.bySkill });
        haptic('success');
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    }, 350);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
        <div className="safe-top sticky top-0 z-20 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={onClose} className="text-sm text-text-hint">
              ✕
            </button>
            <span className="text-xs font-medium text-text-hint">
              {items ? t('calibration.progress', { current: index + 1, total: items.length }) : '…'}
            </span>
            <span className="w-4" />
          </div>
          <ProgressBar value={index} max={Math.max(1, items?.length ?? 10)} height={6} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {error && (
            <Card className="text-center">
              <p className="text-sm text-text">{t('calibration.failed')}</p>
              <Button className="mt-3" onClick={onClose}>
                {t('common.close')}
              </Button>
            </Card>
          )}

          {!error && !result && !items && (
            <p className="text-center text-xs text-text-hint">{t('calibration.preparing')}</p>
          )}

          {result && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="text-4xl">🎯</div>
              <p className="text-base font-bold text-text">{t('calibration.doneTitle')}</p>
              <p className="text-sm text-text-hint">
                {t('calibration.estimated', { level: result.estimated })}
              </p>
              {result.bySkill && Object.keys(result.bySkill).length > 0 && (
                <div className="mt-2 w-full space-y-1">
                  {(['MEANING', 'LISTENING'] as const).map((k) => {
                    const row = result.bySkill?.[k];
                    if (!row) return null;
                    return (
                      <div
                        key={k}
                        className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5"
                      >
                        <span className="text-[11px] text-text">
                          {k === 'MEANING' ? '📖' : '🎧'}{' '}
                          {t(`calibrationSkill.${k}`)}
                        </span>
                        <span className="text-[11px] font-bold text-text">
                          {row.correct}/{row.total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="max-w-xs text-[11px] leading-relaxed text-text-muted">
                {t('calibration.note')}
              </p>
              <Button className="mt-3 w-full" onClick={onDone}>
                {t('calibration.startLearning')}
              </Button>
            </div>
          )}

          {current && !result && (
            <div className="space-y-4">
              <Card className="text-center">
                {current.kind === 'LISTENING' ? (
                  <>
                    <p className="text-[11px] text-text-hint">{t('calibration.listenPrompt')}</p>
                    <button
                      type="button"
                      onClick={() => void play(current.term, targetLanguage ?? 'en')}
                      disabled={audioLoading}
                      className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-600 transition active:scale-95"
                    >
                      {audioLoading ? '⏳' : '🔊'}
                    </button>
                    <p className="mt-2 text-[10px] text-text-muted">{t('calibration.replayHint')}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-text-hint">{t('calibration.question')}</p>
                    <h2 className="target-text mt-2 text-2xl font-bold text-text" dir="ltr">
                      {current.term}
                    </h2>
                  </>
                )}
              </Card>

              <div className="space-y-2">
                {current.options.map((opt, i) => (
                  <button
                    key={`${opt}-${i}`}
                    type="button"
                    onClick={() => answer(i)}
                    disabled={selected !== null || busy}
                    className={clsx(
                      'w-full rounded-xl border p-3 text-start text-sm transition active:scale-[0.99]',
                      current.kind === 'LISTENING' && 'target-text',
                      selected === i
                        ? i === current.correctIndex
                          ? 'border-success-500 bg-success-100'
                          : 'border-danger-500 bg-danger-100'
                        : 'border-border bg-card text-text'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => answer(-1)}
                disabled={selected !== null || busy}
                className="w-full rounded-xl border border-dashed border-border p-2.5 text-xs text-text-muted"
              >
                🤷 {t('lesson.dontKnow')}
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
