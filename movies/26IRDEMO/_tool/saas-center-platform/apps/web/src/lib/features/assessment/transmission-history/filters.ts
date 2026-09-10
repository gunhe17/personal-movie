import {
	appendPaginationToParams,
	parsePaginationFromUrl,
	parseSearchFromUrl,
	type BaseListFilter
} from '$lib/features/common/filters'
import {
	DEFAULT_PAGE_SIZE,
	type SortOrder,
	type TabType
} from './constants'
import type { GetTransmissionHistoryParams } from '$lib/hooks/actions/transmission.action'

export interface TransmissionFilters extends BaseListFilter {
	sort: SortOrder
	tab: TabType
	sendDate: string | null // YYYY-MM-DD
}

const DEFAULT_FILTERS: Omit<TransmissionFilters, keyof BaseListFilter> = {
	sort: 'desc',
	tab: 'direct-link',
	sendDate: null
}

export function parseFiltersFromUrl(url: URL): TransmissionFilters {
	const pagination = parsePaginationFromUrl(url, {
		page: 1,
		pageSize: DEFAULT_PAGE_SIZE
	})

	const params = url.searchParams

	return {
		...DEFAULT_FILTERS,
		...pagination,
		search: parseSearchFromUrl(url),
		sort: (params.get('sort') as SortOrder) || DEFAULT_FILTERS.sort,
		tab: (params.get('tab') as TabType) || DEFAULT_FILTERS.tab,
		sendDate: params.get('sendDate')
	}
}

export function toSearchParams(filters: TransmissionFilters): URLSearchParams {
	const params = new URLSearchParams()
	appendPaginationToParams(params, filters)

	if (filters.search) params.set('search', filters.search)
	if (filters.sort !== 'desc') params.set('sort', filters.sort)
	if (filters.tab !== 'direct-link') params.set('tab', filters.tab)
	if (filters.sendDate) params.set('sendDate', filters.sendDate)

	return params
}

export function toTransmissionQueryParams(filters: TransmissionFilters, centerId: string): GetTransmissionHistoryParams {
	return {
		centerId,
		queryParams: {
			search: filters.search || undefined,
			type: filters.tab,
			sendDate: filters.sendDate || undefined,
			sort: filters.sort,
			page: filters.page,
			pageSize: filters.pageSize
		}
	}
}
