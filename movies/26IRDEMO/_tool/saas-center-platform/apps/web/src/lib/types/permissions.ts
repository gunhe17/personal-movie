// 권한 시스템 관련 타입 정의
// 서버 RBAC와 동일한 형식: "{action}:{resource}" (예: read:schedule, write:center)

// 사용자 역할 (프론트 표시용; 실제 권한은 서버 permissions 배열로 판단)
export type UserRole = 'counselor' | 'manager' | 'super_admin' | 'staff'

/** 서버에서 내려주는 권한 문자열 (Permission 클래스와 동일) */
export type Permission =
  // CENTER
  | 'read:center'
  | 'write:center'
  // PROGRAM
  | 'read:program'
  | 'write:program'
  // ROOM
  | 'read:room'
  | 'write:room'
  // MEMBER
  | 'read:member'
  | 'write:member'
  | 'delete:member'
  // MEMBER_INVITATION
  | 'read:member_invitation'
  | 'write:member_invitation'
  // SCHEDULE
  | 'read:schedule'
  | 'write:schedule'
  | 'delete:schedule'
  // CLIENT
  | 'read:client'
  | 'write:client'
  | 'delete:client'
  // COUNSELING
  | 'read:counseling'
  | 'write:counseling'
  | 'delete:counseling'
  // COUNSELING_NOTE
  | 'read:counseling_note'
  | 'write:counseling_note'
  // ASSESSMENT_CASE
  | 'read:assessment_case'
  | 'write:assessment_case'
  | 'delete:assessment_case'
  // CENTER_ASSESSMENT
  | 'read:center_assessment'
  | 'write:center_assessment'
  // SEND_LINK
  | 'read:send_link'
  | 'write:send_link'
  // DOCUMENT
  | 'read:document'
  | 'write:document'
  | 'delete:document'
  // FORM_TEMPLATE
  | 'read:form_template'
  | 'write:form_template'
  // FORM (instance)
  | 'read:form_instance'
  | 'write:form_instance'
  | 'delete:form_instance'
  // ROLE
  | 'read:role'
  | 'write:role'
  // ACTIVITY_LOG
  | 'read:activity_log'
  // NOTICE
  | 'read:notice'
  | 'write:notice'
  // BILLING
  | 'read:billing'
  | 'write:billing'
  | 'delete:billing'
  // VOUCHER
  | 'read:voucher'
  | 'write:voucher'
  | 'delete:voucher'
  // Special
  | '*'

/** 데이터 접근 범위: all(센터 전체) | own(본인 담당만) */
export type AccessLevel = 'all' | 'own'

// 권한 확인 규칙 인터페이스
export interface PermissionRule {
  all?: readonly Permission[]
  any?: readonly Permission[]
  not?: readonly Permission[]
  roles?: readonly UserRole[]
  custom?: (permissions: Permission[], role: UserRole | null) => boolean
}

// 권한 컨텍스트
export interface PermissionContext {
  permissions: Permission[]
  role: UserRole | null
  /** 현재 로그인한 멤버 ID (센터별). 담당자 기본값 등에 사용 */
  memberId?: string | null
  /** 데이터 접근 범위: all(센터 전체) | own(본인 담당만) */
  accessLevel: AccessLevel
  isAuthenticated: boolean
  version: number
  updatedAt: string
}

// 권한 평가 결과
export interface PermissionResult {
  granted: boolean
  reason?: string
  missingPermissions?: Permission[]
}
