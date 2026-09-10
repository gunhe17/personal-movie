/**
 * 검사 현황 Feature 모듈 - 공개 API
 */

// Constants
export {
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_DELAY,
  staffOptions,
  clientTypeOptions,
  sortOptions,
  type TabType,
  type SortOrder,
  type ViewType,
  type ClientType,
  type SelectOption
} from './constants'

// Filters
export {
  parseFiltersFromUrl,
  toSearchParams,
  toCasesQueryParams,
  toStatusCountsInput,
  type StatusFilters,
  type CasesQueryInput,
  type StatusCountsInput
} from './filters'

// Query Builders
export { buildCasesQueryInput, buildStatusCountsInput } from './query-builders'

// ViewModel
export {
  setAssessmentsData,
  getHasOnlineLink,
  mapCasesToVM
} from './view-model'

// Service
export { createStatusService, type StatusServiceDeps } from './status-service'

// Hooks
export { useStatusFilters } from './hooks.svelte'
