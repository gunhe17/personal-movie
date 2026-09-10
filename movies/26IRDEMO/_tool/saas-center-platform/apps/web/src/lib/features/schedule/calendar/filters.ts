import type { DateRangeMode, DisplayMode } from './constants'

export interface CalendarFilters {
  selectedManagerNames: string[] | null
  selectedProgramNames: string[] | null
  selectedClientNames: string[] | null
  dateRange: DateRangeMode
  displayMode: DisplayMode
}

export const DEFAULT_FILTERS: CalendarFilters = {
  selectedManagerNames: [],
  selectedProgramNames: [],
  selectedClientNames: [],
  dateRange: '일간',
  displayMode: '장소별'
}

export function parseFiltersFromUrl(url: URL): CalendarFilters {
  const params = url.searchParams
  const selectedManagerNames = params
    .get('selectedManagerNames')
    ?.split(',') as string[]
  const selectedProgramNames = params
    .get('selectedProgramNames')
    ?.split(',') as string[]
  const selectedClientNames = params
    .get('selectedClientNames')
    ?.split(',') as string[]
  const dateRange = (params.get('dateRange') as DateRangeMode) ?? DEFAULT_FILTERS.dateRange
  const displayMode = (params.get('displayMode') as DisplayMode) ?? DEFAULT_FILTERS.displayMode

  return {
    selectedManagerNames:
      selectedManagerNames ?? DEFAULT_FILTERS.selectedManagerNames,
    selectedProgramNames:
      selectedProgramNames ?? DEFAULT_FILTERS.selectedProgramNames,
    selectedClientNames:
      selectedClientNames ?? DEFAULT_FILTERS.selectedClientNames,
    dateRange,
    displayMode
  }
}

export function toSearchParams(filters: CalendarFilters) {
  const params = new URLSearchParams()
  if (filters.selectedManagerNames && filters.selectedManagerNames.length)
    params.set('selectedManagerNames', filters.selectedManagerNames.join(','))
  if (filters.selectedProgramNames !== DEFAULT_FILTERS.selectedProgramNames && filters.selectedProgramNames?.length)
    params.set('selectedProgramNames', filters.selectedProgramNames.join(','))
  if (filters.selectedClientNames !== DEFAULT_FILTERS.selectedClientNames && filters.selectedClientNames?.length)
    params.set('selectedClientNames', filters.selectedClientNames.join(','))
  if (filters.dateRange && filters.dateRange !== DEFAULT_FILTERS.dateRange)
    params.set('dateRange', filters.dateRange)
  if (filters.dateRange === '일간' && filters.displayMode && filters.displayMode !== DEFAULT_FILTERS.displayMode)
    params.set('displayMode', filters.displayMode)

  return params
}
