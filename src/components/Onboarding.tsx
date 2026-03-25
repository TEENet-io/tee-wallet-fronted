import { useState } from 'react';
import { Shield, Key, Fingerprint, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingProps {
  onLoginSuccess: () => void;
}

export default function Onboarding({ onLoginSuccess }: OnboardingProps) {
  const { login, register, loading } = useAuth();

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
    <div className="flex-grow flex items-center justify-center p-4 md:p-8 lg:p-12 z-10 min-h-screen relative overflow-hidden">
      {/* Ambient Background Decals */}
      <div className="fixed top-[-10%] right-[-5%] w-96 h-96 bg-primary-container/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-96 h-96 bg-secondary/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-[1200px] mx-auto space-y-8 lg:space-y-12 relative z-10">
        {/* Brand Identity Section */}
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-surface-container-high mb-2">
            <Shield className="w-10 h-10 md:w-12 md:h-12 text-primary fill-primary/20" />
          </div>
          <h1 className="font-headline font-bold text-4xl md:text-6xl tracking-tighter text-on-surface">
            OpenClaw <span className="text-primary">Wallet</span>
          </h1>
          <p className="text-slate-400 font-body text-base md:text-lg max-w-md mx-auto">
            The autonomous observer for your digital assets. Secure, private, and persistent.
          </p>
        </header>

        {/* Responsive Layout Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Registration Details */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            {/* Display Name Section */}
            <section className="glass-panel p-6 md:p-8 rounded-[2rem] ghost-border glow-primary transition-all hover:border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="font-headline font-bold text-xl text-secondary">Your Identity</h2>
                  <p className="text-slate-500 text-sm">Enter your name or email to register.</p>
                </div>
                <div className="relative flex-grow md:max-w-xs">
                  <input
                    className="w-full bg-surface-container-lowest border-b border-outline-variant/30 text-on-surface p-4 font-body focus:border-secondary focus:ring-0 transition-all outline-none"
                    placeholder="alice@example.com"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Key className="w-5 h-5 text-secondary opacity-50" />
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Right Column: Primary Call to Action */}
          <div className="lg:col-span-5 order-1 lg:order-2 h-full">
            <section className="primary-gradient p-8 md:p-10 rounded-[2rem] shadow-[0_20px_40px_rgba(124,58,237,0.3)] flex flex-col justify-between items-start group overflow-hidden relative h-full min-h-[280px] lg:min-h-full">
              <div className="shimmer absolute inset-0 opacity-20 pointer-events-none"></div>
              <div className="space-y-3 relative z-10">
                <h2 className="font-headline font-bold text-white text-2xl lg:text-3xl">Register with Passkey</h2>
                <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-xs">
                  No passwords. Biometric-grade security powered by hardware enclaves.
                </p>
              </div>
              <div className="mt-10 lg:mt-auto relative z-10 w-full space-y-3">
                <button
                  onClick={handleRegister}
                  disabled={loading || !displayName.trim()}
                  className="w-full bg-white text-primary-container font-bold font-headline py-4 lg:py-5 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:shadow-xl hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  {loading ? 'Activating…' : 'Activate Secure Key'}
                </button>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-white/10 border border-white/20 text-white font-headline font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {loading ? 'Connecting…' : 'Already have an account? Login with Passkey'}
                </button>
              </div>
              {/* Decorative Icon */}
              <Fingerprint className="absolute -bottom-6 -right-6 w-48 h-48 md:w-64 md:h-64 text-white/10 rotate-12 pointer-events-none transition-transform group-hover:rotate-6 duration-700" />
            </section>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="flex flex-col items-center gap-6 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-slate-500 text-[10px] md:text-xs font-label uppercase tracking-[0.2em]">
            <a className="hover:text-secondary transition-colors" href="#">Privacy Protocol</a>
            <span className="hidden md:block w-1 h-1 rounded-full bg-outline-variant"></span>
            <a className="hover:text-secondary transition-colors" href="#">Whitepaper</a>
            <span className="hidden md:block w-1 h-1 rounded-full bg-outline-variant"></span>
            <a className="hover:text-secondary transition-colors" href="#">Terms of Void</a>
          </div>
          <div className="text-slate-600 text-[9px] uppercase tracking-widest opacity-50">
            © 2026 OpenClaw Foundation. All Rights Reserved.
          </div>
        </footer>
      </div>

      {/* Decorative Scanner Lines */}
      <div className="fixed top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-secondary/20 to-transparent pointer-events-none hidden md:block"></div>
      <div className="fixed top-0 right-0 w-1 h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent pointer-events-none hidden md:block"></div>
    </div>
  );
}
