/**
 * CenterVoucher 페이지용 필터 훅
 * - URL ↔ 상태 동기화
 * - 페이지·활성 필터·뷰 타입 관리
 */

import { goto } from '$app/navigation'
import { browser } from '$app/environment'
import {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  toSearchParams,
  type CenterVoucherFilters
} from './filters'
import type { ActiveStatusFilter, ViewType } from './constants'

export function useCenterVoucherFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let activeStatus = $state<ActiveStatusFilter>(initial.activeStatus)
  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let viewType = $state<ViewType>(initial.view)

  // URL 동기화
  function updateURL() {
    if (!browser) return
    const filters: CenterVoucherFilters = {
      activeStatus,
      page: currentPage,
      pageSize,
      view: viewType
    }
    const params = toSearchParams(filters)
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    goto(url, { replaceState: true, noScroll: true, keepFocus: true })
  }

  $effect(() => {
    updateURL()
  })

  function buildFilters(): CenterVoucherFilters {
    return {
      activeStatus,
      page: currentPage,
      pageSize,
      view: viewType
    }
  }

  function resetPage() {
    currentPage = 1
  }

  return {
    get activeStatus() {
      return activeStatus
    },
    set activeStatus(v: ActiveStatusFilter) {
      activeStatus = v
      resetPage()
    },
    get currentPage() {
      return currentPage
    },
    set currentPage(v: number) {
      currentPage = v
    },
    get pageSize() {
      return pageSize
    },
    set pageSize(v: number) {
      pageSize = v
      resetPage()
    },
    get viewType() {
      return viewType
    },
    set viewType(v: ViewType) {
      viewType = v
    },
    buildFilters
  }
}
