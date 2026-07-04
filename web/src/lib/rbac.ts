import { UserRole } from '@/types';

// Role-based access control configuration
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
  ADMIN: [
    'users:read',
    'users:update',
    'users:delete',
    'projects:read',
    'projects:update',
    'projects:delete',
    'companies:read',
    'companies:update',
    'companies:delete',
    'engagements:read',
    'engagements:update',
    'messages:read',
    'audit_logs:read',
    'scoring:trigger',
    'matches:recalculate',
  ],
};

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = rolePermissions[role];
  return permissions?.includes(permission) ?? false;
}

// Check if a role can access a specific resource
export function canAccessResource(
  role: UserRole,
  resourceType: string,
  action: 'create' | 'read' | 'update' | 'delete',
  ownerId?: string,
  userId?: string
): boolean {
  const permission = `${resourceType}:${action}`;
  
  // Admin has full access
  if (role === 'ADMIN') {
    return true;
  }
  
  // Check if role has the permission
  if (!hasPermission(role, permission)) {
    return false;
  }
  
  // For update/delete, check ownership
  if ((action === 'update' || action === 'delete') && ownerId && userId) {
    return ownerId === userId;
  }
  
  return true;
}

// Middleware function for API routes
export function checkPermission(role: UserRole, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Unauthorized: ${permission} permission required`);
  }
}
