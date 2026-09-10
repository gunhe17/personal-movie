/**
 * Form Tools — 폼 선언(FormSpec) 하나에서 agent page tool 세트를 파생하는 공통 등록기.
 *
 * 읽기: page.get_form_state — 모든 필드의 get() + extraState + can_submit
 * 쓰기: page.set_field / page.set_fields / page.submit — kind별 검증·ref 해석 후 set()
 * 안내: page.focus_field
 *
 * 각 폼은 이 파일을 직접 쓰지 않고 형제 디스크립터 파일(client-register.ts 등)에서
 * FormSpec을 선언한다. 계약·동기화 지점은 ./README.md 참고.
 */

import { pageToolRegistry, type PageToolResult } from './registry'

// raw = 검증 없이 값을 그대로 넘긴다 — 화면이 직접 정의한 구조(단체 명단 등)를 실을 때만
export type FieldKind = 'text' | 'date' | 'time' | 'enum' | 'ref' | 'raw'

export interface RefValue {
  id?: string
  name?: string
}

export interface FieldSpec {
  label: string
  /** 기본 'text'. date/time/enum은 형식 검증, ref는 {id,name} 정규화(+list 매칭) 후 set에 전달 */
  kind?: FieldKind
  /** 미입력 안내·page.submit 검증 대상. 함수면 조건부 필수(방문 검사일 때만 등) */
  required?: boolean | (() => boolean)
  /** kind 'enum': 허용값 — 대소문자 무시로 매칭 후 정본값을 set에 전달 */
  values?: string[]
  /** kind 'ref': 로드된 목록에서 id → name 순으로 찾아 원본 항목을 set에 전달 (LLM이 id를 자를 수 있음) */
  list?: () => any[]
  /** kind 'ref': 값을 배열로 정규화해 set에 전달 (내담자·상담사 복수 선택). list 매칭은 생략 */
  many?: boolean
  get: () => unknown
  /** 없으면 읽기 전용 필드 — 쓰기 시도에 "화면에서 직접 선택" 안내 */
  set?: (v: any) => void
}

export interface FormSpec {
  /** 안내 문구용 폼 이름 ('상담 접수') */
  formName: string
  /** 완료 동작 라벨 ('접수' | '저장') */
  submitLabel: string
  /** key = agent가 쓰는 필드명 (백엔드 prefill 스키마와 동일해야 함). 선언 순서 = 미입력 안내 순서 */
  fields: Record<string, FieldSpec>
  /** mode 등 필드 밖 상태를 get_form_state에 병합 */
  extraState?: () => Record<string, unknown>
  /** 쓰기 직전 훅 (view → edit 모드 전환 등). 대상 데이터가 아직 로드 전이면 async로 대기 가능 */
  beforeWrite?: () => void | Promise<void>
  canSubmit?: () => boolean
  /** 있으면 page.submit 등록 */
  submit?: () => void
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

function isEmpty(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0)
}

function isRequired(f: FieldSpec): boolean {
  return typeof f.required === 'function' ? f.required() : !!f.required
}

function toRef(v: unknown): RefValue {
  return typeof v === 'object' && v !== null
    ? (v as RefValue)
    : { name: String(v) }
}

/** 리스트가 로드될 때까지 대기 (query 로딩 race 방지) */
async function waitForList<T>(getter: () => T[], maxMs = 2000): Promise<T[]> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const list = getter()
    if (list.length > 0) return list
    await new Promise((r) => setTimeout(r, 50))
  }
  return getter()
}

/** 구 runtime은 [{field, value}] 배열, new_agent(v5)는 {field: value} 딕셔너리 — 둘 다 수용 */
function normalizeFields(input: unknown): { field: string; value: unknown }[] {
  if (Array.isArray(input)) {
    return input.filter(
      (e): e is { field: string; value: unknown } =>
        !!e && typeof e.field === 'string'
    )
  }
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([field, value]) => ({ field, value }))
  }
  return []
}

