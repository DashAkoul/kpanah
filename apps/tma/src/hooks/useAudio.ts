import { useState, useCallback, useRef } from 'react';
import { API_BASE } from '../lib/api';

/** مسیر تولید صوت — بیرون از دروازهٔ اصلی، قبل از auth چک می‌شود */
const SPEAK_PATH = '/kpanah56/8fjg7rfb/v1/media/speak';

/** قرارداد پاسخ سرور: `{ ok, data }` یا `{ ok: false, error }` */
interface SpeakPayload {
  ok: boolean;
  data?: { url: string; mimeType?: string; fromCache?: boolean };
  error?: { message?: string };
}

/**
 * لینک نسبی سرور را به origin درست می‌چسباند.
 *
 * ⚠️ چرا لازم است: پیش‌فرض سرور (`MEDIA_URL_BASE`) یک مسیر نسبی است. اگر
 * همان را به `new Audio()` بدهیم، مرورگر آن را نسبت به origin **فرانت**
 * (`app.infolange.kdns.fr`) حل می‌کند — جایی که هیچ route رسانه‌ای نیست →
 * ۴۰۴. پس لینک نسبی باید به origin **API** بچسبد.
 */
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * پخش تلفظ — از endpoint تولید صوت استفاده می‌کند.
 *
 * صوت یک بار ساخته و در R2 کش می‌شود؛ بار بعدی فوراً از cache می‌آید.
 * ⚠️ `loading` فقط تا **شروع** پخش true می‌ماند، نه تا پایان آن — وگرنه
 * دکمه در تمام مدت پخش «در حال بارگذاری» می‌ماند.
 */
export function useAudio() {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * ⚠️ کش URL در حافظه — برای سازگاری با WebView تلگرام.
   *
   * در iOS/WKWebView، `audio.play()` فقط داخل «ژست کاربر» مجاز است. اگر قبل
   * از play یک `await fetch(...)` باشد، ژست باطل می‌شود و play با
   * NotAllowedError رد می‌شود (همان «دکمه کار نمی‌کند»). با کش کردن URL،
   * بار دوم (و بعد از یک بار خطا) پخش **مستقیماً** و بدون await شبکه انجام
   * می‌شود.
   */
  const urlCache = useRef<Map<string, string>>(new Map());

  const startPlayback = useCallback(async (url: string) => {
    audioRef.current?.pause();

    const audio = new Audio(absoluteMediaUrl(url));
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      setPlaying(false);
      setError('playback failed');
    };

    await audio.play();
    setLoading(false);
    setPlaying(true);
  }, []);

  const play = useCallback(
    async (text: string, language: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;

      setError(null);
      const cacheKey = `${language}:${trimmed}`;
      const cachedUrl = urlCache.current.get(cacheKey);

      setLoading(true);
      setPlaying(false);

      // مسیر سریع: URL از قبل داریم → پخش فوری، بدون await شبکه
      if (cachedUrl) {
        try {
          await startPlayback(cachedUrl);
        } catch (err) {
          setLoading(false);
          setPlaying(false);
          setError((err as Error).message || 'playback failed');
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}${SPEAK_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, language }),
        });

        const payload = (await res.json().catch(() => null)) as SpeakPayload | null;
        const url = payload?.data?.url;
        if (!res.ok || !payload?.ok || !url) {
          throw new Error(payload?.error?.message || 'speech synthesis failed');
        }

        urlCache.current.set(cacheKey, url);
        await startPlayback(url);
      } catch (err) {
        setLoading(false);
        setPlaying(false);
        // ⚠️ خطا دیگر بی‌صدا نمی‌ماند؛ دکمه متن «پخش نشد» را نشان می‌دهد.
        setError((err as Error).message || 'speech synthesis failed');
      }
    },
    [startPlayback]
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);

  return { play, stop, loading, playing, error };
}
