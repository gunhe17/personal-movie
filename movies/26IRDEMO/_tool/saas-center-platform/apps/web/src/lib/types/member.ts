export type PersonDetailType = {
  id: string
  center_id: string
  role: 'CENTER' | 'MANAGER' | 'SPECIALIST'
  permission_policy_id: string
  employment_type: 'FULLTIME' | 'CONTRACT' | 'FREELANCER'
  memo: string
  metadata: string | null
  effective_from: Date
  effective_to: Date | null
  created_at: Date
  updated_at: Date | null
  name: string
  birth: string
  phone: string
  gender: 'FEMALE' | 'MALE'
  person_metadata: string | null
  person_created_at: Date
  person_updated_at: Date | null
  email: string
  email_verified: string | null
  account_created_at: Date | null
  account_updated_at: Date | null
}
