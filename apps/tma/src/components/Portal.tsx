import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * رندر محتوا در `document.body`.
 *
 * چرا لازم است: هر عنصری که `backdrop-filter`، `transform` یا `filter` داشته
 * باشد، یک **containing block** برای فرزندانِ `position: fixed` می‌سازد. کارت‌های
 * ما `backdrop-filter` دارند؛ پس شیت/پاپ‌آپی که داخل یک کارت رندر شود، به‌جای
 * viewport نسبت به همان کارت fixed می‌شود و زیر سرصفحه گیر می‌کند و بریده می‌شود.
 * با پورتال، اورلی همیشه روی کل صفحه و بالای همه‌چیز می‌نشیند.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
