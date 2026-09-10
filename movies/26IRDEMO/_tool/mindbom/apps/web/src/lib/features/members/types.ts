export interface MemberItem {
  id: string
  account_id: string
  name: string
  role: string
  email: string | null
  is_active: boolean
  created_at: string
}

export interface MemberListResponse {
  items: MemberItem[]
  total: number
  page: number
  size: number
  pages: number
}
