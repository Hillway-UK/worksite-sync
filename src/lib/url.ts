// src/lib/url.ts
export function getAppBaseUrl() {
  const fromEnv =
    (import.meta as any)?.env?.VITE_PUBLIC_APP_URL ||
    (typeof process !== 'undefined' && (process as any)?.env?.VITE_PUBLIC_APP_URL);
  if (fromEnv) return String(fromEnv).replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
}
