export enum SessionType {
  ONLINE = 'online',
  OFFLINE = 'offline',
  HYBRID = 'hybrid'
}

export type SessionStatusType =
  | 'created'
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'reportFinished'
  | 'reportRejected'

export type AssessmentSessionType = {
  // Identity
  uid: string
  session_number: string

  // Relations
  center_uid: string
  client_uid: string
  assigned_specialist: string
  assessment_uids: string[]
  inventory_uid: string

  // Session
  session_type: keyof typeof SessionType
  status: SessionStatusType

  // Progress
  progress_percentage: number
  total_questions: number
  answered_questions: number

  // Timeline
  scheduled_at: Date
  invited_at: Date
  started_at: Date
  completed_at: Date

  // Online Access
  access_token: string
  access_url: string
  expires_at: Date

  // Data
  raw_responses: string
  metadata: string

  // Audit
  created_at: Date
  updated_at: Date
  created_by_account: string
}
