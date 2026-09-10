/**
 * Voucher 도메인 상수.
 */

// ── 자료 유형 (global_document 분류) ──
//
// 백엔드 platform_admin/voucher 의 VoucherFileType enum과 동일한 값.
// (business_guide / manual / form / supplementary / notice)

export type VoucherFileType =
  | 'business_guide'
  | 'manual'
  | 'form'
  | 'supplementary'
  | 'notice'

export const VOUCHER_FILE_TYPE_OPTIONS: Array<{
  value: VoucherFileType
  title: string
}> = [
  { value: 'business_guide', title: '사업 안내' },
  { value: 'manual', title: '매뉴얼' },
  { value: 'form', title: '서식' },
  { value: 'supplementary', title: '보충 자료' },
  { value: 'notice', title: '공고/공지' }
]

export const VOUCHER_FILE_TYPE_LABELS: Record<VoucherFileType, string> = {
  business_guide: '사업 안내',
  manual: '매뉴얼',
  form: '서식',
  supplementary: '보충 자료',
  notice: '공고/공지'
}

export const VOUCHER_FILE_TYPE_BADGE: Record<
  VoucherFileType,
  { bg: string; text: string }
> = {
  business_guide: { bg: 'bg-blue-50', text: 'text-blue-700' },
  manual: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  form: { bg: 'bg-purple-50', text: 'text-purple-700' },
  supplementary: { bg: 'bg-gray-100', text: 'text-gray-600' },
  notice: { bg: 'bg-amber-50', text: 'text-amber-700' }
}

/**
 * 파일명 키워드 → 자료 유형 추정.
 *
 * 적용 규칙:
 * - 대소문자 무시, 연속 공백은 하나로 정규화 후 부분 매칭
 * - 키워드 길이가 긴 것부터 우선 매칭 (예: '공지사항'이 '공지'보다 우선)
 * - 매칭 실패 시 null 반환 → 호출 쪽에서 기본값 유지
 */
const _TYPE_KEYWORD_RULES: Array<{ keyword: string; type: VoucherFileType }> = [
  // notice
  { keyword: '공지사항', type: 'notice' },
  { keyword: '공지문', type: 'notice' },
  { keyword: '공고문', type: 'notice' },
  { keyword: '안내문', type: 'notice' },
  { keyword: '공지', type: 'notice' },
  { keyword: '공고', type: 'notice' },
  { keyword: 'notice', type: 'notice' },

  // business_guide
  { keyword: '사업 안내', type: 'business_guide' },
  { keyword: '사업안내', type: 'business_guide' },
  { keyword: '안내서', type: 'business_guide' },
  { keyword: '지침서', type: 'business_guide' },
  { keyword: '지침', type: 'business_guide' },
  { keyword: 'guide', type: 'business_guide' },

  // manual
  { keyword: '이용 가이드', type: 'manual' },
  { keyword: '이용가이드', type: 'manual' },
  { keyword: '이용 방법', type: 'manual' },
  { keyword: '이용방법', type: 'manual' },
  { keyword: '매뉴얼', type: 'manual' },
  { keyword: '사용법', type: 'manual' },
  { keyword: 'manual', type: 'manual' },

  // form
  { keyword: '신청 양식', type: 'form' },
  { keyword: '신청양식', type: 'form' },
  { keyword: '신청서', type: 'form' },
  { keyword: '서식', type: 'form' },
  { keyword: '양식', type: 'form' },
  { keyword: 'form', type: 'form' },

  // supplementary
  { keyword: '참고 자료', type: 'supplementary' },
  { keyword: '참고자료', type: 'supplementary' },
  { keyword: '보충 자료', type: 'supplementary' },
  { keyword: '보충자료', type: 'supplementary' },
  { keyword: '보조 자료', type: 'supplementary' },
  { keyword: '보조자료', type: 'supplementary' },
  { keyword: '브로슈어', type: 'supplementary' },
  { keyword: '리플릿', type: 'supplementary' },
  { keyword: '팸플릿', type: 'supplementary' },
  { keyword: '홍보물', type: 'supplementary' },
  { keyword: '부록', type: 'supplementary' }
]

// macOS 파일명은 NFD(자모 분리) 형식이고 소스 키워드는 NFC라 NFC로 통일해서 비교
const TYPE_KEYWORD_RULES = [..._TYPE_KEYWORD_RULES]
  .map((r) => ({
    keyword: r.keyword.toLowerCase().normalize('NFC'),
    type: r.type
  }))
  .sort((a, b) => b.keyword.length - a.keyword.length)

export function detectVoucherFileType(
  filename: string
): VoucherFileType | null {
  // 공백 외에 +, _, - 도 단어 구분자로 취급해 공백으로 정규화.
  // 예) "2026년도+지역사회서비스+투자사업+안내" → "2026년도 지역사회서비스 투자사업 안내"
  const normalized = filename
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s+_\-]+/g, ' ')
  for (const rule of TYPE_KEYWORD_RULES) {
    if (normalized.includes(rule.keyword)) {
      return rule.type
    }
  }
  return null
}

/**
 * 사업 연도 셀렉트 옵션 — 현재 연도 기준 ±2년.
 */
export function buildYearOptions(now: Date = new Date()) {
  const current = now.getFullYear()
  const years: Array<{ value: string; title: string }> = [
    { value: 'all', title: '전체 연도' }
  ]
  for (let y = current + 1; y >= current - 5; y--) {
    years.push({ value: String(y), title: `${y}년` })
  }
  return years
}
