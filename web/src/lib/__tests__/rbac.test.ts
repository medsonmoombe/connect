import { describe, it, expect } from 'vitest';
import type { UserRole } from '@/types';
import {
  rolePermissions,
  PLATFORM_ADMIN_PERMISSIONS,
  ORG_MEMBER_PERMISSIONS,
  hasPermission,
  isPlatformAdmin,
  isOrgAdmin,
  canAccessResource,
  checkPermission,
} from '../rbac';

describe('rolePermissions', () => {
  it('defines permissions for DEVELOPER role', () => {
    const perms = rolePermissions.DEVELOPER;
    expect(perms).toContain('projects:create');
    expect(perms).toContain('projects:read');
    expect(perms).toContain('projects:update');
    expect(perms).toContain('documents:upload');
    expect(perms).toContain('messages:send');
    expect(perms).toContain('engagements:create');
    expect(perms).not.toContain('users:read');
    expect(perms).not.toContain('settings:read');
  });

  it('defines permissions for CAPITAL_PARTNER role', () => {
    const perms = rolePermissions.CAPITAL_PARTNER;
    expect(perms).toContain('projects:read');
    expect(perms).toContain('matches:read');
    expect(perms).toContain('capital_profiles:read');
    expect(perms).toContain('capital_profiles:update');
    expect(perms).not.toContain('projects:create');
    expect(perms).not.toContain('projects:delete');
  });

  it('defines permissions for TECHNICAL_PARTNER role', () => {
    const perms = rolePermissions.TECHNICAL_PARTNER;
    expect(perms).toContain('projects:read');
    expect(perms).toContain('technical_profiles:read');
    expect(perms).toContain('technical_profiles:update');
    expect(perms).not.toContain('projects:create');
  });

  it('defines permissions for POWER_TRADER role', () => {
    const perms = rolePermissions.POWER_TRADER;
    expect(perms).toContain('trader_profiles:read');
    expect(perms).toContain('trader_profiles:update');
    expect(perms).toContain('projects:read');
  });

  it('defines permissions for GRANT_PROVIDER role', () => {
    const perms = rolePermissions.GRANT_PROVIDER;
    expect(perms).toContain('grants:read');
    expect(perms).toContain('grants:create');
    expect(perms).toContain('grants:update');
    expect(perms).toContain('projects:read');
  });

  it('ADMIN role has full system permissions', () => {
    const perms = rolePermissions.ADMIN;
    expect(perms).toContain('users:read');
    expect(perms).toContain('users:create');
    expect(perms).toContain('users:update');
    expect(perms).toContain('users:delete');
    expect(perms).toContain('audit_logs:read');
    expect(perms).toContain('settings:read');
    expect(perms).toContain('settings:update');
    expect(perms).toContain('matches:recalculate');
  });

  it('every role has a defined set of permissions', () => {
    const roles: UserRole[] = ['DEVELOPER', 'CAPITAL_PARTNER', 'TECHNICAL_PARTNER', 'POWER_TRADER', 'GRANT_PROVIDER', 'ADMIN'];
    for (const role of roles) {
      expect(rolePermissions[role]).toBeDefined();
      expect(Array.isArray(rolePermissions[role])).toBe(true);
      expect(rolePermissions[role].length).toBeGreaterThan(0);
    }
  });
});

describe('PLATFORM_ADMIN_PERMISSIONS', () => {
  it('has comprehensive system-wide permissions', () => {
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('users:read');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('users:delete');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('projects:delete');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('companies:delete');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('organizations:verify');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('audit_logs:read');
    expect(PLATFORM_ADMIN_PERMISSIONS).toContain('grants:delete');
  });
});

describe('ORG_MEMBER_PERMISSIONS', () => {
  it('OWNER has full org control', () => {
    const perms = ORG_MEMBER_PERMISSIONS.OWNER;
    expect(perms).toContain('org:read');
    expect(perms).toContain('org:update');
    expect(perms).toContain('org_users:invite');
    expect(perms).toContain('org_users:remove');
    expect(perms).toContain('settings:read');
  });

  it('ADMIN can invite users but not remove them', () => {
    const perms = ORG_MEMBER_PERMISSIONS.ADMIN;
    expect(perms).toContain('org_users:invite');
    expect(perms).not.toContain('org_users:remove');
    expect(perms).not.toContain('org:update');
    expect(perms).not.toContain('settings:read');
  });

  it('MEMBER has limited org permissions', () => {
    const perms = ORG_MEMBER_PERMISSIONS.MEMBER;
    expect(perms).toContain('org:read');
    expect(perms).toContain('projects:create');
    expect(perms).toContain('messages:send');
    expect(perms).not.toContain('org_users:invite');
    expect(perms).not.toContain('org:update');
  });
});

