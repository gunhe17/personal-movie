/**
 * 감사 로그 상수 — 카테고리/액션 라벨, 색상, 페이지 사이즈
 */

export const ACTIVITY_LOG_PAGE_SIZE = 20

export const CATEGORY_LABELS: Record<string, string> = {
  client: '내담자',
  schedule: '일정',
  assessment: '심리검사',
  counseling: '상담',
  billing: '청구/결제',
  center: '센터',
  program: '프로그램',
  member: '구성원',
  field_note: '현장노트',
  agent: 'AI 에이전트',
  form: '양식',
  document: '문서',
  role: '권한',
  messaging: '메시지',
}

export const ACTION_LABELS: Record<string, string> = {
  created: '생성',
  updated: '수정',
  deleted: '삭제',
  cancelled: '취소',
  restored: '복원',
  approved: '승인',
  rejected: '반려',
  used: '사용',
}

export const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  created: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  updated: { bg: 'bg-blue-50', text: 'text-blue-600' },
  deleted: { bg: 'bg-red-50', text: 'text-red-600' },
  cancelled: { bg: 'bg-amber-50', text: 'text-amber-600' },
  restored: { bg: 'bg-violet-50', text: 'text-violet-600' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rejected: { bg: 'bg-red-50', text: 'text-red-600' },
  used: { bg: 'bg-violet-50', text: 'text-violet-600' },
}

export const DEFAULT_ACTION_COLOR = { bg: 'bg-gray-50', text: 'text-gray-600' }

export const CATEGORY_OPTIONS = [
  { value: '', title: '전체 카테고리' },
  ...Object.entries(CATEGORY_LABELS).map(([value, title]) => ({ value, title })),
]

export const ACTION_OPTIONS = [
  { value: '', title: '전체 액션' },
  ...Object.entries(ACTION_LABELS).map(([value, title]) => ({ value, title })),
]

/** 날짜 범위 필터 옵션 */
export const DATE_RANGE_OPTIONS = [
  { value: '', title: '전체 기간' },
  { value: '7', title: '최근 7일' },
  { value: '30', title: '최근 30일' },
  { value: '90', title: '최근 90일' },
]
