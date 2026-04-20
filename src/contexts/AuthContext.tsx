// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api, setSession, clearSession, getSessionToken } from '../lib/api';
import { normalizeOptions, credentialToJSON } from '../lib/passkey';
import { useToast } from './ToastContext';
import type { User } from '../types';

/** Challenge options + session id returned by the server for passkey flows. */
interface PasskeyOptionsResponse {
  data?: {
    options?: unknown;
    login_session_id?: string;
  };
}

/** Verify response for `/api/auth/passkey/verify`. */
interface PasskeyVerifyResponse {
  session_token: string;
  csrf_token?: string;
  user_id: string;
  username: string;
}

/** Begin response for `/api/auth/passkey/register/begin`. */
interface RegisterBeginResponse {
  options?: unknown;
  invite_token?: string;
}

/**
 * Verify response for `/api/auth/passkey/register/verify`. The backend
 * issues a session on successful register so the frontend can drop the
 * user straight into the wallet without a separate passkey login.
 */
interface RegisterVerifyResponse {
  session_token?: string;
  csrf_token?: string;
  user_id?: string;
  username?: string;
}

/** Response for `/api/auth/email/send-code`. */
interface EmailSendCodeResponse {
  resend_cooldown?: number;
}

/** Response for `/api/auth/email/verify-code`. */
interface EmailVerifyCodeResponse {
  verification_id?: string;
}

/** Body returned by `getFreshPasskeyCredential` for sensitive endpoints. */
export interface PasskeyCredentialBody {
  login_session_id: string | undefined;
  credential: Record<string, unknown>;
}

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
  getFreshPasskeyCredential: () => Promise<PasskeyCredentialBody | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Upstream stubbed a reauth-cache window but never wired the update side.
