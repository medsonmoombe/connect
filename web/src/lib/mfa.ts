import crypto from 'crypto';

const MFA_CODE_LENGTH = 6;
const MFA_CODE_EXPIRY_MINUTES = 10;
const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_DURATION_MINUTES = 30;
const ATTEMPT_WINDOW_MINUTES = 15;

/**
 * Check if a user requires MFA verification based on their role and org settings.
 * Platform admins always require MFA.
 * Org admins/owners always require MFA.
 * Other users require MFA if their org has mfa_enforced=true or they enabled it themselves.
 */
export function isMfaRequired(user: {
  is_platform_admin?: boolean;
  is_authority_user?: boolean;
  org_member_role?: string | null;
  role?: string;
  mfa_enabled?: boolean;
  org_mfa_enforced?: boolean;
}): boolean {
  if (user.is_platform_admin) return true;
  if (user.is_authority_user) return true;
  if (user.org_member_role === 'OWNER') return true;
  if (user.org_member_role === 'ADMIN') return true;
  if (user.role === 'ADMIN') return true;
  if (user.org_mfa_enforced) return true;
  if (user.mfa_enabled) return true;
  return false;
}

/**
 * Generate a random 6-digit numeric code.
 */
export function generateMfaCode(): string {
  const bytes = crypto.randomBytes(MFA_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < MFA_CODE_LENGTH; i++) {
    code += bytes[i] % 10;
  }
  return code;
}

/**
 * Hash a plain-text MFA code using SHA-256.
 */
export function hashMfaCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify a plain-text code against a stored hash.
 */
export function verifyMfaCode(plainCode: string, storedHash: string): boolean {
  const computed = hashMfaCode(plainCode);
  // Constant-time comparison
  if (computed.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

export { MFA_CODE_EXPIRY_MINUTES, LOCKOUT_THRESHOLD, LOCKOUT_DURATION_MINUTES, ATTEMPT_WINDOW_MINUTES };
