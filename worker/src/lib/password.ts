const encoder = new TextEncoder();

// OWASP Password Storage Cheat Sheet recommends >= 600,000 iterations for
// PBKDF2-HMAC-SHA256. Stored hashes record the iteration count they were made
// with, so this can be raised again later without invalidating existing ones.
const PBKDF2_ITERATIONS = 600000;
const HASH_PREFIX = 'pbkdf2-sha256';

// Hashes written before the format was versioned are `saltHex:hashHex` at 100k.
const LEGACY_ITERATIONS = 100000;

// PBKDF2 runs over the password regardless of length, so an unbounded password
// is an easy way to burn CPU on the Worker. 8 is the NIST SP 800-63B minimum.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

interface ParsedHash {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

function parseStoredHash(stored: string): ParsedHash | null {
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const [, iterStr, saltHex, hashHex] = stored.split('$');
    const iterations = parseInt(iterStr, 10);
    const salt = fromHex(saltHex ?? '');
    const hash = fromHex(hashHex ?? '');
    if (!Number.isFinite(iterations) || iterations < 1 || !salt || !hash) return null;
    return { iterations, salt, hash };
  }

  const [saltHex, hashHex, ...rest] = stored.split(':');
  if (rest.length > 0) return null;
  const salt = fromHex(saltHex ?? '');
  const hash = fromHex(hashHex ?? '');
  if (!salt || !hash) return null;
  return { iterations: LEGACY_ITERATIONS, salt, hash };
}

/**
 * Verify a password against a stored hash. Returns false - never throws - for a
 * malformed or corrupt stored value, so a bad row cannot turn a login attempt
 * into a 500.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const computed = await derive(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(computed, parsed.hash);
}

/** True when a stored hash uses an outdated format or iteration count. */
export function needsRehash(stored: string): boolean {
  const parsed = parseStoredHash(stored);
  return !parsed || parsed.iterations < PBKDF2_ITERATIONS;
}

/**
 * Burn roughly the same CPU as a real verify without needing a stored hash.
 * Called when the account does not exist so that response timing does not
 * distinguish "no such user" from "wrong password".
 */
export async function dummyVerify(password: string): Promise<void> {
  await derive(password, new Uint8Array(16), PBKDF2_ITERATIONS);
}

/** Returns an error message when the password fails policy, otherwise null. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
