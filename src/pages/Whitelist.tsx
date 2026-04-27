// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import { useMemo, useState } from 'react';
import { FileCode2 } from 'lucide-react';
import { useWallets } from '../contexts/WalletContext';
import { useLanguage } from '../contexts/LanguageContext';
import ChainSelector from '../components/ChainSelector';
import ProgramPanel from '../components/wallet/ProgramPanel';

// Top-level whitelist page. Contract/program allowlists are stored
// per-(user, chain) on the backend — independent of wallets — so the
// page lets users manage them on any configured chain whether or not a
// wallet exists yet.
export default function Whitelist() {
  const { chainsMap, getChainFamily } = useWallets();
  const { t } = useLanguage();

  const allChains = useMemo(
    () => Object.values(chainsMap).filter(Boolean),
    [chainsMap],
  );

  const [selectedChain, setSelectedChain] = useState<string>('');
  const effectiveChain = selectedChain || allChains[0]?.name || '';

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

      {allChains.length === 0 ? (
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
              chains={chainsMap}
              value={effectiveChain}
              onChange={setSelectedChain}
            />
          </div>

          {effectiveChain && (
            <div className="pt-2">
              <ProgramPanel
                chainFamily={getChainFamily(effectiveChain)}
                chainName={effectiveChain}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