describe('hasPermission', () => {
  it('returns true when role has the permission', () => {
    expect(hasPermission('DEVELOPER', 'projects:create')).toBe(true);
    expect(hasPermission('CAPITAL_PARTNER', 'matches:read')).toBe(true);
    expect(hasPermission('ADMIN', 'audit_logs:read')).toBe(true);
  });

  it('returns false when role does not have the permission', () => {
    expect(hasPermission('DEVELOPER', 'audit_logs:read')).toBe(false);
    expect(hasPermission('CAPITAL_PARTNER', 'projects:create')).toBe(false);
    expect(hasPermission('TECHNICAL_PARTNER', 'users:create')).toBe(false);
  });

  it('returns true for platform admin regardless of permission', () => {
    expect(hasPermission('DEVELOPER', 'audit_logs:read', true)).toBe(true);
    expect(hasPermission('CAPITAL_PARTNER', 'users:delete', true)).toBe(true);
  });

  it('returns false for unknown role', () => {
    expect(hasPermission('UNKNOWN_ROLE' as UserRole, 'projects:read')).toBe(false);
  });
});

describe('isPlatformAdmin', () => {
  it('returns true when membership role is ADMIN', () => {
    expect(isPlatformAdmin('ADMIN')).toBe(true);
  });

  it('returns false for other roles', () => {
    expect(isPlatformAdmin('OWNER')).toBe(false);
    expect(isPlatformAdmin('MEMBER')).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
    expect(isPlatformAdmin('')).toBe(false);
  });
});

describe('isOrgAdmin', () => {
  it('returns true for OWNER on non-platform org', () => {
    expect(isOrgAdmin('OWNER', false)).toBe(true);
  });

  it('returns true for ADMIN on non-platform org', () => {
    expect(isOrgAdmin('ADMIN', false)).toBe(true);
  });

  it('returns false for MEMBER', () => {
    expect(isOrgAdmin('MEMBER', false)).toBe(false);
  });

  it('returns false on platform org', () => {
    expect(isOrgAdmin('OWNER', true)).toBe(false);
    expect(isOrgAdmin('ADMIN', true)).toBe(false);
  });

  it('returns false when role is undefined', () => {
    expect(isOrgAdmin(undefined, false)).toBe(false);
  });
});

describe('canAccessResource', () => {
  it('platform admin can access any resource', () => {
    expect(canAccessResource('DEVELOPER', 'users', 'delete', 'org-1', 'user-1', true)).toBe(true);
    expect(canAccessResource('CAPITAL_PARTNER', 'settings', 'update', undefined, undefined, true)).toBe(true);
  });

  it('returns false if role lacks the permission', () => {
    expect(canAccessResource('DEVELOPER', 'audit_logs', 'read')).toBe(false);
  });

  it('checks ownership for update/delete operations', () => {
    // Same owner
    expect(canAccessResource('DEVELOPER', 'projects', 'update', 'user-1', 'user-1')).toBe(true);
    expect(canAccessResource('DEVELOPER', 'projects', 'delete', 'user-1', 'user-1')).toBe(true);
    // Different owner
    expect(canAccessResource('DEVELOPER', 'projects', 'delete', 'user-1', 'user-2')).toBe(false);
  });

  it('allows read without ownership check', () => {
    expect(canAccessResource('DEVELOPER', 'projects', 'read', 'user-1', 'user-2')).toBe(true);
  });
});

describe('checkPermission', () => {
  it('does not throw when permission is granted', () => {
    expect(() => checkPermission('DEVELOPER', 'projects:create')).not.toThrow();
  });

  it('throws when permission is denied', () => {
    expect(() => checkPermission('DEVELOPER', 'audit_logs:read')).toThrow('Unauthorized');
  });

  it('does not throw for platform admin', () => {
    expect(() => checkPermission('DEVELOPER', 'audit_logs:read', true)).not.toThrow();
  });
});
