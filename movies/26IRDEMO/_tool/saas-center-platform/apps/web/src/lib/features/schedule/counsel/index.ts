/**
 * Schedule Counsel Feature Module
 * 상담 일정 접수 기능 모듈
 */

// Constants
export {
  MODAL_SIZES,
  CLIENT_TYPE_OPTIONS,
  COUNSEL_TYPE_OPTIONS,
  type ClientType,
} from './constants'

// Query Builders
export {
  buildMembersQueryInput,
  buildRoomsQueryInput,
  type IndividualScheduleParams,
  type GroupScheduleParams
} from './query-builders'

// Hooks
export {
  useCounselForm,
  type ClientRegisterData,
  type OrganizationRegisterData
} from './hooks.svelte'

// Components (re-export from new location)
export {
  IndividualClientSection,
  GroupClientSection,
  CounselTypeSection,
  StaffSection,
  RoomSection,
  RecurrenceSection
} from '$lib/components/schedule/counsel'
