/**
 * 직원 관리 Feature 모듈 - 공개 API
 */

// Constants
export {
  MEMBER_SORT_OPTIONS,
  MEMBER_EMPLOYMENT_TYPE_MAP,
  MEMBER_PAGE_SIZE,
  MEMBER_TABS,
  MEMBER_ROLE_OPTIONS,
  MEMBER_EMPLOYMENT_OPTIONS,
  MODAL_SIZES,
  // 상세 페이지
  MEMBER_DETAIL_TABS,
  WEEKDAYS,
  WEEKDAY_KR_TO_API,
  WEEKDAY_API_TO_KR,
  DEFAULT_WEEKLY_SCHEDULE,
  type MemberDetailTabType,
  type WorkDay,
  type BreakTime,
  type WeekdayType,
  type WeeklySchedule,
  // 학력/경력
  type CareerData
} from './constants'

// Filters
export {
  DEFAULT_FILTERS,
  SEARCH_DEBOUNCE_MS,
  parseFiltersFromUrl,
  toSearchParams,
  type MemberSortOrder,
  type MemberTabType,
  type MemberRoleFilter,
  type MemberViewType,
  type MemberFilters
} from './filters'

// Query Builders
export { buildMemberListInput, type MemberListInput } from './query-builders'

// ViewModel
export {
  mapMembersToVM,
  sortMembers,
  paginateMembers,
  filterMembersByOptions,
  getInitial,
  type MemberVM
} from './view-model'

// Work Schedule (캘린더 일정 집계)
export {
  buildScheduleCountMap,
  toDateKey,
  type DayScheduleCount,
  type ScheduleCountMap
} from './work-schedule'

// Case History (담당 이력: 상담/검사 서브탭별 무한스크롤)
export {
  groupCaseHistoryByDate,
  mapCounselingToHistory,
  mapAssessmentToHistory,
  toCounselingHistoryPage,
  toAssessmentHistoryPage,
  CASE_HISTORY_SUBTABS,
  type CaseHistoryItem,
  type CaseHistoryGroup,
  type CaseHistoryPage,
  type CaseHistoryKind
} from './case-history'

// Service
export { createMembersService, type MembersDeps } from './members-service'

// Permissions
export { MEMBER_PERMISSIONS, type MemberPermissionKey } from './permissions'

// Hooks
export { useMemberFilters } from './hooks.svelte'
