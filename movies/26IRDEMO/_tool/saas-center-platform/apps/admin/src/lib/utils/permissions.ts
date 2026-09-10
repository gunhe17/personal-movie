/**
 * RBAC 권한 유틸리티 (단일 소스)
 *
 * 역할 계층: system_admin > super_admin > admin > customer_service
 * 설계 문서: apps/admin/docs/rbac-architecture.md
 */

// ── AdminRole 타입 ──
export type AdminRole = 'system_admin' | 'super_admin' | 'admin' | 'customer_service'

// ── 역할 계층 (숫자가 클수록 상위) ──
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  system_admin: 4,
  super_admin: 3,
  admin: 2,
  customer_service: 1,
}

// ── 역할 그룹 ──
export const ROLE_GROUPS = {
  SYSTEM_ONLY: ['system_admin'] as AdminRole[],
  SUPER_PLUS: ['system_admin', 'super_admin'] as AdminRole[],
  ADMIN_PLUS: ['system_admin', 'super_admin', 'admin'] as AdminRole[],
  ALL_ROLES: ['system_admin', 'super_admin', 'admin', 'customer_service'] as AdminRole[],
}

// ── 역할 메타 (라벨, 배지 색상, 사이드바 로고 색상) ──
export const ROLE_META: Record<
  AdminRole,
  { label: string; bg: string; text: string; logoBg: string }
> = {
  system_admin: {
    label: '시스템 관리자',
    bg: 'bg-red-50',
    text: 'text-red-700',
    logoBg: 'bg-red-600',
  },
  super_admin: {
    label: '슈퍼관리자',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    logoBg: 'bg-primary-500',
  },
  admin: {
    label: '관리자',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    logoBg: 'bg-blue-500',
  },
  customer_service: {
    label: 'CS 담당자',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    logoBg: 'bg-emerald-600',
  },
}

// ── 핵심 함수 ──

/** 특정 역할 그룹에 포함되는지 확인 */
export function hasRole(
  role: AdminRole | string | undefined,
  allowed: readonly AdminRole[],
): boolean {
  if (!role) return false
  return (allowed as readonly string[]).includes(role)
}

/** 계층 비교: role이 minRole 이상인지 */
export function isAtLeast(
  role: AdminRole | string | undefined,
  minRole: AdminRole,
): boolean {
  if (!role) return false
  const level = ROLE_HIERARCHY[role as AdminRole]
  if (level === undefined) return false
  return level >= ROLE_HIERARCHY[minRole]
}

// ── 의미 있는 권한 헬퍼 ──

/** 운영 행위 가능 — 센터 승인, 계정 잠금, 검사 CRUD 등 (admin+) */
export function canOperate(role: AdminRole | string | undefined): boolean {
  return isAtLeast(role, 'admin')
}

/** 관리 행위 가능 — 어드민 계정 관리 (super_admin+) */
export function canAdminister(role: AdminRole | string | undefined): boolean {
  return isAtLeast(role, 'super_admin')
}

/** 시스템 행위 가능 — 감사 로그, 시스템 설정, 인프라, 데이터 삭제 (system_admin) */
export function canSystemManage(role: AdminRole | string | undefined): boolean {
  return isAtLeast(role, 'system_admin')
}
