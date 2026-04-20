// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useEffect, useMemo, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import { useLanguage } from '../contexts/LanguageContext';
import ChainSelector from '../components/ChainSelector';
import ProgramPanel from '../components/wallet/ProgramPanel';

// Top-level whitelist page. Contract/program allowlists are stored
// per-(user, chain) on the backend, not per-wallet, so surface them at
// the chain level instead of burying them inside each wallet.
//
// The backend API is still /api/wallets/:id/contracts — it uses
// wallet.Chain to scope the query. We pick any wallet belonging to the
// selected chain to satisfy the path parameter.
export default function Whitelist() {
  const { wallets, chainsMap, loadWallets, getChainFamily } = useWallets();
  const { t } = useLanguage();

  useEffect(() => { loadWallets(); }, [loadWallets]);

  // Chains the user actually has wallets on — no point showing a chain
  // the user can't operate on.
  const userChains = useMemo(() => {
    const seen = new Set<string>();
    wallets.forEach(w => seen.add(w.chain));
    return Array.from(seen)
      .map(name => chainsMap[name])
      .filter(Boolean);
  }, [wallets, chainsMap]);

  const userChainsMap = useMemo(() => {
    const map: typeof chainsMap = {};
    userChains.forEach(c => { if (c) map[c.name] = c; });
    return map;
  }, [userChains]);

  const [selectedChain, setSelectedChain] = useState<string>('');
  const effectiveChain = selectedChain || userChains[0]?.name || '';

  // Any wallet on the selected chain works — backend scopes by user+chain.
  const anchorWallet = useMemo(
    () => wallets.find(w => w.chain === effectiveChain),
    [wallets, effectiveChain],
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-on-surface flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-primary" />
            {t('whitelist.title')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('whitelist.subtitle')}
          </p>
        </div>
      </div>

      {userChains.length === 0 ? (
        <div className="rounded-2xl ghost-border bg-surface-container-low p-8 text-center">
          <p className="text-sm text-on-surface-variant">{t('whitelist.empty')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-w-md">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-label">
              {t('wallets.chain')}
            </label>
            <ChainSelector
              chains={userChainsMap}
              value={effectiveChain}
              onChange={setSelectedChain}
            />
          </div>

          {anchorWallet && effectiveChain && (
            <div className="pt-2">
              <ProgramPanel
                walletId={anchorWallet.id}
                chainFamily={getChainFamily(anchorWallet.chain)}
                chainName={anchorWallet.chain}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
