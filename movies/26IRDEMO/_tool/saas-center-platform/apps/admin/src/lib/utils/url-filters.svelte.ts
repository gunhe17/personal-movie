import { goto } from '$app/navigation'
import { page } from '$app/stores'
import { get } from 'svelte/store'
import { browser } from '$app/environment'

/**
 * URL 검색 파라미터와 동기화되는 필터 상태 관리 유틸리티
 *
 * 사용법:
 *   const url = useUrlFilters({ search: '', status: 'all', page: 1 })
 *   // 초기값 읽기: url.initial.search, url.initial.page 등
 *   // URL 동기화: url.sync({ search, status, page })  — 기본값과 같으면 URL에서 제거
 *   // 리셋:       url.reset()  — 기본값으로 URL 업데이트
 */

type FilterValue = string | number | boolean

export function useUrlFilters<T extends Record<string, FilterValue>>(defaults: T) {
  const initial: T = browser ? parseFromUrl(get(page).url, defaults) : { ...defaults }

  function sync(current: Partial<T>) {
    if (!browser) return

    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(current)) {
      const defaultValue = defaults[key as keyof T]
      if (value === defaultValue || value === '' || value === undefined) continue
      params.set(key, String(value))
    }

    const search = params.toString()
    const currentUrl = get(page).url
    const newPath = search ? `${currentUrl.pathname}?${search}` : currentUrl.pathname

    goto(newPath, { replaceState: true, noScroll: true, keepFocus: true })
  }

  function reset() {
    if (!browser) return
    const currentUrl = get(page).url
    goto(currentUrl.pathname, { replaceState: true, noScroll: true, keepFocus: true })
  }

  return { initial, defaults, sync, reset }
}

function parseFromUrl<T extends Record<string, FilterValue>>(url: URL, defaults: T): T {
  const result = { ...defaults }

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const param = url.searchParams.get(key)
    if (param === null) continue

    if (typeof defaultValue === 'number') {
      const parsed = parseInt(param, 10)
      if (!Number.isNaN(parsed)) {
        ;(result as any)[key] = parsed
      }
    } else if (typeof defaultValue === 'boolean') {
      ;(result as any)[key] = param === 'true'
    } else {
      ;(result as any)[key] = param
    }
  }

  return result
}
