/**
 * Assessment Receive Feature Module
 * 검사 접수 기능 모듈
 */

// Constants
export {
  MORNING_TIMES,
  AFTERNOON_TIMES,
  MODAL_SIZES,
  DEFAULT_ASSESSMENT_DURATION_HOURS,
  type ClientType,
  type ReportStatus
} from './constants'

// Query Builders
export {
  buildAssessmentsQueryInput,
  buildPackagesQueryInput,
  buildMembersQueryInput,
  buildRoomsQueryInput,
  buildCreateClientRequest,
  buildCreateInstitutionPayload,
  buildIndividualScheduleRequest,
  buildGroupScheduleRequest,
  formatBirthDateValue
} from './query-builders'

// Service
export {
  createReceiveService,
  type CaseDetail,
  type ReceiveServiceDeps,
  type SubmitReceiveInput
} from './receive-service'

// View Model
export {
  mapAssessmentSetItemsToPackages,
  mapMemberOptions,
  mapRoomOptions,
  meMemberToMemberItem,
  getDuplicateAssessmentNames,
  mapClientSummaryToExtendedClient,
  mapCaseCounselorToMemberItem,
  mapCaseTasksToAssessmentItemNames,
  type SelectOption
} from './view-model'

// Hooks
export { useReceiveForm } from './hooks.svelte'

// Components (re-export from new location)
export {
  SelectedOrganizationCard,
  AssessmentSelector,
  SelectableButtonGroup,
  ClientMultiSelect
} from '$lib/components/assessment/receive'
