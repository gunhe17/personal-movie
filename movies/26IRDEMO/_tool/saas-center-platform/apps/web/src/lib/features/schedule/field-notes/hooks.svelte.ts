import { onMount } from 'svelte'
import { goto } from '$app/navigation'
import {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  toSearchParams,
  type FieldNoteFilters,
  type FieldNoteLinkedFilter,
  type FieldNoteProcessingFilter,
  type FieldNoteViewType
} from './filters'

export function useFieldNoteFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let processingStatus: FieldNoteProcessingFilter = $state(
    initial.processingStatus
  )
  let linked: FieldNoteLinkedFilter = $state(initial.linked)
  let viewType: FieldNoteViewType = $state(initial.view)

  let mounted = $state(false)

  const buildFilters = (): FieldNoteFilters => ({
    page: currentPage,
    pageSize,
    processingStatus,
    linked,
    view: viewType
  })

  const updateURL = () => {
    const params = toSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  onMount(() => {
    mounted = true
  })

  $effect(() => {
    currentPage
    pageSize
    processingStatus
    linked
    viewType
    if (!mounted) return
    updateURL()
  })

  $effect(() => {
    processingStatus
    linked
    viewType
    currentPage = 1
  })

  const reset = () => {
    currentPage = DEFAULT_FILTERS.page
    pageSize = DEFAULT_FILTERS.pageSize
    processingStatus = DEFAULT_FILTERS.processingStatus
    linked = DEFAULT_FILTERS.linked
    // viewType은 초기화 대상이 아니다 — 초기화는 검색·필터만 되돌린다(보기 방식은 사용자 선택 유지)
  }

  return {
    get currentPage() {
      return currentPage
    },
    set currentPage(value: number) {
      currentPage = value
    },
    get pageSize() {
      return pageSize
    },
    set pageSize(value: number) {
      pageSize = value
    },
    get processingStatus() {
      return processingStatus
    },
    set processingStatus(value: FieldNoteProcessingFilter) {
      processingStatus = value
    },
    get linked() {
      return linked
    },
    set linked(value: FieldNoteLinkedFilter) {
      linked = value
    },
    get viewType() {
      return viewType
    },
    set viewType(value: FieldNoteViewType) {
      viewType = value
    },
    reset,
    buildFilters
  }
}
