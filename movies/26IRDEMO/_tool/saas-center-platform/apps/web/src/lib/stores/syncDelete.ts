import { writable, get } from 'svelte/store'

/**
 * 삭제/취소 동기화 스토어
 *
 * assessment/status와 schedule/calendar 간의 동기화를 담당합니다.
 * - 삭제: 데이터 완전 삭제
 * - 취소: 상태를 'cancelled'로 변경
 * - API 미구현 상태에서 클라이언트 사이드 동기화 제공
 */

// assessment/status에서 삭제된 케이스 ID를 추적
export const deletedCaseIds = writable<Set<string>>(new Set())

// schedule/calendar에서 삭제된 스케줄 ID를 추적
export const deletedScheduleIds = writable<Set<string>>(new Set())

// assessment/status에서 취소된 케이스 ID를 추적
export const cancelledCaseIds = writable<Set<string>>(new Set())

// schedule/calendar에서 취소된 스케줄 ID를 추적
export const cancelledScheduleIds = writable<Set<string>>(new Set())

// 바로링크 전송 완료된 케이스 ID를 추적
export const sentBaroLinkIds = writable<Set<string>>(new Set())

// 결과 전송 완료된 케이스 ID를 추적
export const sentResultIds = writable<Set<string>>(new Set())

/**
 * 동기화 서비스
 */
function createSyncDeleteService() {
  /**
   * schedule/calendar에서 스케줄 삭제 시 호출
   * - 삭제된 ID를 추적 (assessment/status에서 필터링에 사용)
   */
  function deleteFromScheduleCalendar(scheduleId: string) {
    deletedScheduleIds.update((ids) => {
      ids.add(scheduleId)
      return new Set(ids)
    })
    console.log(
      `[SyncDelete] Schedule deleted from schedule/calendar: ${scheduleId}`
    )
  }

  /**
   * ID가 삭제되었는지 확인
   */
  function isDeleted(id: string): boolean {
    const caseIds = get(deletedCaseIds)
    const scheduleIds = get(deletedScheduleIds)
    return caseIds.has(id) || scheduleIds.has(id)
  }

  /**
   * ID가 취소되었는지 확인
   */
  function isCancelled(id: string): boolean {
    const caseIds = get(cancelledCaseIds)
    const scheduleIds = get(cancelledScheduleIds)
    return caseIds.has(id) || scheduleIds.has(id)
  }

  /**
   * 바로링크 전송 완료 처리
   */
  function markBaroLinkSent(caseId: string) {
    sentBaroLinkIds.update((ids) => {
      ids.add(caseId)
      return new Set(ids)
    })
    console.log(`[SyncBaroLink] BaroLink sent for case: ${caseId}`)
  }

  /**
   * 바로링크 전송 여부 확인
   */
  function isBaroLinkSent(id: string): boolean {
    return get(sentBaroLinkIds).has(id)
  }

  /**
   * 결과 전송 완료 처리
   */
  function markResultSent(caseId: string) {
    sentResultIds.update((ids) => {
      ids.add(caseId)
      return new Set(ids)
    })
    console.log(`[SyncResult] Result sent for case: ${caseId}`)
  }

  /**
   * 결과 전송 여부 확인
   */
  function isResultSent(id: string): boolean {
    return get(sentResultIds).has(id)
  }

  /**
   * 모든 ID 목록 초기화
   */
  function clearAllIds() {
    deletedCaseIds.set(new Set())
    deletedScheduleIds.set(new Set())
    cancelledCaseIds.set(new Set())
    cancelledScheduleIds.set(new Set())
    sentBaroLinkIds.set(new Set())
    sentResultIds.set(new Set())
    console.log('[Sync] Cleared all IDs')
  }

  return {
    deleteFromScheduleCalendar,
    isDeleted,
    isCancelled,
    markBaroLinkSent,
    isBaroLinkSent,
    markResultSent,
    isResultSent,
    clearAllIds
  }
}

export const syncDeleteService = createSyncDeleteService()
