import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
	DEFAULT_PAGE_SIZE,
	SEARCH_DEBOUNCE_DELAY,
	type SortOrder,
	type TabType
} from './constants'
import {
	parseFiltersFromUrl,
	toSearchParams,
	type TransmissionFilters
} from './filters'

export function useTransmissionFilters(initialUrl: URL, pathname: string) {
	const initial = parseFiltersFromUrl(initialUrl)

	let currentPage = $state(initial.page)
	let pageSize = $state(initial.pageSize || DEFAULT_PAGE_SIZE)
	let searchQuery = $state(initial.search)
	let debouncedSearchQuery = $state(initial.search)
	let sortOrder: SortOrder = $state(initial.sort)
	let activeTab: TabType = $state(initial.tab)
	let sendDate: string | null = $state(initial.sendDate)

	let mounted = $state(false)
	let searchInitialized = $state(false)
	let searchTimeout: ReturnType<typeof setTimeout> | null = null

	function buildFilters(): TransmissionFilters {
		return {
			page: currentPage,
			pageSize,
			search: debouncedSearchQuery,
			sort: sortOrder,
			tab: activeTab,
			sendDate
		}
	}

	function updateURL() {
		const params = toSearchParams(buildFilters())
		const queryString = params.toString()
		const newUrl = queryString ? `${pathname}?${queryString}` : pathname
		goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
	}

	onMount(() => {
		mounted = true
		return () => {
			if (searchTimeout) clearTimeout(searchTimeout)
		}
	})

	// 검색어 디바운싱
	$effect(() => {
		const q = searchQuery
		if (!searchInitialized) {
			searchInitialized = true
			return
		}
		if (searchTimeout) clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			debouncedSearchQuery = q
			currentPage = 1
		}, SEARCH_DEBOUNCE_DELAY)
	})

	// 필터 변경 시 URL 업데이트
	$effect(() => {
		currentPage
		debouncedSearchQuery
		sortOrder
		activeTab
		sendDate
		pageSize

		if (!mounted) return
		updateURL()
	})

	function resetFilters() {
		searchQuery = ''
		debouncedSearchQuery = ''
		sortOrder = 'desc'
		activeTab = 'direct-link'
		sendDate = null
		currentPage = 1
	}

	function changeTab(tab: TabType) {
		activeTab = tab
		currentPage = 1
	}

	function setSendDate(date: string | null) {
		sendDate = date
		currentPage = 1
	}

	function setPageSize(size: number) {
		pageSize = size
		currentPage = 1
	}

	return {
		// getters
		get page() {
			return currentPage
		},
		get pageSize() {
			return pageSize
		},
		get searchQuery() {
			return searchQuery
		},
		get debouncedSearchQuery() {
			return debouncedSearchQuery
		},
		get sortOrder() {
			return sortOrder
		},
		get activeTab() {
			return activeTab
		},
		get sendDate() {
			return sendDate
		},
		get mounted() {
			return mounted
		},

		// setters
		set page(value: number) {
			currentPage = value
		},
		set searchQuery(value: string) {
			searchQuery = value
		},
		set sortOrder(value: SortOrder) {
			sortOrder = value
		},
		set activeTab(value: TabType) {
			activeTab = value
		},
		set sendDate(value: string | null) {
			sendDate = value
		},
		set pageSize(value: number) {
			pageSize = value
		},

		// methods
		buildFilters,
		resetFilters,
		changeTab,
		setSendDate,
		setPageSize
	}
}
