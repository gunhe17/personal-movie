// 추출 후보(completed.vouchers) → 확정 화면이 쓰는 폼 모양. 확정 흐름이 여러 페이지로
// 나뉘면서(목록 확정 / 바우처별 검증) 두 라우트가 같은 파생을 써야 해 여기로 모았다.
// 파생 규칙 자체는 옛 단일 confirm 페이지 것 그대로 — 동작 변경 없음.

export interface VoucherForm {
  include: boolean
  name: string
  program_name: string
  program_organization: string
  program_year: string
  usage_start_date: string
  usage_end_date: string
  application_method: string
  application_start_date: string
  application_end_date: string
  contact: string
  /** 추출 정규화 레코드(§1~§10) — 정본 */
  record: Record<string, unknown> | null
  /** 정규화가 남긴 검증 소견 */
  findings: { 유형: string; 축: string; 요약: string }[]
  page_range: [number, number] | null
  paths: Record<string, string | null>
  /** 필드별 하이라이트용 근거 텍스트 */
  queries: Record<string, string>
}

export type StrKey =
  | 'program_name'
  | 'program_organization'
  | 'program_year'
  | 'usage_start_date'
  | 'usage_end_date'
  | 'application_method'
  | 'application_start_date'
  | 'application_end_date'
  | 'contact'

export interface FieldDef {
  key: StrKey
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date'
  kind?: 'input' | 'textarea'
}

// record 에 없는 사업 메타데이터만 여기서 다룬다(기관·연도·기간·신청·문의처).
// 지원금·범위·대상은 record 정본이므로 구조 뷰가 표시한다.
export const FIELDS_MAIN: FieldDef[] = [
  { key: 'program_name', label: '사업 이름', required: true },
  { key: 'program_organization', label: '사업 기관', required: true },
  { key: 'program_year', label: '사업 연도', required: true, type: 'number' },
  { key: 'usage_start_date', label: '이용 시작일', type: 'date' },
  { key: 'usage_end_date', label: '이용 종료일', type: 'date' },
  { key: 'application_start_date', label: '신청 시작일', type: 'date' },
  { key: 'application_end_date', label: '신청 종료일', type: 'date' },
  { key: 'application_method', label: '신청 방법', kind: 'textarea' },
  { key: 'contact', label: '문의처', kind: 'textarea' }
]

/** 리치 노드에서 처음 만나는 page("p-NNN"). */
export function firstPage(node: any): string | null {
  if (node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const x of node) {
      const p = firstPage(x)
      if (p) return p
    }
    return null
  }
  if (typeof node.page === 'string') return node.page
  for (const v of Object.values(node)) {
    const p = firstPage(v)
    if (p) return p
  }
  return null
}

/** 리치 노드에서 처음 만나는 인용 — quote_pdf 우선, 없으면 원문 quote.
 *  자간이 벌어져 인쇄된 표 헤더는 백엔드 스냅이 공백을 못 지워 quote_pdf 가 null 이 된다.
 *  뷰어의 norm 이 공백·가운뎃점·NFKC 를 흡수하므로 원문 quote 로도 맞는다. */
export function firstQuote(node: any): string {
  if (node == null || typeof node !== 'object') return ''
  if (Array.isArray(node)) {
    for (const x of node) {
      const q = firstQuote(x)
      if (q) return q
    }
    return ''
  }
  const q = node.quote_pdf || node.quote
  if (typeof q === 'string' && q) return q
  for (const [k, v] of Object.entries(node)) {
    if (k === 'page' || k === 'value' || k === 'quote' || k === 'quote_pdf' || k === 'match')
      continue
    const r = firstQuote(v)
    if (r) return r
  }
  return ''
}

