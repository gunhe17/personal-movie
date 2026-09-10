import type { CaseDetail } from '$lib/hooks/actions/case.action'
import type {
  TaskDetail,
  TaskReportResponse,
  TaskListItem
} from '$lib/hooks/actions/case.action'
import type { CenterAssessment } from '$lib/hooks/actions/assessment.action'
import type {
  AssessmentItem,
  AssessmentVisual,
  CaseDetailVM,
  ClientDetailVM,
  ScheduleVM,
  SendHistoryItem,
  SpecialistDetailVM
} from './types'
import { ASSESSMENT_STATUS_DESCRIPTIONS, resolveCategoryColor } from './constants'
import { formatUtcToKst } from '$lib/utils/date'

export function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  return formatUtcToKst(isoDate, 'YYYY.MM.DD')
}

function formatDateWithDay(isoDate: string): string {
  if (!isoDate) return ''
  return formatUtcToKst(isoDate, 'YYYY.MM.DD (d) HH:mm')
}

export function formatDateTime(isoDate: string): string {
  if (!isoDate) return ''
  return formatUtcToKst(isoDate, 'YYYY-MM-DD HH:mm')
}

export function toAssessmentItems(detail?: CaseDetail): AssessmentItem[] {
  if (!detail?.tasks?.length) return []
  return detail.tasks.map((task, idx) => {
    const name = task.assessment_name || `검사 ${idx + 1}`
    const isOnline = task.execution_method === 'online'
    const status: AssessmentItem['status'] = mapTaskStatusToAssessmentStatus(
      task.status ?? ''
    )

    return {
      id: task.id,
      assessmentId: task.assessment_id,
      name,
      nameEn: '',
      status,
      isOnline,
      needsUpload: !isOnline,
      date: formatDate(task.completed_at || detail.created_at || ''),
      reportPayload: null
    }
  })
}

/** Task 목록 API 응답 → AssessmentItem[] (케이스/태스크 API 데이터만 사용) */
export function toAssessmentItemsFromTaskList(
  tasks: TaskListItem[],
  caseCreatedAt?: string
): AssessmentItem[] {
  if (!tasks?.length) return []
  const fallbackDate = caseCreatedAt || ''
  const sorted = [...tasks].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
      a.id.localeCompare(b.id)
  )
  return sorted.map((task, idx) => {
    const name = task.assessment?.kor_name || `검사 ${idx + 1}`
    const isOnline = task.execution_method === 'online'
    const status: AssessmentItem['status'] = mapTaskStatusToAssessmentStatus(
      task.status ?? ''
    )

    const process = task.process as
      | {
          responses?: { question_number: number; answer_value: number }[]
          cancelled_reason?: string
        }
      | undefined
    const definition = task.assessment?.definition as
      | { questions?: { number: number; text: string }[] }
      | undefined
    return {
      id: task.id,
      assessmentId: task.assessment_id,
      name,
      nameEn: '',
      status,
      isOnline,
      needsUpload: !isOnline,
      date: formatDate(task.completed_at || fallbackDate),
      reportPayload: task.report_payload ?? null,
      reportDocumentId: task.report_document_id ?? null,
      processResponses: process?.responses ?? null,
      questionDefinitions: definition?.questions ?? null,
      assessmentCode: task.assessment?.code ?? undefined,
      workflowType: task.assessment?.workflow_type ?? undefined,
      cancelledReason: process?.cancelled_reason ?? undefined,
      taskId: task.id,
      opinion: task.opinion ?? null
    }
  })
}

/**
 * 검사 목록에 세트 소속(belongsToSet)을 채운다.
 * TaskListItem에는 세트 정보가 없어, 케이스 상세(CaseDetail.tasks[].belongs_to_set)를
 * assessment_id 기준으로 조인한다.
 */
export function applySetMembership(
  items: AssessmentItem[],
  caseTasks?: CaseDetail['tasks']
): AssessmentItem[] {
  if (!items.length || !caseTasks?.length) return items
  const membership = new Map<string, boolean>()
  for (const t of caseTasks) {
    membership.set(t.assessment_id, !!t.belongs_to_set)
  }
  return items.map((item) => ({
    ...item,
    belongsToSet: membership.get(item.assessmentId) ?? item.belongsToSet ?? false
  }))
}

/**
 * center-assessments 카탈로그 → assessmentId 기준 카드 비주얼 맵.
 * 영문명/한글명/분류색을 카드 그리드에서 조회한다.
 */
