import { JWTPayload } from '../types';

const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 7 days. Short enough that a leaked token has a bounded life, long enough that
// people are not re-authenticating daily. Session revocation (the `tv` claim)
// covers the cases where we need a token dead sooner than expiry.
export const SESSION_TTL_SECONDS = 604800;

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const key = await getKey(secret);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const key = await getKey(secret);
  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = base64urlDecode(parts[2]);

  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signingInput));
  if (!valid) throw new Error('Invalid signature');

  // We only ever verify with HMAC, so a forged `alg` cannot downgrade us. Reject
  // anything else anyway so the accepted token shape stays explicit rather than
  // resting on an implementation detail.
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Unsupported token header');
  }

  const payload: JWTPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new Error('Token expired or missing expiry');
  }
  // Guard against a token minted with a far-future iat (clock skew or tampering
  // upstream); 60s of leeway covers legitimate skew.
  if (!payload.iat || payload.iat > now + 60) {
    throw new Error('Token issued in the future or missing issue time');
  }
  if (!payload.sub) {
    throw new Error('Token missing subject');
  }

  return payload;
}
