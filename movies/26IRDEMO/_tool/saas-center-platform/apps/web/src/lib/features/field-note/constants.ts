import type {
  FieldNoteStatus,
  NoteTemplateType,
  ProcessingStatus,
  StepStatus,
  SummaryStatus
} from '$lib/hooks/actions/field-note.action'

/** 필드노트 녹음 상태 라벨 */
export const FIELD_NOTE_STATUS_LABELS: Record<FieldNoteStatus, string> = {
  recording: '녹음 중',
  paused: '일시정지',
  completed: '녹음 완료'
}

/** 파이프라인 전체 상태 라벨 (사용자 노출 용어는 "분석"으로 통일)
 *  - idle: 녹음은 끝났으나 분석 미시작 (예: 방금 종료 후 run-pipeline 호출 전)
 *  - processing: STT/정제/요약/초안 생성 중
 *  - completed: 모든 분석 완료
 *  - failed: 중간에 실패
 *  - skipped: 사용자가 "저장만 하기"를 선택한 경우 (짧은 녹음 등)
 */
export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  idle: '분석 대기',
  processing: '분석 중',
  completed: '분석 완료',
  failed: '분석 실패',
  skipped: '분석 안 함'
}

/** 세션 리스트 뱃지 색상 */
export const STATUS_DOT_COLORS: Record<ProcessingStatus, string> = {
  idle: 'bg-gray-300',
  processing: 'bg-blue-400',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-300'
}

/** 처리 상태 뱃지 색상 (필드노트 헤더 등 사용). bg + text 쌍. */
export const PROCESSING_STATUS_BADGE_COLORS: Record<
  ProcessingStatus,
  { bg: string; text: string }
> = {
  idle: { bg: 'bg-gray-100', text: 'text-gray-600' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700' },
  completed: { bg: 'bg-green-50', text: 'text-green-700' },
  failed: { bg: 'bg-red-50', text: 'text-red-700' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500' }
}

/** 파이프라인 단계 한글 라벨 */
export const STEP_LABELS: Record<string, string> = {
  transcribing: '음성 전사',
  refining: '문장 정제',
  summarizing: '요약 생성',
  generating_note: '상담일지 초안 생성',
  transcribe: '음성 전사',
  refine: '문장 정제',
  summary: '요약 생성',
  counseling_note: '상담일지 초안 생성'
}

/** 단계별 상태 라벨 (작은 뱃지용) */
export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  none: '-',
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
  failed: '실패',
  skipped: '건너뜀'
}

/** 파이프라인 단계 순서 (진행 표시용) */
export const PIPELINE_STEPS = [
  { key: 'transcribe', label: '음성 전사' },
  { key: 'refine', label: '문장 정제' },
  { key: 'summary', label: '요약 생성' },
  { key: 'counseling_note', label: '상담일지 초안' }
] as const

/** 요약 상태 라벨 */
export const SUMMARY_STATUS_LABELS: Record<SummaryStatus, string> = {
  none: '요약 없음',
  generating: '요약 생성 중',
  completed: '요약 완료',
  failed: '요약 실패'
}

/** 노트 서식 타입 라벨 */
export const NOTE_TEMPLATE_LABELS: Record<NoteTemplateType, string> = {
  default: '기본 서식',
  soap: 'SOAP',
  dap: 'DAP',
  birp: 'BIRP',
  family_center: '가족센터'
}

/** 유효한 서식 타입 목록 (셀렉트 옵션용) */
export const NOTE_TEMPLATE_OPTIONS: {
  value: NoteTemplateType
  label: string
}[] = [
  { value: 'default', label: '기본 서식' },
  { value: 'soap', label: 'SOAP' },
  { value: 'dap', label: 'DAP' },
  { value: 'birp', label: 'BIRP' },
  { value: 'family_center', label: '가족센터' }
]

/** Select 컴포넌트용 서식 옵션 (SelectOptionType 형태) */
export const NOTE_TEMPLATE_SELECT_OPTIONS = [
  { value: 'default', title: '기본 서식' },
  { value: 'soap', title: 'SOAP' },
  { value: 'dap', title: 'DAP' },
  { value: 'birp', title: 'BIRP' },
  { value: 'family_center', title: '가족센터' }
]

/** 모달 사이즈 */
export const FIELD_NOTE_MODAL_SIZES = {
  linkUnlinked: { customWidth: 540 },
  speakerEdit: { customWidth: 540 }
} as const

/** 화자별 색상 팔레트 (최대 8명 구분). 여러 컴포넌트에서 공유. */
export interface SpeakerColor {
  text: string
  bg: string
  border: string
  dot: string
}

// 화자 이름 색 = category 팔레트(Web_Design.md §Category). Figma 필드노트 시안이
// 참석자1 #1C9DFB(category-blue) · 참석자2 #15B76C(category-green)로 지정.
// bg·border·dot은 화자 설정 모달의 칩용이라 기존 스케일 유지(category엔 틴트 단계가 없다).
export const SPEAKER_COLORS: SpeakerColor[] = [
  {
    text: 'text-category-blue',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    dot: 'bg-primary-500'
  },
  {
    text: 'text-category-green',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500'
  },
  {
    text: 'text-category-indigo',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500'
  },
  {
    text: 'text-category-coral',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500'
  },
  {
    text: 'text-category-pink',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500'
  },
  {
    text: 'text-category-teal',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500'
  },
  {
    text: 'text-category-amber',
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    dot: 'bg-lime-500'
  },
  {
    text: 'text-category-lime',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500'
  }
]

/** processing 상태일 때 폴링 주기(ms). 모바일과 동일 */
export const POLLING_INTERVAL_MS = 3000
