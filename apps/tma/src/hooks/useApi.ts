import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type {
  AiProviderListResponse,
  AiProviderTestResult,
  CreateAiProviderInput,
  Cycle,
  Lesson,
  Plan,
  ProgressDashboard,
  UpdateAiProviderInput,
  UserProfile,
} from '@kpanah/shared';
import { api, setToken, ApiClientError } from '../lib/api';
import { useSessionStore } from '../store/session';
import { useUiStore } from '../store/ui';
import {
  MOCK_ADMIN_USERS,
  MOCK_AI_PROVIDERS,
  MOCK_CYCLE,
  MOCK_DASHBOARD,
  MOCK_LESSON,
  MOCK_PLANS,
  MOCK_USER,
} from '../mocks/user';

const MOCK = import.meta.env.VITE_ENABLE_MOCK === 'true' || import.meta.env.DEV;

// ─────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────

export function useAuthBootstrap(): void {
  const { setAuthenticating, setUser, setUnauthenticated } = useSessionStore();
  const setUiLanguage = useUiStore((s) => s.setUiLanguage);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setAuthenticating();
      try {
        const result = (await api.auth()) as { token: string; user: UserProfile };
        if (cancelled) return;
        setToken(result.token);
        setUser(result.user);
        if (result.user.uiLanguage) setUiLanguage(result.user.uiLanguage);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiClientError ? err.userMessageKey ?? err.message : 'errors.generic';
        setUnauthenticated(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAuthenticating, setUser, setUnauthenticated, setUiLanguage]);
}

// ─────────────────────────────────────────────────────────────────────
// Home (learn tab)
// ─────────────────────────────────────────────────────────────────────

export interface HomeData {
  user: UserProfile;
  cycle: Cycle | null;
  lesson: Lesson | null;
  generating: boolean;
  generationStatus: string | null;
  /** اگر درس امروز تمام شده، زمان باز شدن درس بعدی (ISO) */
  nextUnlockAt?: string | null;
  /** بالاترین بخشِ تکمیل‌شدهٔ درس جاری (سرور) */
  partsDone?: number;
  /** ارزش هر سکه به ریال (تنظیم مدیر) */
  coinValueIrr?: number | null;
  /** دلیل خطا وقتی تولید چرخه شکست خورده (فقط برای FAILED) */
  generationError?: string | null;
}

/**
 * تلاش مجدد برای چرخهٔ شکست‌خورده.
 *
 * ⚠️ چرا mutation جدا و نه فقط `refetch`: چرخهٔ FAILED با refetch همان
 * وضعیت را برمی‌گرداند و هیچ اتفاقی نمی‌افتد — کاربر فکر می‌کرد دکمه
 * خراب است. این mutation واقعاً تولید را از سر می‌گیرد.
 */
