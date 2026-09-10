/**
 * 청구서 생성 모달 공통 helpers
 */

import type {
  BillableItemCreatePayload,
  CreateBillablePayload
} from '$lib/hooks/actions/billable.action'
import type { ItemRow } from './types'

export function todayDateString(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export function buildCreatePayload(params: {
  clientId: string
  items: ItemRow[]
  notes?: string
  discountAmount?: number
  /** 청구서 단위 바우처 지원금 (서버에서 item별 회기 비율로 분배) */
  subsidyAmount?: number
  relatedType?: string | null
  relatedCaseId?: string | null
  relatedSessionId?: string | null
}): CreateBillablePayload {
  // 직접 입력으로 추가됐지만 안 채운 빈 행은 제출에서 제외 (삭제 안 해도 생성 가능)
  const filledItems = params.items.filter((item) => item.description.trim())
  return {
    client_id: params.clientId,
    billable_date: todayDateString(),
    notes: params.notes?.trim() || undefined,
    discount_amount: params.discountAmount || undefined,
    subsidy_amount: params.subsidyAmount || undefined,
    items: filledItems.map(
      (item): BillableItemCreatePayload => ({
        item_type: item.itemType as any,
        price_list_id: item.priceListId,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unitPrice,
        related_type: params.relatedType || undefined,
        related_case_id: params.relatedCaseId || undefined,
        // 항목별 session_id 우선 (패키지 선결제처럼 세션별 1:1 매핑)
        related_session_id:
          item.relatedSessionId || params.relatedSessionId || undefined,
        // 바우처 연결 (있으면 생성 시 회기 차감 트리거)
        client_voucher_id: item.clientVoucherId || undefined
      })
    )
  }
}

export function sumItems(items: ItemRow[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

/**
 * VoucherField의 SelectedVoucher → ItemRow에 부착할 voucher patch.
 * voucher가 null이면 모든 voucher 필드를 null로 클리어 (해제 의도).
 */
export function buildVoucherPatch(
  voucher: {
    id: string
    name: string
    remainingSessions: number
    totalSessions: number
    supportText: string | null
  } | null
): Partial<ItemRow> {
  return {
    clientVoucherId: voucher?.id ?? null,
    voucherName: voucher?.name ?? null,
    voucherRemaining: voucher?.remainingSessions ?? null,
    voucherTotal: voucher?.totalSessions ?? null,
    voucherSupportText: voucher?.supportText ?? null
  }
}
