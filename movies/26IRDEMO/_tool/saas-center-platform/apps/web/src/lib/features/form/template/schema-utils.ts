/** canonical FormSchema(pages/fields/elements) 소비 헬퍼 */
import type { FormSchema, FormField, FormElement } from '$lib/hooks/actions/form.action'

/** field key → 그 필드를 참조하는 첫 element (정렬·위젯 참조용) */
export function firstElementByField(schema: FormSchema): Record<string, FormElement> {
  const map: Record<string, FormElement> = {}
  for (const el of schema.elements ?? []) {
    for (const ref of el.field_refs) {
      if (!map[ref]) map[ref] = el
    }
  }
  return map
}

/** 필드 키를 표시 순서로 정렬 — element(page→y→z) 기준, 없으면 fields 삽입 순서 */
export function orderedFieldKeys(schema: FormSchema): string[] {
  const keys = Object.keys(schema.fields ?? {})
  const elMap = firstElementByField(schema)
  if (!keys.some((k) => elMap[k])) return keys
  return [...keys].sort((a, b) => {
    const ea = elMap[a]
    const eb = elMap[b]
    if (ea && eb) return ea.page - eb.page || ea.rect[1] - eb.rect[1] || ea.z - eb.z
    if (ea) return -1
    if (eb) return 1
    return 0
  })
}

/** 선택지 정규화 — 레거시 템플릿은 options가 문자열 배열로 저장돼 있다 */
export interface NormalizedOption {
  value: string
  label: string
}

export function normalizedOptions(field: FormField): NormalizedOption[] {
  return (field.options ?? []).map((o) =>
    typeof o === 'string'
      ? { value: o, label: o }
      : { value: o.value, label: o.label ?? o.value }
  )
}

/** 선택지 라벨 (radio/checkbox/select 렌더용) */
export function optionLabels(field: FormField): string[] {
  return normalizedOptions(field).map((o) => o.label)
}

/** 선택지 저장 값 */
export function optionValues(field: FormField): string[] {
  return normalizedOptions(field).map((o) => o.value)
}

export function totalFields(schema: FormSchema): number {
  return Object.keys(schema.fields ?? {}).length
}

export function requiredFields(schema: FormSchema): number {
  return Object.values(schema.fields ?? {}).filter((f) => f.required).length
}

/** 사용된 페이지 수 (elements 의 page 기준, 최소 1) */
export function pageCount(schema: FormSchema): number {
  const pages = new Set<number>()
  for (const el of schema.elements ?? []) pages.add(el.page)
  return Math.max(1, pages.size, (schema.pages ?? []).length)
}

/** 전체 element 수 */
export function elementCount(schema: FormSchema): number {
  return (schema.elements ?? []).length
}
