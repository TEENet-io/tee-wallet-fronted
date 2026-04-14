import { useState } from 'react';
import { Shield, Fingerprint, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingProps {
  onLoginSuccess: () => void;
}

type Mode = 'login' | 'signup';

export default function Onboarding({ onLoginSuccess }: OnboardingProps) {
  const { login, register, loading } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [showHint, setShowHint] = useState(false);

  async function handleRegister() {
    const name = displayName.trim();
    if (!name) {
      setShowHint(true);
      return;
    }
    const ok = await register(name);
    if (ok) {
      // Registration creates a session on the backend already.
      onLoginSuccess();
    }
  }

  async function handleLogin() {
    const ok = await login();
    if (ok) onLoginSuccess();
  }

  function switchTo(next: Mode) {
    setMode(next);
    setShowHint(false);
  }

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
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
                {t('onboarding.nameLabel')} <span className="text-error">*</span>
              </label>
              <input
                className={`w-full bg-surface-container border rounded-xl px-4 py-3 text-on-surface text-sm outline-none transition-colors placeholder:text-outline ${showHint && !displayName.trim() ? 'border-error ring-1 ring-error/30' : 'border-outline-variant/20 focus:border-primary'}`}
                placeholder="alice@example.com"
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); if (e.target.value.trim()) setShowHint(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                disabled={loading}
              />
              {showHint && !displayName.trim() && (
                <p className="text-error text-xs mt-2">{t('onboarding.nameRequired')}</p>
              )}
            </div>
          )}

          {mode === 'login' ? (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-primary text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? t('onboarding.connecting') : t('onboarding.loginWithPasskey')}
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={loading}
              className={`w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm ${!displayName.trim() ? 'bg-outline/30 text-on-surface/40' : 'bg-primary text-white hover:opacity-90'} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              {loading ? t('onboarding.activating') : t('onboarding.registerWithPasskey')}
            </button>
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
