export interface ClientSummary {
  id: string
  name: string
  birth_date: string | null
  gender: string | null
  phone: string | null
  status: string
  created_at: string
}

export interface ClientDetail {
  id: string
  institution_id: string
  name: string
  birth_date: string | null
  gender: string | null
  phone: string | null
  email: string | null
  education_level: string | null
  occupation: string | null
  referral_source: string | null
  status: string
  note: string | null
  created_at: string
  updated_at: string
}

export interface ClientListResponse {
  items: ClientSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface ClientFormData {
  name: string
  birth_date?: string
  gender?: string
  phone?: string
  email?: string
  education_level?: string
  occupation?: string
  referral_source?: string
  note?: string
}
