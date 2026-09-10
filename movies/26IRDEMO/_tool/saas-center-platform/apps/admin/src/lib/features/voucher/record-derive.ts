// 정규화 record → 구 카탈로그 필드(support_*) 재파생 — record 가 정본, support_* 는
// web·mobile 표시용 파생 캐시. confirm 확정·카탈로그 편집 양쪽이 공유한다(단일 파생 로직).
import {
  amountToStr,
  formToSupportAmount,
  type SupportAmountForm
} from '$lib/features/voucher/components/SupportAmountEditor.svelte'
import type { Amount } from '$lib/features/voucher/support-amount.types'

const META_KEYS = new Set(['page', 'quote', 'quote_pdf', 'match', 'items'])
const NO_LABEL_KEYS = new Set(['value', '내용', '값'])

/** record 노드(값 축 / {내용,ref} 항목형 / 배열 / 하위객체) → 표시용 텍스트.
 *  본문 키(내용·값)는 라벨 없이, 나머지 한글 키(최소·최대·구분 등)는 라벨 동반. */
export function flattenNode(node: any): string {
  if (node == null) return ''
  if (node === true) return '예'
  if (typeof node !== 'object') return String(node).trim()
  if (Array.isArray(node)) return node.map(flattenNode).filter(Boolean).join(', ')
  if ('시군구' in node || '시도' in node) {
    return (node as any).시군구 ?? (node as any).시도 ?? ''
  }
  return Object.entries(node)
    .filter(([k]) => !META_KEYS.has(k))
    .sort(([a], [b]) => Number(NO_LABEL_KEYS.has(a)) - Number(NO_LABEL_KEYS.has(b)))
    .map(([k, val]) => {
      const t = flattenNode(val)
      if (!t) return ''
      return !NO_LABEL_KEYS.has(k) && /^[가-힣]+$/.test(k) ? `${k} ${t}` : t
    })
    .filter(Boolean)
    .join(' · ')
}

/** 금액 행 조건({등급,연령,구분…}) → 표시 라벨. 없으면 ''. */
export function condLabel(row: any): string {
  const c = row?.조건
  if (!c || typeof c !== 'object') return ''
  return Object.values(c).filter(Boolean).join(' · ')
}

const UNIT_OF: Record<string, '회' | '시간' | '일'> = { 회당: '회', 시간당: '시간', 일당: '일' }

/** record.금액 (flat v2: [{명칭,주기,적용대상,금액:[{조건,정부지원금,본인부담금,정부지원비율,금액}]}])
 *  → SupportAmountEditor 폼 값. 등급표 = 전 묶음의 정부/본인 분리 행, 단가·월총액 = 첫 단일액 행. */
function buildSupportAmountForm(A: any): SupportAmountForm {
  const groups: any[] = Array.isArray(A) ? A : []
  const 등급별: SupportAmountForm['등급별'] = []
  let 월총액 = '', 단가금액 = '', 단가단위: '회' | '시간' | '일' = '회'
  for (const g of groups) {
    for (const r of Array.isArray(g?.금액) ? g.금액 : []) {
      if (r?.정부지원금 != null || r?.본인부담금 != null) {
        등급별.push({
          등급: String(등급별.length + 1),
          기준: [groups.length > 1 ? g?.명칭 : '', condLabel(r)].filter(Boolean).join(' · '),
          정부지원금: amountToStr((r?.정부지원금 ?? null) as Amount),
          본인부담금: amountToStr((r?.본인부담금 ?? null) as Amount),
          지원비율: r?.정부지원비율 != null ? String(r.정부지원비율) : ''
        })
      } else if (r?.금액 != null && !월총액 && !단가금액) {
        // ponytail: 첫 단일액 행만 — 월정액이면 월총액, 회당/시간당/일당이면 단가
        if (g?.주기 === '월정액' || g?.주기 === '월') 월총액 = String(r.금액)
        else { 단가금액 = String(r.금액); 단가단위 = UNIT_OF[g?.주기] ?? '회' }
      }
    }
  }
  return {
    월총액, 단가금액, 단가단위,
    한도값: '', 한도단위: '원', 한도기간: '연',
    정부지원금: '', 본인부담금: '', 가격탄력제: false,
    등급별,
    항목: []
  }
}

