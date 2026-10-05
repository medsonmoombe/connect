import { UserRole, OrgMemberRole } from '@/types';

// â”€â”€ Role-based access control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Platform Admin (membership.role === 'ADMIN') = internal staff with full system access
// Org Admin (membership.role !== 'ADMIN', user.role derived from org.primary_role) = org-levelç®¡ç†è€…

export const rolePermissions: Record<UserRole, string[]> = {
  DEVELOPER: [
    'projects:read',
    'projects:create',
    'projects:update',
    'projects:delete',
    'documents:upload',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'messages:send',
    'messages:read',
    'companies:read',
    'companies:update',
  ],
  CAPITAL_PARTNER: [
    'projects:read',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'messages:send',
    'messages:read',
    'companies:read',
    'capital_profiles:read',
    'capital_profiles:update',
  ],
  TECHNICAL_PARTNER: [
    'projects:read',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'messages:send',
    'messages:read',
    'companies:read',
    'technical_profiles:read',
    'technical_profiles:update',
  ],
  POWER_TRADER: [
    'projects:read',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'messages:send',
    'messages:read',
    'companies:read',
    'trader_profiles:read',
    'trader_profiles:update',
  ],
  GRANT_PROVIDER: [
    'projects:read',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'messages:send',
    'messages:read',
    'companies:read',
    'grants:read',
    'grants:create',
    'grants:update',
  ],
  CONSULTANT: [
    'projects:read',
    'profiles:read',
    'profiles:update',
    'matches:read',
    'engagements:create',
    'engagements:read',
    'engagements:update',
    'messages:send',
    'messages:read',
    'messages:update',
    'quotes:send',
    'quotes:receive',
    'companies:read',
  ],
  AUTHORITY_ADMIN: [
    'projects:read',
    'projects:review',
    'projects:approve',
    'companies:read',
    'organizations:read',
    'matches:read',
    'audit_logs:read',
  ],
  AUTHORITY_REVIEWER: [
    'projects:read',
    'projects:review',
    'projects:approve',
    'companies:read',
    'matches:read',
  ],
  AUTHORITY_VIEWER: [
    'projects:read',
    'companies:read',
    'matches:read',
  ],  ADMIN: [
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'projects:read',
    'projects:update',
    'projects:delete',
    'companies:read',
    'companies:update',
    'companies:delete',
    'organizations:read',
    'organizations:update',
    'organizations:delete',
    'engagements:read',
    'engagements:update',
    'messages:read',
    'audit_logs:read',
    'scoring:trigger',
    'matches:recalculate',
    'settings:read',
    'settings:update',
  ],
};

// Platform Admin permissions â€” full system access (internal staff)
// This overrides the role-based permissions above
export const PLATFORM_ADMIN_PERMISSIONS: string[] = [
  'users:read',
  'users:create',
  'users:update',
  'users:delete',
  'projects:read',
  'projects:create',
  'projects:update',
  'projects:delete',
  'companies:read',
  'companies:update',
  'companies:delete',
  'organizations:read',
  'organizations:update',
  'organizations:delete',
  'organizations:verify',
  'engagements:read',
  'engagements:update',
  'engagements:delete',
  'messages:send',
  'messages:read',
  'audit_logs:read',
  'scoring:trigger',
  'matches:recalculate',
  'settings:read',
  'settings:update',
  'grants:read',
  'grants:create',
  'grants:update',
  'grants:delete',
];

// Org-level permissions â€” restricted to own org's data
// Applied when membership.role !== 'ADMIN' (i.e., OWNER, ADMIN, MEMBER)
export const ORG_MEMBER_PERMISSIONS: Record<OrgMemberRole, string[]> = {
  OWNER: [
    'org:read',
    'org:update',
    'org_users:read',
    'org_users:invite',
    'org_users:remove',
    'projects:read',
    'projects:create',
    'projects:update',
    'projects:delete',
    'engagements:read',
    'engagements:create',
    'messages:send',
    'messages:read',
    'settings:read',
  ],
  ADMIN: [
    'org:read',
    'org_users:read',
    'org_users:invite',
    'projects:read',
    'projects:create',
    'projects:update',
    'engagements:read',
    'engagements:create',
    'messages:send',
    'messages:read',
  ],
  MEMBER: [
    'org:read',
    'projects:read',
    'projects:create',
    'engagements:read',
    'messages:send',
    'messages:read',
  ],
};

// â”€â”€ Route-level access control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Maps URL path prefixes to required permissions
export const routePermissions: Record<string, string> = {
  '/admin': 'ADMIN',
  '/api/admin': 'ADMIN',
};

// â”€â”€ Helper functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if a user has a specific permission.
 * Platform Admin (membership.role === 'ADMIN') gets all permissions.
 * Org Admin/Org Member gets permissions based on their org membership role.
 */
export function hasPermission(
  userRole: UserRole,
  permission: string,
  isPlatformAdmin?: boolean,
): boolean {
  if (isPlatformAdmin) return true;
  const permissions = rolePermissions[userRole];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a user is a Platform Admin (internal staff).
 * Platform Admin = membership.role === 'ADMIN' in organization_members table.
 */
export function isPlatformAdmin(membershipRole?: string): boolean {
  return membershipRole === 'ADMIN';
}

/**
 * Check if a user is an Org Admin (org-levelç®¡ç†è€…).
 * Org Admin = membership.role is 'OWNER' or 'ADMIN' (but NOT 'ADMIN' in the Platform Admin sense).
 * This is determined by checking if the org has is_platform_org = false.
 */
export function isOrgAdmin(membershipRole?: string, isPlatformOrg?: boolean): boolean {
  if (isPlatformOrg) return false;
  return membershipRole === 'OWNER' || membershipRole === 'ADMIN';
}

/**
 * Check if a role can access a specific resource.
 */
export function canAccessResource(
  role: UserRole,
  resourceType: string,
  action: 'create' | 'read' | 'update' | 'delete',
  ownerId?: string,
  userId?: string,
  isPlatformAdmin?: boolean,
): boolean {
  // Platform Admin has full access
  if (isPlatformAdmin) return true;

  const permission = `${resourceType}:${action}`;

  // Check if role has the permission
  if (!hasPermission(role, permission)) return false;

  // For update/delete, check ownership
  if ((action === 'update' || action === 'delete') && ownerId && userId) {
    return ownerId === userId;
  }

  return true;
}

/**
 * Middleware function for API routes â€” throws if not authorized.
 */
export function checkPermission(
  role: UserRole,
  permission: string,
  isPlatformAdmin?: boolean,
): void {
  if (!hasPermission(role, permission, isPlatformAdmin)) {
    throw new Error(`Unauthorized: ${permission} permission required`);
  }
}
