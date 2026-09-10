/**
 * 청구 쿼리 입력 빌더
 */
import type { BillingFilters } from './filters'

export interface BillingListInput {
  centerId: string | null | undefined
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  size?: number
}

export function buildBillingListInput(
  centerId: string | null | undefined,
  filters: BillingFilters
): BillingListInput {
  const input: BillingListInput = {
    centerId,
    page: filters.page,
    size: filters.size
  }
  if (filters.status && filters.status !== 'all') input.status = filters.status
  if (filters.search) input.search = filters.search
  if (filters.date_from) input.date_from = filters.date_from
  if (filters.date_to) input.date_to = filters.date_to
  return input
}

export interface BillingDetailInput {
  centerId: string | null | undefined
  paymentId: string
}

export function buildBillingDetailInput(
  centerId: string | null | undefined,
  paymentId: string
): BillingDetailInput {
  return { centerId, paymentId }
}

// ── Billable (Phase 2) ──

import type { BillableFilters } from './filters'

export function buildBillableListInput(
  centerId: string | null | undefined,
  filters: BillableFilters
) {
  return {
    centerId,
    status: filters.status !== 'all' ? filters.status : undefined,
    search: filters.search || undefined,
    page: filters.page,
    size: filters.size,
    sort: filters.sort,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    related_type:
      filters.targetType !== 'all' ? filters.targetType : undefined
  }
}
