/**
 * lib/admin/auth.ts
 * Client-side admin auth helpers: token storage, fetch wrapper, auto-logout.
 *
 * Features:
 *   - Token stored in localStorage
 *   - 30-minute inactivity auto-logout
 *   - Activity events reset the inactivity timer
 *   - Authenticated fetch wrapper auto-injects Bearer token
 */

export const TOKEN_KEY       = 'ss_admin_token';
export const LAST_ACTIVE_KEY = 'ss_admin_last_active';
export const INACTIVITY_MS   = 30 * 60 * 1_000; // 30 minutes

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
  touchActivity();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}

export function touchActivity() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
}

export function isLoggedIn(): boolean {
  const tok = getToken();
  if (!tok) return false;

  // Check JWT expiry (client-side only — server always re-verifies)
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    if (payload.exp * 1000 <= Date.now()) {
      clearToken();
      return false;
    }
  } catch {
    clearToken();
    return false;
  }

  // Check inactivity window
  const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) ?? '0', 10);
  if (lastActive > 0 && Date.now() - lastActive > INACTIVITY_MS) {
    clearToken();
    return false;
  }

  return true;
}

/**
 * Call once in the admin layout to start the inactivity watcher.
 * Returns a cleanup function to remove event listeners.
 */
export function startActivityWatcher(onLogout: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  touchActivity();

  const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  const onActivity = () => touchActivity();
  EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

  // Poll every 60 seconds to auto-logout if inactive
  const interval = setInterval(() => {
    if (!isLoggedIn()) {
      clearToken();
      onLogout();
    }
  }, 60_000);

  return () => {
    EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
    clearInterval(interval);
  };
}

/** Authenticated fetch wrapper — auto-injects Bearer token */
export async function adminFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  touchActivity();
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
