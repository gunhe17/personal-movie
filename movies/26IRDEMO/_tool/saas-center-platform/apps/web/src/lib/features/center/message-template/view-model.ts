/**
 * 문자 양식 View Model
 */

import type { MessageTemplateSummary } from '$lib/hooks/actions/messageTemplate.action'
import { TEMPLATE_TYPE_LABELS } from './constants'

export interface MessageTemplateVM {
  id: string
  templateType: string
  typeLabel: string
  name: string
  isDefault: boolean
  isSystem: boolean
  createdAt: string
}

export function mapToTemplateVM(
  item: MessageTemplateSummary
): MessageTemplateVM {
  const isSystem = item.center_id === null
  return {
    id: item.id,
    templateType: item.template_type,
    typeLabel: TEMPLATE_TYPE_LABELS[item.template_type] ?? item.template_type,
    name: isSystem ? item.name.replace(/\s*\(기본\)\s*$/, '') : item.name,
    isDefault: item.is_default,
    isSystem,
    createdAt: new Date(item.created_at).toLocaleDateString('ko-KR')
  }
}

export function renderPreview(
  content: string,
  variables: Record<string, string>
): string {
  // 빈값인 변수가 포함된 줄 제거
  const emptyKeys = new Set(
    Object.entries(variables)
      .filter(([, v]) => !v)
      .map(([k]) => k)
  )

  let result = content
  if (emptyKeys.size > 0) {
    result = content
      .split('\n')
      .filter((line) => {
        const lineVars = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
        if (lineVars.length > 0 && lineVars.every((k) => emptyKeys.has(k)))
          return false
        return true
      })
      .join('\n')
  }

  return result.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] ?? match
  })
}

/**
 * 변수 부분을 파란색 하이라이트로 표시하는 HTML 렌더링
 * 양식 원문에서 {변수} → #{한글라벨} 파란색으로 표시
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

/**
 * 미리보기에서도 #{한글라벨} 파란색으로 표시 (양식 원문과 동일)
 */
export const renderPreviewWithHighlight = renderContentWithHighlight

/**
 * 영어 변수 → 한글 표시 태그 변환 (편집용)
 * {center_name} → #{센터명}
 */
export function contentToDisplay(
  content: string,
  labelMap: Record<string, string>
): string {
  return content.replace(/\{(\w+)\}/g, (match, key) => {
    const label = labelMap[key]
    return label ? `#{${label}}` : match
  })
}

/**
 * 한글 표시 태그 → 영어 변수 변환 (저장용)
 * #{센터명} → {center_name}
 */
export function displayToContent(
  display: string,
  labelMap: Record<string, string>
): string {
  const reversedMap = Object.fromEntries(
    Object.entries(labelMap).map(([key, label]) => [label, key])
  )
  if (labelMap.assessment_url) reversedMap['검사 링크'] = 'assessment_url'
  return display.replace(/#\{([^}]+)\}/g, (match, label) => {
    const key = reversedMap[label]
    return key ? `{${key}}` : match
  })
}

export const SAMPLE_VARIABLES: Record<string, Record<string, string>> = {
  assessment_result_send: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    result_url: 'https://example.com/result/abc123',
    verification_code: '1234'
  },
  assessment_send_link: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    assessment_url: 'https://example.com/assess/abc123',
    verification_code: '5678'
  },
  assessment_report_ready: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    assessment_name: 'K-WISC-V'
  },
  counseling_session_booked: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    counselor_name: '김상담',
    session_date: '2026년 04월 01일 14:00'
  },
  session_reminder: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    session_date: '2026년 04월 01일 14:00'
  },
  appointment_confirmation_sms: {
    center_name: '마음숲 상담센터',
    recipient_name: '홍길동',
    appointment_type: '상담',
    appointment_date: '2026.04.01 14:00'
  }
}
