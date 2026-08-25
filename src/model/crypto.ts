/**
 * Salted key derivation for alarm codes.
 *
 * Every code gets its own random salt, so two people who pick the same code
 * produce different digests and the stored data never reveals that collision.
 * The trade-off is that verification cannot be a lookup: with a per-code salt
 * there is no key to index on, so AlarmCodeStore has to test the entered code
 * against every stored salt in turn.
 *
 * Honest scope note: PBKDF2 keeps the plaintext out of storage. It does not
 * make a 4-digit code hard to brute force -- the keyspace is only 10,000.
 */

export const DEFAULT_ITERATIONS = 100_000;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function deriveHash(
  code: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Compares without a length-dependent early exit. */
export function equalsConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