export function buildAssessmentVisualMap(
  centerAssessments?: CenterAssessment[]
): Record<string, AssessmentVisual> {
  const map: Record<string, AssessmentVisual> = {}
  if (!centerAssessments?.length) return map
  for (const ca of centerAssessments) {
    map[ca.assessment_id] = {
      engName: ca.eng_name ?? '',
      korName: ca.kor_name ?? '',
      category: (ca.assessment_type as string) ?? '',
      color: resolveCategoryColor(ca.assessment_type as string)
    }
  }
  return map
}

export function mapTaskStatusToAssessmentStatus(
  status: string
): AssessmentItem['status'] {
  const value = (status ?? '').toLowerCase()
  if (value === 'completed') return 'completed'
  if (value === 'submitted') return 'submitted'
  if (value === 'refused') return 'refused'
  if (value === 'cancelled') return 'cancelled'
  if (value === 'in_progress') return 'in_progress'
  return 'pending'
}

export function mergeTaskIntoAssessmentItem(
  item: AssessmentItem,
  task: TaskDetail & { report_document_id?: string | null },
  report?: TaskReportResponse | null
): AssessmentItem {
  return {
    ...item,
    status: mapTaskStatusToAssessmentStatus(task.status),
    date: formatDate(task.completed_at || item.date),
    reportPayload: report?.report_payload ?? task.report_payload ?? null,
    reportDocumentId: task.report_document_id ?? item.reportDocumentId ?? null,
    opinion: task.opinion ?? item.opinion ?? null
  }
}

/** 검사 상태 + workflowType 조합으로 서술형 텍스트 반환 */
export function getStatusDescription(assessment: AssessmentItem): string {
  if (assessment.status === 'in_progress') {
    if (assessment.workflowType === 'self_report') {
      return '온라인 검사 진행중입니다'
    }
    if (assessment.workflowType === 'external_service') {
      return '외부 검사 진행중입니다'
    }
    return '검사 진행중입니다'
  }

  return ''
}

export function summarizeTaskReportPayload(
  payload?: Record<string, unknown> | null
): string {
  if (!payload) return '보고서 데이터 없음'
  const keyCount = Object.keys(payload).length
  if (keyCount === 0) return '보고서 데이터 없음'
  return `보고서 데이터 ${keyCount}개 항목`
}

function buildScheduleVM(
  schedule: CaseDetail['schedule'],
  roomNameMap?: Record<string, string>
): ScheduleVM | null {
  if (!schedule?.start || !schedule?.end) return null
  const datePart = formatUtcToKst(schedule.start, 'YYYY-MM-DD (d)')
  const startTime = formatUtcToKst(schedule.start, 'HH:mm')
  const endTime = formatUtcToKst(schedule.end, 'HH:mm')
  const dateTimeLabel = `${datePart} ${startTime} - ${endTime}`
  const roomName =
    schedule.room_id && roomNameMap?.[schedule.room_id]
      ? roomNameMap[schedule.room_id]
      : null
  return {
    dateTimeLabel,
    roomName,
    isCancelled: schedule.is_cancelled ?? false,
    cancelReason: schedule.cancel_reason ?? null,
    sessionId: schedule.session_id ?? null,
    scheduleId: schedule.schedule_id ?? null
  }
}

