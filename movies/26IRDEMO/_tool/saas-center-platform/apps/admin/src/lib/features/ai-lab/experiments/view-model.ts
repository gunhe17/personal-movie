/**
 * Experiments - ViewModel
 */

import type {
  ExperimentRunResponse,
  ExperimentRunSummary,
  LabMetadataResponse,
} from '$hooks/actions/aiLab.action'
import {
  formatCostKRW,
  formatCostUSD,
  formatLatency,
  formatTokens,
  formatDuration,
  formatDateKST,
  formatDateShortKST,
  getStatusDisplay,
  parseOutputJson,
} from '../constants'
import { getExperimentTypeLabel } from '../metadata-helpers'

export interface ExperimentListItemVM {
  id: string
  typeLabel: string
  sampleId: string | null
  modelName: string
  statusLabel: string
  statusColor: string
  latency: string
  cost: string
  costKRW: string
  inputSource: string
  createdAt: string
}

export function mapExperimentListItem(item: ExperimentRunSummary, meta?: LabMetadataResponse | null): ExperimentListItemVM {
  const { label: statusLabel, color: statusColor } = getStatusDisplay(item.status)
  return {
    id: item.id,
    typeLabel: getExperimentTypeLabel(meta, item.experiment_type),
    sampleId: item.sample_id,
    modelName: item.model_name,
    statusLabel,
    statusColor,
    latency: formatLatency(item.latency_ms),
    cost: formatCostKRW(item.estimated_cost_usd),
    costKRW: formatCostUSD(item.estimated_cost_usd),
    inputSource: item.sample_id ? '샘플' : '직접 입력',
    createdAt: formatDateShortKST(item.created_at),
  }
}

export type ResultViewMode = 'text' | 'structured' | 'diff'

export interface ExperimentDetailVM {
  id: string
  experimentType: string
  typeLabel: string
  sampleId: string | null
  promptVersionId: string | null
  provider: string
  modelName: string
  statusLabel: string
  statusColor: string
  startedAt: string
  completedAt: string
  latency: string
  inputTokens: string
  outputTokens: string
  totalTokens: string
  cost: string
  costKRW: string
  audioDuration: string
  inputSource: string
  inputText: string
  outputText: string
  outputJson: string | null
  parsedJson: Record<string, unknown> | null
  errorMessage: string | null
  tags: string | null
  memo: string | null
  availableViewModes: ResultViewMode[]
}

export function mapExperimentDetail(exp: ExperimentRunResponse, meta?: LabMetadataResponse | null): ExperimentDetailVM {
  const { label: statusLabel, color: statusColor } = getStatusDisplay(exp.status)
  const parsed = parseOutputJson(exp.output_json)

  // 사용 가능한 뷰 모드 결정
  const modes: ResultViewMode[] = []
  if (exp.output_text) modes.push('text')
  if (parsed) modes.push('structured')
  if (exp.input_text && exp.output_text) modes.push('diff')

  return {
    id: exp.id,
    experimentType: exp.experiment_type,
    typeLabel: getExperimentTypeLabel(meta, exp.experiment_type),
    sampleId: exp.sample_id,
    promptVersionId: exp.prompt_version_id,
    provider: exp.provider,
    modelName: exp.model_name,
    statusLabel,
    statusColor,
    startedAt: formatDateKST(exp.started_at),
    completedAt: formatDateKST(exp.completed_at),
    latency: formatLatency(exp.latency_ms),
    inputTokens: formatTokens(exp.input_tokens),
    outputTokens: formatTokens(exp.output_tokens),
    totalTokens: formatTokens(exp.total_tokens),
    cost: formatCostKRW(exp.estimated_cost_usd),
    costKRW: formatCostUSD(exp.estimated_cost_usd),
    audioDuration: formatDuration(exp.input_audio_duration),
    inputSource: exp.sample_id ? '샘플' : '직접 입력',
    inputText: exp.input_text ?? '',
    outputText: exp.output_text ?? '',
    outputJson: exp.output_json,
    parsedJson: parsed,
    errorMessage: exp.error_message,
    tags: exp.tags,
    memo: exp.memo,
    availableViewModes: modes,
  }
}
