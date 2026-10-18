import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * مرز خطای سراسری.
 *
 * ⚠️ چرا لازم است: بدون این، هر خطای رندر در React کل درخت را از بین می‌برد
 * و کاربر فقط یک صفحهٔ **سفید** می‌بیند — بدون هیچ پیام یا راه بازگشت.
 * (همین اتفاق با یک باگ هوک در پروفایل افتاد.)
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // برای دیباگ در کنسول تلگرام/دسکتاپ
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl">😕</div>
        <h1 className="text-base font-bold text-text">مشکلی پیش آمد</h1>
        <p className="max-w-xs text-xs leading-relaxed text-text-hint">
          اپ به‌درستی بالا نیامد. یک‌بار دوباره باز کن؛ اگر ادامه داشت، همین پیام را
          برای پشتیبانی بفرست.
        </p>

        <pre
          className="max-h-32 w-full max-w-xs overflow-auto rounded-lg border border-border bg-card p-2 text-left font-mono text-[9px] leading-relaxed text-text-muted"
          dir="ltr"
        >
          {error.message}
        </pre>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-text transition active:scale-95"
        >
          بارگذاری مجدد
        </button>
      </div>
    );
  }
}
