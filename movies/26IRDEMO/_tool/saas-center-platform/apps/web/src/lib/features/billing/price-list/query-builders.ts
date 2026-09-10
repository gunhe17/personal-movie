import type { PriceListFilters } from './filters'

export const buildPriceListListInput = (
  centerId: string | null,
  filters: PriceListFilters
) => ({
  centerId,
  service_type:
    filters.serviceType !== 'all' ? filters.serviceType : undefined,
  is_active:
    filters.activeStatus !== 'all'
      ? filters.activeStatus === 'true'
      : undefined,
  search: filters.search || undefined,
  page: filters.page,
  size: filters.pageSize
})
