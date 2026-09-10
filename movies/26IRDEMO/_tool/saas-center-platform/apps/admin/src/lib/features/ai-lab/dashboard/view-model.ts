/**
 * Dashboard - ViewModel (API → UI 변환)
 */

import type {
  ExperimentRunSummary,
  CostSummaryResponse,
  LabMetadataResponse,
} from '$hooks/actions/aiLab.action'
import {
  formatCostUSD,
  formatCostKRW,
  formatTokens,
  formatLatency,
  getStatusDisplay,
} from '../constants'
import { getExperimentTypeLabel, getPurposeLabel } from '../metadata-helpers'

// ── 모델명 간소화 (날짜 suffix 제거) ──

function simplifyModelName(name: string): string {
  return name.replace(/-\d{4}-\d{2}-\d{2}$/, '')
}

// ── Experiment VM ──

export interface ExperimentVM {
  id: string
  typeLabel: string
  modelName: string
  statusLabel: string
  statusColor: string
  latency: string
  cost: string
  createdAt: string
}

export function mapExperiment(item: ExperimentRunSummary, meta?: LabMetadataResponse | null): ExperimentVM {
  const typeLabel = getExperimentTypeLabel(meta, item.experiment_type)
  const { label: statusLabel, color: statusColor } = getStatusDisplay(item.status)
  return {
    id: item.id,
    typeLabel,
    modelName: simplifyModelName(item.model_name),
    statusLabel,
    statusColor,
    latency: formatLatency(item.latency_ms),
    cost: formatCostKRW(item.estimated_cost_usd),
    createdAt: new Date(item.created_at).toLocaleDateString('ko-KR'),
  }
}

// ── KPI Cards VM (관리자 친화적) ──

export interface KpiCardVM {
  label: string
  value: string
  sub: string
  color: 'emerald' | 'blue' | 'violet' | 'amber'
  icon: 'dollar' | 'server' | 'flask' | 'clock'
}

export function buildKpiCards(cost: CostSummaryResponse | null): KpiCardVM[] {
  const p = cost?.production
  const l = cost?.lab
  const totalCostUsd = (p?.estimated_cost_usd ?? 0) + (l?.estimated_cost_usd ?? 0)
  const prodCostUsd = p?.estimated_cost_usd ?? 0
  const labCostUsd = l?.estimated_cost_usd ?? 0

  return [
    {
      label: '총 AI 비용',
      value: formatCostKRW(totalCostUsd),
      sub: formatCostUSD(totalCostUsd),
      color: 'emerald',
      icon: 'dollar',
    },
    {
      label: '서비스 운영',
      value: `${(p?.total_calls ?? 0).toLocaleString()}건`,
      sub: formatCostKRW(prodCostUsd),
      color: 'blue',
      icon: 'server',
    },
    {
      label: '실험실 테스트',
      value: `${(l?.total_runs ?? 0).toLocaleString()}회`,
      sub: formatCostKRW(labCostUsd),
      color: 'violet',
      icon: 'flask',
    },
  ]
}

// ── Cost Breakdown VM (수평 바 차트) ──

export interface CostBarItem {
  key: string
  label: string
  model: string
  cost: string
  costKrw: string
  costRaw: number
  percentage: number
  calls: number
  extraLabel: string
  labLink: string | null
}

// purpose → Lab 스텝 매핑 (해당 스텝 실험실로 바로 이동)
const PURPOSE_TO_LAB_STEP: Record<string, string> = {
  field_note_stt_chunk: 'stt_transcribe',
  field_note_stt_diarize: 'chain_stt_refine',
  field_note_refine: 'refine',
  field_note_recommendation: 'recommendation',
  field_note_summarize: 'summary',
  field_note_generate_note: 'counseling_note',
  case_analysis: 'case_analysis',
}

export interface CostBreakdownVM {
  title: string
  description: string
  totalCost: string
  totalCostKrw: string
  totalCount: number
  countLabel: string
  items: CostBarItem[]
  maxCostRaw: number
  emptyMessage: string
  emptyLink: { href: string; label: string } | null
}

