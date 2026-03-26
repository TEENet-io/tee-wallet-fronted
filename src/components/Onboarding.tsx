import { useState } from 'react';
import { Shield, Fingerprint, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface OnboardingProps {
  onLoginSuccess: () => void;
}

export default function Onboarding({ onLoginSuccess }: OnboardingProps) {
  const { login, register, loading } = useAuth();
  const { t } = useLanguage();

  const [displayName, setDisplayName] = useState('');
  const [registered, setRegistered] = useState(false);

  async function handleRegister() {
    const name = displayName.trim();
    if (!name) return;
    const ok = await register(name);
    if (ok) setRegistered(true);
  }

  async function handleLogin() {
    const ok = await login();
    if (ok) onLoginSuccess();
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

        {/* Register Card */}
        <div className="bg-surface-container-low rounded-2xl ghost-border p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-on-surface-variant">{t('onboarding.nameLabel')}</label>
            <input
              className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-3 text-on-surface text-sm outline-none focus:border-primary transition-colors placeholder:text-outline"
              placeholder="alice@example.com"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || !displayName.trim()}
            className="w-full bg-primary text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
            {loading ? t('onboarding.activating') : t('onboarding.registerPasskey')}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/15" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-surface-container-low text-on-surface-variant">{t('onboarding.or')}</span>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-surface-container-high text-on-surface font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-surface-container-highest active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? t('onboarding.connecting') : t('onboarding.signInPasskey')}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-on-surface-variant">
          {t('onboarding.securedBy')}
        </p>
      </div>
    </div>
  );
}
