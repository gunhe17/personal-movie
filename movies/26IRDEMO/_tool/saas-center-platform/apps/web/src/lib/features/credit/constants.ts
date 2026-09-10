/**
 * 크레딧 시스템 상수
 */

// ── AI Purpose 키 (Backend AIPurpose Enum과 1:1 대응) ──

export const AI_PURPOSE = {
  SKILL_SELECTION: 'skill_selection',
  FIELD_NOTE_STT_CHUNK: 'field_note_stt_chunk',
  FIELD_NOTE_STT_DIARIZE: 'field_note_stt_diarize',
  FIELD_NOTE_STT_STREAMING: 'field_note_stt_streaming',
  FIELD_NOTE_REFINE: 'field_note_refine',
  FIELD_NOTE_SUMMARIZE: 'field_note_summarize',
  FIELD_NOTE_GENERATE_NOTE: 'field_note_generate_note',
  FIELD_NOTE_RECOMMENDATION: 'field_note_recommendation',
  CASE_ANALYSIS: 'case_analysis'
} as const

export type AIPurposeKey = (typeof AI_PURPOSE)[keyof typeof AI_PURPOSE]

// ── AI 기능 그룹 (Admin FeatureCostTable GROUP_DEFS와 1:1 대응) ──
// 두 앱에서 동일한 그룹 라벨·범위를 사용하기 위한 단일 정의.

export const AI_GROUP = {
  FIELD_NOTE: 'field_note',
  STT: 'stt',
  CASE_ANALYSIS: 'case_analysis',
  AGENT: 'agent',
  VOUCHER: 'voucher'
} as const

export type AIGroupKey = (typeof AI_GROUP)[keyof typeof AI_GROUP]

/** 그룹 표시 라벨 — 사용자에게 노출되는 카테고리명 */
export const GROUP_LABELS: Readonly<Record<AIGroupKey, string>> = {
  [AI_GROUP.FIELD_NOTE]: 'AI 상담일지',
  [AI_GROUP.STT]: '화자분리',
  [AI_GROUP.CASE_ANALYSIS]: 'AI 상담사례',
  [AI_GROUP.AGENT]: '채팅 에이전트',
  [AI_GROUP.VOUCHER]: '바우처'
}

/** purpose → 그룹 매핑 */
export const PURPOSE_TO_GROUP: Readonly<Partial<Record<string, AIGroupKey>>> = {
  [AI_PURPOSE.FIELD_NOTE_SUMMARIZE]: AI_GROUP.FIELD_NOTE,
  [AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE]: AI_GROUP.FIELD_NOTE,
  [AI_PURPOSE.FIELD_NOTE_RECOMMENDATION]: AI_GROUP.FIELD_NOTE,
  [AI_PURPOSE.FIELD_NOTE_STT_CHUNK]: AI_GROUP.STT,
  [AI_PURPOSE.FIELD_NOTE_STT_DIARIZE]: AI_GROUP.STT,
  [AI_PURPOSE.FIELD_NOTE_STT_STREAMING]: AI_GROUP.STT,
  [AI_PURPOSE.FIELD_NOTE_REFINE]: AI_GROUP.STT,
  [AI_PURPOSE.CASE_ANALYSIS]: AI_GROUP.CASE_ANALYSIS,
  [AI_PURPOSE.SKILL_SELECTION]: AI_GROUP.AGENT
}

// ── 무료 purpose (크레딧 차감 없음) — Backend FREE_PURPOSES와 1:1 대응 ──

export const FREE_PURPOSES: ReadonlySet<string> = new Set([
  AI_PURPOSE.FIELD_NOTE_STT_CHUNK,
  AI_PURPOSE.FIELD_NOTE_STT_DIARIZE,
  AI_PURPOSE.FIELD_NOTE_STT_STREAMING,
  AI_PURPOSE.FIELD_NOTE_REFINE,
  AI_PURPOSE.FIELD_NOTE_RECOMMENDATION
])

