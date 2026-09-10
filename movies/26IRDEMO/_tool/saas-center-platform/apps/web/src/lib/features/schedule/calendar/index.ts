/**
 * 일정 캘린더 Feature 모듈 - 공개 API
 */

// Constants
export {
  DATE_RANGE_MODES,
  DISPLAY_MODES,
  SESSION_STATUS_OPTIONS,
  REGISTER_SCHEDULE_OPTIONS,
  ROOM_COLORS,
  type DateRangeMode,
  type DisplayMode
} from './constants'

// Filters
export {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  toSearchParams,
  type CalendarFilters
} from './filters'

// Query Builders
export { buildIndividualScheduleRequest, buildGroupScheduleRequest } from './query-builders'

// ViewModel
export {
  formatHeaderText,
  isToday,
  isTodayInRange,
  computeWeeklySummary,
  getScheduleTypeLabel,
  getSessionStatusLabel,
  getSessionStatusColor,
  formatScheduleBlockText
} from './view-model'

// Service
export { createScheduleService } from './calendar-service'

// Components (re-export from new location)
export { CounselReceiveSummaryPanel as ReceiveSummaryPanel } from '$lib/components/schedule/calendar'

// Hooks
export {
  useCalendarState,
  useResourceFilters,
} from './hooks.svelte'
