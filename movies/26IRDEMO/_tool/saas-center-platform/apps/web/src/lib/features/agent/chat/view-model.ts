/**
 * Agent Chat ViewModel — checkpoint 파싱 + 세션 시간 포맷.
 */

import type { FormFieldDef, SSEEvent, WaitingInput } from './types'

/**
 * checkpoint_waiting SSE 이벤트 → WaitingInput.
 * input.type = selection(옵션 배열) · form(다필드) · 그 외 text.
 */
export function extractCheckpointWaiting(event: SSEEvent): WaitingInput {
  const stepId = event.step_id ?? ''
  const question = event.question ?? ''
  const input = event.input

  if (input?.type === 'selection' && Array.isArray(input.options)) {
    return { stepId, question, inputType: 'selection', options: input.options }
  }

  if (input?.type === 'form' && Array.isArray(input.fields)) {
    const formFields: FormFieldDef[] = (input.fields as Array<Record<string, unknown>>).map((f) => ({
      name: String(f.name ?? ''),
      type: String(f.type ?? 'text'),
      label: String(f.label ?? f.name ?? ''),
      required: f.required === true,
      choices: Array.isArray(f.choices) ? (f.choices as string[]) : undefined,
    }))
    return {
      stepId,
      question,
      inputType: 'form',
      formTitle: (input.title as string) ?? question,
      formFields,
    }
  }

  return { stepId, question, inputType: 'text' }
}

/**
 * assistant 답변용 최소 마크다운 → HTML.
 * HTML을 먼저 escape한 뒤 굵게/기울임/인라인코드·목록만 우리 태그로 감싸므로 XSS 안전(무의존).
 * 컨테이너가 <p>+pre-wrap이라 블록 <ul>은 못 넣는다 — 목록은 마커만 인라인 불릿으로 정규화하고
 * 줄바꿈은 pre-wrap이 유지한다(laguna가 프롬프트 무시하고 목록을 내는 B12를 렌더에서 흡수).
 */
export function renderMessageMarkdown(text: string): string {
  let s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  s = s.replace(/`([^`\n]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-[.9em]">$1</code>')
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  // 불릿 마커(-, *, •) — 뒤 공백 필수(음수 '-5' 등 오탐 방지) → 회색 불릿으로. 줄바꿈은 pre-wrap.
  s = s.replace(/^[ \t]*[-*•][ \t]+/gm, '<span class="text-gray-400">•</span> ')
  return s
}

/**
 * ISO 날짜 문자열 → 상대 시간 표시.
 */
export function formatSessionTime(dateStr: string): string {
  const now = Date.now()
  const target = new Date(dateStr).getTime()
  const diffMs = now - target

  if (isNaN(target)) return ''

  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)

  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (hours < 48) return '어제'
  return `${days}일 전`
}
