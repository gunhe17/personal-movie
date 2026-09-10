import type { CenterVoucherResponse } from '$lib/hooks/actions/centerVoucher.action'
import { ACTIVE_COLOR, ACTIVE_LABEL } from './constants'

export interface CenterVoucherVM {
  id: string
  centerId: string
  catalogId: string

  // 카탈로그 정보
  catalogName: string
  programName: string
  programOrganization: string
  programYear: number
  catalogSummary: string  // "전국민 마음투자 · 보건복지부 · 2026" (목록용)
  /** 상세용 — 사업 기간 포함 "전국민 마음투자 · 보건복지부 · 2026.01.01 ~ 2026.12.31" */
  catalogDetailSummary: string
  /** "2026.01.01 ~ 2026.12.31" 또는 null */
  programPeriod: string | null
  /** 이 사업에 연결된 서식 템플릿 id (이름은 서식 목록에서 해소) */
  formTemplateIds: string[]

  // 정량 정보
  unitPrice: number | null
  unitPriceFormatted: string  // "60,000원" 또는 "-"
  defaultTotalSessions: number | null
  defaultTotalSessionsFormatted: string  // "8회" 또는 "-"

  // 활성 여부
  isActive: boolean
  activeLabel: string
  activeColor: string

  // 사업 종료 여부 (catalog.usage_end_date < today)
  isExpired: boolean

  memo: string | null

  // 메타
  createdBy: string
  createdAt: string
  updatedAt: string
  createdAtFormatted: string  // "2026-05-18 17:30"
}

function formatPrice(price: number | null): string {
  if (price == null) return '-'
  return `${price.toLocaleString('ko-KR')}원`
}

function formatSessions(sessions: number | null): string {
  if (sessions == null) return '-'
  return `${sessions}회`
}

function formatDateTime(iso: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  } catch {
    return iso
  }
}

function isCatalogExpired(usageEndDate: string | null | undefined): boolean {
  if (!usageEndDate) return false
  // YYYY-MM-DD 문자열 비교 (오늘 포함은 만료 아님)
  const today = new Date().toISOString().slice(0, 10)
  return usageEndDate < today
}

function formatPeriodDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  // 'YYYY-MM-DD' → 'YYYY.MM.DD'
  return iso.replaceAll('-', '.')
}

function buildProgramPeriod(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const s = formatPeriodDate(start)
  const e = formatPeriodDate(end)
  if (s && e) return `${s} ~ ${e}`
  if (s) return `${s} ~`
  if (e) return `~ ${e}`
  return null
}

export function mapToCenterVoucherVM(item: CenterVoucherResponse): CenterVoucherVM {
  const catalog = item.catalog
  const catalogName = catalog?.name ?? '(카탈로그 없음)'
  const programName = catalog?.program_name ?? ''
  const programOrganization = catalog?.program_organization ?? ''
  const programYear = catalog?.program_year ?? 0

  const summaryParts = [programName, programOrganization, programYear ? String(programYear) : '']
    .filter(Boolean)
  const catalogSummary = summaryParts.join(' · ')

  const programPeriod = buildProgramPeriod(
    catalog?.usage_start_date,
    catalog?.usage_end_date
  )
  // 상세용은 연도 대신 사업 기간으로 대체 (기간 없으면 연도 그대로)
  const detailParts = [programName, programOrganization, programPeriod ?? (programYear ? String(programYear) : '')]
    .filter(Boolean)
  const catalogDetailSummary = detailParts.join(' · ')

  return {
    id: item.id,
    centerId: item.center_id,
    catalogId: item.catalog_id,
    catalogName,
    programName,
    programOrganization,
    programYear,
    catalogSummary,
    catalogDetailSummary,
    programPeriod,
    formTemplateIds: catalog?.form_template_ids ?? [],
    unitPrice: item.unit_price,
    unitPriceFormatted: formatPrice(item.unit_price),
    defaultTotalSessions: item.default_total_sessions,
    defaultTotalSessionsFormatted: formatSessions(item.default_total_sessions),
    isActive: item.is_active,
    activeLabel: ACTIVE_LABEL[String(item.is_active) as 'true' | 'false'],
    activeColor: ACTIVE_COLOR[String(item.is_active) as 'true' | 'false'],
    isExpired: isCatalogExpired(catalog?.usage_end_date),
    memo: item.memo,
    createdBy: item.created_by,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    createdAtFormatted: formatDateTime(item.created_at)
  }
}

export function mapToCenterVoucherVMs(
  items: CenterVoucherResponse[] | undefined
): CenterVoucherVM[] {
  if (!items) return []
  return items.map(mapToCenterVoucherVM)
}
