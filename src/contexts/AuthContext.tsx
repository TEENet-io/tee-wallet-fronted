import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api, setSession, clearSession, getSessionToken } from '../lib/api';
import { normalizeOptions, credentialToJSON } from '../lib/passkey';
import { useToast } from './ToastContext';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => Promise<boolean>;
  register: (displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  requireReauth: () => Promise<boolean>;
  getFreshPasskeyCredential: () => Promise<Record<string, unknown> | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let reauthExpiry = 0;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('ocw_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!user && !!getSessionToken();

  // ── Login: matches old passkeyLogin() exactly ──
  const login = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: get challenge options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optRes = await api<any>('/api/auth/passkey/options');
      if (!optRes.success) { toast(optRes.error || 'Failed to get challenge', 'error'); return false; }

      // Step 2: prompt passkey - old code: normalizeOptions(optRes.data?.options)
      const credential = await navigator.credentials.get(normalizeOptions(optRes.data?.options));
      if (!credential) { toast('Login cancelled', 'error'); return false; }
      const credJSON = credentialToJSON(credential);

      // Step 3: verify
      const verRes = await api<{
        session_token: string; csrf_token?: string;
        user_id: string; username: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }>('/api/auth/passkey/verify', {
        method: 'POST',
        body: JSON.stringify({
          login_session_id: optRes.data?.login_session_id,
          credential: credJSON,
        }),
      });
      if (!verRes.success) { toast(verRes.error || 'Login failed', 'error'); return false; }

      setSession(verRes.session_token, verRes.csrf_token || '');
      const u = { id: verRes.user_id, username: verRes.username };
      setUser(u);
      localStorage.setItem('ocw_user', JSON.stringify(u));
      toast(`Logged in as ${verRes.username}`, 'success');
      return true;
    } catch (e) {
      toast(`Login error: ${(e as Error).message}`, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ── Register: matches old registerPasskey() exactly ──
  // Old code uses /api/auth/passkey/register/begin, returns { options, invite_token }
  const register = useCallback(async (displayName: string) => {
    setLoading(true);
    try {
      // Step 1: begin registration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beginRes = await api<any>('/api/auth/passkey/register/begin', {
        method: 'POST',
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!beginRes.success) { toast(beginRes.error || 'Failed to start registration', 'error'); return false; }

      // Step 2: prompt passkey creation - old code: normalizeOptions(beginRes.options)
      const credential = await navigator.credentials.create(normalizeOptions(beginRes.options));
      if (!credential) { toast('Registration cancelled', 'error'); return false; }
      const credJSON = credentialToJSON(credential);

      // Step 3: verify - old code sends invite_token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verRes = await api<any>('/api/auth/passkey/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          invite_token: beginRes.invite_token,
          credential: credJSON,
        }),
      });
      if (!verRes.success) { toast(verRes.error || 'Registration failed', 'error'); return false; }

      // Old code doesn't auto-login after register, just shows success and switches to login tab
      toast('Registered! Please log in with your Passkey.', 'success');
      return true;
    } catch (e) {
      toast(`Registration error: ${(e as Error).message}`, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    await api('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    clearSession();
    setUser(null);
    toast('Logged out');
  }, [toast]);

  // Get a fresh passkey credential for sensitive operations
  const getFreshPasskeyCredentialFn = async (): Promise<Record<string, unknown> | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optRes = await api<any>('/api/auth/passkey/options');
      if (!optRes.success) { toast(optRes.error || 'Failed to get challenge', 'error'); return null; }
      const credential = await navigator.credentials.get(normalizeOptions(optRes.data?.options));
      if (!credential) { toast('Verification cancelled', 'error'); return null; }
      const credJSON = credentialToJSON(credential);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verRes = await api<any>('/api/auth/passkey/verify', {
        method: 'POST',
        body: JSON.stringify({ login_session_id: optRes.data?.login_session_id, credential: credJSON }),
      });
      if (!verRes.success) { toast('Verification failed', 'error'); return null; }
      reauthExpiry = Date.now() + 5 * 60 * 1000;
      return { login_session_id: optRes.data?.login_session_id, credential: credJSON };
    } catch (e) {
      toast((e as Error).message || 'Verification failed', 'error');
      return null;
    }
  };

  const deleteAccount = useCallback(async () => {
    try {
      const passkeyBody = await getFreshPasskeyCredentialFn();
      if (!passkeyBody) return false;
      const res = await api('/api/auth/account', { method: 'DELETE', body: JSON.stringify(passkeyBody) });
      if (!res.success) { toast(res.error || 'Delete failed', 'error'); return false; }
      clearSession();
      setUser(null);
      toast('Account deleted', 'success');
      return true;
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'error');
      return false;
    }
  }, [toast]);

  const requireReauth = useCallback(async () => {
    if (Date.now() < reauthExpiry) return true;
    const result = await getFreshPasskeyCredentialFn();
    return !!result;
  }, [toast]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, loading,
      login, register, logout, deleteAccount, requireReauth,
      getFreshPasskeyCredential: getFreshPasskeyCredentialFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