/** "p-048" → 48. 실패 시 null. */
export function pageNum(p: string | null | undefined): number | null {
  if (!p) return null
  const m = String(p).match(/p[-\s]?0*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

function metaCell(meta: any, key: string): any {
  return meta && typeof meta === 'object' ? meta[key] : null
}
function metaStr(meta: any, key: string): string {
  const v = metaCell(meta, key)?.value
  if (v == null || typeof v === 'object') return ''
  return String(v).trim()
}
function metaDate(meta: any, key: string, which: 'start' | 'end'): string {
  const v = metaCell(meta, key)?.value
  return v && typeof v === 'object' ? (v[which] ?? '') : ''
}

export function buildForm(cand: any, meta: any): VoucherForm {
  const span = cand?.span as [string | number, string | number] | undefined
  const fmtP = (v: string | number | undefined) =>
    typeof v === 'number' ? `p-${String(v).padStart(3, '0')}` : (v ?? null)
  const spanStart = fmtP(span?.[0])

  const paths: Record<string, string | null> = {
    name: spanStart,
    program_name: spanStart,
    program_organization: firstPage(metaCell(meta, 'organization')),
    program_year: firstPage(metaCell(meta, 'year')),
    usage_start_date: firstPage(metaCell(meta, 'usage_period')),
    usage_end_date: firstPage(metaCell(meta, 'usage_period')),
    application_start_date: firstPage(metaCell(meta, 'application_period')),
    application_end_date: firstPage(metaCell(meta, 'application_period')),
    application_method: firstPage(metaCell(meta, 'application_method')),
    contact: firstPage(metaCell(meta, 'contact'))
  }
  const queries: Record<string, string> = {
    name: cand?.name ?? '',
    program_name: cand?.name ?? '',
    program_organization: firstQuote(metaCell(meta, 'organization')),
    program_year: firstQuote(metaCell(meta, 'year')),
    usage_start_date: firstQuote(metaCell(meta, 'usage_period')),
    usage_end_date: firstQuote(metaCell(meta, 'usage_period')),
    application_start_date: firstQuote(metaCell(meta, 'application_period')),
    application_end_date: firstQuote(metaCell(meta, 'application_period')),
    application_method: firstQuote(metaCell(meta, 'application_method')),
    contact: firstQuote(metaCell(meta, 'contact'))
  }
  for (const f of FIELDS_MAIN) {
    if (!(f.key in paths)) paths[f.key] = null
    if (!(f.key in queries)) queries[f.key] = ''
  }

  const lo = pageNum(spanStart)
  const hi = pageNum(fmtP(span?.[1]))
  return {
    include: true,
    name: cand?.name ?? '',
    program_name: cand?.name ?? '',
    program_organization: metaStr(meta, 'organization'),
    program_year: metaStr(meta, 'year'),
    usage_start_date: metaDate(meta, 'usage_period', 'start'),
    usage_end_date: metaDate(meta, 'usage_period', 'end'),
    application_method: metaStr(meta, 'application_method'),
    application_start_date: metaDate(meta, 'application_period', 'start'),
    application_end_date: metaDate(meta, 'application_period', 'end'),
    contact: metaStr(meta, 'contact'),
    record: structuredClone(cand?.record ?? null),
    findings: Array.isArray(cand?.findings) ? cand.findings : [],
    page_range: lo != null && hi != null ? [lo, hi] : null,
    paths,
    queries
  }
}

export interface FormPageItem {
  /** 서식 첫 쪽 png 의 global_document id (적재 실패면 null) — 화면 키 겸 대표 이미지 */
  id: string | null
  /** 첫 쪽 — 정렬·키 앵커 */
  page: number
  /** 서식이 걸친 쪽 전부. 여러 장짜리 서식이 한 단위다 */
  pages: { no: number; id: string | null }[]
  title: string
  kind: string
  /** 소속 — 영역 확정 화면의 선택. 구 데이터엔 없어 unknown */
  scope: 'voucher' | 'common' | 'unknown'
  voucherNames: string[]
}

/** completed.forms → 화면용 서식 목록. 확정 구간(여러 장 = 한 서식)을 한 단위로 두고,
 *  구형(확정 게이트 이전) 페이지 단위도 1장짜리 단위로 받는다. */
export function formPagesOf(forms: Record<string, unknown>[]): FormPageItem[] {
  const out: FormPageItem[] = []
  for (const f of (forms ?? []) as any[]) {
    const raw = Array.isArray(f.pages) ? f.pages : [f]
    const pages = raw
      .map((pg: any) => ({ no: pageNum(pg.page), id: pg.global_document_id ?? null }))
      .filter((pg: any) => pg.no != null) as { no: number; id: string | null }[]
    if (!pages.length) continue
    pages.sort((a, b) => a.no - b.no)
    out.push({
      id: pages[0].id,
      page: pages[0].no,
      pages,
      title: f.title ?? '',
      kind: f.kind ?? '',
      scope: f.scope ?? 'unknown',
      voucherNames: f.voucher_names ?? []
    })
  }
  return out.sort((a, b) => a.page - b.page)
}

/** 바우처 구간에 속한 서식만. span 밖 서식은 문서 공용(부록)이라 특정 바우처 것이 아니다. */
export function formPagesInSpan(
  all: FormPageItem[],
  span: [number, number] | null
): FormPageItem[] {
  if (!span) return []
  return all.filter((f) => f.page >= span[0] && f.page <= span[1])
}


/** 확정 여부 대조 키 — 확정 시 중복 판정에 쓰는 (이름·연도·기관) 그대로 */
export function voucherIdentityKey(
  name: string,
  year: number | string,
  org: string
): string {
  return `${String(name).trim()}\u0000${year}\u0000${String(org).trim()}`
}

/** 사업명들 → 확정된 바우처 id들. 확정 전인 이름은 빠진다(붙일 대상이 없으므로). */
export function resolveVoucherIds(
  names: string[],
  catalogItems: Record<string, unknown>[],
  meta: { year: number | string; organization: string } | null
): string[] {
  if (!meta?.year || !meta?.organization || !names.length) return []
  const byKey = new Map<string, string>(
    (catalogItems ?? []).map((v: any) => [
      voucherIdentityKey(v.name, v.program_year, v.program_organization),
      v.id
    ])
  )
  const out: string[] = []
  for (const n of names) {
    const id = byKey.get(voucherIdentityKey(n, Number(meta.year), String(meta.organization)))
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}
