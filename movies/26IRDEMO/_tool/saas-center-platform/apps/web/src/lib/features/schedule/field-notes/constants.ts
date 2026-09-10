/**
 * 필드노트 목록 페이지 전용 상수
 *
 * 공용 상수(상태 라벨, 파이프라인 등)는 $lib/features/field-note/constants.ts 참조.
 * 여기에는 목록 필터 옵션처럼 목록 페이지에서만 쓰이는 상수만 정의한다.
 */

/** 목록 테이블용 짧은 처리 상태 라벨 */
export const PROCESSING_STATUS_LABELS: Record<string, string> = {
  idle: '대기',
  processing: '처리중',
  completed: '완료',
  failed: '실패',
  skipped: '건너뜀'
} as const

export const PROCESSING_STATUS_COLORS: Record<string, string> = {
  idle: 'text-gray-500',
  processing: 'text-blue-500',
  completed: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-gray-400'
} as const

/** 처리 상태 뱃지 (배경 + 텍스트 조합) */
export const PROCESSING_BADGE_STYLES: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-50 text-blue-600',
  completed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-600',
  skipped: 'bg-gray-100 text-gray-500'
} as const

/** 처리 상태 dot 색상 */
export const PROCESSING_DOT_COLORS: Record<string, string> = {
  idle: 'bg-gray-400',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-300'
} as const

export const STATUS_LABELS: Record<string, string> = {
  recording: '녹음중',
  paused: '일시정지',
  completed: '완료'
} as const

export const LINKED_FILTER_OPTIONS = [
  { value: 'all', title: '전체 연결' },
  { value: 'true', title: '연결됨' },
  { value: 'false', title: '미연결' }
]

export const PROCESSING_FILTER_OPTIONS = [
  { value: 'all', title: '전체 처리' },
  { value: 'idle', title: '대기' },
  { value: 'processing', title: '처리중' },
  { value: 'completed', title: '완료' },
  { value: 'failed', title: '실패' }
]

export const FIELD_NOTE_LIST_PAGE_SIZE = 20
export const FIELD_NOTE_GRID_PAGE_SIZE = 16
