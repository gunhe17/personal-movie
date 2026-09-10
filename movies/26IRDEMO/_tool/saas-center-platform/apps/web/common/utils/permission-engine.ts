import type { Permission, UserRole, PermissionRule, PermissionContext, PermissionResult } from '$lib/types/permissions';

/**
 * 권한 엔진 - 서버에서 내려준 permissions 배열만으로 평가 (역할 하드코딩 제거)
 * 실제 사용처: $lib/utils/permission-engine (동일 로직)
 */
export class PermissionEngine {
  private static instance: PermissionEngine;

  static getInstance(): PermissionEngine {
    if (!PermissionEngine.instance) {
      PermissionEngine.instance = new PermissionEngine();
    }
    return PermissionEngine.instance;
  }

  createContext(
    role: UserRole | null,
    isAuthenticated: boolean,
    permissionsOverride?: Permission[],
    version?: number
  ): PermissionContext {
    const permissions = Array.isArray(permissionsOverride) && permissionsOverride.length > 0
      ? permissionsOverride
      : [];
    return {
      permissions,
      role,
      isAuthenticated,
      version: version ?? 1,
      updatedAt: new Date().toISOString()
    };
  }

  evaluate(rule: PermissionRule, context: PermissionContext): PermissionResult {
    if (!context.isAuthenticated) {
      return {
        granted: false,
        reason: 'User not authenticated',
        missingPermissions: undefined
      };
    }

    const { permissions, role } = context;

    const hasWildcard = permissions.includes('*' as Permission);
    if (hasWildcard) {
      return { granted: true, missingPermissions: undefined };
    }

    if (rule.custom) {
      const result = rule.custom(permissions, role);
      return {
        granted: result,
        reason: result ? 'Custom rule passed' : 'Custom rule failed',
        missingPermissions: undefined
      };
    }

    if (rule.roles && rule.roles.length > 0) {
      if (!role || !rule.roles.includes(role)) {
        return {
          granted: false,
          reason: `Required role: ${rule.roles.join(' or ')}, current: ${role || 'none'}`,
          missingPermissions: undefined
        };
      }
    }

    if (rule.not && rule.not.length > 0) {
      const forbiddenFound = rule.not.find((p) => permissions.includes(p));
      if (forbiddenFound) {
        return {
          granted: false,
          reason: `Forbidden permission: ${forbiddenFound}`,
          missingPermissions: undefined
        };
      }
    }

    if (rule.all && rule.all.length > 0) {
      const missing = rule.all.filter((p) => !permissions.includes(p));
      if (missing.length > 0) {
        return {
          granted: false,
          reason: 'Missing required permissions',
          missingPermissions: missing
        };
      }
    }

    if (rule.any && rule.any.length > 0) {
      const hasAny = rule.any.some((p) => permissions.includes(p));
      if (!hasAny) {
        return {
          granted: false,
          reason: 'No required permissions found',
          missingPermissions: rule.any
        };
      }
    }

    return { granted: true, missingPermissions: undefined };
  }

  hasPermission(permission: Permission, context: PermissionContext): boolean {
    return this.evaluate({ any: [permission] }, context).granted;
  }

  hasAnyPermission(permissions: Permission[], context: PermissionContext): boolean {
    return this.evaluate({ any: permissions }, context).granted;
  }

  hasAllPermissions(permissions: Permission[], context: PermissionContext): boolean {
    return this.evaluate({ all: permissions }, context).granted;
  }

  hasRole(requiredRoles: UserRole[], context: PermissionContext): boolean {
    return this.evaluate({ roles: requiredRoles }, context).granted;
  }
}

export const permissionEngine = PermissionEngine.getInstance();
