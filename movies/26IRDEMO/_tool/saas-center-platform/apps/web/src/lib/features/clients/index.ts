/**
 * 내담자 관리 Feature 모듈 - 공개 API
 */

// Constants
export {
  CLIENT_SORT_OPTIONS,
  CLIENT_ROLE_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  CLIENT_GENDER_OPTIONS,
  CLIENT_STATUS_MAP,
  CLIENT_PAGE_SIZE
} from './constants'

// Filters
export {
  DEFAULT_FILTERS,
  SEARCH_DEBOUNCE_MS,
  parseFiltersFromUrl,
  toSearchParams,
  type ClientRoleFilter,
  type ClientStatusFilter,
  type ClientGenderFilter,
  type ClientGuardianFilter,
  type ClientFilters
} from './filters'

// Query Builders
export { buildClientListInput, type ClientListInput } from './query-builders'

// ViewModel
export {
  mapClientsToVM,
  filterClients,
  sortClients,
  paginateClients,
  type ClientCardVM
} from './view-model'

// Hooks
export { useClientFilters } from './hooks.svelte'
