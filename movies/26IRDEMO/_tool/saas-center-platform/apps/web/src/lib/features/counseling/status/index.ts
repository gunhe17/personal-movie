/**
 * 상담 현황 Feature 모듈 - 공개 API
 */

// Constants
export {
  SEARCH_DEBOUNCE_DELAY,
  sortOptions,
  COUNSELING_TABS,
  COUNSELING_SIGNAL_CHIPS,
  type SortOrder,
  type CounselingTypeFilter,
  type CounselingSignalFilter,
  type SelectOption,
  type TabType,
  type ViewType
} from './constants'

// Filters
export {
  parseFiltersFromUrl,
  toSearchParams,
  type CounselingFilters,
  type CounselingsQueryInput
} from './filters'

// Query Builders
export { buildCounselingsQueryInput } from './query-builders'

// Hooks
export { useCounselingFilters } from './hooks.svelte'

// View Model
export {
  mapCounselingToRow,
  mapCounselingsToRows,
  type CounselingStatusRow
} from './view-model'

// Service
export {
  createCounselingService,
  type CounselingServiceDeps
} from './counseling-service'
