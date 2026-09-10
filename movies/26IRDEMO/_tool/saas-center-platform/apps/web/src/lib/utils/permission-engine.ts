import type { Permission, UserRole, PermissionRule, PermissionContext, PermissionResult } from '$lib/types/permissions';

/**
 * 권한 엔진 - 서버에서 내려준 permissions 배열만으로 평가 (역할 하드코딩 제거)
 */
export class PermissionEngine {
  private static instance: PermissionEngine;

  static getInstance(): PermissionEngine {
    if (!PermissionEngine.instance) {
      PermissionEngine.instance = new PermissionEngine();
    }
    return PermissionEngine.instance;
  }

  /**
   * 권한 컨텍스트 생성 (permissionsOverride가 없으면 빈 배열 → 접근 거부)
   */
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
      accessLevel: 'all' as const,
      isAuthenticated,
      version: version ?? 1,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 권한 규칙 평가
   */
  evaluate(rule: PermissionRule, context: PermissionContext): PermissionResult {
    if (!context.isAuthenticated) {
      return { 
        granted: false, 
        reason: 'User not authenticated',
        missingPermissions: undefined
      };
    }

    const { permissions, role } = context;

    // 와일드카드(*) 권한 → 모든 권한 허용
    const hasWildcard = permissions.includes('*' as Permission);
    if (hasWildcard) {
      return { granted: true, missingPermissions: undefined };
    }

    // 커스텀 함수가 있는 경우 우선 실행
    if (rule.custom) {
      const result = rule.custom(permissions, role);
      return { 
        granted: result,
        reason: result ? 'Custom rule passed' : 'Custom rule failed',
        missingPermissions: undefined
      };
    }

    // 역할 기반 체크
    if (rule.roles && rule.roles.length > 0) {
      if (!role || !rule.roles.includes(role)) {
        return { 
          granted: false, 
          reason: `Required role: ${rule.roles.join(' or ')}, current: ${role || 'none'}`,
          missingPermissions: undefined
        };
      }
    }

    // NOT 조건 체크 (특정 권한이 없어야 함)
    if (rule.not && rule.not.length > 0) {
      const forbiddenFound = rule.not.find(p => permissions.includes(p));
      if (forbiddenFound) {
        return { 
          granted: false, 
          reason: `Forbidden permission: ${forbiddenFound}`,
          missingPermissions: undefined
        };
      }
    }

    // ALL 조건 체크 (모든 권한이 필요)
    if (rule.all && rule.all.length > 0) {
      const missing = rule.all.filter(p => !permissions.includes(p));
      if (missing.length > 0) {
        return { 
          granted: false, 
          reason: 'Missing required permissions',
          missingPermissions: missing 
        };
      }
    }

    // ANY 조건 체크 (하나 이상의 권한이 필요)
    if (rule.any && rule.any.length > 0) {
      const hasAny = rule.any.some(p => permissions.includes(p));
      if (!hasAny) {
        return { 
          granted: false, 
          reason: 'No required permissions found',
          missingPermissions: [...rule.any]
        };
      }
    }

    return { granted: true, missingPermissions: undefined };
  }

  /**
   * 단순 권한 체크 (하위 호환성)
   */
  hasPermission(permission: Permission, context: PermissionContext): boolean {
    return this.evaluate({ any: [permission] }, context).granted;
  }

  /**
   * 복수 권한 체크 (OR 조건)
   */
  hasAnyPermission(permissions: Permission[], context: PermissionContext): boolean {
    return this.evaluate({ any: permissions }, context).granted;
  }

  /**
   * 모든 권한 체크 (AND 조건)
   */
  hasAllPermissions(permissions: Permission[], context: PermissionContext): boolean {
    return this.evaluate({ all: permissions }, context).granted;
  }

  /**
   * 역할 체크
   */
  hasRole(requiredRoles: UserRole[], context: PermissionContext): boolean {
    return this.evaluate({ roles: requiredRoles }, context).granted;
  }
}

// 싱글톤 인스턴스 내보내기
export const permissionEngine = PermissionEngine.getInstance();