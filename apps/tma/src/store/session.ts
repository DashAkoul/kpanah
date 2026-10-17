import { create } from 'zustand';
import type { UserProfile } from '@kpanah/shared';

/**
 * Session state: the authenticated user + auth lifecycle.
 * Kept separate from React Query because the whole app gates on it.
 */

export type SessionStatus =
  | 'idle'
  | 'authenticating'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

interface SessionState {
  status: SessionStatus;
  user: UserProfile | null;
  error: string | null;

  setAuthenticating: () => void;
  setUser: (user: UserProfile) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  setUnauthenticated: (error?: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'idle',
  user: null,
  error: null,

  setAuthenticating: () => set({ status: 'authenticating', error: null }),

  setUser: (user) => set({ status: 'authenticated', user, error: null }),

  updateUser: (patch) =>
    set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

  setUnauthenticated: (error = null) =>
    set({ status: 'unauthenticated', user: null, error }),

  reset: () => set({ status: 'idle', user: null, error: null }),
}));

// ─────────────────────────────────────────────────────────────────────
// Lesson session (in-flight answers, not yet submitted)
// ─────────────────────────────────────────────────────────────────────

export interface PendingAnswer {
  itemId: string;
  isCorrect: boolean;
  responseMs: number;
  linkedTerm?: string;
  usedHint?: boolean;
}

interface LessonSessionState {
  lessonId: string | null;
  startedAt: number;
  currentPart: 1 | 2;
  pendingAnswers: PendingAnswer[];
  itemStartedAt: number;

  begin: (lessonId: string) => void;
  setPart: (part: 1 | 2) => void;
  markItemStart: () => void;
  recordAnswer: (answer: Omit<PendingAnswer, 'responseMs'>) => PendingAnswer;
  reset: () => void;
}

export const useLessonSession = create<LessonSessionState>((set, get) => ({
  lessonId: null,
  startedAt: 0,
  currentPart: 1,
  pendingAnswers: [],
  itemStartedAt: 0,

  begin: (lessonId) =>
    set({
      lessonId,
      startedAt: Date.now(),
      currentPart: 1,
      pendingAnswers: [],
      itemStartedAt: Date.now(),
    }),

  setPart: (currentPart) => set({ currentPart }),

  markItemStart: () => set({ itemStartedAt: Date.now() }),

  recordAnswer: (answer) => {
    const { itemStartedAt } = get();
    // ⚠️ سقف ۱۰ دقیقه: اگر کاربر اپ را رها کند و برگردد، responseMs
    // می‌تواند از max اسکیمای سرور (۶۰۰٬۰۰۰ms) بگذرد و کل درخواست
    // complete-lesson را با ۴۰۰ رد کند → «دکمه انجام شد کار نمی‌کند».
    const responseMs = Math.min(
      600_000,
      Math.max(0, Date.now() - itemStartedAt)
    );
    const full: PendingAnswer = { ...answer, responseMs };
    set((state) => ({
      pendingAnswers: [...state.pendingAnswers, full],
      itemStartedAt: Date.now(),
    }));
    return full;
  },

  reset: () =>
    set({
      lessonId: null,
      startedAt: 0,
      currentPart: 1,
      pendingAnswers: [],
      itemStartedAt: 0,
    }),
}));
