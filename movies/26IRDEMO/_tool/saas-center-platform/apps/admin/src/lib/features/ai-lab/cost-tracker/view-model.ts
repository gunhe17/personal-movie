/**
 * Cost Tracker - ViewModel
 */

import type {
  CostSummaryResponse,
  CostByPurpose,
  CostByType,
  LabMetadataResponse,
} from '$hooks/actions/aiLab.action'
import { formatCostKRW, formatTokens, formatDuration } from '../constants'
import { getPurposeLabel, getExperimentTypeLabel } from '../metadata-helpers'

export interface CostByPurposeVM {
  purpose: string
  purposeLabel: string
  model: string
  calls: number
  inputTokens: string
  outputTokens: string
  audioSeconds: string
  cost: string
}

export function mapCostByPurpose(item: CostByPurpose, meta?: LabMetadataResponse | null): CostByPurposeVM {
  return {
    purpose: item.purpose,
    purposeLabel: getPurposeLabel(meta, item.purpose),
    model: item.model,
    calls: item.calls,
    inputTokens: formatTokens(item.input_tokens),
    outputTokens: formatTokens(item.output_tokens),
    audioSeconds: formatDuration(item.audio_seconds),
    cost: formatCostKRW(item.estimated_cost_usd),
  }
}

// ── 실험 유형별 ──

export interface CostByTypeVM {
  type: string
  typeLabel: string
  runs: number
  cost: string
  avgLatency: string
}

export function mapCostByType(item: CostByType, meta?: LabMetadataResponse | null): CostByTypeVM {
  return {
    type: item.type,
    typeLabel: getExperimentTypeLabel(meta, item.type),
    runs: item.runs,
    cost: formatCostKRW(item.cost_usd),
    avgLatency: item.avg_latency_ms ? `${Math.round(item.avg_latency_ms)}ms` : '-',
  }
}

// ── 통합 요약 ──

export interface CostSummaryVM {
  production: {
    totalCalls: number
    totalCost: string
    totalTokens: string
    totalAudio: string
    byPurpose: CostByPurposeVM[]
  }
  lab: {
    totalRuns: number
    totalCost: string
    totalTokens: string
    totalAudio: string
    byType: CostByTypeVM[]
  }
  grandTotalCost: string
}

export function mapCostSummary(data: CostSummaryResponse, meta?: LabMetadataResponse | null): CostSummaryVM {
  const p = data.production
  const l = data.lab
  return {
    production: {
      totalCalls: p.total_calls,
      totalCost: formatCostKRW(p.estimated_cost_usd),
      totalTokens: formatTokens(p.total_input_tokens + p.total_output_tokens),
      totalAudio: formatDuration(p.total_audio_seconds),
      byPurpose: p.by_purpose.map((bp) => mapCostByPurpose(bp, meta)),
    },
    lab: {
      totalRuns: l.total_runs,
      totalCost: formatCostKRW(l.estimated_cost_usd),
      totalTokens: formatTokens(l.total_input_tokens + l.total_output_tokens),
      totalAudio: formatDuration(l.total_audio_seconds),
      byType: l.by_type.map((bt) => mapCostByType(bt, meta)),
    },
    grandTotalCost: formatCostKRW(p.estimated_cost_usd + l.estimated_cost_usd),
  }
}
