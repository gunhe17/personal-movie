/**
 * 문자 양식 View Model (Admin)
 */

import type { MessageTemplateSummary } from '$hooks/actions/messageTemplate.action'
import { TEMPLATE_TYPE_LABELS } from './constants'

export interface MessageTemplateVM {
  id: string
  templateType: string
  typeLabel: string
  name: string
  isDefault: boolean
  createdAt: string
}

export function mapToTemplateVM(item: MessageTemplateSummary): MessageTemplateVM {
  return {
    id: item.id,
    templateType: item.template_type,
    typeLabel: TEMPLATE_TYPE_LABELS[item.template_type] ?? item.template_type,
    name: item.name,
    isDefault: item.is_default,
    createdAt: new Date(item.created_at).toLocaleDateString('ko-KR')
  }
}

/**
 * 변수를 #{한글라벨} 파란색으로 하이라이트
 */
export function renderContentWithHighlight(
  content: string,
  variableLabels: Record<string, string>
): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped.replace(/\{(\w+)\}/g, (match, key) => {
    const label = variableLabels[key]
    if (label) {
      return `<span class="text-blue-500 font-medium">#{${label}}</span>`
    }
    return match
  })
}