export function useRetryCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{
      ok: boolean;
      via: string;
      alreadyGenerating?: boolean;
      recovered?: string;
    }> => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true, via: 'inline' };
      }
      return api.retryCycle();
    },
    onSuccess: () => {
      // وضعیت چرخه عوض شده → خانه را دوباره بخوان
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// مرور آزاد (واژه‌های سررسیده)
// ─────────────────────────────────────────────────────────────────────

export interface DueReviewItem {
  term: string;
  meaning: string;
  example: string;
  exampleTranslation?: string;
  pronunciation?: string;
  box: number;
}

/**
 * واژه‌هایی که زمان مرورشان رسیده.
 *
 * ⚠️ این حلقه قبلاً بسته نبود: اگر درس امروز به واژه‌ای نمی‌پرداخت،
 * فاصلهٔ لایتنر آن عملاً بی‌اثر می‌شد.
 */
export function useDueReviews() {
  const status = useSessionStore((s) => s.status);

  return useQuery({
    queryKey: ['due-reviews'],
    enabled: status === 'authenticated',
    queryFn: async (): Promise<{ items: DueReviewItem[]; count: number; totalDue: number }> => {
      if (MOCK) return { items: [], count: 0, totalDue: 0 };
      return api.dueReviews();
    },
    staleTime: 60_000,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      answers: { term: string; isCorrect: boolean; responseMs: number }[];
    }) => {
      if (MOCK) return { ok: true, updated: body.answers.length };
      return api.submitReview(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['due-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useHome() {
  const status = useSessionStore((s) => s.status);

  return useQuery({
    queryKey: ['home'],
    enabled: status === 'authenticated',
    queryFn: async (): Promise<HomeData> => {
      if (MOCK) {
        return {
          user: MOCK_USER,
          cycle: MOCK_CYCLE,
          lesson: MOCK_LESSON,
          generating: false,
          generationStatus: null,
        };
      }
      return api.home() as Promise<HomeData>;
    },
    staleTime: 30_000,
    /**
     * ⚠️ وقتی تولید در جریان است، هر ۵ ثانیه poll کن تا کاربر خودش درسِ
     * آماده‌شده را ببیند (بدون نیاز به رفرش دستی). وقتی تولید تمام شد
     * (`generating: false`)، polling متوقف می‌شود.
     */
    refetchInterval: (query) => {
      const data = query.state.data as HomeData | undefined;
      return data?.generating ? 5_000 : false;
    },
  });
}
// ─────────────────────────────────────────────────────────────────────
// Progress dashboard
// ─────────────────────────────────────────────────────────────────────

export function useProgress() {
  const status = useSessionStore((s) => s.status);

  return useQuery({
    queryKey: ['progress'],
    enabled: status === 'authenticated',
    queryFn: async (): Promise<{ dashboard: ProgressDashboard }> => {
      if (MOCK) return { dashboard: MOCK_DASHBOARD };
      return api.progress() as Promise<{ dashboard: ProgressDashboard }>;
    },
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Plans / store
// ─────────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async (): Promise<{ plans: Plan[] }> => {
      if (MOCK) return { plans: MOCK_PLANS };
      return api.plans() as Promise<{ plans: Plan[] }>;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateInvoice() {
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async (planId: string) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 700));
        return { invoiceLink: '', amountStars: 0, mocked: true };
      }
      return api.createInvoice(planId);
    },
    onError: (err) => {
      const key = err instanceof ApiClientError ? err.userMessageKey : null;
      showToast(key ?? 'errors.payment_unavailable', 'error');
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Lesson completion
// ─────────────────────────────────────────────────────────────────────

export interface CompleteLessonResult {
  dayNumber: number;
  score: { score: number; accuracy: number; speedBonus: number; isPerfect: boolean };
  reward: number;
  streak: number;
  cycleCompleted: boolean;
  nextCycleTriggered: boolean;
  appLocked: boolean;
}

export function useCompleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      lessonId: string;
      durationSeconds: number;
      answers: {
        itemId: string;
        isCorrect: boolean;
        responseMs: number;
        linkedTerm?: string;
        usedHint?: boolean;
      }[];
    }): Promise<CompleteLessonResult> => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        const total = input.answers.length || 1;
        const correct = input.answers.filter((a) => a.isCorrect).length;
        const accuracy = Math.round((correct / total) * 100);
        return {
          dayNumber: 3,
          score: { score: Math.min(100, accuracy + 8), accuracy, speedBonus: 60, isPerfect: accuracy === 100 },
          reward: 10,
          streak: 6,
          cycleCompleted: false,
          nextCycleTriggered: false,
          appLocked: false,
        };
      }
      return api.completeLesson(input) as Promise<CompleteLessonResult>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useSendTelemetry() {
  return useMutation({
    mutationFn: async (body: unknown) => {
      if (MOCK) return { accepted: 1 };
      return api.telemetry(body);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Onboarding / settings
// ─────────────────────────────────────────────────────────────────────

export function useOnboarding() {
  const queryClient = useQueryClient();
  const setUser = useSessionStore((s) => s.setUser);
  const currentUser = useSessionStore((s) => s.user);

  return useMutation({
    mutationFn: async (body: {
      uiLanguage: string;
      targetLanguage: string;
      skillLevel: string;
      learningGoal: string;
      dialect?: string | null;
      dailyMinutes?: number | null;
      placement?: {
        score: number;
        estimatedLevel: string;
        answers: number;
      } | null;
    }) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 900));
        return { onboardingComplete: true, generating: true };
      }
      return api.onboarding(body);
    },
    onSuccess: (_result, variables) => {
      if (currentUser) {
        setUser({
          ...currentUser,
          uiLanguage: variables.uiLanguage as UserProfile['uiLanguage'],
          targetLanguage: variables.targetLanguage as UserProfile['targetLanguage'],
          skillLevel: variables.skillLevel as UserProfile['skillLevel'],
          learningGoal: variables.learningGoal,
          onboardingDone: true,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useUpdateProfile() {
  const setUser = useSessionStore((s) => s.setUser);
  const updateUser = useSessionStore((s) => s.updateUser);

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return { updated: true };
      }
      return api.updateProfile(body);
    },
    onSuccess: (_result, variables) => {
      updateUser(variables as Partial<UserProfile>);
      const user = useSessionStore.getState().user;
      if (user) setUser(user);
    },
  });
}

export function useDeleteAccount() {
  const setUnauthenticated = useSessionStore((s) => s.setUnauthenticated);

  return useMutation({
    mutationFn: async () => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        return { deleted: true };
      }
      return api.deleteAccount();
    },
    onSuccess: () => {
      setToken(null);
      setUnauthenticated();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────

export function useAdminUsers(params: { limit?: number; offset?: number; q?: string }) {
  const isAdmin = useSessionStore((s) => s.user?.isAdmin);

  return useQuery({
    queryKey: ['admin-users', params],
    // ⚠️ قبلاً `Boolean(isAdmin)` باعث می‌شد اگر پروفایل دیر لود شود یا پرچم
    // لحظه‌ای undefined باشد، لیست اصلاً گرفته نشود («یک‌بار می‌آید، یک‌بار نه»).
    // حالا فقط وقتی صریحاً *غیر‌ادمین* باشیم غیرفعال می‌شود.
    enabled: isAdmin !== false,
    queryFn: async () => {
      if (MOCK) return { users: MOCK_ADMIN_USERS as never[] };
      return api.adminUsers(params) as Promise<{ users: never[] }>;
    },
    staleTime: 30_000,
    retry: 2,
  });
}

export function useAdminGift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      telegramId: number;
      planType: string;
      note?: string;
      extend: boolean;
    }) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        return { granted: true };
      }
      return api.adminGift(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useAdminStats() {
  const isAdmin = useSessionStore((s) => s.user?.isAdmin);

  return useQuery({
    queryKey: ['admin-stats'],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      if (MOCK) {
        return { stats: { totalUsers: 3, activeSubscriptions: 2, trialsActive: 1, receiptsPending: 0 }, plans: MOCK_PLANS };
      }
      return api.adminStats() as Promise<Record<string, unknown>>;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// AI provider pool (admin)
// ─────────────────────────────────────────────────────────────────────

export function useAiProviders() {
  const isAdmin = useSessionStore((s) => s.user?.isAdmin);

  return useQuery({
    queryKey: ['admin-ai-providers'],
    enabled: Boolean(isAdmin),
    queryFn: async (): Promise<AiProviderListResponse> => {
      if (MOCK) return MOCK_AI_PROVIDERS;
      return api.adminAiProviders() as Promise<AiProviderListResponse>;
    },
  });
}

export function useCreateAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAiProviderInput) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 700));
        return { provider: { id: `mock-${Date.now()}`, label: input.label } };
      }
      return api.adminAiProviderCreate(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });
}

export function useUpdateAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateAiProviderInput }) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        return { provider: { id } };
      }
      return api.adminAiProviderUpdate(id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });
}

