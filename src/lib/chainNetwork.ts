// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

import type { ChainConfig } from '../types';

// Chains the backend doesn't tag mainnet/testnet explicitly, so classify
// by well-known substrings in name/label. Anything not matched is treated
// as mainnet.
const TESTNET_PATTERNS = [
  'testnet', 'test-net', 'devnet', 'dev-net',
  'sepolia', 'goerli', 'holesky', 'ropsten', 'rinkeby',
  'fuji', 'amoy', 'mumbai', 'baobab', 'chapel',
];

export function isTestnetChain(chain: Pick<ChainConfig, 'name' | 'label'>): boolean {
  const haystack = `${chain.name} ${chain.label}`.toLowerCase();
  return TESTNET_PATTERNS.some(p => haystack.includes(p));
}