export function mapCaseDetailToVM(
  detail: CaseDetail | undefined,
  isSecretMode: boolean,
  roomNameMap?: Record<string, string>
): CaseDetailVM {
  const client = detail?.clients?.[0]
  const specialist = detail?.counselor
  const gender = client?.gender

  const isFemale = gender === 'F' || gender === 'female'
  const isMale = gender === 'M' || gender === 'male'
  const genderLabel = isFemale ? '여' : isMale ? '남' : ''
  const genderColor = isFemale ? 'text-semantic-female' : isMale ? 'text-semantic-male' : 'text-gray-400'
  const genderSymbol = isFemale ? '여' : isMale ? '남' : ''

  const maskedName = isSecretMode ? '***' : client?.name || ''
  const maskedBirthDate = isSecretMode
    ? '****-**-**'
    : (client?.birth_date ?? '') || ''
  const maskedContact = isSecretMode ? '***-****-****' : ''

  const assessmentSetName = detail?.set_name ?? ''

  const assessmentNames =
    detail?.tasks
      ?.map((t) => t.assessment_name)
      .filter(Boolean)
      .join(', ') || ''

  const assessmentItemNames = assessmentNames

  const statusLower = (detail?.status ?? '').toLowerCase()
  const statusLabel =
    statusLower === 'completed'
      ? '완료'
      : statusLower === 'cancelled'
        ? '취소'
        : '진행전'

  const hasOnlineAssessment =
    detail?.tasks?.some((t) => t.execution_method === 'online') ?? false

  const specialistDetail = buildSpecialistDetail(specialist)
  const clientDetail = buildClientDetail(client, isSecretMode)

  return {
    clientId: client?.client_id ?? '',
    // 시크릿 모드에선 업로드 사진이 신원을 노출하므로 숨김 → 기본 아이콘 폴백
    profileImageUrl: isSecretMode ? null : (client?.profile_image_url ?? null),
    maskedName,
    maskedBirthDate,
    maskedContact,
    genderLabel,
    genderColor,
    genderSymbol,
    ageLabel: client?.age != null ? `만 ${client.age}세` : '',
    clientDetail,
    specialistName: specialist?.name || '',
    specialistId: specialist?.member_id ?? '',
    specialistDetail,
    caseTypeLabel:
      String(detail?.case_type || '').toLowerCase() === 'group'
        ? '단체'
        : '개인',
    caseCode: detail?.case_code,
    clientCode: client?.client_code ?? undefined,
    createdAtLabel: formatDateTime(detail?.created_at || ''),
    completedAtLabel: detail?.completed_at
      ? formatDateTime(detail.completed_at)
      : '',
    assessmentSetName,
    assessmentNames,
    assessmentItemNames,
    statusLabel,
    caseStatus: (detail?.status ?? '').toLowerCase(),
    hasOnlineAssessment,
    requireFinalReport: detail?.is_final_report_required ?? false,
    sendHistories: buildSendHistories(detail),
    schedule: buildScheduleVM(detail?.schedule ?? null, roomNameMap),
    institutionName: detail?.institution?.name ?? ''
  }
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULLTIME: '정규직',
  CONTRACT: '계약직',
  FREELANCER: '프리랜서'
}

function buildClientDetail(
  client: CaseDetail['clients'][0] | undefined,
  isSecretMode: boolean
): ClientDetailVM {
  const mask = (v: string | null | undefined) =>
    isSecretMode ? '***' : (v ?? '')
  const name = isSecretMode ? '***' : (client?.name ?? '')
  const birthDate = isSecretMode
    ? '****-**-**'
    : client?.birth_date
      ? formatDateOnly(client.birth_date)
      : ''
  const g = client?.gender
  const genderLabel =
    g === 'F' || g === 'female' ? '여' : g === 'M' || g === 'male' ? '남' : ''
  const ageLabel = client?.age != null ? `만 ${client.age}세` : ''
  const email = mask(client?.email)
  const phone = mask(client?.phone)
  const address = mask(client?.address)
  const memo = mask(client?.memo)
  return {
    name,
    birthDate,
    genderLabel,
    ageLabel,
    email,
    phone,
    address,
    memo
  }
}

function buildSpecialistDetail(
  counselor?: CaseDetail['counselor']
): SpecialistDetailVM {
  const id = counselor?.member_id ?? ''
  const name = counselor?.name ?? ''
  const birthDate = counselor?.birth_date
    ? formatDateOnly(counselor.birth_date)
    : ''
  const email = counselor?.email ?? ''
  const phone = counselor?.phone ?? ''
  const employmentTypeLabel =
    (counselor?.employment_type &&
      EMPLOYMENT_TYPE_LABELS[counselor.employment_type]) ||
    ''
  const hireDate = counselor?.hire_date
    ? formatDateOnly(counselor.hire_date)
    : ''
  const memo = counselor?.memo ?? ''
  return {
    id,
    name,
    birthDate,
    email,
    phone,
    employmentTypeLabel,
    hireDate,
    memo
  }
}

function formatDateOnly(isoDate: string): string {
  if (!isoDate) return ''
  return formatUtcToKst(isoDate, 'YYYY-MM-DD')
}

function buildSendHistories(detail?: CaseDetail): SendHistoryItem[] {
  if (!detail) return []
  const clientName = detail.clients?.[0]?.name || '-'
  const base: Omit<SendHistoryItem, 'id'> = {
    sentAtLabel: formatDateWithDay(detail.created_at || ''),
    relationLabel: '보호자',
    recipientName: clientName,
    phone: '-'
  }
  return [
    { id: `${detail.case_id}-send-1`, ...base },
    { id: `${detail.case_id}-send-2`, ...base, sentAtLabel: base.sentAtLabel }
  ]
}