export function useDeleteAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return { deleted: true };
      }
      return api.adminAiProviderDelete(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });
}

export function useReorderAiProviders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: string[]) => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 300));
        return { providers: [] };
      }
      return api.adminAiProviderReorder(order);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });
}

export function useTestAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<AiProviderTestResult> => {
      if (MOCK) {
        await new Promise((r) => setTimeout(r, 1200));
        return { ok: true, ms: 640, sample: 'OK' };
      }
      return api.adminAiProviderTest(id) as Promise<AiProviderTestResult>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] });
    },
  });
}

// ═════════════════════════════════════════════════════════════════════
// پشتیبانی (تیکت)
// ═════════════════════════════════════════════════════════════════════

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message: string | null;
  last_at: string;
  unread_for_user: boolean;
}

export interface SupportMessage {
  id: string;
  author: 'USER' | 'ADMIN';
  body: string;
  created_at: string;
}

export function useSupportTickets() {
  return useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => (await api.supportList()) as { tickets: SupportTicket[] },
    staleTime: 15_000,
  });
}

export function useSupportThread(ticketId: string) {
  return useQuery({
    queryKey: ['support-thread', ticketId],
    queryFn: async () =>
      (await api.supportThread(ticketId)) as {
        ticket: SupportTicket;
        messages: SupportMessage[];
      },
    enabled: Boolean(ticketId),
    staleTime: 10_000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  return useMutation({
    mutationFn: (body: { subject: string; body: string; category: string }) =>
      api.supportCreate(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      showToast('تیکت شما ثبت شد ✅', 'success');
    },
    onError: () => showToast('ثبت تیکت ناموفق بود', 'error'),
  });
}

export function useReplyTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) =>
      api.supportReply(ticketId, body),
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: ['support-thread', v.ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useCloseTicket() {
  const queryClient = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  return useMutation({
    mutationFn: (ticketId: string) => api.supportClose(ticketId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      showToast('تیکت بسته شد', 'info');
    },
  });
}
