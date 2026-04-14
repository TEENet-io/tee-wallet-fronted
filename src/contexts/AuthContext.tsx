import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setSession, clearSession, getSessionToken } from '../lib/api';
import { normalizeOptions, credentialToJSON } from '../lib/passkey';
import { useToast } from './ToastContext';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => Promise<boolean>;
  register: (email: string, code: string, verificationId: string) => Promise<boolean>;
  sendEmailCode: (email: string) => Promise<number | null>;
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
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

  // Listen for session expiry from api.ts (401 response)
  useEffect(() => {
    const handler = () => {
      setUser(null);
      toast('Session expired. Please log in again.', 'error');
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [toast]);

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

  const sendEmailCode = useCallback(async (email: string): Promise<number | null> => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api<any>('/api/auth/email/send-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (!res.success) {
        toast(res.error || 'Failed to send code', 'error');
        return null;
      }
      toast('Verification code sent. Check your inbox.', 'success');
      // Backend tells us how many seconds the user must wait before
      // requesting another code. Fall back to 60 if the field is missing.
      const cooldown = typeof res.resend_cooldown === 'number' ? res.resend_cooldown : 60;
      return cooldown;
    } catch (e) {
      toast(`Send code error: ${(e as Error).message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api<any>('/api/auth/email/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (!res.success) {
        toast(res.error || 'Invalid code', 'error');
        return null;
      }
      return res.verification_id as string;
    } catch (e) {
      toast(`Verify code error: ${(e as Error).message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ── Register: three-step flow with email verification ──
  const register = useCallback(async (_email: string, _code: string, verificationId: string) => {
    setLoading(true);
    try {
      // Step 1: begin registration with verification_id (no display_name).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beginRes = await api<any>('/api/auth/passkey/register/begin', {
        method: 'POST',
        body: JSON.stringify({ verification_id: verificationId }),
      });
      if (!beginRes.success) { toast(beginRes.error || 'Failed to start registration', 'error'); return false; }

      // Step 2: detect platform authenticator.
      const hasPlatform = typeof PublicKeyCredential !== 'undefined'
        && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : false;
      const opts = normalizeOptions(beginRes.options);
      if (opts?.publicKey?.authenticatorSelection) {
        opts.publicKey.authenticatorSelection.authenticatorAttachment = hasPlatform ? 'platform' : 'cross-platform';
      }

      const credential = await navigator.credentials.create(opts);
      if (!credential) { toast('Registration cancelled', 'error'); return false; }
      const credJSON = credentialToJSON(credential);

      // Step 3: verify with verification_id (consumes the code).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verRes = await api<any>('/api/auth/passkey/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          invite_token: beginRes.invite_token,
          credential: credJSON,
          verification_id: verificationId,
        }),
      });
      if (!verRes.success) { toast(verRes.error || 'Registration failed', 'error'); return false; }

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

  // Get a fresh passkey credential for sensitive operations.
  // Returns { login_session_id, credential } WITHOUT verifying first —
  // the calling API endpoint (e.g. apikey/generate, account/delete) does its own verify.
  const getFreshPasskeyCredentialFn = async (): Promise<Record<string, unknown> | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optRes = await api<any>('/api/auth/passkey/options');
      if (!optRes.success) { toast(optRes.error || 'Failed to get challenge', 'error'); return null; }
      const credential = await navigator.credentials.get(normalizeOptions(optRes.data?.options));
      if (!credential) { toast('Verification cancelled', 'error'); return null; }
      const credJSON = credentialToJSON(credential);
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
      login, register, sendEmailCode, verifyEmailCode, logout, deleteAccount, requireReauth,
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
