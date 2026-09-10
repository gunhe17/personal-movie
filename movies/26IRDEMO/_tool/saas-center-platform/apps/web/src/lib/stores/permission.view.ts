import { derived } from 'svelte/store'
import { auth } from './auth'
import { permissionStore } from './permission.store'
import { permissionEngine } from '$lib/utils/permission-engine'
import type { Permission, PermissionContext } from '$lib/types/permissions'

// 사용자 역할 derived store - permissionStore 기반
export const userRole = derived(
  permissionStore,
  ($store) => $store.context?.role ?? null
)

// 권한 컨텍스트 derived store - permissionStore 기반 (단일 소스)
export const permissionContext = derived(
  [permissionStore, auth],
  ([$store, $auth]): PermissionContext => {
    // permissionStore에 context가 있으면 사용 (버전 동기화된 최신 권한)
    if ($store.context) {
      return $store.context
    }
    // fallback: 로딩 중이거나 초기화 전에는 기본값 반환
    return {
      permissions: [],
      role: null,
      accessLevel: 'own' as const,
      isAuthenticated: $auth.isAuthenticated,
      version: 0,
      updatedAt: ''
    }
  }
)

// 현재 사용자 권한 목록
export const permissions = derived(
  permissionContext,
  ($context) => $context.permissions
)

// 권한 확인 헬퍼 함수들 (하위 호환성)
export const hasPermission = derived(
  permissionContext,
  ($context) =>
    (permission: Permission): boolean => {
      return permissionEngine.hasPermission(permission, $context)
    }
)

export const hasAnyPermission = derived(
  permissionContext,
  ($context) =>
    (requiredPermissions: Permission[]): boolean => {
      return permissionEngine.hasAnyPermission(requiredPermissions, $context)
    }
)

export const hasAllPermissions = derived(
  permissionContext,
  ($context) =>
    (requiredPermissions: Permission[]): boolean => {
      return permissionEngine.hasAllPermissions(requiredPermissions, $context)
    }
)

// 역할별 체크 함수들
export const isCounselor = derived(userRole, ($role) => $role === 'counselor')
export const isManager = derived(userRole, ($role) => $role === 'manager')
export const isSuperAdmin = derived(
  userRole,
  ($role) => $role === 'super_admin'
)

// 권한 평가 함수 (새로운 권장 방식)
export const canAccess = derived(
  permissionContext,
  ($context) =>
    (rule: import('$lib/types/permissions').PermissionRule): boolean => {
      return permissionEngine.evaluate(rule, $context).granted
    }
)

// 상세한 권한 평가 결과 (디버깅용)
export const evaluatePermission = derived(
  permissionContext,
  ($context) => (rule: import('$lib/types/permissions').PermissionRule) => {
    return permissionEngine.evaluate(rule, $context)
  }
)
