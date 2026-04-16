// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

// Derive the API base path from the current URL so deployments under a
// sub-path (e.g. /instance/<id>/) prefix API requests correctly.
// NOTE: computed here (inside a module script) instead of via an inline
// <script> in index.html, because the server sets a strict CSP
// (script-src 'self') which blocks inline scripts.
const API_BASE = (() => {
  const injected = (window as unknown as { __API_BASE__?: string }).__API_BASE__;
  if (typeof injected === 'string') return injected;
  return window.location.pathname.replace(/\/+$/, '');
})();

let sessionToken = localStorage.getItem('ocw_session') || '';
let csrfToken = localStorage.getItem('ocw_csrf') || '';

export function getSessionToken(): string {
  return sessionToken;
}

export function setSession(token: string, csrf: string): void {
  sessionToken = token;
  csrfToken = csrf;
  localStorage.setItem('ocw_session', token);
  localStorage.setItem('ocw_csrf', csrf);
}

export function clearSession(): void {
  sessionToken = '';
  csrfToken = '';
  localStorage.removeItem('ocw_session');
  localStorage.removeItem('ocw_csrf');
  localStorage.removeItem('ocw_user');
}

export async function api<T = Record<string, unknown>>(
  path: string,
  opts: RequestInit = {},
): Promise<T & { success: boolean; error?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };

  if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    // Only treat 401 as "session expired" when we actually sent a session
    // token. Public endpoints (e.g. email verification) use 401 to mean
    // "wrong credentials for this request" and must surface their own
    // error body instead of being hijacked into the logout flow.
    if (res.status === 401 && sessionToken) {
      clearSession();
      // Force re-render: AuthContext reads from getSessionToken()
      // which is now empty, so isAuthenticated becomes false → shows login
      window.dispatchEvent(new Event('session-expired'));
      return { success: false, error: 'Session expired' } as T & { success: boolean; error: string };
    }
    return await res.json();
  } catch (e) {
    return { success: false, error: (e as Error).message } as T & {
      success: boolean;
      error: string;
    };
  }
}
