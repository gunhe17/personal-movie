/**
 * 기능 테스트 ViewModel — API 응답 → UI 변환, 크레딧 검증
 */

import { DEFAULT_TOKENS_PER_CREDIT } from './constants'
import type { CreditBalance } from '$lib/hooks/actions/featureTest.action'

// ── 크레딧 유틸 ──

export function getCreditPercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export function getCreditStatus(usagePercent: number): 'normal' | 'warning' | 'danger' {
  if (usagePercent >= 90) return 'danger'
  if (usagePercent >= 70) return 'warning'
  return 'normal'
}

export const CREDIT_STATUS_STYLES: Record<string, { text: string; bar: string }> = {
  normal: { text: 'text-emerald-600', bar: 'bg-emerald-500' },
  warning: { text: 'text-amber-500', bar: 'bg-amber-400' },
  danger: { text: 'text-red-500', bar: 'bg-red-500' },
}

// ── 플로우 단계 VM ──

export type FlowStepStatus = 'idle' | 'active' | 'completed' | 'error'

export interface FlowStep {
  key: string
  label: string
  description: string
  status: FlowStepStatus
}

export function mapToSimpleFlowSteps(
  defs: Array<{ key: string; label: string; description: string }>,
  runningAction: string | null,
  featureAction: string,
  hasResult: boolean,
  hasError: boolean,
): FlowStep[] {
  if (hasError) return defs.map((d, i) => ({ ...d, status: i < defs.length - 1 ? 'completed' as const : 'error' as const }))
  if (hasResult) return defs.map((d) => ({ ...d, status: 'completed' as const }))
  if (runningAction === featureAction) return defs.map((d) => ({ ...d, status: 'active' as const }))
  return defs.map((d) => ({ ...d, status: 'idle' as const }))
}

// ── 크레딧 검증 ──

export interface CreditSnapshot {
  used: number
  remaining: number
  limit: number
  tokensPerCredit: number
}

export interface CreditVerification {
  before: CreditSnapshot
  after: CreditSnapshot
  totalTokens: number
  expectedCredits: number
  actualCredits: number
  isMatch: boolean
}

export function snapshotCredit(data: CreditBalance): CreditSnapshot {
  return {
    used: data.credit_used,
    remaining: data.credit_remaining,
    limit: data.credit_limit,
    tokensPerCredit: data.tokens_per_credit ?? DEFAULT_TOKENS_PER_CREDIT,
  }
}

export function buildCreditVerification(
  before: CreditSnapshot,
  after: CreditSnapshot,
  totalTokens: number,
): CreditVerification {
  const tpc = before.tokensPerCredit > 0 ? before.tokensPerCredit : DEFAULT_TOKENS_PER_CREDIT
  const expectedCredits = totalTokens > 0 ? Math.max(1, Math.ceil(totalTokens / tpc)) : 0
  const actualCredits = after.used - before.used
  return {
    before,
    after,
    totalTokens,
    expectedCredits,
    actualCredits,
    isMatch: actualCredits === expectedCredits || Math.abs(actualCredits - expectedCredits) <= 1,
  }
}

// ── 실행 이력 ──

export interface ExecutionLogEntry {
  id: string
  featureId: string
  featureName: string
  action: string
  status: 'success' | 'error' | 'running'
  timestamp: string
  model: string | null
  creditsUsed: number | null
  preview: string | null
  rawJson: any | null
}

let logCounter = 0
export function createLogEntry(
  featureId: string,
  featureName: string,
  action: string,
  status: ExecutionLogEntry['status'],
  extra: { model?: string | null; credits?: number | null; preview?: string | null; rawJson?: any } = {},
): ExecutionLogEntry {
  return {
    id: `log-${++logCounter}-${Date.now()}`,
    featureId,
    featureName,
    action,
    status,
    timestamp: new Date().toISOString(),
    model: extra.model ?? null,
    creditsUsed: extra.credits ?? null,
    preview: extra.preview ?? null,
    rawJson: extra.rawJson ?? null,
  }
}
