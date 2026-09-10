/**
 * AI Lab 메타데이터 헬퍼
 * API 메타데이터에서 필요한 값을 추출하는 순수 함수들.
 * API 실패 시 사용할 인라인 폴백 포함.
 */

import type {
  LabMetadataResponse,
  ModelOption,
  PipelineStepMeta,
  ModuleMeta,
  ExperimentTypeMeta,
} from '$hooks/actions/aiLab.action'

// ── 폴백 (API 실패 시 최소 기본값) ──

const FALLBACK: LabMetadataResponse = {
  modules: [],
  experiment_types: [],
  stt_models: [],
  stt_diarize_models: [],
  llm_models: [],
  purpose_labels: {},
}

type Meta = LabMetadataResponse | undefined | null

// ── 실험 유형 ──

export function getExperimentTypeLabel(meta: Meta, key: string): string {
  const found = (meta ?? FALLBACK).experiment_types.find((t) => t.key === key)
  return found?.label ?? key
}

export function getExperimentTypes(meta: Meta): ExperimentTypeMeta[] {
  return (meta ?? FALLBACK).experiment_types
}

// ── 스텝별 기본 시스템 프롬프트 ──

export function getDefaultSystemPrompt(meta: Meta, stepKey: string): string {
  const types = (meta ?? FALLBACK).experiment_types
  // 1) stepKey 자체로 검색 (chain_stt_refine 등)
  const direct = types.find((t) => t.key === stepKey)
  if (direct?.default_system_prompt) return direct.default_system_prompt
  // 2) llm_{stepKey} 형태로 검색 (refine → llm_refine 등)
  const prefixed = types.find((t) => t.key === `llm_${stepKey}`)
  return prefixed?.default_system_prompt ?? ''
}

// ── 모듈/파이프라인 ──

export function getModules(meta: Meta): ModuleMeta[] {
  return (meta ?? FALLBACK).modules
}

export function getModuleSteps(meta: Meta, moduleKey: string): PipelineStepMeta[] {
  return (meta ?? FALLBACK).modules.find((m) => m.key === moduleKey)?.pipeline_steps ?? []
}

export function getStepMeta(meta: Meta, moduleKey: string, stepKey: string): PipelineStepMeta | undefined {
  return getModuleSteps(meta, moduleKey).find((s) => s.key === stepKey)
}

// ── Purpose 라벨 ──

export function getPurposeLabel(meta: Meta, purpose: string): string {
  return (meta ?? FALLBACK).purpose_labels[purpose] ?? purpose
}

// ── 모델 목록 ──

export function getSttModels(meta: Meta): ModelOption[] {
  const m = meta ?? FALLBACK
  // 화자분리 모델 우선 + 일반 전사 모델 (중복 제거)
  // 스트리밍 모델(AWS Transcribe 등)은 별도 스텝이므로 여기 포함하지 않음
  const diarize = m.stt_diarize_models ?? []
  const diarizeValues = new Set(diarize.map((d) => d.value))
  const uniqueGeneral = m.stt_models.filter((s) => !diarizeValues.has(s.value))
  return [...diarize, ...uniqueGeneral]
}

export function getLlmModels(meta: Meta): ModelOption[] {
  return (meta ?? FALLBACK).llm_models
}

export function getModelLabel(meta: Meta, modelName: string, category: 'stt' | 'llm' = 'llm'): string {
  const models = category === 'stt' ? getSttModels(meta) : getLlmModels(meta)
  return models.find((m) => m.value === modelName)?.label ?? modelName
}

// ── 스텝별 예시 입력 텍스트 ──

export function getSampleInputText(meta: Meta, stepKey: string): string {
  const types = (meta ?? FALLBACK).experiment_types
  // 1) stepKey 직접 매칭
  const direct = types.find((t) => t.key === stepKey)
  if (direct?.input_placeholder) return direct.input_placeholder
  // 2) llm_{stepKey} 형태
  const prefixed = types.find((t) => t.key === `llm_${stepKey}`)
  return prefixed?.input_placeholder ?? ''
}

// ── Playground 카테고리 빌드 ──

export interface PlaygroundCategory {
  value: string
  label: string
  category: 'llm' | 'stt'
  promptKey: string | null
  defaultSystemPrompt: string | null
  inputPlaceholder: string | null
  instructionPlaceholder: string | null
}

export function buildPlaygroundCategories(meta: Meta): PlaygroundCategory[] {
  const types = (meta ?? FALLBACK).experiment_types
  const llmTypes = types.filter((t) => t.category === 'llm')
  const sttTypes = types.filter((t) => t.category === 'stt')
  return [
    ...llmTypes.map((t) => ({
      value: t.key,
      label: t.label,
      category: 'llm' as const,
      promptKey: extractPromptKey(t.key),
      defaultSystemPrompt: t.default_system_prompt ?? null,
      inputPlaceholder: t.input_placeholder ?? null,
      instructionPlaceholder: t.instruction_placeholder ?? null,
    })),
    ...sttTypes.map((t) => ({
      value: t.key,
      label: t.label,
      category: 'stt' as const,
      promptKey: null,
      defaultSystemPrompt: null,
      inputPlaceholder: null,
      instructionPlaceholder: null,
    })),
    {
      value: 'custom',
      label: '커스텀',
      category: 'llm' as const,
      promptKey: null,
      defaultSystemPrompt: null,
      inputPlaceholder: 'AI가 처리할 텍스트를 입력하세요.',
      instructionPlaceholder: null,
    },
  ]
}

function extractPromptKey(experimentType: string): string | null {
  return experimentType.startsWith('llm_') ? experimentType.slice(4) : null
}

// ── Prompt Key 라벨 ──

export function getPromptKeyLabel(meta: Meta, promptKey: string): string {
  // experiment_types에서 llm_{promptKey} 형태로 검색
  const expType = (meta ?? FALLBACK).experiment_types.find(
    (t) => t.key === `llm_${promptKey}`
  )
  if (expType) return expType.label.replace(/^LLM\s*/, '')

  // pipeline_steps에서 검색
  for (const mod of (meta ?? FALLBACK).modules) {
    const step = mod.pipeline_steps.find((s) => s.key === promptKey)
    if (step) return step.label
  }

  return promptKey
}
