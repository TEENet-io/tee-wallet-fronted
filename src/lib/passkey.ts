// Copyright (C) 2026 TEENet
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Helpers for bridging server JSON and the browser WebAuthn API.
 *
 * The server speaks base64url over JSON; `navigator.credentials.{get,create}`
 * speaks `ArrayBuffer` over structured objects. These helpers handle the
 * conversion in both directions.
 */

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Shape of the raw options object as returned by the backend. The backend may
 * wrap the actual options in a `{ publicKey: {...} }` envelope, or return the
 * publicKey object directly.
 */
interface ServerPublicKeyOptions {
  challenge: string | ArrayBuffer;
  user?: { id: string | ArrayBuffer; [k: string]: unknown };
  allowCredentials?: unknown;
  excludeCredentials?: Array<{ id: string | ArrayBuffer; [k: string]: unknown }>;
  authenticatorSelection?: {
    authenticatorAttachment?: AuthenticatorAttachment;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface ServerWebAuthnOptions {
  publicKey?: ServerPublicKeyOptions;
  [k: string]: unknown;
}

/**
 * Normalize WebAuthn options from the server for use with
 * `navigator.credentials.get/create`.
 *
 * - Accepts both wrapped `{ publicKey: {...} }` envelopes and raw objects
 * - Converts base64url `challenge` / `user.id` / `excludeCredentials[].id`
 *   strings into `ArrayBuffer`s
 * - Strips `allowCredentials` so the browser surfaces every registered passkey
 *   rather than filtering to a specific one
 */
export function normalizeOptions(
  raw: unknown,
): { publicKey: PublicKeyCredentialRequestOptions | PublicKeyCredentialCreationOptions } | null {
  if (!raw || typeof raw !== 'object') return null;
  const typed = raw as ServerWebAuthnOptions;
  const options: { publicKey: ServerPublicKeyOptions } = typed.publicKey
    ? { publicKey: typed.publicKey }
    : { publicKey: typed as unknown as ServerPublicKeyOptions };

  const pk = options.publicKey;
  if (typeof pk.challenge === 'string') {
    pk.challenge = base64urlToBuffer(pk.challenge);
  }
  if (pk.user && typeof pk.user.id === 'string') {
    pk.user.id = base64urlToBuffer(pk.user.id);
  }
  // Clear allowCredentials so the browser shows all registered passkeys.
  delete pk.allowCredentials;
  if (Array.isArray(pk.excludeCredentials)) {
    pk.excludeCredentials = pk.excludeCredentials.map(c => ({
      ...c,
      id: typeof c.id === 'string' ? base64urlToBuffer(c.id) : c.id,
    }));
  }

  return options as {
    publicKey: PublicKeyCredentialRequestOptions | PublicKeyCredentialCreationOptions;
  };
}

/**
 * Serialize a `Credential` returned by `navigator.credentials.{get,create}`
 * into a JSON-safe shape the backend can verify. All `ArrayBuffer` fields are
 * encoded as base64url strings.
 */
export function credentialToJSON(cred: Credential): Record<string, unknown> {
  const pk = cred as PublicKeyCredential;
  const base: Record<string, unknown> = {
    id: pk.id,
    type: pk.type,
    rawId: bufferToBase64url(pk.rawId),
  };
  const response = pk.response as
    | (AuthenticatorAttestationResponse & AuthenticatorAssertionResponse)
    | undefined;
  if (response) {
    const resp: Record<string, string> = {};
    if (response.clientDataJSON) {
      resp.clientDataJSON = bufferToBase64url(response.clientDataJSON);
    }
    if (response.attestationObject) {
      resp.attestationObject = bufferToBase64url(response.attestationObject);
    }
    if (response.authenticatorData) {
      resp.authenticatorData = bufferToBase64url(response.authenticatorData);
    }
    if (response.signature) {
      resp.signature = bufferToBase64url(response.signature);
    }
    if (response.userHandle) {
      resp.userHandle = bufferToBase64url(response.userHandle);
    }
    base.response = resp;
  }
  if (pk.authenticatorAttachment) {
    base.authenticatorAttachment = pk.authenticatorAttachment;
  }
  return base;
}
