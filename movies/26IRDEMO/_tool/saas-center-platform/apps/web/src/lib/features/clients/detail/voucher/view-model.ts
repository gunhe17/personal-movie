import type {
  ClientVoucherResponse,
  VoucherUsageItem
} from '$lib/hooks/actions/clientVoucher.action'

export interface ClientVoucherCardVM {
  id: string
  clientId: string
  centerVoucherId: string
  name: string
  organization: string
  totalSessions: number
  remainingSessions: number
  totalAmount: number | null
  remainingAmount: number | null
  validRange: string | null
  rawValidFrom: string | null
  rawValidUntil: string | null
}

export interface VoucherUsageItemVM {
  billableItemId: string
  billableDate: string // 'YYYY-MM-DD'
  description: string
  quantity: number
  amount: number
  subsidyAmount: number
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

export function mapToClientVoucherCardVM(
  voucher: ClientVoucherResponse
): ClientVoucherCardVM {
  const validFrom = formatDate(voucher.valid_from)
  const validUntil = formatDate(voucher.valid_until)
  let validRange: string | null = null
  if (validFrom && validUntil) {
    validRange = `${validFrom} ~ ${validUntil}`
  } else if (validFrom) {
    validRange = `${validFrom} ~`
  } else if (validUntil) {
    validRange = `~ ${validUntil}`
  }

  return {
    id: voucher.id,
    clientId: voucher.client_id,
    centerVoucherId: voucher.center_voucher_id,
    name: voucher.catalog?.name ?? '바우처',
    organization: voucher.catalog?.program_organization ?? '',
    totalSessions: voucher.total_sessions,
    remainingSessions: voucher.remaining_sessions,
    totalAmount: voucher.total_amount,
    remainingAmount: voucher.remaining_amount,
    validRange,
    rawValidFrom: voucher.valid_from,
    rawValidUntil: voucher.valid_until
  }
}

export function mapToVoucherUsageItemVM(
  item: VoucherUsageItem
): VoucherUsageItemVM {
  return {
    billableItemId: item.billable_item_id,
    billableDate: item.billable_date,
    description: item.description,
    quantity: item.quantity,
    amount: item.amount,
    subsidyAmount: item.subsidy_amount
  }
}
