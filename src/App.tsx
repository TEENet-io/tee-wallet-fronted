import { useState, useEffect, useCallback } from 'react';
import { Shield, Wallet, ShieldCheck, Activity, Settings, Sun, Moon, Languages } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { useLanguage } from './contexts/LanguageContext';
import Onboarding from './components/Onboarding';
import WalletList from './pages/WalletList';
import WalletDetail from './pages/WalletDetail';
import ApprovalList from './pages/ApprovalList';
import ApprovalDetail from './components/ApprovalDetail';
import SecuritySettings from './components/SecuritySettings';
import AuditHistory from './pages/AuditHistory';

type View =
  | { page: 'onboarding' }
  | { page: 'wallets' }
  | { page: 'wallet-detail'; walletId: string }
  | { page: 'approvals' }
  | { page: 'approval-detail'; approvalId: string }
  | { page: 'settings' }
  | { page: 'history' };

function viewFromHash(): View | null {
  const match = window.location.hash.match(/^#\/approve\/(.+)$/);
  if (match) return { page: 'approval-detail', approvalId: match[1] };
  return null;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const [view, setView] = useState<View>(() => viewFromHash() || { page: 'wallets' });

  // Listen for hash changes (e.g. back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const v = viewFromHash();
      if (v) setView(v);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Sync hash when navigating
  const setViewWithHash = useCallback((v: View) => {
    if (v.page === 'approval-detail') {
      window.location.hash = `#/approve/${v.approvalId}`;
    } else if (window.location.hash.startsWith('#/approve/')) {
      // Clear approval hash when navigating away
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setView(v);
  }, []);

  if (!isAuthenticated) {
    return <Onboarding onLoginSuccess={() => setView(viewFromHash() || { page: 'wallets' })} />;
  }

  const nav = {
    wallets: () => setViewWithHash({ page: 'wallets' }),
    walletDetail: (id: string) => setViewWithHash({ page: 'wallet-detail', walletId: id }),
    approvals: () => setViewWithHash({ page: 'approvals' }),
    approvalDetail: (id: string) => setViewWithHash({ page: 'approval-detail', approvalId: id }),
    settings: () => setViewWithHash({ page: 'settings' }),
    history: () => setViewWithHash({ page: 'history' }),
  };

  const currentPage = view.page;

  let content;
  switch (view.page) {
    case 'wallets':
      content = <WalletList onSelectWallet={nav.walletDetail} />;
      break;
    case 'wallet-detail':
      content = <WalletDetail walletId={view.walletId} onBack={nav.wallets} />;
      break;
    case 'approvals':
      content = <ApprovalList onSelectApproval={nav.approvalDetail} />;
      break;
    case 'approval-detail':
      content = <ApprovalDetail approvalId={view.approvalId} onBack={nav.approvals} />;
      break;
    case 'settings':
      content = <SecuritySettings onNavigateHome={nav.wallets} />;
      break;
    case 'history':
      content = <AuditHistory />;
      break;
  }

  const isActive = (page: string) => currentPage === page || currentPage.startsWith(page);

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/20 relative">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold text-on-surface tracking-tight font-headline">TWallet</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden md:flex gap-1 items-center mr-2">
            <button onClick={nav.wallets} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('wallet') ? 'text-primary font-semibold bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>{t('nav.wallets')}</button>
            <button onClick={nav.approvals} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive('approval') ? 'text-primary font-semibold bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>{t('nav.approvals')}</button>
            <button onClick={nav.history} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${currentPage === 'history' ? 'text-primary font-semibold bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>{t('nav.activity')}</button>
          </div>

          <button
            onClick={toggleLang}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors"
            title={lang === 'en' ? '切换中文' : 'Switch to English'}
          >
            <Languages className="w-4 h-4 text-on-surface-variant" />
          </button>

          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-on-surface-variant" /> : <Moon className="w-4 h-4 text-on-surface-variant" />}
          </button>

          <button onClick={nav.settings} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors">
            <Settings className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-28 px-4 sm:px-6 max-w-4xl mx-auto">
        {content}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-5 pt-2 bg-surface/80 backdrop-blur-xl border-t border-outline-variant/10">
        <button onClick={nav.wallets} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${isActive('wallet') ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Wallet className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.wallets')}</span>
        </button>
        <button onClick={nav.approvals} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${isActive('approval') ? 'text-primary' : 'text-on-surface-variant'}`}>
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.approvals')}</span>
        </button>
        <button onClick={nav.history} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${currentPage === 'history' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.activity')}</span>
        </button>
        <button onClick={nav.settings} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${currentPage === 'settings' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.settings')}</span>
        </button>
      </nav>
    </div>
  );
}
