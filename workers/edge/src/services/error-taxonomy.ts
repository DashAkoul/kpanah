/**
 * دسته‌بندی خطا — از **شناسهٔ آیتم** استنباط می‌شود، نه از حدس مدل.
 *
 * ⚠️ چرا اینجا و نه داخل route: تا قابل تست باشد. بدون دسته‌بندی،
 * «چرا کاربر ضعیف است» قابل تحلیل نیست (بخش ۱۰.۱ چک‌لیست).
 */
export type ErrorType =
  | 'VOCABULARY'
  | 'GRAMMAR'
  | 'APPLICATION'
  | 'PRODUCTION'
  | 'COMPREHENSION'
  | 'OTHER';

export function errorTypeFor(
  itemId: string,
  isCorrect: boolean,
  usedHint = false
): ErrorType | null {
  if (isCorrect) return null;
  if (itemId.startsWith('write-')) return 'PRODUCTION';
  if (itemId.startsWith('example-')) return 'GRAMMAR';
  if (itemId.startsWith('pattern-')) return 'APPLICATION';
  if (itemId.startsWith('meaning-')) return 'VOCABULARY';
  if (itemId.startsWith('story-')) return 'COMPREHENSION';
  return usedHint ? 'VOCABULARY' : 'OTHER';
}
