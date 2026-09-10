import type { VoucherClientFilters } from './filters'

export type VoucherClientListInput = {
  centerId: string
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  sort?: string
  signal?: string
  page: number
  size: number
}

export const buildVoucherClientListInput = (
  centerId: string,
  filters: VoucherClientFilters
): VoucherClientListInput => ({
  centerId,
  status: filters.status === 'all' ? undefined : filters.status,
  search: filters.search || undefined,
  date_from: filters.dateFrom || undefined,
  date_to: filters.dateTo || undefined,
  sort: filters.sort,
  signal: filters.signal || undefined,
  page: filters.page,
  size: filters.pageSize
})
