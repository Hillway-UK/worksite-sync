// src/lib/url.ts
export const AUTOTIME_BASE_URL = 'https://autotime.hillwayco.uk';

export function getAppBaseUrl() {
  return AUTOTIME_BASE_URL.replace(/\/+$/, '');
}
