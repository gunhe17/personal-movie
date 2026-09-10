export type NotificationType =
  | 'examination.assigned'
  | 'examination.ai_draft_ready'
  | 'examination.confirmed'
  | 'examination.report_ready'
  | 'member.invited'
  | 'account.password_changed'
  | (string & {})

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  link_path: string | null
  actor_member_id: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  items: NotificationItem[]
  total: number
  unread_count: number
  page: number
  size: number
  pages: number
}

export interface UnreadCountResponse {
  unread_count: number
}

export interface MarkReadResponse {
  updated: number
}
