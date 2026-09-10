/**
 * Schedule Counsel Constants
 * 상담 일정 접수 페이지에서 사용하는 상수 및 타입 정의
 */

// 클라이언트 타입
export type ClientType = 'individual' | 'group'

// 회기 반복 타입
export type RecurrenceType = 'daily' | 'weekly' | 'monthly'

// 회기 반복 종료 타입
export type RecurrenceEndType = 'count' | 'date' | null

// 회기 반복 타입 옵션
export const RECURRENCE_TYPE_OPTIONS = [
  { label: '매일', value: 'daily' as const },
  { label: '매주', value: 'weekly' as const },
  { label: '매월', value: 'monthly' as const },
] as const

// 회기 반복 타입별 단위 라벨
export const RECURRENCE_UNIT_LABELS: Record<RecurrenceType, string> = {
  daily: '일마다',
  weekly: '주마다',
  monthly: '개월마다',
}

// 요일 타입
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// 요일 옵션
export const DAY_OF_WEEK_OPTIONS: { label: string; value: DayOfWeek }[] = [
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
  { label: '일', value: 'sun' }
]

// 월간 반복 타입
export type MonthlyRepeatType = 'day' | 'weekday' | 'last_weekday' | 'last_day'

// 월간 반복 옵션 라벨 생성 함수
export function getMonthlyRepeatOptions(selectedDate: Date | null): { label: string; value: MonthlyRepeatType }[] {
  if (!selectedDate) {
    return [
      { label: '날짜 선택', value: 'day' }
    ]
  }

  const day = selectedDate.getDate()
  const dayOfWeek = selectedDate.getDay()
  const weekOfMonth = Math.ceil(day / 7)

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayName = dayNames[dayOfWeek]

  return [
    { label: `${day}일`, value: 'day' },
    { label: `${weekOfMonth}번째 ${dayName}요일`, value: 'weekday' },
    { label: `마지막 ${dayName}요일`, value: 'last_weekday' },
    { label: '마지막 날', value: 'last_day' }
  ]
}

// 모달 사이즈
export const MODAL_SIZES = {
  excelUpload: { customWidth: 1000, customHeight: 530 },
  roomRegister: { customWidth: 540 }
} as const

// 상담 유형 옵션 (개별상담 / 그룹상담) — 값은 API counselingType로 전송
export const CLIENT_TYPE_OPTIONS = [
  { title: '전체 유형', value: 'all' },
  { title: '개별상담', value: 'individual' },
  { title: '그룹상담', value: 'group' }
]

// 날짜 필터 옵션
export const DATE_FILTER_OPTIONS = [
  { title: '전체 날짜', value: 'all' },
  { title: '최근 1일', value: 'day' },
  { title: '최근 1주일', value: 'week' },
  { title: '최근 1개월', value: 'month' }
]

// 상담 유형 옵션
export const COUNSEL_TYPE_OPTIONS = [
  { label: '초기상담', value: '초기상담' as const },
  { label: '프로그램', value: '프로그램' as const }
] as const
