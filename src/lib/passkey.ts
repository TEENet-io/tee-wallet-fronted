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
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Normalize WebAuthn options from the server.
 * Matches the old index_old.html logic exactly:
 * - Handles both wrapped { publicKey: {...} } and raw objects
 * - Converts base64url strings to ArrayBuffers
 * - Deletes allowCredentials so browser shows all registered passkeys
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOptions(raw: any): any {
  if (!raw) return raw;
  const options = raw.publicKey ? raw : { publicKey: raw };
  const pk = options.publicKey;
  if (typeof pk.challenge === 'string') pk.challenge = base64urlToBuffer(pk.challenge);
  if (typeof pk.user?.id === 'string') pk.user.id = base64urlToBuffer(pk.user.id);
  // Clear allowCredentials so the browser shows all registered passkeys
  delete pk.allowCredentials;
  if (Array.isArray(pk.excludeCredentials)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pk.excludeCredentials = pk.excludeCredentials.map((c: any) => ({
      ...c,
      id: typeof c.id === 'string' ? base64urlToBuffer(c.id) : c.id,
    }));
  }
  return options;
}

/**
 * Serialize a credential to JSON for sending to the server.
 * Matches the old index_old.html credentialToJSON exactly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function credentialToJSON(cred: any): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: cred.id,
    type: cred.type,
    rawId: bufferToBase64url(cred.rawId),
  };
  if (cred.response) {
    const r = cred.response;
    const resp: Record<string, string> = {};
    if (r.clientDataJSON) resp.clientDataJSON = bufferToBase64url(r.clientDataJSON);
    if (r.attestationObject) resp.attestationObject = bufferToBase64url(r.attestationObject);
    if (r.authenticatorData) resp.authenticatorData = bufferToBase64url(r.authenticatorData);
    if (r.signature) resp.signature = bufferToBase64url(r.signature);
    if (r.userHandle) resp.userHandle = bufferToBase64url(r.userHandle);
    base.response = resp;
  }
  if (cred.authenticatorAttachment) base.authenticatorAttachment = cred.authenticatorAttachment;
  return base;
}
