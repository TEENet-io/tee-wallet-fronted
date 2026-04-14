import { useEffect, useState } from 'react';
import { Shield, Fingerprint, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingProps {
  onLoginSuccess: () => void;
}

type Mode = 'login' | 'signup';

export default function Onboarding({ onLoginSuccess }: OnboardingProps) {
  const { login, register, sendEmailCode, verifyEmailCode, loading } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Tick the resend cooldown down every second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function switchTo(next: Mode) {
    setMode(next);
    setShowHint(false);
    if (next === 'signup') {
      setEmail('');
      setCode('');
      setCodeSent(false);
      setCooldown(0);
    }
  }

  async function handleSendCode() {
    const e = email.trim();
    if (!e) { setShowHint(true); return; }
    const cd = await sendEmailCode(e);
    if (cd !== null) {
      setCodeSent(true);
      setCooldown(cd);
    }
  }

  async function handleCreateAccount() {
    if (code.length !== 6) { setShowHint(true); return; }
    const vid = await verifyEmailCode(email.trim(), code);
    if (!vid) return;
    const ok = await register(email.trim(), code, vid);
    if (ok) {
      // Backend creates the user but does NOT sign them in — bounce to login.
      switchTo('login');
    }
  }

  async function handleLogin() {
    const ok = await login();
    if (ok) onLoginSuccess();
  }

  const emailValid = email.trim().length > 0;
  const canCreate = codeSent && code.length === 6 && emailValid;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-high">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-headline font-semibold text-2xl text-on-surface tracking-tight">
            {t('onboarding.appName')}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {t('onboarding.appTagline')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-container-low rounded-2xl ghost-border p-6 space-y-5">
          {mode === 'login' && (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-primary text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? t('onboarding.connecting') : t('onboarding.loginWithPasskey')}
            </button>
          )}

          {mode === 'signup' && (
            <>
              {/* Email + inline Send code */}
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
                  Email <span className="text-error">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    className={`flex-1 min-w-0 bg-surface-container border rounded-xl px-4 py-3 text-on-surface text-sm outline-none transition-colors placeholder:text-outline ${showHint && !emailValid ? 'border-error ring-1 ring-error/30' : 'border-outline-variant/20 focus:border-primary'}`}
                    placeholder="alice@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setCodeSent(false);
                      setCooldown(0);
                      if (e.target.value.trim()) setShowHint(false);
                    }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || !emailValid || cooldown > 0}
                    className={`shrink-0 px-3 rounded-xl text-xs font-medium transition-all active:scale-[0.98] ${!emailValid || cooldown > 0 ? 'bg-outline/30 text-on-surface/40 cursor-not-allowed' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : cooldown > 0
                        ? `Resend (${cooldown}s)`
                        : codeSent
                          ? 'Resend'
                          : 'Send code'}
                  </button>
                </div>
                {showHint && !emailValid && (
                  <p className="text-error text-xs mt-2">Email is required</p>
                )}
                {codeSent && (
                  <p className="text-on-surface-variant text-xs mt-2">
                    Code sent to <strong>{email}</strong>. Check your inbox.
                  </p>
                )}
              </div>

              {/* Verification code */}
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
                  Verification code <span className="text-error">*</span>
                </label>
                <input
                  className={`w-full bg-surface-container border rounded-xl px-4 py-3 text-on-surface text-sm outline-none transition-colors placeholder:text-outline tracking-widest ${showHint && code.length !== 6 ? 'border-error ring-1 ring-error/30' : 'border-outline-variant/20 focus:border-primary'} ${!codeSent ? 'opacity-50' : ''}`}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (e.target.value) setShowHint(false); }}
                  disabled={loading || !codeSent}
                />
              </div>

              <button
                onClick={handleCreateAccount}
                disabled={loading || !canCreate}
                className={`w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm ${!canCreate ? 'bg-outline/30 text-on-surface/40 cursor-not-allowed' : 'bg-primary text-white hover:opacity-90'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                {loading ? t('onboarding.activating') : t('onboarding.registerWithPasskey')}
              </button>
            </>
          )}

          <p className="text-center text-xs text-on-surface-variant">
            {mode === 'login' ? (
              <>
                {t('onboarding.noAccount')}{' '}
                <button
                  type="button"
                  onClick={() => switchTo('signup')}
                  className="text-primary font-semibold hover:underline"
                >
                  {t('onboarding.signUp')}
                </button>
              </>
            ) : (
              <>
                {t('onboarding.haveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => switchTo('login')}
                  className="text-primary font-semibold hover:underline"
                >
                  {t('onboarding.logIn')}
                </button>
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-on-surface-variant">
          {t('onboarding.securedBy')}
        </p>
      </div>
    </div>
  );
}
