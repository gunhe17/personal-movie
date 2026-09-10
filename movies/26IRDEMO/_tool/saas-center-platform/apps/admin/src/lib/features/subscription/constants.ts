/**
 * Admin 구독 관리 — 공유 상수
 *
 * ── 설계 원칙 ──
 * 센터 접근 차단 = Center suspend/terminate (is_active)
 * 구독 상태 = 플랜/결제 라이프사이클 (subscription status)
 *
 * 현재(무료 운영): trial, active, pending 사용
 * 결제 연동 시 확장: pending_payment, payment_failed, expired, cancelled
 */

// ── 플랜 ──
// 플랜 목록(어떤 플랜이 존재하는가)의 정본은 getPlanConfigs() = GET /admin/platform-settings/plans.
// 아래 맵들은 API 로드 전 fallback + 정적 표현(hex 색상 등)일 뿐 — 플랜을 여기서 순회하지 말 것.

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

/** 뱃지용 Tailwind 클래스 */
export const PLAN_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: 'bg-gray-100', text: 'text-gray-600' },
  starter: { bg: 'bg-blue-50', text: 'text-blue-700' },
  pro: { bg: 'bg-purple-50', text: 'text-purple-700' },
  enterprise: { bg: 'bg-amber-50', text: 'text-amber-700' },
}

/** 차트(도넛) 렌더링용 hex 색상 — API가 hex를 안 주므로 정적 유지 */
export const PLAN_CHART_COLORS: Record<string, string> = {
  free: '#9ca3af',
  starter: '#3b82f6',
  pro: '#a855f7',
  enterprise: '#f59e0b',
}

/** 미등록 플랜용 폴백 팔레트 — 플랜 목록은 getPlanConfigs()가 정본, 색상만 정적 보강 */
const PLAN_CHART_FALLBACK = ['#9ca3af', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4']
export function planChartColor(planType: string, order = 0): string {
  return PLAN_CHART_COLORS[planType] ?? PLAN_CHART_FALLBACK[order % PLAN_CHART_FALLBACK.length]
}

// ── 상태 ──

export interface StatusStyle {
  label: string
  dot: string
  bg: string
  text: string
}

/**
 * 구독 상태 뱃지 스타일 — 백엔드에서 올 수 있는 모든 상태를 렌더링할 수 있도록 유지.
 * 현재 운영에서 실제로 발생하는 상태: trial, active, pending
 */
export const STATUS_MAP: Record<string, StatusStyle> = {
  trial: { label: '무료', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  active: { label: '활성', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  pending: { label: '승인 대기', dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  // 결제 연동 후 활성화
  expired: { label: '만료', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' },
  cancelled: { label: '해지', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600' },
  pending_payment: { label: '결제 대기', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  payment_failed: { label: '결제 실패', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-600' },
}

export const QUOTA_EXCEEDED_BADGE: StatusStyle = {
  label: '쿼터 초과',
  dot: 'bg-red-500',
  bg: 'bg-red-50',
  text: 'text-red-600',
}

// ── AI 기능 ──

export const FEATURE_LABELS: Record<string, string> = {
  ai_field_note: 'AI 필드노트',
  ai_agent: 'AI 에이전트',
  ai_case_analysis: '종단 분석',
  api_access: 'API 연동',
}

/** 기능별 바 차트 색상 (hex) */
export const FEATURE_BAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
] as const

// ── 필터 옵션 ──
// 플랜 필터 옵션은 페이지에서 getPlanConfigs() 결과로 파생 (하드코딩 시 새 플랜 누락).

/**
 * 구독 상태 필터 옵션 — 현재 운영에서 발생하는 상태만 노출.
 * 결제 연동 시 pending_payment, payment_failed, expired, cancelled 추가.
 */
export const STATUS_OPTIONS = [
  { value: 'all', title: '전체 상태' },
  { value: 'trial', title: '무료' },
  { value: 'active', title: '활성' },
  { value: 'pending', title: '승인 대기' },
  // 결제 연동 후 추가:
  // { value: 'pending_payment', title: '결제 대기' },
  // { value: 'payment_failed', title: '결제 실패' },
  // { value: 'expired', title: '만료' },
  // { value: 'cancelled', title: '해지' },
]

// ── 크레딧 사용률 임계값 ──

export const CREDIT_USAGE_THRESHOLDS = {
  WARNING: 70,
  DANGER: 90,
} as const

export const PAGE_SIZE = 20

// 플랜 티어 순서(업/다운그레이드 판단)는 PlanConfigItem.plan_order 사용 (planLookup.get(plan)?.plan_order).

/**
 * 상태 전이 State Machine — 현재 운영에서 가능한 전이만 정의.
 * 센터 접근 차단(정지/해지)은 센터 관리(suspend/terminate)에서 처리.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  trial: ['active'],
  active: ['pending'],
  pending: ['active'],
  // 결제 연동 후 확장:
  // trial: ['active', 'expired'],
  // active: ['pending', 'pending_payment', 'cancelled'],
  // pending_payment: ['active', 'payment_failed'],
  // payment_failed: ['active', 'cancelled'],
  // cancelled: ['active'],
  // expired: ['active'],
}

/** 상태 라벨 — 모달 드롭다운, 이력 표시, 강제 전이 등 모든 상태 커버 */
export const STATUS_LABELS: Record<string, string> = {
  trial: '무료',
  active: '활성',
  pending: '승인 대기',
  pending_payment: '결제 대기',
  payment_failed: '결제 실패',
  expired: '만료',
  cancelled: '해지',
}

/**
 * 강제 전이 시 선택 가능한 전체 상태 목록.
 * 현재 상태와 동일한 상태는 모달에서 제외됨.
 */
export const ALL_STATUSES = ['trial', 'active', 'pending', 'pending_payment', 'payment_failed', 'expired', 'cancelled'] as const
