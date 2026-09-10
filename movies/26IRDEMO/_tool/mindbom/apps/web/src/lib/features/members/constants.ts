import { LIST_PAGE_SIZE } from '$lib/features/common/filters'

export const MEMBER_PAGE_SIZE = LIST_PAGE_SIZE

export const MEMBER_ROLE_OPTIONS = [
  { value: 'all', label: '전체 역할' },
  { value: 'admin', label: '관리자' },
  { value: 'clinician', label: '임상심리사' },
  { value: 'researcher', label: '연구원' }
] as const

/**
 * 부여 가능한 역할 — 초대·수정 모달 공용.
 *
 * 위 MEMBER_ROLE_OPTIONS는 필터용이라 '전체 역할'이 섞여 있어 여기 쓸 수 없다.
 * desc는 권한 부여가 되돌리기 번거로운 결정이라 고르는 자리에서 바로 보여준다.
 */
export const ROLE_OPTIONS = [
  { value: 'clinician', label: '임상심리사', desc: '검사 수행 및 보고서 작성' },
  { value: 'researcher', label: '연구원', desc: '데이터 분석 및 연구 지원' },
  { value: 'admin', label: '관리자', desc: '기관 전체 관리 권한' }
] as const

type RoleColor = 'blue' | 'green' | 'purple'

export const MEMBER_ROLE_CONFIG: Record<string, { label: string; color: RoleColor }> = {
  admin: { label: '관리자', color: 'blue' },
  clinician: { label: '임상심리사', color: 'green' },
  researcher: { label: '연구원', color: 'purple' }
}
