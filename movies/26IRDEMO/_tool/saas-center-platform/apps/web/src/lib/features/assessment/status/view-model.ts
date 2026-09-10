import type { AssessmentStatusRow, CaseData } from '$lib/types/assessmentStatus'
import { mapCaseToAssessmentRow } from '$lib/types/assessmentStatus'
import type { Assessment } from '$lib/hooks/actions/assessment.action'
import type { TaskListItem } from '$lib/hooks/actions/case.action'

// 검사 데이터를 저장할 모듈 레벨 변수 (하위 호환성 유지)
let assessmentsCache: Assessment[] = []

// 검사 데이터 설정 (페이지에서 호출)
export function setAssessmentsData(assessments: Assessment[]) {
  assessmentsCache = assessments
}

// UID로 검사 정보 조회 (assessments 파라미터 우선, 없으면 캐시 사용)
function getAssessmentByUid(
  uid: string,
  assessments?: Assessment[]
): Assessment | undefined {
  const list = assessments ?? assessmentsCache
  return list.find((a) => a.uid === uid)
}

// UID 배열로 검사 이름 배열 반환
function getAssessmentNames(
  uids: string[],
  assessments?: Assessment[]
): string[] {
  return uids.map((uid) => {
    const assessment = getAssessmentByUid(uid, assessments)
    return assessment?.eng_name || assessment?.kor_name || uid
  })
}

// UID가 온라인 검사인지 확인
function isOnlineAssessment(uid: string, assessments?: Assessment[]): boolean {
  const assessment = getAssessmentByUid(uid, assessments)
  return assessment?.is_online_available ?? false
}

/**
 * CaseData에서 hasOnlineLink 여부 계산.
 * 검사 현황에서는 assessments API를 부르지 않으므로, 케이스 목록만으로는 온라인 여부를 모름 → false.
 * (필요 시 서버 목록 API에 is_online 필드가 추가되면 그때 반영 가능)
 */
export function getHasOnlineLink(
  caseData: { package?: unknown | null; assessment_uids?: string[]; assessments?: { id: string }[] },
  assessments?: Assessment[]
): boolean {
  if (!assessments?.length) return false
  const uids = caseData.assessments?.length
    ? caseData.assessments.map((a) => a.id)
    : caseData.assessment_uids ?? []
  return !!caseData.package || uids.some((uid) => isOnlineAssessment(uid, assessments))
}


/**
 * 케이스 데이터만으로 검사별 완료 상태 목록 생성 (assessments API 없이, 이름은 케이스의 assessment_names 사용)
 * 케이스 status가 'completed'/'COMPLETED'면 모든 검사를 완료로 판정
 */
export function getAssessmentCompletionStatusFromCase(
  caseId: string,
  caseData: { status?: string; assessments?: { id: string }[]; assessment_names?: string[] }
): { uid: string; name: string; isCompleted: boolean }[] {
  const list = caseData.assessments ?? []
  const names = caseData.assessment_names ?? []
  const caseCompleted = (caseData.status ?? '').toLowerCase() === 'completed'
  return list.map((a, i) => ({
    uid: a.id,
    name: names[i] ?? a.id,
    isCompleted: caseCompleted
  }))
}

/**
 * 완료 상태이면서 보고서가 없는 태스크의 검사명 반환
 */
export function findTasksMissingReports(tasks: TaskListItem[]): string[] {
  return tasks
    .filter(t => t.status === 'completed' && !t.report_payload && !t.report_document_id)
    .map(t => t.assessment?.kor_name || '검사')
}

/**
 * 완료되지 않은(completed/cancelled/refused 아닌) 태스크의 검사명 반환
 */
export function findIncompleteTaskNames(tasks: TaskListItem[]): string[] {
  const terminalStatuses = ['completed', 'cancelled', 'refused']
  return tasks
    .filter(t => !terminalStatuses.includes(t.status))
    .map(t => t.assessment?.kor_name || '검사')
}

/**
 * 케이스 목록을 뷰모델로 변환.
 * 검사 현황에서는 assessments API를 호출하지 않으므로, 이름은 케이스의 assessment_names만 사용하고 hasOnlineLink는 false.
 */
export function mapCasesToVM(
  list: CaseData[] = [],
  assessments?: Assessment[]
): AssessmentStatusRow[] {
  return list.map((item) => {
    const names = item.assessment_names ?? []
    const assessmentIds = item.assessments?.map((a) => a.id) ?? []
    const namesToUse = names.length ? names : getAssessmentNames(assessmentIds, assessments)
    return mapCaseToAssessmentRow(item, namesToUse, {
      hasOnlineLink: getHasOnlineLink(item, assessments)
    })
  })
}
