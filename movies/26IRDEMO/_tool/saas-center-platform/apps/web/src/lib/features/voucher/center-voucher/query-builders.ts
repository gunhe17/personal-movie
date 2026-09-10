import type { CenterVoucherFilters } from './filters'

// 목록 조회 input 빌더
export function buildCenterVoucherListInput(
  centerId: string | null | undefined,
  filters: CenterVoucherFilters
) {
  return {
    centerId,
    is_active:
      filters.activeStatus === 'all'
        ? undefined
        : filters.activeStatus === 'true',
    page: filters.page,
    size: filters.pageSize
  }
}

// 상세 조회 input 빌더
export function buildCenterVoucherDetailInput(
  centerId: string | null | undefined,
  centerVoucherId: string
) {
  return {
    centerId,
    centerVoucherId
  }
}

// 폼 데이터 타입 (모달에서 사용)
export interface CenterVoucherFormData {
  catalog_id: string
  unit_price?: number | null
  default_total_sessions?: number | null
  is_active: boolean
  memo?: string | null
}

export interface CenterVoucherEditFormData {
  unit_price?: number | null
  default_total_sessions?: number | null
  is_active: boolean
  memo?: string | null
}
