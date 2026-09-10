/**
 * AI Lab - 공통 상수 및 유틸
 *
 * 동적 데이터(실험 유형, 모델 목록, 파이프라인 스텝, purpose 라벨 등)는
 * GET /ai-lab/metadata API에서 가져오며, metadata-helpers.ts 헬퍼로 접근.
 * 여기에는 라우트/UI 전용 고정 상수와 포맷팅 유틸만 유지.
 */

// ── 실험 상태 (고정 enum, 백엔드와 일치) ──

export const EXPERIMENT_STATUS = {
  pending: { label: '대기', color: 'gray' },
  running: { label: '실행 중', color: 'blue' },
  completed: { label: '완료', color: 'green' },
  failed: { label: '실패', color: 'red' },
} as const

export type ExperimentStatus = keyof typeof EXPERIMENT_STATUS

// ── 비교 모드 (UI 전용) ──

export const MAX_COMPARE_ITEMS = 2
export const COMPARE_LABELS = ['A', 'B'] as const

// ── 공유 유틸 ──

export function getStatusDisplay(status: string): { label: string; color: string } {
  const s = EXPERIMENT_STATUS[status as keyof typeof EXPERIMENT_STATUS]
  return { label: s?.label ?? status, color: s?.color ?? 'gray' }
}

export function parseOutputJson(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

// ── 비용 포맷 ──

/** 고정 환율 (추후 API 연동 가능) */
export const USD_TO_KRW = 1_400

export function formatCostUSD(cost: number | null | undefined): string {
  if (cost == null) return '-'
  if (cost < 0.001) return `$${cost.toFixed(6)}`
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

/** KRW 주 통화 표시 (운영 관리자용) */
export function formatCostKRW(costUsd: number | null | undefined): string {
  if (costUsd == null) return '-'
  const krw = costUsd * USD_TO_KRW
  if (krw < 1) return '< 1원'
  if (krw < 100) return `약 ${Math.round(krw)}원`
  return `약 ${Math.round(krw).toLocaleString()}원`
}

/** 원화 주 표시 + 달러 보조 (예: "약 4,480원 ($3.20)") */
export function formatCostDual(costUsd: number | null | undefined): string {
  if (costUsd == null) return '-'
  return `${formatCostKRW(costUsd)} (${formatCostUSD(costUsd)})`
}

export function formatDateKST(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export function formatDateShortKST(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null) return '-'
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return '-'
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`
  return `${ms}ms`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}
