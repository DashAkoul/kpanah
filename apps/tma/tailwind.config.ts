import type { Config } from 'tailwindcss';

/**
 * Design tokens live here as CSS variables so the same build can support
 * both light and dark Telegram themes without a second stylesheet.
 *
 * NOTE on alpha support
 * ---------------------
 * Tailwind's opacity modifier (`bg-brand-500/40`) only works when a colour is
 * declared with the `<alpha-value>` placeholder. Palette colours below are
 * therefore written as `rgb(R G B / <alpha-value>)`, which keeps every step
 * overridable while making `/5`, `/20`, `/30`, `/50`, `/60` valid utilities.
 *
 * The Telegram theme tokens (`accent`, `card`, `text`, …) are plain CSS
 * variables with light/dark fallbacks baked in. An opacity modifier cannot be
 * applied to them by Tailwind, so the stylesheet defines dedicated
 * `*-soft` / `*-ring` helpers instead (see `styles/index.css`).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--tg-theme-bg-color, #ffffff)',
        'bg-secondary': 'var(--tg-theme-secondary-bg-color, #f4f4f5)',
        text: 'var(--tg-theme-text-color, #0f172a)',
        'text-hint': 'var(--tg-theme-hint-color, #71717a)',
        'text-muted': 'var(--tg-theme-subtitle-text-color, #a1a1aa)',
        accent: 'var(--tg-theme-button-color, #2563eb)',
        'accent-text': 'var(--tg-theme-button-text-color, #ffffff)',
        link: 'var(--tg-theme-link-color, #2563eb)',
        destructive: 'var(--tg-theme-destructive-text-color, #dc2626)',
        card: 'var(--card-bg, #ffffff)',
        border: 'var(--border-color, #e4e4e7)',

        // ⚠️ عمداً `accent-soft` و `accent-ring` اینجا تعریف نشده‌اند.
        // اگر در پالت باشند، Tailwind یوتیلیتی `.bg-accent-soft` با آبیِ کامل
        // می‌سازد که روی کلاس کامپوننتیِ هم‌نام (لایهٔ components، تینت ۶٪)
        // غلبه می‌کند → آیتم انتخاب‌شده آبیِ توپر با متنِ آبی و ناخوانا می‌شود.
        // تینت‌ها در `src/styles/index.css` تعریف شده‌اند.

        brand: {
          50: 'rgb(238 246 255 / <alpha-value>)',
          100: 'rgb(217 235 255 / <alpha-value>)',
          200: 'rgb(188 220 255 / <alpha-value>)',
          300: 'rgb(142 197 255 / <alpha-value>)',
          400: 'rgb(89 164 255 / <alpha-value>)',
          500: 'rgb(50 125 255 / <alpha-value>)',
          600: 'rgb(27 92 245 / <alpha-value>)',
          700: 'rgb(22 72 225 / <alpha-value>)',
          800: 'rgb(25 59 182 / <alpha-value>)',
          900: 'rgb(26 55 143 / <alpha-value>)',
        },
        success: {
          500: 'rgb(22 163 74 / <alpha-value>)',
          100: 'rgb(220 252 231 / <alpha-value>)',
        },
        warning: {
          500: 'rgb(217 119 6 / <alpha-value>)',
          100: 'rgb(254 243 199 / <alpha-value>)',
        },
        danger: {
          500: 'rgb(220 38 38 / <alpha-value>)',
          100: 'rgb(254 226 226 / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Vazirmatn',
          'Tahoma',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        lift: '0 4px 12px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