/** 저장 전 정리 — 사용자가 '추가'만 하고 안 채운 빈 리스트 항목·빈 등급표 행·빈 항목쌍
 *  제거. plain copy 를 받아 in-place 정리 후 반환($state.snapshot 결과를 넘길 것). */
export function pruneEmptyRows<T>(record: T): T {
  if (!record || typeof record !== 'object') return record
  const R = record as any
  const has = (v: any) => typeof v === 'string' && v.trim().length > 0
  const items = (arr: any) => (Array.isArray(arr) ? arr.filter((it) => has(it?.내용)) : arr)

  if (R.욕구기준?.지표) R.욕구기준.지표 = items(R.욕구기준.지표)
  if (R.우선순위) R.우선순위 = items(R.우선순위)
  if (R.제외) R.제외 = items(R.제외)
  if (R.절차) R.절차 = items(R.절차)
  if (R.법적근거) R.법적근거 = items(R.법적근거)
  if (R.신고의무) R.신고의무 = items(R.신고의무)
  if (Array.isArray(R.중지상실)) R.중지상실 = R.중지상실.filter((it: any) => has(it?.사유))
  if (R.제공인력?.자격경로) R.제공인력.자격경로 = items(R.제공인력.자격경로)
  if (R.제공인력?.결격) R.제공인력.결격 = items(R.제공인력.결격)
  if (Array.isArray(R.집단규모)) R.집단규모 = R.집단규모.filter((it: any) => has(it?.값))
  if (Array.isArray(R.운영규칙))
    R.운영규칙 = R.운영규칙.filter((it: any) => has(it?.종류) || has(it?.내용))
  if (Array.isArray(R.서비스)) {
    for (const g of R.서비스) if (Array.isArray(g?.내용)) g.내용 = g.내용.filter((it: any) => has(it?.설명))
  }
  if (Array.isArray(R.중복금지?.불가)) R.중복금지.불가 = R.중복금지.불가.filter(has)
  if (Array.isArray(R.금액)) {
    for (const g of R.금액) {
      if (!Array.isArray(g?.금액)) continue
      g.금액 = g.금액.filter(
        (r: any) => has(condLabel(r)) || r?.정부지원금 != null || r?.본인부담금 != null || r?.금액 != null
      )
    }
  }
  if (Array.isArray(R.항목)) R.항목 = R.항목.filter((it: any) => has(it?.라벨) || has(it?.값))
  return record
}

/** 편집된 record → 구 카탈로그 필드(support_*) 재파생. record 가 정본, 이건 파생 캐시. */
export function deriveOldFields(record: any): {
  support_amount: Record<string, unknown> | null
  support_scope: string | null
  support_target: string | null
} {
  const R = record ?? {}
  const target = (
    [
      ['소득기준', R.소득기준],
      ['연령기준', R.연령기준],
      ['욕구기준', R.욕구기준],
      ['우선순위', R.우선순위],
      ['중복금지', R.중복금지]
    ] as [string, unknown][]
  )
    .map(([label, node]) => {
      const t = flattenNode(node)
      return t ? `[${label}] ${t}` : ''
    })
    .filter(Boolean)
    .join('\n')
  const scope = flattenNode(R.서비스)   // 목적 축은 D15 로 폐기 — 서비스만
  const { value: amount } = formToSupportAmount(buildSupportAmountForm(R.금액))
  return {
    support_amount: (amount ?? null) as Record<string, unknown> | null,
    support_scope: scope || null,
    support_target: target || null
  }
}
