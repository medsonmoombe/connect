import { describe, it, expect } from 'vitest';
import {
  isMfaRequired,
  generateMfaCode,
  hashMfaCode,
  verifyMfaCode,
  MFA_CODE_EXPIRY_MINUTES,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
} from '../mfa';

describe('isMfaRequired', () => {
  it('requires MFA for platform admins', () => {
    expect(isMfaRequired({ is_platform_admin: true })).toBe(true);
  });

  it('requires MFA for org owners', () => {
    expect(isMfaRequired({ org_member_role: 'OWNER' })).toBe(true);
  });

  it('requires MFA for org admins', () => {
    expect(isMfaRequired({ org_member_role: 'ADMIN' })).toBe(true);
  });

  it('requires MFA for ADMIN role', () => {
    expect(isMfaRequired({ role: 'ADMIN' })).toBe(true);
  });

  it('requires MFA when org enforces it', () => {
    expect(isMfaRequired({ org_mfa_enforced: true })).toBe(true);
  });

  it('requires MFA when user has it enabled', () => {
    expect(isMfaRequired({ mfa_enabled: true })).toBe(true);
  });

  it('does not require MFA for regular users', () => {
    expect(isMfaRequired({
      is_platform_admin: false,
      org_member_role: 'MEMBER',
      role: 'DEVELOPER',
      mfa_enabled: false,
      org_mfa_enforced: false,
    })).toBe(false);
  });

  it('does not require MFA for default/empty user', () => {
    expect(isMfaRequired({})).toBe(false);
  });
});

describe('generateMfaCode', () => {
  it('generates a 6-character string', () => {
    const code = generateMfaCode();
    expect(code).toHaveLength(6);
  });

  it('generates only numeric characters', () => {
    const code = generateMfaCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates different codes on successive calls', () => {
    const code1 = generateMfaCode();
    const code2 = generateMfaCode();
    // Extremely unlikely to clash
    expect(code1).not.toBe(code2);
  });
});

describe('hashMfaCode & verifyMfaCode', () => {
  it('produces a SHA-256 hash (64 hex chars)', () => {
    const hash = hashMfaCode('123456');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different codes', () => {
    const hash1 = hashMfaCode('123456');
    const hash2 = hashMfaCode('654321');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies a correct code against its hash', () => {
    const code = generateMfaCode();
    const hash = hashMfaCode(code);
    expect(verifyMfaCode(code, hash)).toBe(true);
  });

  it('rejects an incorrect code', () => {
    const hash = hashMfaCode('123456');
    expect(verifyMfaCode('654321', hash)).toBe(false);
  });

  it('rejects empty code against non-empty hash', () => {
    const hash = hashMfaCode('123456');
    expect(verifyMfaCode('', hash)).toBe(false);
  });

  it('is constant-time (rejects wrong-length hash)', () => {
    expect(verifyMfaCode('123456', 'short')).toBe(false);
  });
});

describe('Constants', () => {
  it('MFA_CODE_EXPIRY_MINUTES is 10', () => {
    expect(MFA_CODE_EXPIRY_MINUTES).toBe(10);
  });

  it('LOCKOUT_THRESHOLD is 3', () => {
    expect(LOCKOUT_THRESHOLD).toBe(3);
  });

  it('LOCKOUT_DURATION_MINUTES is 30', () => {
    expect(LOCKOUT_DURATION_MINUTES).toBe(30);
  });

  it('ATTEMPT_WINDOW_MINUTES is 15', () => {
    expect(ATTEMPT_WINDOW_MINUTES).toBe(15);
  });
});