export function buildProductionCostBreakdown(
  cost: CostSummaryResponse | null,
  meta?: LabMetadataResponse | null,
): CostBreakdownVM {
  const empty: CostBreakdownVM = {
    title: '서비스 운영 비용',
    description: '실제 센터에서 사용된 AI 기능별 비용',
    totalCost: '$0.00',
    totalCostKrw: formatCostKRW(0),
    totalCount: 0,
    countLabel: '건',
    items: [],
    maxCostRaw: 0,
    emptyMessage: '아직 AI 기능이 사용되지 않았습니다',
    emptyLink: null,
  }
  if (!cost || cost.production.by_purpose.length === 0) return empty

  const p = cost.production
  const totalUsd = p.estimated_cost_usd || 1 // prevent div-by-zero

  // 같은 purpose끼리 합산 (백엔드가 purpose+model로 분리 반환)
  const grouped = new Map<string, { costRaw: number; calls: number; tokens: number; models: Set<string> }>()
  for (const bp of p.by_purpose) {
    const existing = grouped.get(bp.purpose)
    if (existing) {
      existing.costRaw += bp.estimated_cost_usd
      existing.calls += bp.calls
      existing.tokens += bp.input_tokens + bp.output_tokens
      existing.models.add(simplifyModelName(bp.model))
    } else {
      grouped.set(bp.purpose, {
        costRaw: bp.estimated_cost_usd,
        calls: bp.calls,
        tokens: bp.input_tokens + bp.output_tokens,
        models: new Set([simplifyModelName(bp.model)]),
      })
    }
  }

  const items: CostBarItem[] = [...grouped.entries()]
    .sort(([, a], [, b]) => b.costRaw - a.costRaw)
    .map(([purpose, g]) => {
      const step = PURPOSE_TO_LAB_STEP[purpose]
      return {
        key: purpose,
        label: getPurposeLabel(meta, purpose),
        model: [...g.models].join(', '),
        cost: formatCostUSD(g.costRaw),
        costKrw: formatCostKRW(g.costRaw),
        costRaw: g.costRaw,
        percentage: Math.round((g.costRaw / totalUsd) * 100),
        calls: g.calls,
        extraLabel: `${g.calls.toLocaleString()}건`,
        labLink: step ? `/ai-lab/lab?step=${step}` : null,
      }
    })

  return {
    title: '서비스 운영 비용',
    description: '실제 센터에서 사용된 AI 기능별 비용',
    totalCost: formatCostUSD(p.estimated_cost_usd),
    totalCostKrw: formatCostKRW(p.estimated_cost_usd),
    totalCount: p.total_calls,
    countLabel: '건',
    items,
    maxCostRaw: items[0]?.costRaw ?? 0,
    emptyMessage: '',
    emptyLink: null,
  }
}

export function buildLabCostBreakdown(
  cost: CostSummaryResponse | null,
  meta?: LabMetadataResponse | null,
): CostBreakdownVM {
  const empty: CostBreakdownVM = {
    title: '실험실 테스트 비용',
    description: '프롬프트·모델 테스트에 사용된 비용',
    totalCost: '$0.00',
    totalCostKrw: formatCostKRW(0),
    totalCount: 0,
    countLabel: '회',
    items: [],
    maxCostRaw: 0,
    emptyMessage: '실험 데이터가 없습니다',
    emptyLink: { href: '/ai-lab/lab', label: '실험실에서 첫 실험 실행하기 →' },
  }
  if (!cost || cost.lab.by_type.length === 0) return empty

  const l = cost.lab
  const totalUsd = l.estimated_cost_usd || 1

  const items: CostBarItem[] = l.by_type
    .slice()
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .map((bt) => {
      const step = bt.type.startsWith('llm_') ? bt.type.slice(4) : bt.type
      return {
        key: bt.type,
        label: getExperimentTypeLabel(meta, bt.type),
        model: '',
        cost: formatCostUSD(bt.cost_usd),
        costKrw: formatCostKRW(bt.cost_usd),
        costRaw: bt.cost_usd,
        percentage: Math.round((bt.cost_usd / totalUsd) * 100),
        calls: bt.runs,
        extraLabel: `${bt.runs.toLocaleString()}회`,
        labLink: `/ai-lab/lab?step=${step}`,
      }
    })

  return {
    title: '실험실 테스트 비용',
    description: '프롬프트·모델 테스트에 사용된 비용',
    totalCost: formatCostUSD(l.estimated_cost_usd),
    totalCostKrw: formatCostKRW(l.estimated_cost_usd),
    totalCount: l.total_runs,
    countLabel: '회',
    items,
    maxCostRaw: items[0]?.costRaw ?? 0,
    emptyMessage: '',
    emptyLink: null,
  }
}

// ── Model Performance VM (작업 유형별 모델 비교) ──

const MIN_RUNS_FOR_COMPARISON = 3

export interface ModelRowVM {
  modelName: string
  totalRuns: number
  avgLatency: string
  avgLatencyRaw: number
  costPerRun: string
  costPerRunRaw: number
  successRate: string
  successRateRaw: number
  avgQuality: string
  avgQualityRaw: number
  hasQuality: boolean
  qualityPerCost: number // quality_score / cost — 높을수록 효율적
  insufficientData: boolean // MIN_RUNS 미만
  isBestLatency: boolean
  isBestCost: boolean
  isBestQuality: boolean
}

export interface ExperimentTypeGroupVM {
  experimentType: string
  typeLabel: string
  models: ModelRowVM[]
  hasMultipleModels: boolean
}

