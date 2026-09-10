import { goto } from '$app/navigation'

/** 목록 페이지 공용 페이지 크기 (검사현황/내담자/직원관리) */
export const LIST_PAGE_SIZE = 10

export interface FilterManager<T> {
  filters: T
  updateFilter: (key: keyof T, value: any) => void
  resetFilters: () => void
  toSearchParams: () => URLSearchParams
}

export function parseParam(
  url: URL,
  key: string,
  defaultValue: string
): string {
  return url.searchParams.get(key) || defaultValue
}

export function parseNumParam(
  url: URL,
  key: string,
  defaultValue: number
): number {
  const val = url.searchParams.get(key)
  if (!val) return defaultValue
  const num = parseInt(val, 10)
  return isNaN(num) ? defaultValue : num
}
