import { useState } from 'react';
import { Shield, Wallet, ShieldCheck, Activity, Settings } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
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

export default function App() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<View>({ page: 'wallets' });

  if (!isAuthenticated) {
    return <Onboarding onLoginSuccess={() => setView({ page: 'wallets' })} />;
  }

  const nav = {
    wallets: () => setView({ page: 'wallets' }),
    walletDetail: (id: string) => setView({ page: 'wallet-detail', walletId: id }),
    approvals: () => setView({ page: 'approvals' }),
    approvalDetail: (id: string) => setView({ page: 'approval-detail', approvalId: id }),
    settings: () => setView({ page: 'settings' }),
    history: () => setView({ page: 'history' }),
  };

  const currentPage = view.page;

  // Render content
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
    <div className="min-h-screen bg-surface text-on-surface font-body selection:bg-primary/30 relative">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-[50vw] h-[50vw] bg-primary/5 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[5%] right-[5%] w-[40vw] h-[40vw] bg-secondary/5 blur-[130px] rounded-full"></div>
      </div>

      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#0b1326] shadow-[0_20px_50px_rgba(124,58,237,0.1)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-container flex items-center justify-center">
            <Shield className="w-5 h-5 text-on-primary-container" />
          </div>
          <span className="text-2xl font-black text-primary tracking-tighter font-headline">OpenClaw</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-6 items-center mr-4">
            <button onClick={nav.wallets} className={`font-label text-sm uppercase tracking-widest transition-colors ${isActive('wallet') ? 'text-secondary font-bold' : 'text-slate-400 hover:text-secondary'}`}>Wallets</button>
            <button onClick={nav.approvals} className={`font-label text-sm uppercase tracking-widest transition-colors ${isActive('approval') ? 'text-secondary font-bold' : 'text-slate-400 hover:text-secondary'}`}>Approvals</button>
            <button onClick={nav.history} className={`font-label text-sm uppercase tracking-widest transition-colors ${currentPage === 'history' ? 'text-secondary font-bold' : 'text-slate-400 hover:text-secondary'}`}>Activity</button>
          </div>
          <button onClick={nav.settings} className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center hover:backdrop-blur-xl hover:bg-white/5 transition-all active:scale-95 duration-200">
            <Shield className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {content}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-[#0b1326]/80 backdrop-blur-2xl border-t border-[#ffffff]/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-t-2xl">
        <button onClick={nav.wallets} className={`flex flex-col items-center justify-center transition-colors ${isActive('wallet') ? 'text-white bg-gradient-to-br from-primary-container to-primary rounded-xl px-4 py-1 shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'text-slate-500 opacity-70 hover:text-secondary'}`}>
          <Wallet className="w-6 h-6 mb-1" />
          <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Wallets</span>
        </button>
        <button onClick={nav.approvals} className={`flex flex-col items-center justify-center transition-colors ${isActive('approval') ? 'text-white bg-gradient-to-br from-primary-container to-primary rounded-xl px-4 py-1 shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'text-slate-500 opacity-70 hover:text-secondary'}`}>
          <ShieldCheck className="w-6 h-6 mb-1" />
          <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Approvals</span>
        </button>
        <button onClick={nav.history} className={`flex flex-col items-center justify-center transition-colors ${currentPage === 'history' ? 'text-white bg-gradient-to-br from-primary-container to-primary rounded-xl px-4 py-1 shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'text-slate-500 opacity-70 hover:text-secondary'}`}>
          <Activity className="w-6 h-6 mb-1" />
          <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Activity</span>
        </button>
        <button onClick={nav.settings} className={`flex flex-col items-center justify-center transition-colors ${currentPage === 'settings' ? 'text-white bg-gradient-to-br from-primary-container to-primary rounded-xl px-4 py-1 shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'text-slate-500 opacity-70 hover:text-secondary'}`}>
          <Settings className="w-6 h-6 mb-1" />
          <span className="font-label text-[10px] uppercase tracking-widest font-semibold">Settings</span>
        </button>
      </nav>
    </div>
  );
}
