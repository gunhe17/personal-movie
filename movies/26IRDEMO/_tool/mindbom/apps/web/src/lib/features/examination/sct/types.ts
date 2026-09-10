export type SCTDomain = 'A' | 'B' | 'C' | 'D' | 'E'

export interface SCTStem {
  id: number
  stem: string
  isCompound?: boolean
  domain: SCTDomain
  domainLabel: string
}

export interface SCTStemListResponse {
  stems: SCTStem[]
  totalCount: number
}

export interface SCTResponseItem {
  stemId: number
  answer: string
  reason?: string | null
  answeredAt?: string | null
}

export interface SCTScoreItem {
  stemId: number
  stem: string
  score: number
  answer?: string | null
  reason?: string | null
}

export interface SCTDomainScore {
  domain: SCTDomain
  domainLabel: string
  totalScore: number
  maxScore: number
  items: SCTScoreItem[]
}

export interface SCTResultsData {
  responses: SCTResponseItem[]
  scores: SCTDomainScore[]
  completedCount: number
  totalCount: number
}

export interface SCTResultsResponse {
  examinationId: string
  status: string
  results: SCTResultsData | null
}

export interface ExaminationSummary {
  id: string
  client_id: string
  examiner_id: string
  exam_type: string
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  ai_model_version: string | null
  note: string | null
  created_at: string
  updated_at: string
  institution_id: string
  battery_id: string | null
}
