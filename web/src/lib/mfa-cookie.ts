/**
 * Edge-compatible HMAC cookie signing/verification.
 * Uses Web Crypto API (available in both Node.js and Edge Runtime).
 */

const MFA_COOKIE_SECRET = process.env?.MFA_COOKIE_SECRET
  || process.env?.SUPABASE_JWT_SECRET;

if (!MFA_COOKIE_SECRET) {
  throw new Error(
    '[mfa-cookie] FATAL: Neither MFA_COOKIE_SECRET nor SUPABASE_JWT_SECRET is set. ' +
    'MFA cookie signing requires a secret. Set one of these environment variables.'
  );
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(MFA_COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a signed MFA verification cookie value.
 * Format: `{userId}|{timestamp}|{hmac}`
 */
export async function signMfaCookie(userId: string): Promise<string> {
  const ts = Date.now().toString();
  const payload = `${userId}|${ts}`;
  const sig = await hmacSign(payload);
  return `${payload}|${sig}`;
}

/**
 * Verify a signed MFA cookie. Returns true if valid and not expired (1 hour).
 */
export async function verifyMfaCookie(cookieValue: string, expectedUserId: string): Promise<boolean> {
  const parts = cookieValue.split('|');
  if (parts.length !== 3) return false;

  const [userId, ts, sig] = parts;
  if (userId !== expectedUserId) return false;

  const payload = `${userId}|${ts}`;
  const expectedSig = await hmacSign(payload);

  // Constant-time comparison
  if (sig.length !== expectedSig.length) return false;
  let result = 0;
  for (let i = 0; i < sig.length; i++) {
    result |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (result !== 0) return false;

  // Check 1-hour expiry
  const age = Date.now() - parseInt(ts, 10);
  return age < 60 * 60 * 1000;
}
