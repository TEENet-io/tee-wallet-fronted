// Read the base path captured in index.html before React Router changed the URL.
const API_BASE = (window as any).__API_BASE__ ?? '';

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
    return await res.json();
  } catch (e) {
    return { success: false, error: (e as Error).message } as T & {
      success: boolean;
      error: string;
    };
  }
}
