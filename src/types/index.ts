export interface User {
  id: string;
  username: string;
}

export interface ChainConfig {
  name: string;
  label: string;
  family: 'evm' | 'solana';
  currency: string;
  chain_id?: number;
  rpc_url?: string;
  icon?: string;
  is_custom?: boolean;
}

export interface Wallet {
  id: string;
  chain: string;
  label: string;
  address: string;
  public_key: string;
  status: 'ready' | 'creating' | 'error';
  created_at: string;
}

export interface AllowedContract {
  id: number;
  wallet_id: string;
  contract_address: string;
  label: string;
  symbol?: string;
  decimals?: number;
  created_at?: string;
}

export interface DailySpent {
  daily_spent_usd: string;
  daily_limit_usd: string;
  remaining_usd: string;
  reset_at: string;
}

export interface WalletPolicy {
  id?: number;
  wallet_id: string;
  threshold_usd: string;
  daily_limit_usd?: string;
  daily_spent_usd?: string;
  enabled?: boolean;
  created_at?: string;
}

export interface Approval {
  id: string;
  wallet_id: string;
  action: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  amount?: string;
  currency?: string;
  to_address?: string;
  memo?: string;
  agent_name?: string;
  agent_intent?: string;
  risk_level?: 'low' | 'mid' | 'high';
  risk_details?: string[];
  destination_label?: string;
  destination_address?: string;
  network_fee?: string;
  expires_at?: string;
  created_at: string;
  tx_hash?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details?: string;
  auth_mode?: string;
  status?: string;
  wallet_id?: string;
  ip?: string;
  created_at: string;
}

export interface APIKey {
  id: string;
  prefix: string;
  label?: string;
  created_at: string;
  status?: 'active' | 'revoked';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
  [key: string]: unknown;
}
