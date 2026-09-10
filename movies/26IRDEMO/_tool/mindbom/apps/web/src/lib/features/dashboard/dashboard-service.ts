import { get } from '$lib/services/api/instances'
import type { ExamStatus } from '$lib/features/examination/common/constants'

/**
 * 서버가 집계한 상태별 검사 수.
 *
 * 예전에는 최근 50건(+내 검사만)을 받아 프론트에서 세었기 때문에
 * 검사 목록 페이지의 숫자와 어긋났다. 집계는 서버가 기관 전체를 기준으로 한다.
 */
export interface DashboardStats {
  total: number
  created: number
  in_progress: number
  ai_draft_ready: number
  under_review: number
  confirmed: number
  report_generated: number
  completed: number

  /** 오늘 예정된 미시작 검사 */
  today_scheduled: number
  /** 이번 주(일요일 시작) 완료 — 확정·보고서·완료 합계 */
  week_completed: number
  /** 검토 대기로 5일 이상 머문 검사 */
  stale_reviews: number
}

export async function fetchDashboardStats(
  institutionId: string
): Promise<DashboardStats> {
  return await get<DashboardStats>(
    `/institutions/${institutionId}/examinations/dashboard`
  )
}

/** 상태별 카운트를 Record 형태로 — 차트가 바로 쓰도록 */
export function statsToCounts(stats: DashboardStats): Record<ExamStatus, number> {
  return {
    created: stats.created,
    in_progress: stats.in_progress,
    ai_draft_ready: stats.ai_draft_ready,
    under_review: stats.under_review,
    confirmed: stats.confirmed,
    report_generated: stats.report_generated,
    completed: stats.completed
  }
}

/**
 * 임상가 확정 이후를 묶은 '완료군' — core/status.ts의 isConfirmed와 같은 기준이다.
 *
 * completed를 더하는 이유: 상태 머신에서는 뺐지만 과거 데이터에 남아 있어
 * 빼면 집계에서 조용히 사라진다. 읽기는 관대하게, 쓰기는 엄격하게.
 */
export function doneCount(stats: DashboardStats): number {
  return stats.confirmed + stats.report_generated + stats.completed
}
