import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Card, Button, ProgressBar } from '../../components/ui';
import { Portal } from '../../components/Portal';
import { api } from '../../lib/api';
import { haptic } from '../../lib/telegram';

interface Q {
  term: string;
  options: string[];
  correctIndex: number;
  fromDay: number;
}

/**
 * مرور تأخیری — دو سؤال از درسی که ۲+ روز پیش تمام شده.
 *
 * ⚠️ این تنها جایی است که **ماندگاری** سنجیده می‌شود: بدون زمینهٔ درس،
 * بدون راهنما، چند روز بعد.
 */
export function DelayedCheck({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Q[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ term: string; isCorrect: boolean }[]>([]);
  const [done, setDone] = useState(false);
  const [lessonId, setLessonId] = useState<string | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.delayedCheck();
        setItems(res.items ?? []);
        setLessonId(res.fromLessonId);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  const current = items?.[index];

  const pick = (choice: number) => {
    if (!current || selected !== null) return;
    haptic('tap');
    setSelected(choice);
    const next = [...answers, { term: current.term, isCorrect: choice === current.correctIndex }];
    setAnswers(next);

    setTimeout(async () => {
      if (index + 1 < (items?.length ?? 0)) {
        setIndex(index + 1);
        setSelected(null);
        return;
      }
      try {
        await api.delayedSubmit({ answers: next, lessonId });
      } catch {
        /* best-effort */
      }
      setDone(true);
      haptic('success');
    }, 400);
  };

  const correctCount = answers.filter((a) => a.isCorrect).length;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center">
        <div className="w-full max-w-sm rounded-t-3xl bg-bg p-5 sm:rounded-3xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">⏳ {t('delayed.title')}</p>
            <button type="button" onClick={onClose} className="text-sm text-text-hint">
              ✕
            </button>
          </div>

          {items && items.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-xs text-text-hint">{t('delayed.none')}</p>
              <Button className="mt-3" size="sm" onClick={onClose}>
                {t('common.close')}
              </Button>
            </div>
          )}

          {items === null && <p className="py-6 text-center text-xs text-text-hint">…</p>}

          {done && (
            <div className="py-4 text-center">
              <p className="text-3xl">{correctCount === answers.length ? '🎉' : '📌'}</p>
              <p className="mt-2 text-sm font-semibold text-text">
                {t('delayed.result', { correct: correctCount, total: answers.length })}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-hint">
                {t('delayed.resultHint')}
              </p>
              <Button className="mt-4 w-full" onClick={onClose}>
                {t('common.done')}
              </Button>
            </div>
          )}

          {current && !done && (
            <>
              <ProgressBar value={index} max={Math.max(1, items.length)} height={5} />
              <p className="mt-3 text-[11px] text-text-hint">
                {t('delayed.fromDay', { day: current.fromDay })}
              </p>
              <p className="mt-1 text-[11px] text-text-hint">{t('calibration.question')}</p>
              <p className="target-text mt-1 text-xl font-bold text-text" dir="ltr">
                {current.term}
              </p>

              <div className="mt-3 space-y-2">
                {current.options.map((opt, i) => (
                  <button
                    key={`${opt}-${i}`}
                    type="button"
                    onClick={() => pick(i)}
                    disabled={selected !== null}
                    className={clsx(
                      'w-full rounded-xl border p-2.5 text-start text-sm transition',
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
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