// ── 기능별 예상 크레딧 소비량 — Backend PURPOSE_ESTIMATED_CREDITS와 1:1 대응 ──
//
// ⚠️ 이 표는 **표시 전용**이다(`estimatedCostLabel`). 실행 가능 여부(`canAfford`)는
// API가 내려주는 `estimated_credits`로 판정하므로 서버가 늘 정본이다.
// 그래서 여기가 낡아도 게이트는 맞고 **숫자만 틀리게 보인다** — 실제로 서버가
// case_analysis를 11→14로 올렸을 때 이 값이 11로 남아 모달이 '~11 크레딧'을
// 띄우고 있었다(2026-09-03 교정). 서버 값을 바꾸면 여기도 같이 고친다.

export const PURPOSE_ESTIMATED_CREDITS: Readonly<Record<string, number>> = {
  [AI_PURPOSE.SKILL_SELECTION]: 3,
  [AI_PURPOSE.FIELD_NOTE_SUMMARIZE]: 7,
  [AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE]: 8,
  [AI_PURPOSE.FIELD_NOTE_RECOMMENDATION]: 2,
  [AI_PURPOSE.CASE_ANALYSIS]: 14
}

// ── 한글 라벨 — Backend PURPOSE_LABELS와 1:1 대응 ──

export const PURPOSE_LABELS: Readonly<Record<string, string>> = {
  [AI_PURPOSE.SKILL_SELECTION]: 'AI 에이전트',
  [AI_PURPOSE.FIELD_NOTE_STT_CHUNK]: '음성 전사 (STT)',
  [AI_PURPOSE.FIELD_NOTE_STT_DIARIZE]: '화자분리 전사',
  [AI_PURPOSE.FIELD_NOTE_STT_STREAMING]: '실시간 음성 전사',
  [AI_PURPOSE.FIELD_NOTE_REFINE]: '텍스트 정제',
  [AI_PURPOSE.FIELD_NOTE_SUMMARIZE]: '상담 요약',
  [AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE]: '상담일지 생성',
  [AI_PURPOSE.FIELD_NOTE_RECOMMENDATION]: '추천 생성',
  [AI_PURPOSE.CASE_ANALYSIS]: '상담 사례분석'
}

// ── 임계값 ──

/** 크레딧 경고 임계값 (%) — 사용 비율이 이 값 이상이면 경고 */
export const CREDIT_WARNING_THRESHOLD = 70

/** 크레딧 위험 임계값 (%) — 사용 비율이 이 값 이상이면 위험 */
export const CREDIT_DANGER_THRESHOLD = 90

/** 최근 활동 최대 표시 건수 */
export const HISTORY_DISPLAY_LIMIT = 50

/** 일별 차트 표시 일수 */
export const DAILY_CHART_DAYS = 14

/** 토큰 → 크레딧 변환 비율 (기본값).
 * 실제 비율은 API 응답의 tokens_per_credit 필드를 사용.
 * 이 값은 API 응답이 없을 때의 fallback 용도. */
export const DEFAULT_TOKENS_PER_CREDIT = 2000

/** 용도별 스타일 (아이콘 배경/텍스트 색상) — PURPOSE_COLORS와 1:1 대응 */
export const PURPOSE_STYLES: Record<string, { bg: string; text: string }> = {
  [AI_PURPOSE.SKILL_SELECTION]: {
    bg: 'bg-purple-100',
    text: 'text-purple-500'
  },
  [AI_PURPOSE.FIELD_NOTE_STT_CHUNK]: {
    bg: 'bg-violet-100',
    text: 'text-violet-500'
  },
  [AI_PURPOSE.FIELD_NOTE_STT_DIARIZE]: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-500'
  },
  [AI_PURPOSE.FIELD_NOTE_STT_STREAMING]: {
    bg: 'bg-violet-100',
    text: 'text-violet-600'
  },
  [AI_PURPOSE.FIELD_NOTE_REFINE]: {
    bg: 'bg-amber-100',
    text: 'text-amber-500'
  },
  [AI_PURPOSE.FIELD_NOTE_SUMMARIZE]: { bg: 'bg-sky-100', text: 'text-sky-500' },
  [AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE]: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-500'
  },
  [AI_PURPOSE.FIELD_NOTE_RECOMMENDATION]: {
    bg: 'bg-pink-100',
    text: 'text-pink-500'
  },
  [AI_PURPOSE.CASE_ANALYSIS]: { bg: 'bg-cyan-100', text: 'text-cyan-500' }
}

