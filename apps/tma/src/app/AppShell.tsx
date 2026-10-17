import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TopBar } from '../components/layout/TopBar';
import { BottomNav, type TabKey } from '../components/layout/BottomNav';
import { LearnTab } from '../features/learn/LearnTab';
import { LessonPlayer } from '../features/learn/LessonPlayer';
import { LessonResult } from '../features/learn/LessonResult';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { Button, Toast } from '../components/ui';
import { MessageBanner } from '../components/MessageBanner';
import { useHome, useCompleteLesson } from '../hooks/useApi';
import { useSessionStore } from '../store/session';
import { useUiStore } from '../store/ui';
import { ApiClientError } from '../lib/api';
import { useLessonSession } from '../store/session';
import { setBackButton } from '../lib/telegram';

/**
 * تب‌های سنگین (نمودارها و پنل مدیریت) تنبل بارگذاری می‌شوند تا
 * باندل اولیهٔ اپ کوچک‌تر و اجرای اولیه سریع‌تر باشد.
 */
const ProfileTab = lazy(() =>
  import('../features/profile/ProfileTab').then((m) => ({ default: m.ProfileTab }))
);
const SettingsTab = lazy(() =>
  import('../features/settings/SettingsTab').then((m) => ({ default: m.SettingsTab }))
);

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
  const showToast = useUiStore((s) => s.showToast);
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
        {/* اگر بیش از ۸ ثانیه طول کشید، احتمالاً یک جای اتصال خراب است */}
        <SlowHint />
      </div>
    );
  }

  if (status === 'unauthenticated' || status === 'error') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl">🔐</div>
        <p className="text-sm text-text-hint">
          {authError ? t(authError) : t('errors.invalid_session')}
        </p>

        {/* در محیطی که initData وجود ندارد، گفتن «اینترنت را چک کن» گمراه‌کننده
            است. تشخیص می‌دهیم و راهنمای دقیق می‌دهیم. */}
        <OpenHelp />

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
              // ⚠️ بدون این، هر خطای شبکه/اعتبارسنجی «هیچ اتفاقی» به‌نظر
              // می‌رسید. حالا کاربر پیام می‌بیند و می‌تواند دوباره بزند.
              onError: (err) => {
                const message =
                  err instanceof ApiClientError
                    ? err.userMessageKey
                      ? t(err.userMessageKey)
                      : err.message
                    : t('errors.server_error');
                showToast(message, 'error');
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
      <TopBar />
      <MessageBanner />

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
        {tab === 'profile' && (
          <Suspense fallback={<TabFallback />}>
            <ProfileTab />
          </Suspense>
        )}
        {tab === 'settings' && (
          <Suspense fallback={<TabFallback />}>
            <SettingsTab />
          </Suspense>
        )}
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

function TabFallback() {
  return (
    <div className="space-y-2 p-4">
      <div className="skeleton h-24" />
      <div className="skeleton h-16" />
      <div className="skeleton h-16" />
    </div>
  );
}

/**
 * بعد از ۸ ثانیه انتظار، یک راهنما نشان می‌دهد که کاربر بی‌نتیجه منتظر نماند.
 * علت رایج: مینی‌اپ در BotFather ثبت نشده و درخواست به‌دلیل نبودِ initData
 * رد می‌شود، یا اصلاً اپ داخل تلگرام باز نشده.
 */
function SlowHint() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(id);
  }, []);

  if (!slow) return null;

  const insideTelegram = Boolean(window.Telegram?.WebApp?.initData);

  return (
    <div className="mt-4 max-w-[22rem] rounded-xl border border-border bg-surface p-3 text-right">
      <p className="mb-2 text-xs font-semibold text-text">
        {t('errors.slow_title')}
      </p>
      <p className="mb-2 text-[11px] leading-relaxed text-text-hint">
        {insideTelegram ? t('errors.slow_inside') : t('errors.slow_outside')}
      </p>
      <a
        href="/diag.html"
        className="text-[11px] font-semibold text-accent underline"
      >
        {t('errors.open_diag')}
      </a>
    </div>
  );
}

/**
 * وقتی احراز هویت رد می‌شود، علت را از محیط تشخیص می‌دهیم و به‌جای
 * «اینترنت را چک کن» راهنمای درست می‌دهیم.
 *
 * توجه: اگر توکن یک‌بارمصرف در URL بود، api.ts خودش آن را مصرف می‌کند
 * و کاربر هیچ‌وقت به این صفحه نمی‌رسد. پس رسیدن به اینجا یعنی یا
 * توکن نبوده، یا مصرف/منقضی شده است.
 */
function OpenHelp() {
  const { t } = useTranslation();
  const wa = window.Telegram?.WebApp;

  // SDK نیست → اسکریپت تلگرام لود نشده (فیلترشکن یا مسدودی)
  if (!wa) {
    return (
      <div className="mt-2 max-w-[22rem] rounded-xl border border-border bg-surface p-3 text-right">
        <p className="text-[11px] leading-relaxed text-text-hint">
          {t('errors.telegram_sdk_missing')}
        </p>
      </div>
    );
  }

  // SDK هست ولی initData خالی → کاربر از مرورگر باز کرده
  if (!wa.initData) {
    return (
      <div className="mt-2 max-w-[22rem] rounded-xl border border-border bg-surface p-3 text-right">
        <p className="mb-1.5 text-xs font-semibold text-text">
          {t('errors.opened_in_browser_title')}
        </p>
        <p className="mb-2 text-[11px] leading-relaxed text-text-hint">
          {t('errors.not_registered_body')}
        </p>
        <a
          href="/diag.html"
          className="text-[11px] font-semibold text-accent underline"
        >
          {t('errors.open_diag')}
        </a>
      </div>
    );
  }

  return null;
}
