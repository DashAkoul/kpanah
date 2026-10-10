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
        />
        <StatBox
          label={t('profile.learningWords')}
          value={d.learningWords}
          icon="📖"
        />
      </div>

      {/* Qualitative skills — the "what you can do now" panel */}
      <Card>
        <p className="mb-1 text-xs font-semibold text-text">{t('profile.skills')}</p>
        <p className="mb-3 text-[11px] text-text-hint">{t('profile.skillsHint')}</p>

        <div className="space-y-2">
          {d.qualitativeSkills.map((skill) => (
            <SkillRow key={skill.key} skill={skill} />
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
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: string;
  tone?: 'neutral' | 'success';
}) {
  return (
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
}

function SkillRow({ skill }: { skill: QualitativeSkill }) {
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
        <span className="text-xs text-text-muted">🔒</span>
      )}
    </div>
  );
}
