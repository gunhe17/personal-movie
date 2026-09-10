/**
 * Subscription 상수
 *
 * 플랜 라벨·배지·기능 라벨 등은 API(PlanMeta)에서 동적으로 제공됩니다.
 * 아래 값은 API 응답이 불완전하거나 로딩 전일 때의 폴백(fallback)입니다.
 */

// ── 플랜 라벨 (폴백) ──

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
}

// ── 플랜 상태 라벨 ──

export const STATUS_LABELS: Record<string, string> = {
  active: '활성',
  pending: '승인 대기',
  pending_payment: '결제 대기',
  payment_failed: '결제 실패',
  expired: '만료',
  cancelled: '취소됨',
}

// ── 플랜 배지 색상 (폴백) ──

export const PLAN_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: 'bg-gray-100', text: 'text-gray-600' },
  starter: { bg: 'bg-blue-50', text: 'text-blue-600' },
  pro: { bg: 'bg-violet-50', text: 'text-violet-600' },
}

export const DEFAULT_BADGE_COLOR = { bg: 'bg-gray-100', text: 'text-gray-600' }

// ── 기능 플래그 라벨 (폴백 — API PlanMeta.feature_labels 우선) ──

export const FEATURE_LABELS: Record<string, string> = {
  ai_field_note: 'AI 상담일지',
  ai_agent: 'AI 업무 도우미',
  ai_case_analysis: '내담자 변화 분석',
  billing: '통합 청구',
  api_access: '외부 연동',
}

/** 기능별 한 줄 설명 (폴백 — API PlanMeta.feature_descriptions 우선) */
export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  ai_field_note: '상담 녹음을 AI가 듣고 상담일지를 자동으로 작성해 줍니다',
  ai_agent: '말로 지시하면 일정 잡기, 검사 접수, 내담자 찾기를 대신합니다',
  ai_case_analysis: '내담자의 회기별 변화를 자동으로 추적하고 요약합니다',
  billing: '바우처·수납을 한 곳에서 관리합니다',
  api_access: '외부 시스템과 데이터를 주고받을 수 있습니다',
}

// ── 플랜 적합도 임계값 ──

/** 적합도: 이 값 미만이면 "부족" */
export const PLAN_FIT_THRESHOLD_TIGHT = 0
/** 적합도: 이 값 미만이면 "비슷한 수준" */
export const PLAN_FIT_THRESHOLD_MODERATE = 15
/** 적합도: 이 값 미만이면 "여유" (이상이면 "충분") */
export const PLAN_FIT_THRESHOLD_COMFORTABLE = 50

export const PLAN_FIT_MESSAGES = {
  insufficient: '현재 사용량 기준 크레딧이 부족합니다',
  tight: '현재 사용량과 비슷한 수준입니다',
  comfortable: '여유 있게 사용할 수 있습니다',
  plenty: '충분한 여유가 있습니다',
} as const

// ── 크레딧 소진 예측 임계값 ──

/** 소진 예측: 이 일수 이하면 위험(red) */
export const DEPLETION_CRITICAL_DAYS = 3
/** 소진 예측: 이 일수 이하면 경고(amber) */
export const DEPLETION_WARNING_DAYS = 7

// ── 쿼리 캐시 전략 ──

/** 구독 staleTime — 플랜 변경은 드물므로 길게 */
export const SUBSCRIPTION_STALE_TIME = 300_000 // 5분

/** 사이드바 전용 refetch 주기 */
export const SUBSCRIPTION_REFETCH_INTERVAL = 600_000 // 10분