async function applyField(
  spec: FormSpec,
  field: string,
  value: unknown
): Promise<string | null> {
  const f = spec.fields[field]
  if (!f) return `알 수 없는 필드: ${field}`
  if (!f.set) return `${f.label}은(는) 화면에서 직접 선택해주세요.`

  switch (f.kind ?? 'text') {
    case 'raw':
      f.set(value)
      return null
    case 'text':
      f.set(value == null ? '' : String(value))
      return null
    case 'date': {
      const v = String(value ?? '')
      if (!DATE_RE.test(v))
        return `${f.label} 형식이 올바르지 않습니다 (YYYY-MM-DD): ${v}`
      f.set(v)
      return null
    }
    case 'time': {
      const v = String(value ?? '')
      if (!TIME_RE.test(v))
        return `${f.label} 형식이 올바르지 않습니다 (HH:mm): ${v}`
      f.set(v)
      return null
    }
    case 'enum': {
      const v = String(value ?? '')
      const hit = f.values?.find((c) => c.toLowerCase() === v.toLowerCase())
      if (!hit)
        return `${f.label} 값이 올바르지 않습니다 (${f.values?.join('/')}): ${v}`
      f.set(hit)
      return null
    }
    case 'ref': {
      if (f.many) {
        const items = (Array.isArray(value) ? value : [value]).map(toRef)
        f.set(items)
        return null
      }
      const ref = toRef(value)
      if (f.list) {
        const list = await waitForList(f.list)
        const found =
          list.find((x) => x.id === ref.id) ??
          list.find((x) => x.name === ref.name)
        if (!found)
          return `${f.label}을(를) 찾지 못했습니다: ${ref.name ?? ref.id}`
        f.set(found)
        return null
      }
      f.set(ref)
      return null
    }
  }
}

function nextEmptyRequiredLabel(spec: FormSpec): string | null {
  for (const f of Object.values(spec.fields)) {
    if (isRequired(f) && isEmpty(f.get())) return f.label
  }
  return null
}

export function registerFormTools(spec: FormSpec): void {
  // ── 읽기 ──
  pageToolRegistry.register(
    'page.get_form_state',
    async (): Promise<PageToolResult> => {
      const state: Record<string, unknown> = {}
      for (const [key, f] of Object.entries(spec.fields)) state[key] = f.get()
      Object.assign(state, spec.extraState?.())
      if (spec.canSubmit) state.can_submit = spec.canSubmit()
      return { result: JSON.stringify(state), is_error: false }
    }
  )

  // ── 쓰기 ──
  pageToolRegistry.register('page.set_field', async ({ field, value }: any) => {
    await spec.beforeWrite?.()
    const err = await applyField(spec, String(field), value)
    if (err) return { result: err, is_error: true }
    const label = spec.fields[String(field)].label
    return {
      result: `${label} 정보를 반영했습니다. 나머지 항목을 입력해주세요.`,
      is_error: false
    }
  })

  pageToolRegistry.register('page.set_fields', async ({ fields }: any) => {
    await spec.beforeWrite?.()
    const results: string[] = []
    for (const { field, value } of normalizeFields(fields)) {
      const err = await applyField(spec, field, value)
      results.push(err ?? `${spec.fields[field].label} ✓`)
    }
    const nextLabel = nextEmptyRequiredLabel(spec)
    let guide: string
    if (results.length === 0) {
      guide = nextLabel
        ? `${spec.formName} 페이지를 열었습니다. ${nextLabel}부터 입력하고 ${spec.submitLabel}해주세요.`
        : `${spec.formName} 페이지를 열었습니다. 확인 후 ${spec.submitLabel} 버튼을 눌러주세요.`
    } else {
      guide = nextLabel
        ? `${results.join(', ')} — 입력한 데이터를 반영했습니다. ${nextLabel}부터 나머지를 입력하고 ${spec.submitLabel}해주세요.`
        : `${results.join(', ')} — 입력한 데이터를 반영했습니다. 확인 후 ${spec.submitLabel} 버튼을 눌러주세요.`
    }
    return { result: guide, is_error: false }
  })

  if (spec.submit) {
    pageToolRegistry.register('page.submit', async () => {
      const missing = Object.values(spec.fields)
        .filter((f) => isRequired(f) && isEmpty(f.get()))
        .map((f) => f.label)
      if (missing.length > 0 || spec.canSubmit?.() === false) {
        return {
          result: `필수 필드 미입력: ${missing.join(', ')}`,
          is_error: true
        }
      }
      spec.submit!()
      return { result: `${spec.submitLabel} 요청 완료`, is_error: false }
    })
  }

  // ── 안내 ──
  pageToolRegistry.register('page.focus_field', async ({ field }: any) => {
    const f = spec.fields[String(field)]
    if (!f) return { result: `알 수 없는 필드: ${field}`, is_error: true }
    return {
      result: `${f.label}을(를) 선택하고 나머지 항목을 입력해주세요.`,
      is_error: false
    }
  })

  pageToolRegistry.notifyPageMounted()
}
