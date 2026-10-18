import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import type { QualitativeSkill } from '@kpanah/shared';
import { Card, Chip, ProgressBar, Skeleton } from '../../components/ui';
import { Portal } from '../../components/Portal';
import type { WordListEntry } from '@kpanah/shared';
import { useProgress } from '../../hooks/useApi';
import { useSessionStore } from '../../store/session';

/**
 * Progress dashboard.
 *
 * Design intent (from the spec): the learner should see concrete,
 * human-readable abilities — "you can now handle hotel check-in" —
 * not just a percentage.
 */
export function ProgressPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useProgress();

  /**
   * ⚠️ باگ رفع‌شده (صفحهٔ سفید): این `useState` **بعد از** `return` شرطی
   * پایین بود. رندر اول (loading) صفر هوک صدا می‌زد و رندر دوم (داده)
   * یکی → React خطای «Rendered more hooks than during the previous render»
   * می‌داد و کل اپ سفید می‌شد، دقیقاً چند ثانیه بعد از باز شدن.
   * همهٔ هوک‌ها باید **قبل از** هر return شرطی باشند.
   */
  const [listKind, setListKind] = useState<'mastered' | 'learning' | null>(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const d = data.dashboard;
  const words = listKind ? (d.wordLists?.[listKind] ?? []) : [];

  return (
    <div className="space-y-3">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox
          label={t('profile.lessonsCompleted')}
          value={d.lessonsCompleted}
          icon="📚"
        />
        <StatBox
          label={t('profile.minutesLearned')}
          value={d.totalMinutes}
          icon="⏱"
        />
        <StatBox
          label={t('profile.masteredWords')}
          value={d.masteredWords}
          icon="🎯"
          tone="success"
          onClick={() => setListKind('mastered')}
        />
        <StatBox
          label={t('profile.learningWords')}
          value={d.learningWords}
          icon="📖"
          onClick={() => setListKind('learning')}
        />
      </div>

      {/* Qualitative skills — the "what you can do now" panel */}
      <Card>
        <p className="mb-1 text-xs font-semibold text-text">{t('profile.skills')}</p>
        <p className="mb-3 text-[11px] text-text-hint">{t('profile.skillsHint')}</p>

        <div className="space-y-2">
          {d.qualitativeSkills.map((skill) => (
            <SkillRow
              key={skill.key}
              skill={skill}
              progress={d.skillProgress?.find((p) => p.key === skill.key)}
            />
          ))}
        </div>
      </Card>

      {/* Weekly activity */}
      <Card>
        <p className="mb-3 text-xs font-semibold text-text">
          {t('profile.weeklyActivity')}
        </p>
        <div className="h-32 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weeklyActivity} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="day"
                tickFormatter={(v: string) => t(`weekdays.${v}`)}
                tick={{ fontSize: 10, fill: 'var(--tg-theme-hint-color, #71717a)' }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                {d.weeklyActivity.map((entry) => (
                  <Cell
                    key={entry.day}
                    fill={entry.completed ? 'var(--tg-theme-button-color, #2563eb)' : 'var(--border-color, #e4e4e7)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Skill breakdown */}
      <Card>
        <p className="mb-3 text-xs font-semibold text-text">{t('profile.stats')}</p>
        <div className="space-y-3">
          {d.skillBreakdown.map((s) => (
            <div key={s.area}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-text-hint">{t(`skills.${s.area}`)}</span>
                <span className="text-xs font-semibold text-text">{s.score}%</span>
              </div>
              <ProgressBar value={s.score} height={6} />
            </div>
          ))}
        </div>

        {/* Accuracy ring */}
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
          <div className="h-16 w-16 shrink-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[{ value: d.accuracyPct, fill: 'var(--success-500, #16a34a)' }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-text-hint">{t('learn.accuracy')}</p>
            <p className="text-xl font-bold text-text">{d.accuracyPct}%</p>
          </div>

          <div className="ms-auto text-end">
            <p className="text-xs text-text-hint">{t('profile.longestStreak')}</p>
            <p className="text-xl font-bold text-text">
              🔥 {useSessionStore.getState().user?.longestStreak ?? 0}
            </p>
          </div>
        </div>
      </Card>

      {listKind && (
        <WordListModal
          kind={listKind}
          words={words}
          onClose={() => setListKind(null)}
        />
      )}
    </div>
  );
}

/**
 * پاپ‌آپ لیست واژه‌ها — «تثبیت‌شده» یا «در حال یادگیری» با موقعیت مرور.
 * ⚠️ از Portal استفاده می‌کند تا `fixed` نسبت به کارت‌های دارای
 * backdrop-filter محاسبه نشود.
 */
function WordListModal({
  kind,
  words,
  onClose,
}: {
  kind: 'mastered' | 'learning';
  words: WordListEntry[];
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const due = (iso: string | null) => {
    if (!iso) return '—';
    const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
    if (!Number.isFinite(diff)) return '—';
    if (diff <= 0) return t('profile.dueToday');
    if (diff === 1) return t('profile.dueTomorrow');
    return t('profile.dueInDays', { count: diff });
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
        <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-bg sm:rounded-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text">
              {kind === 'mastered' ? t('profile.wordsMasteredTitle') : t('profile.wordsLearningTitle')}
              <span className="ms-1 text-xs font-normal text-text-hint">({words.length})</span>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-hint transition active:scale-95"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {words.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-hint">{t('profile.noWords')}</p>
            ) : (
              <ul className="space-y-2">
                {words.map((w) => (
                  <li
                    key={w.term}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="target-text truncate text-sm font-semibold text-text" dir="ltr">
                        {w.term}
                      </p>
                      {w.meaning && (
                        <p className="truncate text-[11px] text-text-hint">{w.meaning}</p>
                      )}
                    </div>

                    <div className="shrink-0 text-end">
                      <span
                        className={
                          w.box >= 5
                            ? 'rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-semibold text-success-500'
                            : 'rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-semibold text-text-hint'
                        }
                      >
                        {t('profile.boxOf', { box: w.box })}
                      </span>
                      <p className="mt-1 text-[10px] text-text-muted">{due(w.nextReviewAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function StatBox({
  label,
  value,
  icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: 'neutral' | 'success';
  onClick?: () => void;
}) {
  const inner = (
    <Card className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-text-hint">{label}</p>
        <p
          className={
            tone === 'success'
              ? 'text-lg font-bold text-success-500'
              : 'text-lg font-bold text-text'
          }
        >
          {value}
        </p>
      </div>
    </Card>
  );

  // ⚠️ Card خودش onClick نمی‌گیرد؛ برای کلیک‌پذیری داخل button می‌گذاریم.
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} className="text-start transition active:scale-[0.98]">
      {inner}
    </button>
  );
}

function SkillRow({
  skill,
  progress,
}: {
  skill: QualitativeSkill;
  progress?: { current: number; target: number };
}) {
  const { t } = useTranslation();

  return (
    <div
      className={
        skill.unlocked
          ? 'flex items-center gap-3 rounded-xl bg-success-100/60 p-2.5'
          : 'flex items-center gap-3 rounded-xl bg-[var(--surface-sunken)] p-2.5 opacity-60'
      }
    >
      <span className="text-lg">{skill.icon}</span>
      <span className="flex-1 text-xs leading-snug text-text">
        {t(`skills.${skill.key}`, { defaultValue: skill.labelFa })}
      </span>
      {skill.unlocked ? (
        <Chip tone="success">✓</Chip>
      ) : (
        <span className="shrink-0 text-[10px] text-text-muted">
          {progress ? `${Math.min(progress.current, progress.target)}/${progress.target} ` : ''}
          🔒
        </span>
      )}
    </div>
  );
}
