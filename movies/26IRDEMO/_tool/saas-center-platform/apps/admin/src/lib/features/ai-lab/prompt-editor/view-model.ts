/**
 * Prompt Editor - ViewModel
 */

import type { PromptVersionResponse, LabMetadataResponse } from '$hooks/actions/aiLab.action'
import { getPromptKeyLabel } from '../metadata-helpers'

export interface PromptVM {
  id: string
  promptKey: string
  promptKeyLabel: string
  version: number
  name: string
  systemPrompt: string
  userPromptTemplate: string | null
  isActive: boolean
  isProduction: boolean
  description: string | null
  createdAt: string
  updatedAt: string
}

export function mapPrompt(item: PromptVersionResponse, meta?: LabMetadataResponse | null): PromptVM {
  return {
    id: item.id,
    promptKey: item.prompt_key,
    promptKeyLabel: getPromptKeyLabel(meta, item.prompt_key),
    version: item.version,
    name: item.name,
    systemPrompt: item.system_prompt,
    userPromptTemplate: item.user_prompt_template,
    isActive: item.is_active,
    isProduction: item.is_production,
    description: item.description,
    createdAt: new Date(item.created_at).toLocaleString('ko-KR'),
    updatedAt: new Date(item.updated_at).toLocaleString('ko-KR'),
  }
}

export function groupPromptsByKey(prompts: PromptVersionResponse[], meta?: LabMetadataResponse | null): Record<string, PromptVM[]> {
  const grouped: Record<string, PromptVM[]> = {}
  for (const p of prompts) {
    const key = p.prompt_key
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(mapPrompt(p, meta))
  }
  // 각 그룹 내 버전 역순 정렬
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.version - a.version)
  }
  return grouped
}
