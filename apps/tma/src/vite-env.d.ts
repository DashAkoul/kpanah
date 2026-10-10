/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** آدرس پایه API (Worker) — در production مقدار دهید */
  readonly VITE_API_BASE?: string;
  /** مسیر مبهم‌سازی‌شده دروازه */
  readonly VITE_GATE_PATH?: string;
  /** فعال‌سازی داده mock در پیش‌نمایش */
  readonly VITE_ENABLE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
