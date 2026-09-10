import type { ExamType, ExamStatus } from './constants'

export interface ExaminationSummary {
  id: string
  institution_id: string
  client_id: string
  client_name: string
  examiner_id: string
  examiner_name: string
  exam_type: ExamType
  status: ExamStatus
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ExaminationDetail extends ExaminationSummary {
  battery_id: string | null
  ai_model_version: string | null
}

// 목록 조회 응답 (백엔드 ExaminationSummaryWithNames와 매핑)
export interface ExamItem {
  id: string
  client_id: string
  client_name: string | null
  client_birth_date: string | null
  client_gender: string | null
  examiner_id: string
  examiner_name: string | null
  exam_type: string
  status: string
  battery_id: string | null
  scheduled_at: string | null
  created_at: string
}

export interface ExamListResponse {
  items: ExamItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface DashboardStats {
  total: number
  created: number
  in_progress: number
  ai_draft_ready: number
  under_review: number
  confirmed: number
  completed: number
}

export interface ExamListParams {
  institutionId: string
  page?: number
  size?: number
  status?: string
  exam_type?: string
  client_id?: string
  search?: string
}
