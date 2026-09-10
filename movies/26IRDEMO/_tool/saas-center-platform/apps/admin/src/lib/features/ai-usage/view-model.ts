import { formatCostKRW } from '$lib/features/ai-lab/constants'
import type { AlertLevel } from './constants'
import { ALERT_THRESHOLDS } from './constants'
import type { AiUsageSummary } from '$hooks/actions/ai-usage.action'

export { formatCostKRW as fmtKRW }

export function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return fmtNum(n)
}

export function fmtAudioMin(min: number): string {
  if (min >= 60) return `${(min / 60).toFixed(1)}h`
  return `${Math.round(min)}분`
}

export type ChangePctDisplay = {
  label: string
  color: string
  bgColor: string
  arrow: string
}

export function changePctDisplay(pct: number | null): ChangePctDisplay | null {
  if (pct == null) return null
  if (Math.abs(pct) < 1) return { label: '유지', color: 'text-gray-500', bgColor: 'bg-gray-50', arrow: '' }
  return pct > 0
    ? { label: `+${Math.round(pct)}%`, color: 'text-red-600', bgColor: 'bg-red-50', arrow: '↑' }
    : { label: `${Math.round(pct)}%`, color: 'text-emerald-600', bgColor: 'bg-emerald-50', arrow: '↓' }
}

export function calcAlertLevel(summary: AiUsageSummary | null | undefined): AlertLevel {
  if (!summary || summary.cost_change_pct == null) return 'normal'
  const pct = summary.cost_change_pct
  if (pct >= ALERT_THRESHOLDS.critical) return 'critical'
  if (pct >= ALERT_THRESHOLDS.warning) return 'warning'
  return 'normal'
}

export function calcAlertMessage(
  summary: AiUsageSummary | null | undefined,
  level: AlertLevel,
): string {
  if (!summary || level === 'normal') return 'AI 비용이 정상 범위입니다'
  const pct = Math.round(summary.cost_change_pct ?? 0)
  if (level === 'critical') return `전월 대비 비용 ${pct}% 급증 — 즉각 점검 필요`
  return `전월 대비 비용 ${pct}% 증가 — 모니터링 권장`
}

// 전체 평균 대비 배수 (소수점 1자리)
export function fmtMultiplier(value: number, avg: number): string {
  if (avg <= 0) return '-'
  const x = value / avg
  return `${x.toFixed(1)}x`
}