// Leaving it `const` so every `requireReauth` call actually prompts for a
// fresh passkey assertion, which is the safer default for a wallet frontend.
const reauthExpiry = 0;

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('ocw_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && 'id' in parsed && 'username' in parsed) {
      return parsed as User;
    }
  } catch {
    /* ignore malformed storage */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!user && !!getSessionToken();

  // Listen for session expiry from api.ts (401 response).
  useEffect(() => {
    const handler = () => {
      setUser(null);
      toast('Session expired. Please log in again.', 'error');
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, [toast]);

  /**
   * Gets a fresh passkey assertion for sensitive operations (delete account,
   * delete wallet, generate API key, etc.). The returned body is forwarded
   * verbatim to the calling endpoint, which performs the server-side verify.
   */
  const getFreshPasskeyCredentialFn = useCallback(
    async (): Promise<PasskeyCredentialBody | null> => {
      try {
        const optRes = await api<PasskeyOptionsResponse>('/api/auth/passkey/options');
        if (!optRes.success) {
          toast(optRes.error ?? 'Failed to get challenge', 'error');
          return null;
        }
        const credential = await navigator.credentials.get(
          normalizeOptions(optRes.data?.options) as CredentialRequestOptions,
        );
        if (!credential) {
          toast('Verification cancelled', 'error');
          return null;
        }
        return {
          login_session_id: optRes.data?.login_session_id,
          credential: credentialToJSON(credential),
        };
      } catch (e) {
        toast((e as Error).message || 'Verification failed', 'error');
        return null;
      }
    },
    [toast],
  );

  const login = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const optRes = await api<PasskeyOptionsResponse>('/api/auth/passkey/options');
      if (!optRes.success) {
        toast(optRes.error ?? 'Failed to get challenge', 'error');
        return false;
      }

      const credential = await navigator.credentials.get(
        normalizeOptions(optRes.data?.options) as CredentialRequestOptions,
      );
      if (!credential) {
        toast('Login cancelled', 'error');
        return false;
      }
      const credJSON = credentialToJSON(credential);

      const verRes = await api<PasskeyVerifyResponse>('/api/auth/passkey/verify', {
        method: 'POST',
        body: JSON.stringify({
          login_session_id: optRes.data?.login_session_id,
          credential: credJSON,
        }),
      });
      if (!verRes.success) {
        toast(verRes.error ?? 'Login failed', 'error');
        return false;
      }

      setSession(verRes.session_token, verRes.csrf_token ?? '');
      const u: User = { id: verRes.user_id, username: verRes.username };
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

  const sendEmailCode = useCallback(
    async (email: string): Promise<number | null> => {
      setLoading(true);
      try {
        const res = await api<EmailSendCodeResponse>('/api/auth/email/send-code', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        if (!res.success) {
          toast(res.error ?? 'Failed to send code', 'error');
          return null;
        }
        toast('Verification code sent. Check your inbox.', 'success');
        // Backend tells us how many seconds the user must wait before
        // requesting another code. Fall back to 60 if the field is missing.
        return typeof res.resend_cooldown === 'number' ? res.resend_cooldown : 60;
      } catch (e) {
        toast(`Send code error: ${(e as Error).message}`, 'error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string): Promise<string | null> => {
      setLoading(true);
      try {
        const res = await api<EmailVerifyCodeResponse>('/api/auth/email/verify-code', {
          method: 'POST',
          body: JSON.stringify({ email, code }),
        });
        if (!res.success || !res.verification_id) {
          toast(res.error ?? 'Invalid code', 'error');
          return null;
        }
        return res.verification_id;
      } catch (e) {
        toast(`Verify code error: ${(e as Error).message}`, 'error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const register = useCallback(
    async (_email: string, _code: string, verificationId: string): Promise<boolean> => {
      setLoading(true);
      try {
        const beginRes = await api<RegisterBeginResponse>(
          '/api/auth/passkey/register/begin',
          {
            method: 'POST',
            body: JSON.stringify({ verification_id: verificationId }),
          },
        );
        if (!beginRes.success) {
          toast(beginRes.error ?? 'Failed to start registration', 'error');
          return false;
        }

        // Detect platform authenticator and pick the right attachment mode.
        // Older browsers lack `isUserVerifyingPlatformAuthenticatorAvailable`;
        // treat "unknown" as cross-platform (QR / roaming).
        let hasPlatform = false;
        if (
          typeof PublicKeyCredential !== 'undefined' &&
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ) {
          try {
            hasPlatform =
              await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          } catch {
            hasPlatform = false;
          }
        }

        const opts = normalizeOptions(beginRes.options) as CredentialCreationOptions & {
          publicKey?: PublicKeyCredentialCreationOptions;
        };
        if (opts.publicKey?.authenticatorSelection) {
          opts.publicKey.authenticatorSelection.authenticatorAttachment = hasPlatform
            ? 'platform'
            : 'cross-platform';
        }

        const credential = await navigator.credentials.create(opts);
        if (!credential) {
          toast('Registration cancelled', 'error');
          return false;
        }
        const credJSON = credentialToJSON(credential);

        const verRes = await api<RegisterVerifyResponse>(
          '/api/auth/passkey/register/verify',
          {
            method: 'POST',
            body: JSON.stringify({
              invite_token: beginRes.invite_token,
              credential: credJSON,
              verification_id: verificationId,
            }),
          },
        );
        if (!verRes.success) {
          toast(verRes.error ?? 'Registration failed', 'error');
          return false;
        }

        // Auto-login: consume the session issued by the backend so the
        // user skips a separate passkey login right after register. On
        // Android, Google Password Manager has a 1-3s indexing delay
        // after credential creation that otherwise makes the first
        // discoverable login return empty.
        if (verRes.session_token && verRes.user_id && verRes.username) {
          setSession(verRes.session_token, verRes.csrf_token ?? '');
          const u: User = { id: String(verRes.user_id), username: verRes.username };
          setUser(u);
          localStorage.setItem('ocw_user', JSON.stringify(u));
          toast(`Welcome, ${verRes.username}`, 'success');
        } else {
          toast('Registered! Please log in with your Passkey.', 'success');
        }
        return true;
      } catch (e) {
        toast(`Registration error: ${(e as Error).message}`, 'error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const logout = useCallback(async () => {
    await api('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    clearSession();
    setUser(null);
    toast('Logged out');
  }, [toast]);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    try {
      const passkeyBody = await getFreshPasskeyCredentialFn();
      if (!passkeyBody) return false;
      const res = await api('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify(passkeyBody),
      });
      if (!res.success) {
        toast(res.error ?? 'Delete failed', 'error');
        return false;
      }
      clearSession();
      setUser(null);
      toast('Account deleted', 'success');
      return true;
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'error');
      return false;
    }
  }, [toast, getFreshPasskeyCredentialFn]);

  const requireReauth = useCallback(async (): Promise<boolean> => {
    if (Date.now() < reauthExpiry) return true;
    const result = await getFreshPasskeyCredentialFn();
    return !!result;
  }, [getFreshPasskeyCredentialFn]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        sendEmailCode,
        verifyEmailCode,
        logout,
        deleteAccount,
        requireReauth,
        getFreshPasskeyCredential: getFreshPasskeyCredentialFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
