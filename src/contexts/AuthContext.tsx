import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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

// Decode the base64url-encoded clientDataJSON on a credential JSON payload
// and extract the challenge (which is itself a base64url-encoded string the
// authenticator signed). Returns null if anything in the chain is missing.
function extractChallengeFromCredential(credJSON: Record<string, unknown>): string | null {
  try {
    const response = credJSON.response as Record<string, unknown> | undefined;
    const clientDataJSONb64 = response?.clientDataJSON as string | undefined;
    if (!clientDataJSONb64) return null;
    const b64 = clientDataJSONb64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const jsonStr = atob(b64 + pad);
    const parsed = JSON.parse(jsonStr) as { challenge?: string };
    return parsed.challenge ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('ocw_user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  // Abort controller for in-flight passkey ceremonies. A new login() call
  // aborts any previous navigator.credentials.get() so its stale assertion
  // can't leak into the next flow (best-effort; some authenticators ignore
  // the signal).
  const loginAbortRef = useRef<AbortController | null>(null);
  // Rolling window of the last few (login_session_id, challenge) pairs we
  // obtained from /passkey/options. 1Password on Android aggressively
  // caches the first get() result and will happily return an assertion
  // signed with a *previous* challenge long after we've moved on to a new
  // session. Instead of rejecting that assertion we reverse-map its
  // challenge back to the original session_id and submit verify against
  // the matching session — whichever session the authenticator actually
  // signed for gets consumed, not whichever one we just issued.
  type SessionSlot = { sessionId: number; challenge: string; optRes: unknown; ts: number };
  const sessionCacheRef = useRef<SessionSlot[]>([]);
  const SESSION_CACHE_MAX = 5;
  const SESSION_CACHE_TTL_MS = 3 * 60_000; // server-side TTL is longer; this is a local safety net
  const rememberSession = (slot: SessionSlot) => {
    const now = Date.now();
    const fresh = sessionCacheRef.current.filter((s) => now - s.ts < SESSION_CACHE_TTL_MS);
    // Dedupe by sessionId in case the same options response was cached twice.
    const filtered = fresh.filter((s) => s.sessionId !== slot.sessionId);
    filtered.push(slot);
    sessionCacheRef.current = filtered.slice(-SESSION_CACHE_MAX);
  };
  const findSessionByChallenge = (challenge: string): SessionSlot | undefined => {
    const now = Date.now();
    return sessionCacheRef.current.find(
      (s) => s.challenge === challenge && now - s.ts < SESSION_CACHE_TTL_MS,
    );
  };

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
    // Cancel any in-flight login ceremony before starting a new one.
    loginAbortRef.current?.abort();
    const abort = new AbortController();
    loginAbortRef.current = abort;

    setLoading(true);
    try {
      // Step 1: fetch a fresh challenge. Each call generates a new
      // login_session_id server-side; we remember the (id, challenge) pair
      // so we can reverse-lookup below if the authenticator hands us a
      // stale assertion.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optRes = await api<any>('/api/auth/passkey/options');
      if (abort.signal.aborted) return false;
      if (!optRes.success) { toast(optRes.error || 'Failed to get challenge', 'error'); return false; }
      const issuedSessionId: number = optRes.data?.login_session_id;
      const issuedChallenge: string = optRes.data?.options?.publicKey?.challenge;
      if (issuedSessionId && issuedChallenge) {
        rememberSession({ sessionId: issuedSessionId, challenge: issuedChallenge, optRes, ts: Date.now() });
      }

      // Step 2: prompt passkey. AbortSignal is best-effort — 1Password
      // Android is known to ignore it and return an older cached assertion.
      const opts = normalizeOptions(optRes.data?.options);
      if (opts?.publicKey) opts.signal = abort.signal;
      let credential: Credential | null;
      try {
        credential = await navigator.credentials.get(opts);
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError' || abort.signal.aborted) {
          return false;
        }
        throw e;
      }
      if (abort.signal.aborted) return false;
      if (!credential) { toast('Login cancelled', 'error'); return false; }
      const credJSON = credentialToJSON(credential);

      // Step 2.5: reverse-lookup the signed challenge. If the authenticator
      // returned an assertion for a *previous* session (1Password cache),
      // find that session's id in our local rolling cache and verify
      // against it instead of the one we just issued.
      const signedChallenge = extractChallengeFromCredential(credJSON);
      let verifySessionId = issuedSessionId;
      if (signedChallenge && signedChallenge !== issuedChallenge) {
        const match = findSessionByChallenge(signedChallenge);
        if (match) {
          verifySessionId = match.sessionId;
        }
      }

      // Step 3: verify
      const verRes = await api<{
        session_token: string; csrf_token?: string;
        user_id: string; username: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }>('/api/auth/passkey/verify', {
        method: 'POST',
        body: JSON.stringify({
          login_session_id: verifySessionId,
          credential: credJSON,
        }),
      });
      if (abort.signal.aborted) return false;
      if (!verRes.success) { toast(verRes.error || 'Login failed', 'error'); return false; }

      // Session was consumed server-side; drop the matching cache entry.
      sessionCacheRef.current = sessionCacheRef.current.filter((s) => s.sessionId !== verifySessionId);
      setSession(verRes.session_token, verRes.csrf_token || '');
      const u = { id: verRes.user_id, username: verRes.username };
      setUser(u);
      localStorage.setItem('ocw_user', JSON.stringify(u));
      toast(`Logged in as ${verRes.username}`, 'success');
      return true;
    } catch (e) {
      if (abort.signal.aborted) return false;
      toast(`Login error: ${(e as Error).message}`, 'error');
      return false;
    } finally {
      if (loginAbortRef.current === abort) {
        loginAbortRef.current = null;
        setLoading(false);
      }
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

      // Backend issues a session on successful register so we can skip the
      // separate passkey login step. This avoids the Android GPM indexing
      // delay that otherwise makes the first post-register login fail.
      if (verRes.session_token) {
        setSession(verRes.session_token, verRes.csrf_token || '');
        const u = { id: String(verRes.user_id), username: verRes.username };
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
  }, [toast]);

  const logout = useCallback(async () => {
    await api('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    clearSession();
    setUser(null);
    toast('Logged out');
  }, [toast]);

  // Get a fresh passkey credential for sensitive operations.
  // Returns { login_session_id, credential } WITHOUT verifying first —
  // the calling API endpoint (e.g. apikey/generate, account/delete) does
  // its own verify. Uses the same reverse-lookup trick as login(): if the
  // authenticator hands us an assertion for a previously-issued challenge
  // (1Password Android cache bug) we submit verify against that earlier
  // session_id instead of the one we just issued.
  const getFreshPasskeyCredentialFn = async (): Promise<Record<string, unknown> | null> => {
    loginAbortRef.current?.abort();
    const abort = new AbortController();
    loginAbortRef.current = abort;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const optRes = await api<any>('/api/auth/passkey/options');
      if (abort.signal.aborted) return null;
      if (!optRes.success) { toast(optRes.error || 'Failed to get challenge', 'error'); return null; }
      const issuedSessionId: number = optRes.data?.login_session_id;
      const issuedChallenge: string = optRes.data?.options?.publicKey?.challenge;
      if (issuedSessionId && issuedChallenge) {
        rememberSession({ sessionId: issuedSessionId, challenge: issuedChallenge, optRes, ts: Date.now() });
      }
      const opts = normalizeOptions(optRes.data?.options);
      if (opts?.publicKey) opts.signal = abort.signal;
      let credential: Credential | null;
      try {
        credential = await navigator.credentials.get(opts);
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError' || abort.signal.aborted) return null;
        throw e;
      }
      if (abort.signal.aborted) return null;
      if (!credential) { toast('Verification cancelled', 'error'); return null; }
      const credJSON = credentialToJSON(credential);

      // Reverse-lookup the signed challenge against our rolling cache.
      const signedChallenge = extractChallengeFromCredential(credJSON);
      let verifySessionId = issuedSessionId;
      if (signedChallenge && signedChallenge !== issuedChallenge) {
        const match = findSessionByChallenge(signedChallenge);
        if (match) {
          verifySessionId = match.sessionId;
        }
      }
      // NOTE: do NOT evict the session from the cache here — the caller
      // still has to POST verify. Let the success path at the caller or
      // the natural TTL expire it.
      return { login_session_id: verifySessionId, credential: credJSON };
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
