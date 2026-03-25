import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import type { Wallet, ChainConfig } from '../types';

interface WalletContextValue {
  wallets: Wallet[];
  chainsMap: Record<string, ChainConfig>;
  balances: Record<string, string>;
  loading: boolean;
  loadWallets: () => Promise<void>;
  createWallet: (chain: string, label: string) => Promise<Wallet | null>;
  deleteWallet: (id: string) => Promise<boolean>;
  refreshBalance: (id: string) => Promise<void>;
  getChainFamily: (chain: string) => 'evm' | 'solana';
  getChainCurrency: (chain: string) => string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [chainsMap, setChainsMap] = useState<Record<string, ChainConfig>>({});
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadChains = useCallback(async () => {
    const res = await api<{ chains?: ChainConfig[] }>('/api/chains');
    if (res.success && res.chains) {
      const map: Record<string, ChainConfig> = {};
      res.chains.forEach(c => { map[c.name] = c; });
      setChainsMap(map);
    }
  }, []);

  const refreshBalance = useCallback(async (id: string) => {
    const res = await api<{ balance?: string }>(`/api/wallets/${id}/balance`);
    if (res.success && res.balance !== undefined) {
      setBalances(prev => ({ ...prev, [id]: res.balance! }));
    }
  }, []);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ wallets?: Wallet[] }>('/api/wallets');
      if (res.success && res.wallets) {
        setWallets(res.wallets);
        // Load balances in background
        res.wallets.filter(w => w.status === 'ready').forEach(w => refreshBalance(w.id));
      } else {
        toast(res.error || 'Failed to load wallets', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [toast, refreshBalance]);

  const createWallet = useCallback(async (chain: string, label: string): Promise<Wallet | null> => {
    const res = await api<{ wallet?: Wallet }>('/api/wallets', {
      method: 'POST',
      body: JSON.stringify({ chain, label: label || `${chain} wallet` }),
    });
    if (res.success && res.wallet) {
      toast('Wallet created!', 'success');
      await loadWallets();
      return res.wallet;
    }
    toast(res.error || 'Create failed', 'error');
    return null;
  }, [toast, loadWallets]);

  const deleteWallet = useCallback(async (id: string): Promise<boolean> => {
    const res = await api(`/api/wallets/${id}`, { method: 'DELETE' });
    if (res.success) {
      toast('Wallet deleted', 'success');
      await loadWallets();
      return true;
    }
    toast(res.error || 'Delete failed', 'error');
    return false;
  }, [toast, loadWallets]);

  const getChainFamily = useCallback((chain: string): 'evm' | 'solana' => {
    const cfg = chainsMap[chain];
    if (cfg?.family) return cfg.family;
    return chain.includes('solana') ? 'solana' : 'evm';
  }, [chainsMap]);

  const getChainCurrency = useCallback((chain: string): string => {
    const cfg = chainsMap[chain];
    if (cfg?.currency) return cfg.currency;
    return chain === 'ethereum' ? 'ETH' : chain === 'solana' ? 'SOL' : chain.toUpperCase();
  }, [chainsMap]);

  useEffect(() => {
    if (isAuthenticated) {
      loadChains();
      loadWallets();
    }
  }, [isAuthenticated, loadChains, loadWallets]);

  return (
    <WalletContext.Provider value={{
      wallets, chainsMap, balances, loading,
      loadWallets, createWallet, deleteWallet, refreshBalance,
      getChainFamily, getChainCurrency,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallets() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallets must be used within WalletProvider');
  return ctx;
}
