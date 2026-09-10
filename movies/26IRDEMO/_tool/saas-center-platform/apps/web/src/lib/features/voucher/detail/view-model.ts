import type {
  ClientVoucherResponse,
  VoucherUsageItem
} from '$lib/hooks/actions/clientVoucher.action'
import type { ClientFormInstanceItem } from '$lib/hooks/actions/form.action'
import type {
  CaseClient,
  CounselingCaseBaseDetail,
  CounselingSession
} from '$lib/types/counseling'

export interface VoucherProgramCardVM {
  id: string
  programName: string
  year: number | null
  organization: string
  isActive: boolean
}

const localToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function groupVoucherProgramCards(
  items: ClientVoucherResponse[] | undefined
): { active: VoucherProgramCardVM[]; expired: VoucherProgramCardVM[] } {
  if (!items) return { active: [], expired: [] }
  const today = localToday()
  const active: VoucherProgramCardVM[] = []
  const expired: VoucherProgramCardVM[] = []

  for (const v of items) {
    const isActive =
      v.remaining_sessions > 0 && (!v.valid_until || v.valid_until >= today)
    const card: VoucherProgramCardVM = {
      id: v.id,
      // 목록과 동일하게 하위 서비스명(catalog.name)을 우선. program_name은 상위 사업명(예: 지역사회서비스투자사업)이라 식별성이 낮음.
      programName: v.catalog?.name ?? v.catalog?.program_name ?? '바우처',
      year: v.catalog?.program_year ?? null,
      organization: v.catalog?.program_organization ?? '',
      isActive
    }
    ;(isActive ? active : expired).push(card)
  }

  return { active, expired }
}

// ─── 바우처 상세 (사용 내역 행) ───

export interface VoucherUsageRowVM {
  billableItemId: string
  billableDate: string // 'YYYY-MM-DD'
  dateLabel: string // '2026. 7. 12'
  description: string
  amount: number
  subsidyAmount: number
  relatedCaseId: string | null
  relatedSessionId: string | null
}

function toUsageDateLabel(d: string): string {
  if (!d) return '-'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return d
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`
}

export function mapToVoucherUsageRowVM(
  item: VoucherUsageItem
): VoucherUsageRowVM {
  return {
    billableItemId: item.billable_item_id,
    billableDate: item.billable_date,
    dateLabel: toUsageDateLabel(item.billable_date),
    description: item.description || '청구 항목',
    amount: item.amount,
    subsidyAmount: item.subsidy_amount,
    relatedCaseId: item.related_case_id,
    relatedSessionId: item.related_session_id
  }
}

// ─── 바우처 상세 (제출 서류 카드) ───

export interface VoucherDocCardVM {
  mappingId: string
  instanceId: string
  templateId: string
  name: string
  isSubmitted: boolean
}

export function mapToVoucherDocCardVM(
  item: ClientFormInstanceItem,
  templateNames: Map<string, string>
): VoucherDocCardVM {
  return {
    mappingId: item.mapping_id,
    instanceId: item.instance.id,
    templateId: item.instance.template_id,
    name: templateNames.get(item.instance.template_id) ?? '문서',
    isSubmitted: item.instance.status === 'submitted'
  }
}

// ─── 바우처 상세 (회기 ↔ 일지) ───

export interface SessionJournalInfo {
  session: CounselingSession
  caseClients: CaseClient[]
  programName: string
  hasNote: boolean
}

/** 케이스 상세들에서 session_id → 일지 작성 정보 맵을 만든다 */
export function buildSessionJournalMap(
  cases: CounselingCaseBaseDetail[],
  clientId: string
): Map<string, SessionJournalInfo> {
  const map = new Map<string, SessionJournalInfo>()
  for (const c of cases) {
    for (const session of c.sessions ?? []) {
      const participant =
        session.clients?.find((p) => p.participant_id === clientId) ??
        session.clients?.[0]
      map.set(session.session_id, {
        session,
        caseClients: c.clients ?? [],
        programName: c.program_name,
        hasNote: participant?.has_note ?? false
      })
    }
  }
  return map
}

/** 사용 내역 기준 가장 최근 케이스의 담당 상담사 이름 */
export function deriveCounselorName(
  rows: VoucherUsageRowVM[],
  cases: CounselingCaseBaseDetail[]
): string | null {
  if (cases.length === 0) return null
  const caseById = new Map(cases.map((c) => [c.case_id, c]))
  for (const row of rows) {
    if (row.relatedCaseId && caseById.has(row.relatedCaseId)) {
      return caseById.get(row.relatedCaseId)!.counselor_name || null
    }
  }
  return cases[0].counselor_name || null
}
