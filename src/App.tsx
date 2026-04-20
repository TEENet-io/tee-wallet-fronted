// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';
import { Shield, Wallet, ShieldCheck, Activity, Settings, Sun, Moon, Languages, KeyRound, BookUser, FileCode2 } from 'lucide-react';
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
import AddressBook from './components/AddressBook';
import Whitelist from './pages/Whitelist';

type View =
  | { page: 'onboarding' }
  | { page: 'wallets' }
  | { page: 'wallet-detail'; walletId: string }
  | { page: 'approvals' }
  | { page: 'approval-detail'; approvalId: string }
  | { page: 'settings' }
  | { page: 'api-keys' }
  | { page: 'address-book' }
  | { page: 'whitelist' }
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
    apiKeys: () => setViewWithHash({ page: 'api-keys' }),
    addressBook: () => setViewWithHash({ page: 'address-book' }),
    whitelist: () => setViewWithHash({ page: 'whitelist' }),
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
    case 'api-keys':
      // API keys currently live inside the SecuritySettings page.
      content = <SecuritySettings onNavigateHome={nav.wallets} />;
      break;
    case 'address-book':
      content = <AddressBook onBack={nav.wallets} />;
      break;
    case 'whitelist':
      content = <Whitelist />;
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
          <span className="text-lg font-semibold text-on-surface tracking-tight font-headline">TEENet Wallet</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={toggleLang}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors"
            title={lang === 'en' ? '切换中文' : 'Switch to English'}
          >
            <Languages className="w-4 h-4 text-on-surface-variant" />
          </button>

          <button type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-on-surface-variant" /> : <Moon className="w-4 h-4 text-on-surface-variant" />}
          </button>

          <button type="button" onClick={nav.settings} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors">
            <Settings className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 flex-col gap-1 px-3 py-6 border-r border-outline-variant/10 bg-surface/60 backdrop-blur-xl z-40">
        {[
          { key: 'wallet', onClick: nav.wallets, icon: Wallet, label: t('nav.wallets'), active: isActive('wallet') },
          { key: 'approval', onClick: nav.approvals, icon: ShieldCheck, label: t('nav.approvals'), active: isActive('approval') },
          { key: 'whitelist', onClick: nav.whitelist, icon: FileCode2, label: t('nav.whitelist'), active: currentPage === 'whitelist' },
          { key: 'history', onClick: nav.history, icon: Activity, label: t('nav.activity'), active: currentPage === 'history' },
          { key: 'api-keys', onClick: nav.apiKeys, icon: KeyRound, label: t('nav.apiKeys'), active: currentPage === 'api-keys' || currentPage === 'settings' },
          { key: 'address-book', onClick: nav.addressBook, icon: BookUser, label: t('nav.addressBook'), active: currentPage === 'address-book' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${item.active ? 'text-primary font-semibold bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Main Content */}
      <main className="pt-20 pb-28 px-4 sm:px-6 md:pl-64 md:pr-6 max-w-4xl md:max-w-none md:mr-0 mx-auto md:mx-0 md:w-auto">
        <div className="md:max-w-4xl md:mx-auto">
          {content}
        </div>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-5 pt-2 bg-surface/80 backdrop-blur-xl border-t border-outline-variant/10">
        <button type="button" onClick={nav.wallets} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${isActive('wallet') ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Wallet className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.wallets')}</span>
        </button>
        <button type="button" onClick={nav.approvals} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${isActive('approval') ? 'text-primary' : 'text-on-surface-variant'}`}>
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.approvals')}</span>
        </button>
        <button type="button" onClick={nav.history} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${currentPage === 'history' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.activity')}</span>
        </button>
        <button type="button" onClick={nav.settings} className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${currentPage === 'settings' ? 'text-primary' : 'text-on-surface-variant'}`}>
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">{t('nav.settings')}</span>
        </button>
      </nav>
    </div>
  );
}
