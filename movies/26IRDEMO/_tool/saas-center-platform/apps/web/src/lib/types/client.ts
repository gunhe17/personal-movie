// 사용자의 역할 정의
export type RoleType = 'all' | 'CENTER' | 'MANAGER' | 'SPECIALIST'

export type UserStatus = 'active' | 'inactive' | 'suspended'

export type Family = {
  relation: string
  name: string
  phone: string
  birth: string
}

export type Client = {
  uid: string
  role: string
  name: string
  gender: '남자' | '여자'
  birth_date: Date
  guardian_relationship: string
  guardian_name: string
  guardian_phone: string
  memo: string
  created_at: string
  updated_at: string
}

// 사용자의 디코딩된 JWT (JSON Web Token) 객체 구조 정의
export type UserDecode = {
  email: string
  exp: number
  sub: string
  role: RoleType
  tenant_id: string
  tenant_profile_id: string
  type: string
}

// 인증 응답 데이터 타입
export type AuthResponse = {
  account: Client
  access_token: string
  refresh_token: string
  token_type: 'bearer'
}

export type ClientDocumentItem = {
  title: string
  originalName: string | null
  id: string
  finishedAt: Date
  fileType: string
  mappingId: string
  fileSize: number
  storagePath: string
  file?: File
}
