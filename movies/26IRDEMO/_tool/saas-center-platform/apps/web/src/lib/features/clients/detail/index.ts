export {
  DETAIL_TABS,
  HIDDEN_DETAIL_TABS,
  MODAL_SIZES,
  type DetailTab
} from './constants'
export {
  buildClientDetailInput,
  buildClientDocsInput,
  buildRelationsInput,
  buildTemplatesInput,
  buildInstancesInput,
  buildFormInstanceInput,
  buildFormTemplateInput
} from './query-builders'
export {
  mapToClientDetailVM,
  mapToDocumentItem,
  mapToPreAdmissionDocument,
  mapToDocumentList,
  formatAnswerValue,
  type ClientDetailVM,
  type RelationInfo
} from './view-model'
export { createDetailService, type DetailServiceDeps } from './detail-service'
export {
  toAssessmentByClientPage,
  mapCounselingToHistory,
  mapAssessmentToHistory,
  toCounselingHistoryPage,
  groupCaseHistoryByDate,
  CASE_HISTORY_SUBTABS,
  type CaseHistoryItem,
  type CaseHistoryKind,
  type CaseHistoryPage,
  type CaseHistoryGroup
} from './case-history'
