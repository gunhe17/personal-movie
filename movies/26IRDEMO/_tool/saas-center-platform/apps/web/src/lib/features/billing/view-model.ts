/**
 * 청구서 API → UI 변환기
 */
import type { BillableSummary, BillableDetail, BillableStatus } from '$lib/hooks/actions/billable.action'
import { formatUtcToKst } from '$lib/utils/date'
import { BILLABLE_STATUS, BILLABLE_STATUS_COLORS } from './constants'

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

// ── Billable VM ──

export interface BillableListItemVM {
  id: string
  clientId: string
  clientName: string
  clientCode: string
  clientBirthDate: string
  clientGender: 'male' | 'female'
  clientProfileImageUrl: string | null
  billableDate: string
  totalAmount: number
  totalAmountFormatted: string
  paidAmount: number
  paidAmountFormatted: string
  unpaidAmount: number
  unpaidAmountFormatted: string
  status: BillableStatus
  statusLabel: string
  statusColor: string
  itemCount: number
  itemSummary: string
  caseCodes: string[]
  isPackage: boolean
  issuedAt: string
  createdByName: string
  createdAt: string
  createdAtDate: string // 'YYYY-MM-DD' (셀 상단)
  createdAtTime: string // '(목) HH:mm' (셀 하단)
}

export function mapToBillableListItemVM(item: BillableSummary): BillableListItemVM {
  return {
    id: item.id,
    clientId: item.client_id,
    clientName: item.client_name ?? '-',
    clientCode: item.client_code ?? '',
    clientBirthDate: item.client_birth_date ?? '',
    clientGender:
      item.client_gender === 'F' || item.client_gender === 'female'
        ? 'female'
        : 'male',
    clientProfileImageUrl: item.client_profile_image_url ?? null,
    billableDate: item.billable_date,
    totalAmount: item.total_amount,
    totalAmountFormatted: formatAmount(item.total_amount),
    paidAmount: item.paid_amount,
    paidAmountFormatted: formatAmount(item.paid_amount),
    unpaidAmount: item.unpaid_amount,
    unpaidAmountFormatted: formatAmount(item.unpaid_amount),
    status: item.status,
    statusLabel: BILLABLE_STATUS[item.status] ?? item.status,
    statusColor: BILLABLE_STATUS_COLORS[item.status] ?? '',
    itemCount: item.item_count,
    itemSummary: item.item_summary || '-',
    caseCodes: item.case_codes ?? [],
    isPackage: item.is_package ?? false,
    issuedAt: item.issued_at ? formatUtcToKst(item.issued_at, 'YYYY-MM-DD HH:mm') : '-',
    createdByName: item.created_by_name ?? '-',
    createdAt: formatUtcToKst(item.created_at, 'YYYY-MM-DD HH:mm'),
    createdAtDate: formatUtcToKst(item.created_at, 'YYYY-MM-DD'),
    createdAtTime: formatUtcToKst(item.created_at, '(d) HH:mm')
  }
}

export interface BillableDetailVM {
  id: string
  clientId: string
  clientName: string
  clientCode: string
  /** 아바타·표기용 내담자 정보 (상세 응답이 함께 실어준다) */
  clientBirthDate: string | null
  clientGender: string | null
  clientProfileImageUrl: string | null
  billableDate: string
  subtotalAmount: number
  subtotalAmountFormatted: string
  discountAmount: number
  discountAmountFormatted: string
  hasDiscount: boolean
  subsidyAmount: number
  subsidyAmountFormatted: string
  hasSubsidy: boolean
  totalAmount: number
  totalAmountFormatted: string
  paidAmount: number
  paidAmountFormatted: string
  unpaidAmount: number
  unpaidAmountFormatted: string
  status: BillableStatus
  statusLabel: string
  statusColor: string
  issuedAt: string
  dueDate: string | null
  notes: string
  createdBy: string
  createdByName: string
  items: BillableDetail['items']
  createdAt: string
}

export function mapToBillableDetailVM(item: BillableDetail): BillableDetailVM {
  const discount = item.discount_amount ?? 0
  const subsidy = item.subsidy_amount ?? 0
  const subtotal = item.total_amount + discount + subsidy
  return {
    id: item.id,
    clientId: item.client_id,
    clientName: item.client_name ?? '-',
    clientCode: item.client_code ?? '',
    clientBirthDate: item.client_birth_date ?? null,
    clientGender: item.client_gender ?? null,
    clientProfileImageUrl: item.client_profile_image_url ?? null,
    billableDate: item.billable_date,
    subtotalAmount: subtotal,
    subtotalAmountFormatted: formatAmount(subtotal),
    discountAmount: discount,
    discountAmountFormatted: formatAmount(discount),
    hasDiscount: discount > 0,
    subsidyAmount: subsidy,
    subsidyAmountFormatted: formatAmount(subsidy),
    hasSubsidy: subsidy > 0,
    totalAmount: item.total_amount,
    totalAmountFormatted: formatAmount(item.total_amount),
    paidAmount: item.paid_amount,
    paidAmountFormatted: formatAmount(item.paid_amount),
    unpaidAmount: item.unpaid_amount,
    unpaidAmountFormatted: formatAmount(item.unpaid_amount),
    status: item.status,
    statusLabel: BILLABLE_STATUS[item.status] ?? item.status,
    statusColor: BILLABLE_STATUS_COLORS[item.status] ?? '',
    issuedAt: item.issued_at ? formatUtcToKst(item.issued_at, 'YYYY-MM-DD HH:mm') : '-',
    dueDate: item.due_date,
    notes: item.notes ?? '',
    createdBy: item.created_by,
    createdByName: item.created_by_name ?? '-',
    items: item.items,
    createdAt: formatUtcToKst(item.created_at, 'YYYY-MM-DD HH:mm')
  }
}
