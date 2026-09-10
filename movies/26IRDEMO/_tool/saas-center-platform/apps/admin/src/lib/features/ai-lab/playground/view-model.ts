/**
 * Playground - ViewModel
 * 실험 결과를 UI 표현용으로 변환
 */

import type { ExperimentRunResponse, LabMetadataResponse } from '$hooks/actions/aiLab.action'
import {
  formatCostKRW,
  formatDuration,
  formatLatency,
  formatTokens,
  getStatusDisplay,
  parseOutputJson,
} from '../constants'
import { getExperimentTypeLabel } from '../metadata-helpers'

export interface PlaygroundResultVM {
  id: string
  experimentType: string
  typeLabel: string
  modelName: string
  promptLabel: string
  latency: string
  cost: string
  inputTokens: string
  outputTokens: string
  outputText: string
  outputJson: string | null
  status: string
  statusLabel: string
  statusColor: string
  audioDuration: string
  errorMessage: string | null
  createdAt: string
}

export function mapToPlaygroundResult(
  raw: ExperimentRunResponse,
  promptLabel?: string,
  meta?: LabMetadataResponse | null,
): PlaygroundResultVM {
  const { label: statusLabel, color: statusColor } = getStatusDisplay(raw.status)
  return {
    id: raw.id,
    experimentType: raw.experiment_type,
    typeLabel: getExperimentTypeLabel(meta, raw.experiment_type),
    modelName: raw.model_name,
    promptLabel: promptLabel ?? (raw.prompt_version_id ? `v${raw.prompt_version_id.slice(0, 6)}` : '인라인 프롬프트'),
    latency: formatLatency(raw.latency_ms),
    cost: formatCostKRW(raw.estimated_cost_usd),
    inputTokens: formatTokens(raw.input_tokens),
    outputTokens: formatTokens(raw.output_tokens),
    outputText: raw.output_text ?? '',
    outputJson: raw.output_json,
    status: raw.status,
    statusLabel,
    statusColor,
    audioDuration: formatDuration(raw.input_audio_duration),
    errorMessage: raw.error_message,
    createdAt: new Date(raw.created_at).toLocaleString('ko-KR'),
  }
}

