// ============================================
// 상세 페이지 타입 및 상수
// ============================================

export type MemberDetailTabType = 'schedule' | 'history' | 'career'

export interface WorkDay {
  day: string
  start: string
  end: string
}

export interface BreakTime {
  start: string
  end: string
}

export const MEMBER_DETAIL_TABS: { key: MemberDetailTabType; label: string }[] =
  [
    { key: 'schedule', label: '근무일정' },
    { key: 'history', label: '담당 상담 · 검사' },
    { key: 'career', label: '학력 · 경력 · 자격증' }
  ]

/** 구성원 수정(근무일정/학력·경력) 권한 없을 때 안내 문구 */
export const NO_EDIT_PERMISSION_MESSAGE =
  '수정 권한이 없습니다. 필요 시 관리자에게 권한을 요청해 주세요.'

// 요일 목록 (월~일)
export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
export type WeekdayType = (typeof WEEKDAYS)[number]

// API 요일 (MON~SUN) ↔ 한글 요일 매핑
export const WEEKDAY_KR_TO_API: Record<WeekdayType, string> = {
  월: 'MON',
  화: 'TUE',
  수: 'WED',
  목: 'THU',
  금: 'FRI',
  토: 'SAT',
  일: 'SUN'
}
export const WEEKDAY_API_TO_KR: Record<string, WeekdayType> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일'
}

// 주간 근무일정 타입 (요일별 시간 또는 null=휴무)
export interface WeeklySchedule {
  [day: string]: { start: string; end: string } | null
}

// 기본 주간 근무일정 (월~목 근무, 금~일 휴무)
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  월: { start: '09:00', end: '18:00' },
  화: { start: '09:00', end: '18:00' },
  수: { start: '09:00', end: '18:00' },
  목: { start: '09:00', end: '18:00' },
  금: null,
  토: null,
  일: null
}

// ============================================
// 학력/경력 타입
// ============================================

export interface CareerData {
  educations: string[]
  careers: string[]
  certifications: string[]
}

export const MEMBER_SORT_OPTIONS = [
  { value: 'desc', title: '최신순' },
  { value: 'asc', title: '오래된순' }
] satisfies { value: string; title: string }[]

export const MEMBER_EMPLOYMENT_TYPE_MAP = {
  FULLTIME: '정규직',
  CONTRACT: '계약직',
  FREELANCER: '프리랜서'
} as const

export const MEMBER_PAGE_SIZE = 20

// 탭 옵션
export const MEMBER_TABS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기중' }
]

// 역할 필터 옵션 (role_code 기반)
export const MEMBER_ROLE_OPTIONS: { value: string; title: string }[] = [
  { value: 'all', title: '역할' },
  { value: 'ADMIN', title: '관리자' },
  { value: 'COUNSELOR', title: '전문가' },
  { value: 'MANAGER', title: '매니저' },
  { value: 'STAFF', title: '스태프' }
]

// 고용형태 필터 옵션 (employment_type 기반, 라벨 맵 재사용)
export const MEMBER_EMPLOYMENT_OPTIONS: { value: string; title: string }[] = [
  { value: 'all', title: '고용형태' },
  ...Object.entries(MEMBER_EMPLOYMENT_TYPE_MAP).map(([value, title]) => ({
    value,
    title
  }))
]

// 모달 사이즈 설정
export const MODAL_SIZES = {
  invite: { customWidth: 640, desktopOnly: true },
  excelInvite: { customWidth: 540 },
  modify: { customWidth: 540 },
  workSchedule: { customWidth: 540 },
  career: { customWidth: 540 }
} as const
