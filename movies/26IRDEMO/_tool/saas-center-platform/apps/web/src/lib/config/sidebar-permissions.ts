/**
 * 사이드 메뉴 표시 권한 설정
 * 서버 RBAC(역할별 권한)와 동기화: ADMIN(전체), MANAGER/STAFF(운영), COUNSELOR(본인 담당만)
 * 권한 코드 형식: "{action}:{resource}" (예: read:schedule, write:center)
 */

import type { UserRole } from '$lib/types/permissions'

/** 메뉴/서브메뉴 표시에 필요한 권한 — 하나라도 있으면 표시 (또는 * 와일드카드) */
export const SIDEBAR_MENU_PERMISSIONS = {
  dashboard: ['read:center', 'write:center', '*'],
  schedule: ['read:schedule', 'write:schedule', '*'],
  clients: ['read:client', 'write:client', '*'],
  voucher: ['read:voucher', 'write:voucher', '*'],
  counseling: ['read:counseling', 'write:counseling', '*'],
  assessment: [
    'read:assessment',
    'write:assessment',
    'read:assessment_case',
    'write:assessment_case',
    'read:center_assessment',
    'write:center_assessment',
    '*'
  ],
  billing: ['read:billing', 'write:billing', 'write:center', '*'],
  members: ['read:member', 'write:member_invitation', '*'],
  settings: ['read:center', 'write:center', '*'],
  /** 구성원 하위 메뉴 중 '권한 설정'만 별도 권한 */
  settingsAuthorization: ['read:role', 'write:role', '*'],
  /**
   * 검사 탭 하위 '검사 관리' — 옛 설정 메뉴 소속이었으므로 settings와 동일 조건을 복제한다.
   * (이동이지 권한 개편이 아니다. write:center_assessment 등으로 조이면 STAFF가 쓰던 화면을 잃는다)
   */
  assessmentManage: ['read:center', 'write:center', '*'],
  /** 바우처 탭 하위 '바우처 관리' — 위와 동일한 이유로 settings 조건 복제 */
  voucherManage: ['read:center', 'write:center', '*'],
  /** 상담 탭 하위 '프로그램 관리' — 옛 센터 정보 탭 소속이었으므로 settings 조건 복제 */
  programManage: ['read:center', 'write:center', '*'],
  /** 센터 관리 하위 메뉴 중 '문서 양식' — 매니저(write:center)·문서양식 권한·관리자에게 노출 (프로덕션은 구현 완료 전까지 HIDDEN_CHILD_PATHS로 숨김) */
  formTemplates: ['write:center', 'write:form_template', 'read:form_template', '*'],
  /** 센터 관리 하위 메뉴 중 '문자 양식' — manager만 접근 */
  messageTemplates: ['write:center', '*'],
  /** 설정 > 활동 로그 */
  activityLog: ['read:activity_log', '*'],
  notice: ['read:notice', 'write:notice', '*'],
  myInfo: [] as string[],
  agent: [] as string[]
} as const

export type SidebarMenuId = keyof typeof SIDEBAR_MENU_PERMISSIONS

/** 역할별 접근 불가 메뉴 — 해당 역할이면 권한과 무관하게 숨김 */
const ROLE_EXCLUDED_MENUS: Partial<Record<UserRole, SidebarMenuId[]>> = {
  counselor: [
    'settings',
    'settingsAuthorization',
    'assessmentManage',
    'voucherManage',
    'programManage',
    'members',
    'billing'
  ]
}

/**
 * 현재 권한 목록 + 역할로 해당 메뉴 표시 여부 판단
 */
export function canShowSidebarMenu(
  menuId: SidebarMenuId,
  permissions: string[],
  role?: UserRole | null
): boolean {
  // 역할 기반 제외 (권한과 무관하게 숨김)
  if (role && ROLE_EXCLUDED_MENUS[role]?.includes(menuId)) return false

  const required = SIDEBAR_MENU_PERMISSIONS[menuId]
  if (!required?.length) return true
  if (permissions.includes('*')) return true
  return required.some((p) => permissions.includes(p))
}
