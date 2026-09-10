export type SectionSource = 'auto' | 'clinician' | 'ai'

export interface ReportSection {
  key: string
  title: string
  body: string
  source: SectionSource
  order: number
  editable: boolean
}

export interface LinkedExamination {
  examination_id: string
  exam_type: string
  exam_type_label: string
  exam_date: string | null
  sort_order: number
  is_deleted: boolean
}

export interface ComprehensiveReport {
  id: string
  institution_id: string
  client_id: string
  client_name: string | null
  examiner_id: string
  examiner_name: string | null
  title: string | null
  status: string
  status_label: string
  sections: ReportSection[]
  linked_examinations: LinkedExamination[]
  ai_model_version: string | null
  ai_generated_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  report_generated_at: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface ComprehensiveReportSummary {
  id: string
  client_id: string
  title: string | null
  status: string
  status_label: string
  exam_count: number
  created_at: string
  updated_at: string
}

export type DraftMode = 'fill_empty' | 'replace_ai_sections'
