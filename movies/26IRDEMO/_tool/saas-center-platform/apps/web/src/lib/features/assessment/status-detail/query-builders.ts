export function buildCaseDetailInput(centerId: string, caseId: string) {
  return {
    centerId,
    caseId
  }
}

/** Task 목록 조회 쿼리 입력 (GET .../assessment-cases/{case_id}/tasks) */
export function buildTaskListInput(centerId: string, caseId: string) {
  return {
    centerId,
    caseId
  }
}

