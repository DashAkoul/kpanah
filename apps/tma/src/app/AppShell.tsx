import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TopBar } from '../components/layout/TopBar';
import { BottomNav, type TabKey } from '../components/layout/BottomNav';
import { LearnTab } from '../features/learn/LearnTab';
import { ProfileTab } from '../features/profile/ProfileTab';
import { SettingsTab } from '../features/settings/SettingsTab';
import { LessonPlayer } from '../features/learn/LessonPlayer';
import { LessonResult } from '../features/learn/LessonResult';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { Button, Toast } from '../components/ui';
import { useHome, useCompleteLesson } from '../hooks/useApi';
import { useSessionStore } from '../store/session';
import { useLessonSession } from '../store/session';
import { setBackButton } from '../lib/telegram';

type Screen = 'tabs' | 'lesson' | 'result';

/**
 * Root shell.
 *
 * Gate order:
 *   authenticating → error/unauthenticated → onboarding → app
 *
 * The lesson player takes over the whole viewport (no tabs) so the
 * learner is not tempted to wander mid-lesson.
 */
export function AppShell() {
  const { t } = useTranslation();
  const status = useSessionStore((s) => s.status);
  const user = useSessionStore((s) => s.user);
  const authError = useSessionStore((s) => s.error);

  const [tab, setTab] = useState<TabKey>('learn');
  const [screen, setScreen] = useState<Screen>('tabs');
  const [result, setResult] = useState<ResultData | null>(null);

  const { data: homeData, refetch: refetchHome } = useHome();
  const completeLesson = useCompleteLesson();
  const lessonSession = useLessonSession();

  // ── Back button: خروج از درس با دکمه بازگشت تلگرام ────────────────
  useEffect(() => {
    if (screen === 'lesson') {
      return setBackButton(true, () => setScreen('tabs'));
    }
    setBackButton(false);
    return undefined;
  }, [screen]);

  // ── Auth states ──────────────────────────────────────────────────
  if (status === 'idle' || status === 'authenticating') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4">
        <div className="text-5xl">🎓</div>
        <p className="text-sm text-text-hint">{t('common.loading')}</p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-pulse-soft rounded-full bg-accent"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || status === 'error') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🔐</div>
        <p className="text-sm text-text-hint">
          {authError ? t(authError) : t('errors.invalid_session')}
        </p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (!user) return null;

  // ── Onboarding gate ──────────────────────────────────────────────
  if (!user.onboardingDone) {
    return (
      <>
        <OnboardingFlow />
        <Toast />
      </>
    );
  }

  // ── Lesson player ────────────────────────────────────────────────
  if (screen === 'lesson' && homeData?.lesson) {
    return (
      <LessonPlayer
        lesson={homeData.lesson}
        onExit={() => setScreen('tabs')}
        onFinish={(answers) => {
          const durationSeconds = Math.round(
            (Date.now() - lessonSession.startedAt) / 1000
          );

          completeLesson.mutate(
            {
              lessonId: homeData.lesson!.id,
              durationSeconds,
              answers,
            },
            {
              onSuccess: (data) => {
                setResult(data as ResultData);
                setScreen('result');
              },
            }
          );
        }}
      />
    );
  }

  // ── Result screen ────────────────────────────────────────────────
  if (screen === 'result' && result) {
    return (
      <LessonResult
        result={result}
        onContinue={() => {
          lessonSession.reset();
          setResult(null);
          setScreen('tabs');
          void refetchHome();
        }}
      />
    );
  }

  // ── Tabs ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <TopBar onOpenStore={() => { setTab('profile'); }} />

      <main className="flex-1">
        {tab === 'learn' && (
          <LearnTab
            onStartLesson={() => {
              if (homeData?.lesson) {
                lessonSession.begin(homeData.lesson.id);
                setScreen('lesson');
              }
            }}
          />
        )}
        {tab === 'profile' && <ProfileTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
      <Toast />
    </div>
  );
}

export interface ResultData {
  dayNumber: number;
  score: { score: number; accuracy: number; speedBonus: number; isPerfect: boolean };
  reward: number;
  streak: number;
  cycleCompleted: boolean;
  nextCycleTriggered: boolean;
  appLocked: boolean;
}
