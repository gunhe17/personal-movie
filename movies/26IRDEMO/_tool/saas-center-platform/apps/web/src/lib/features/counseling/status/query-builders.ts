/**
 * 상담 현황 쿼리 빌더
 */
import type { CounselingsQueryInput, CounselingFilters } from './filters'

export function buildCounselingsQueryInput(
  filters: CounselingFilters,
  centerId: string
): CounselingsQueryInput {
  return {
    centerId,
    queryParams: {
      search: filters.search,
      size: filters.pageSize,
      sort: filters.sort,
      page: filters.page,
      status: filters.status,
      counselingType:
        filters.counselingType !== 'all' ? filters.counselingType : undefined,
      counselorIds: filters.selectedManagerNames,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      signal: filters.signal || undefined
    }
  }
}
