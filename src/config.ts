const hostname = window.location.hostname;
const isDevelopment = import.meta.env.DEV;
const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

// Default endpoints derived from the current host. These are the fallback used when no
// admin override is configured.
export const API_BASE = (import.meta.env.VITE_API_BASE || (isDevelopment ? `${protocol}//${hostname}:3001` : window.location.origin)).replace(/\/$/, '');
export const WS_BASE = (import.meta.env.VITE_WS_BASE || (isDevelopment ? `${wsProtocol}//${hostname}:3001` : `${wsProtocol}//${window.location.host}`)).replace(/\/$/, '');

// --- Admin-configurable server URL ---
// The server URL is an internal, admin-only setting. Regular users never see or set it: it is
// injected transparently when creating/joining online games. Admins can change it via the
// Config panel (see ConfigModal). The override is persisted in localStorage.
const SERVER_URL_KEY = 'shoguns-ascent-serverUrl';

/** Normalize a user-entered server URL into a ws:// / wss:// URL. */
function toWsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return WS_BASE;
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('https://')) return 'wss://' + trimmed.slice('https://'.length);
  if (trimmed.startsWith('http://')) return 'ws://' + trimmed.slice('http://'.length);
  return 'ws://' + trimmed;
}

/** The WebSocket URL to use for online play (admin override or default). */
export function getServerWsUrl(): string {
  try {
    const override = localStorage.getItem(SERVER_URL_KEY);
    if (override && override.trim()) return toWsUrl(override);
  } catch {
    /* ignore storage errors */
  }
  return WS_BASE;
}

/** The raw configured server URL as the admin entered it (empty string if using default). */
export function getConfiguredServerUrl(): string {
  try {
    return localStorage.getItem(SERVER_URL_KEY) || '';
  } catch {
    return '';
  }
}

/** Persist (or clear) the admin server URL override. */
export function setConfiguredServerUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(SERVER_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(SERVER_URL_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}
