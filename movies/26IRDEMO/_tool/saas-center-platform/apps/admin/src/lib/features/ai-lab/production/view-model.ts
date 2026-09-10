/**
 * Production Settings View Model
 * API 응답 → UI 표현 변환 (메타데이터 기반)
 */

import type { ProductionAIConfigResponse, LabMetadataResponse } from '$hooks/actions/aiLab.action'
import { formatDateKST } from '../constants'
import { getModules, getModelLabel } from '../metadata-helpers'

// ── 파이프라인 스텝별 설정 카드 VM ──

export interface PipelineConfigVM {
  step: string
  module: string
  label: string
  description: string
  hasPrompt: boolean
  isConfigured: boolean
  modelName: string
  modelLabel: string
  provider: string
  systemPromptPreview: string | null
  promotedAt: string
  description_text: string | null
  diarizationStrategy: string | null
  raw: ProductionAIConfigResponse | null
  stepModels: { value: string; label: string; provider?: string; cost_label?: string | null }[]
}

export function buildPipelineConfigs(
  configs: ProductionAIConfigResponse[],
  moduleKey: string | null,
  meta?: LabMetadataResponse | null,
): PipelineConfigVM[] {
  const modules = getModules(meta)
  const targetModules = moduleKey
    ? modules.filter((m) => m.key === moduleKey)
    : modules

  const configMap = new Map<string, ProductionAIConfigResponse>()
  for (const c of configs) {
    configMap.set(c.pipeline_step, c)
  }

  const result: PipelineConfigVM[] = []
  for (const mod of targetModules) {
    for (const stepMeta of mod.pipeline_steps) {
      const config = configMap.get(stepMeta.key) ?? null
      const modelName = config?.model_name ?? '(기본값)'
      const category = stepMeta.has_prompt ? 'llm' : 'stt'

      result.push({
        step: stepMeta.key,
        module: mod.key,
        label: stepMeta.label,
        description: stepMeta.description,
        hasPrompt: stepMeta.has_prompt,
        isConfigured: config !== null,
        modelName,
        modelLabel: modelName === '(기본값)'
          ? '기본값 사용'
          : getModelLabel(meta, modelName, category === 'stt' ? 'stt' : 'llm'),
        provider: config?.provider ?? 'openai',
        systemPromptPreview: config?.system_prompt
          ? truncate(config.system_prompt, 200)
          : null,
        promotedAt: config?.promoted_at ? formatDateKST(config.promoted_at) : '-',
        description_text: config?.description ?? null,
        diarizationStrategy: config?.diarization_strategy ?? null,
        raw: config,
        stepModels: stepMeta.models ?? [],
      })
    }
  }

  return result
}

// ── 프롬프트 미리보기 자르기 ──

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}
