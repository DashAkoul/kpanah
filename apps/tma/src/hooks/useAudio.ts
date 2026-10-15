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

  const play = useCallback(async (text: string, language: string) => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);
    setPlaying(false);

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

      // پخش قبلی را قطع کن تا دو کلیپ روی هم نیفتند
      audioRef.current?.pause();

      const audio = new Audio(absoluteMediaUrl(url));
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setError('playback failed');
      };

      await audio.play();
      // پخش شروع شد → دیگر «بارگذاری» نیست
      setLoading(false);
      setPlaying(true);
    } catch (err) {
      setLoading(false);
      setPlaying(false);
      setError((err as Error).message);
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);

  return { play, stop, loading, playing, error };
}
