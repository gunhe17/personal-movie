// 검사 상태·유형은 examination 도메인이 단일 출처다.
// 여기에 다시 적으면 상태를 더하거나 뺄 때 조용히 어긋난다.
import type { ExamStatus, ExamType } from '$lib/features/examination/common/constants'

export type { ExamStatus, ExamType }

export type AnchorLabel = '완료' | '시작' | '예정' | '분석중' | '검토대기' | '검토중'

export interface TimelineItem {
  id: string
  who: {
    name: string
    age?: number
    gender?: 'male' | 'female'
  }
  what: {
    type: ExamType
  }
  /**
   * 타임라인 위 위치를 정하는 기준 시각.
   *
   * 카드는 고정폭이라 기간(시작~종료)을 그리지 않는다 — 담는 정보가
   * 검사 소요 시간과 무관해서, 폭을 기간에 연동하면 내용이 찌그러진다.
   */
  when: {
    anchorAt: Date
    anchorLabel: AnchorLabel
  }
  state: {
    status: ExamStatus
  }
}

export interface ExaminationApiItem {
  id: string
  client_id: string
  client_name: string | null
  client_birth_date: string | null
  client_gender: string | null
  examiner_id: string
  examiner_name: string | null
  exam_type: ExamType
  status: ExamStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ExaminationListResponse {
  items: ExaminationApiItem[]
  total: number
  page: number
  size: number
  pages: number
}
