import type { UserProfile } from '@kpanah/shared';

/**
 * نقش‌های ادمین محدود (RBAC).
 * آینهٔ `ADMIN_ACTION_ROLES` در `workers/edge/src/middleware/auth.ts`.
 */
export type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'MARKETING' | 'FINANCE';

/**
 * نقش مؤثر کاربر.
 *
 * ⚠️ مدیرانی که از طریق `TELEGRAM_ADMIN_IDS` (env) تعیین شده‌اند ممکن است
 * `adminRole` نداشته باشند. در آن حالت باید «مدیر اصلی» در نظر گرفته شوند،
 * وگرنه تب «مدیران» اشتباهاً پیام «فقط مدیر اصلی...» را نشان می‌دهد.
 */
export function effectiveRole(
  user: UserProfile | null | undefined
): AdminRole | null {
  if (!user?.isAdmin) return null;
  const role = user.adminRole as AdminRole | null | undefined;
  return role ?? 'SUPER_ADMIN';
}

/** آیا نقش فعلی به این تب دسترسی دارد؟ */
export function roleCanSee(
  role: AdminRole | null,
  allowed: readonly AdminRole[]
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return allowed.includes(role);
}