function buildModelRow(modelName: string, items: ExperimentRunSummary[]): ModelRowVM {
  const completed = items.filter((e) => e.status === 'completed')
  const failed = items.filter((e) => e.status === 'failed')
  const totalRuns = completed.length + failed.length

  const latencies = completed
    .map((e) => e.latency_ms)
    .filter((v): v is number => v != null && v > 0)
  const avgLatencyRaw = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0

  const totalCostRaw = completed.reduce(
    (sum, e) => sum + (e.estimated_cost_usd ?? 0), 0,
  )
  const costPerRunRaw = completed.length > 0 ? totalCostRaw / completed.length : 0
  const successRateRaw = totalRuns > 0 ? completed.length / totalRuns : 0

  const scores = completed
    .map((e) => e.quality_score)
    .filter((v): v is number => v != null && v > 0)
  const avgQualityRaw = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0
  const hasQuality = scores.length > 0
  const qualityPerCost = avgQualityRaw > 0 && costPerRunRaw > 0
    ? avgQualityRaw / costPerRunRaw
    : 0

  return {
    modelName,
    totalRuns,
    avgLatency: avgLatencyRaw > 0 ? formatLatency(Math.round(avgLatencyRaw)) : '-',
    avgLatencyRaw,
    costPerRun: formatCostKRW(costPerRunRaw),
    costPerRunRaw,
    successRate: `${Math.round(successRateRaw * 100)}%`,
    successRateRaw,
    avgQuality: hasQuality ? avgQualityRaw.toFixed(1) : '-',
    avgQualityRaw,
    hasQuality,
    qualityPerCost,
    insufficientData: totalRuns < MIN_RUNS_FOR_COMPARISON,
    isBestLatency: false,
    isBestCost: false,
    isBestQuality: false,
  }
}

export function buildModelPerformanceByType(
  experiments: ExperimentRunSummary[],
  meta?: LabMetadataResponse | null,
): ExperimentTypeGroupVM[] {
  // 1) experiment_type → model → runs 이중 그룹핑
  const typeGroups = new Map<string, Map<string, ExperimentRunSummary[]>>()
  for (const exp of experiments) {
    if (exp.status !== 'completed' && exp.status !== 'failed') continue
    const type = exp.experiment_type
    if (!typeGroups.has(type)) typeGroups.set(type, new Map())
    const modelMap = typeGroups.get(type)!
    const modelKey = simplifyModelName(exp.model_name)
    if (!modelMap.has(modelKey)) modelMap.set(modelKey, [])
    modelMap.get(modelKey)!.push(exp)
  }

  // 2) 그룹별 ModelRowVM 생성 + best 마킹
  const groups: ExperimentTypeGroupVM[] = []
  for (const [expType, modelMap] of typeGroups) {
    const models: ModelRowVM[] = []
    for (const [modelName, items] of modelMap) {
      const row = buildModelRow(modelName, items)
      if (row.totalRuns > 0) models.push(row)
    }
    if (models.length === 0) continue

    // 실행 횟수 내림차순
    models.sort((a, b) => b.totalRuns - a.totalRuns)

    // 충분한 데이터가 있는 모델만 best 마킹 (2개 이상, 각각 MIN_RUNS 이상)
    const eligible = models.filter((m) => !m.insufficientData)
    if (eligible.length >= 2) {
      const withLatency = eligible.filter((r) => r.avgLatencyRaw > 0)
      if (withLatency.length > 0) {
        withLatency.reduce((a, b) => a.avgLatencyRaw < b.avgLatencyRaw ? a : b).isBestLatency = true
      }
      const withCost = eligible.filter((r) => r.costPerRunRaw > 0)
      if (withCost.length > 0) {
        withCost.reduce((a, b) => a.costPerRunRaw < b.costPerRunRaw ? a : b).isBestCost = true
      }
      const withQuality = eligible.filter((r) => r.hasQuality)
      if (withQuality.length > 0) {
        withQuality.reduce((a, b) => a.avgQualityRaw > b.avgQualityRaw ? a : b).isBestQuality = true
      }
    }

    groups.push({
      experimentType: expType,
      typeLabel: getExperimentTypeLabel(meta, expType),
      models,
      hasMultipleModels: models.length >= 2,
    })
  }

  // 모델 수 많은 그룹 우선 (비교 가치 높음), 같으면 총 실행 수
  groups.sort((a, b) => {
    if (b.hasMultipleModels !== a.hasMultipleModels) return b.hasMultipleModels ? 1 : -1
    const aRuns = a.models.reduce((s, m) => s + m.totalRuns, 0)
    const bRuns = b.models.reduce((s, m) => s + m.totalRuns, 0)
    return bRuns - aRuns
  })

  return groups
}

// ── Production Config VM ──

export interface ProductionConfigVM {
  purposes: { label: string; model: string; cost: string }[]
  costPerNote: string
}

export function buildProductionConfig(cost: CostSummaryResponse | null, meta?: LabMetadataResponse | null): ProductionConfigVM {
  if (!cost || cost.production.by_purpose.length === 0) {
    return { purposes: [], costPerNote: '-' }
  }

  const p = cost.production
  const purposes = p.by_purpose.map((bp) => ({
    label: getPurposeLabel(meta, bp.purpose),
    model: simplifyModelName(bp.model),
    cost: formatCostKRW(bp.estimated_cost_usd),
  }))

  const costPerNote =
    p.total_calls > 0 ? formatCostKRW(p.estimated_cost_usd / p.total_calls) : '-'

  return { purposes, costPerNote }
}