export const DEFAULT_PURPOSE_STYLE = {
  bg: 'bg-indigo-100',
  text: 'text-indigo-500'
}

/** 상태별 Tailwind 클래스 */
export const STATUS_STYLES = {
  normal: { bar: 'bg-primary-500', text: 'text-primary-500' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-500' },
  danger: { bar: 'bg-red-500', text: 'text-red-500' }
} as const

// ── 게이지 색상 스킴 ──

export const GAUGE_COLORS = {
  green: {
    bar: 'bg-primary-500',
    text: 'text-primary-600',
    icon: 'text-primary-500'
  },
  yellow: {
    bar: 'bg-amber-400',
    text: 'text-amber-600',
    icon: 'text-amber-500'
  },
  red: { bar: 'bg-red-500', text: 'text-red-500', icon: 'text-red-500' }
} as const

// ── 기능별 통합 색상 (purpose 키 기반) ──

/** purpose → { hex: SVG용, bg: Tailwind bg 클래스 } */
export const PURPOSE_COLORS: Record<string, { hex: string; bg: string }> = {
  [AI_PURPOSE.FIELD_NOTE_STT_CHUNK]: { hex: '#8b5cf6', bg: 'bg-violet-500' },
  [AI_PURPOSE.FIELD_NOTE_STT_DIARIZE]: { hex: '#6366f1', bg: 'bg-indigo-500' },
  [AI_PURPOSE.FIELD_NOTE_STT_STREAMING]: {
    hex: '#7c3aed',
    bg: 'bg-violet-600'
  },
  [AI_PURPOSE.FIELD_NOTE_REFINE]: { hex: '#f59e0b', bg: 'bg-amber-500' },
  [AI_PURPOSE.FIELD_NOTE_SUMMARIZE]: { hex: '#0ea5e9', bg: 'bg-sky-500' },
  [AI_PURPOSE.FIELD_NOTE_GENERATE_NOTE]: {
    hex: '#10b981',
    bg: 'bg-emerald-500'
  },
  [AI_PURPOSE.FIELD_NOTE_RECOMMENDATION]: { hex: '#ec4899', bg: 'bg-pink-500' },
  [AI_PURPOSE.CASE_ANALYSIS]: { hex: '#06b6d4', bg: 'bg-cyan-500' },
  [AI_PURPOSE.SKILL_SELECTION]: { hex: '#a855f7', bg: 'bg-purple-500' }
}

export const DEFAULT_PURPOSE_COLOR = { hex: '#6b7280', bg: 'bg-gray-500' }

/** 하위 호환: 인덱스 기반 fallback */
export const PURPOSE_BAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-red-500'
] as const

// ── 크레딧 쿼리 캐시 전략 (컴포넌트 간 통일) ──

/** 크레딧 데이터 staleTime (ms) — 이 시간 내 재요청 시 캐시 반환 */
export const CREDIT_STALE_TIME = 30_000

/** 크레딧 자동 갱신 주기 (ms) — 백그라운드 refetch */
export const CREDIT_REFETCH_INTERVAL = 60_000

/** 사이드바 전용 staleTime (긴 주기) */
export const CREDIT_SIDEBAR_STALE_TIME = 60_000

/** 사이드바 전용 refetch 주기 */
export const CREDIT_SIDEBAR_REFETCH_INTERVAL = 120_000
