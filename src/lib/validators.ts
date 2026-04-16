// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Shared client-side validators for user-entered blockchain data.
 *
 * These are defense-in-depth checks: the backend re-validates everything.
 * Their purpose is to catch typos and paste accidents before the user is
 * asked to sign with a passkey, not to be authoritative.
 */

/** Matches a 0x-prefixed 20-byte hex EVM address. Case-insensitive. */
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Base58 alphabet used by Solana (Bitcoin alphabet, no 0/O/I/l). */
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Returns true if `value` looks like a valid EVM address. */
export function isEvmAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test(value.trim());
}

/**
 * Returns true if `value` looks like a valid Solana address (base58, 32-44
 * characters). This does not verify the address is a real curve point — the
 * backend performs that check.
 */
export function isSolanaAddress(value: string): boolean {
  return BASE58_RE.test(value.trim());
}

/** Result returned by {@link validateAddress}. */
export type AddressValidationError = 'addressRequired' | 'addressInvalid' | null;

/**
 * Validates an address for the given chain family.
 * Returns a short error tag describing the failure, or `null` if valid.
 */
export function validateAddress(
  value: string,
  family: 'evm' | 'solana' | string | undefined,
): AddressValidationError {
  const trimmed = value.trim();
  if (!trimmed) return 'addressRequired';
  if (family === 'evm') {
    return isEvmAddress(trimmed) ? null : 'addressInvalid';
  }
  if (family === 'solana') {
    return isSolanaAddress(trimmed) ? null : 'addressInvalid';
  }
  // Unknown family — accept anything non-empty and let the backend decide.
  return null;
}

/** Result returned by {@link validateAmount}. */
export type AmountValidationResult =
  | { ok: true; value: string }
  | { ok: false; key: 'amountRequired' | 'amountInvalid' | 'amountTooLarge' };

/**
 * Parses a user-entered decimal amount string.
 *
 * Rules:
 * - Rejects empty, negative, `NaN`, `Infinity`
 * - Rejects values above `max` if provided
 * - Returns the trimmed string on success (preserving user precision) so the
 *   caller can pass the original text to the backend, which uses exact
 *   BigInt / decimal arithmetic
 */
export function validateAmount(value: string, max?: number): AmountValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, key: 'amountRequired' };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, key: 'amountInvalid' };
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return { ok: false, key: 'amountInvalid' };
  if (max !== undefined && num > max) return { ok: false, key: 'amountTooLarge' };
  return { ok: true, value: trimmed };
}
