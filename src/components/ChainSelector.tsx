import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { ChainConfig } from '../types';
import { isTestnetChain } from '../lib/chainNetwork';

interface ChainSelectorProps {
  chains: Record<string, ChainConfig>;
  value: string;
  onChange: (chain: string) => void;
  network?: 'mainnet' | 'testnet';
}

export default function ChainSelector({ chains, value, onChange, network }: ChainSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const chainList = Object.values(chains).filter(c => {
    if (!network) return true;
    const testnet = isTestnetChain(c);
    return network === 'testnet' ? testnet : !testnet;
  });
  const filtered = chainList.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const evmChains = filtered.filter(c => c.family === 'evm');
  const solanaChains = filtered.filter(c => c.family === 'solana');
  const selected = chains[value];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-lowest border transition-all text-left ${
          open
            ? 'border-primary shadow-[0_0_0_3px_rgba(124,58,237,0.15)]'
            : 'border-outline-variant/20 hover:border-primary/50'
        }`}
      >
        <span className="text-lg">{selected ? (selected.family === 'evm' ? '⬡' : '◎') : '⬡'}</span>
        <span className="flex-1 text-on-surface text-sm">
          {selected ? selected.label : 'Select a chain...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-outline transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-container border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-outline-variant/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chains..."
                className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {evmChains.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-outline uppercase tracking-widest">
                  EVM Chains
                </div>
                {evmChains.map(c => (
                  <button
                    key={c.name}
                    onClick={() => { onChange(c.name); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-high transition-colors ${
                      value === c.name ? 'bg-primary/10 text-primary' : 'text-on-surface'
                    }`}
                  >
                    <span>⬡</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.label}</div>
                      <div className="text-xs text-outline">{c.currency}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
            {solanaChains.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-outline uppercase tracking-widest">
                  Solana
                </div>
                {solanaChains.map(c => (
                  <button
                    key={c.name}
                    onClick={() => { onChange(c.name); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-high transition-colors ${
                      value === c.name ? 'bg-primary/10 text-primary' : 'text-on-surface'
                    }`}
                  >
                    <span>◎</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.label}</div>
                      <div className="text-xs text-outline">{c.currency}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-outline">No chains found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
