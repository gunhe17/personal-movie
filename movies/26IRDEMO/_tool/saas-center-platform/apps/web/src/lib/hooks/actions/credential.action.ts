/**
 * Person Credential Actions
 * 학력·경력·자격증 도메인 API 액션
 *
 * 백엔드 엔드포인트:
 * - GET    /persons/me/credentials              본인 목록
 * - POST   /persons/me/credentials              신규 등록
 * - PATCH  /persons/me/credentials/{id}         수정 (verification 자동 리셋)
 * - DELETE /persons/me/credentials/{id}         Soft Delete
 * - POST   /persons/me/credentials/{id}/request-verification  검증 요청
 * - POST   /persons/me/credentials/{id}/attachment            증빙 업로드
 * - DELETE /persons/me/credentials/{id}/attachment            증빙 삭제
 * - GET    /persons/me/credentials/{id}/attachment/download   증빙 다운로드 (스트리밍)
 *
 * 설계 문서: docs/center/member-credentials.md
 */

import {
  get,
  post,
  patch,
  deleteResource,
  appInstance
} from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CredentialType = 'education' | 'career' | 'certification'

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'

export type EducationDegree = 'bachelor' | 'master' | 'doctorate' | 'other'

/** kind별 metadata 구조 (백엔드 Pydantic과 동일) */
export interface EducationMeta {
  major: string
  degree: EducationDegree
}

export interface CareerMeta {
  position: string
}

export interface CertificationMeta {
  certificate_number: string
}

export type CredentialMetadata =
  | EducationMeta
  | CareerMeta
  | CertificationMeta
  | Record<string, unknown>

export interface CredentialAttachment {
  url: string
  filename: string
  content_type: string
  size: number
}

export interface CredentialVerification {
  status: VerificationStatus
  requested_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reject_reason: string | null
}

export interface Credential {
  id: string
  person_id: string
  credential_type: CredentialType

  title: string
  organization: string
  description: string | null

  start_date: string | null // YYYY-MM-DD
  end_date: string | null
  is_current: boolean

  meta: CredentialMetadata | null
  attachment: CredentialAttachment | null
  verification: CredentialVerification

  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────────────────────

export interface CreateCredentialPayload {
  credential_type: CredentialType
  title: string
  organization: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current: boolean
  meta: CredentialMetadata
}

export interface UpdateCredentialPayload {
  title?: string
  organization?: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean
  meta?: CredentialMetadata
}

// ─────────────────────────────────────────────────────────────
// Stats + List Response
// ─────────────────────────────────────────────────────────────

export interface CredentialStats {
  total: number
  pending: number
  verified: number
  rejected: number
  verified_certifications: number
  verified_educations: number
  /** 인증된 전문가 여부 — 백엔드가 정책 판정 (C안: 자격증 ≥1 verified AND 학력 ≥1 verified) */
  is_certified: boolean
}

export interface CredentialListResponse {
  items: Credential[]
  stats: CredentialStats
}

// ─────────────────────────────────────────────────────────────
// Query Actions
// ─────────────────────────────────────────────────────────────

const BASE = '/persons/me/credentials'

interface ListMyCredentialsParams {
  credential_type?: CredentialType
}

export const listMyCredentials = (): Action<
  CredentialListResponse,
  CredentialListResponse
> => ({
  key: ['listMyCredentials'],
  request: async (
    params?: ListMyCredentialsParams
  ): Promise<CredentialListResponse> => {
    const query = params?.credential_type ? { credential_type: params.credential_type } : undefined
    return get<CredentialListResponse>(BASE, query)
  }
})

// ─────────────────────────────────────────────────────────────
// Mutation Actions
// ─────────────────────────────────────────────────────────────

export const createMyCredential = () => ({
  key: ['createMyCredential', 'listMyCredentials'],
  request: async (payload: CreateCredentialPayload): Promise<Credential> => {
    const res = await appInstance.post<Credential>(BASE, payload)
    return res.data
  }
})

export interface UpdateCredentialParams {
  credentialId: string
  payload: UpdateCredentialPayload
}

export const updateMyCredential = () => ({
  key: ['updateMyCredential', 'listMyCredentials'],
  request: async (params: UpdateCredentialParams): Promise<Credential> => {
    const res = await appInstance.patch<Credential>(
      `${BASE}/${params.credentialId}`,
      params.payload
    )
    return res.data
  }
})

export const deleteMyCredential = () => ({
  key: ['deleteMyCredential', 'listMyCredentials'],
  request: async (params: { credentialId: string }): Promise<void> => {
    await deleteResource(`${BASE}/${params.credentialId}`)
  }
})

export const requestVerification = () => ({
  key: ['requestVerification', 'listMyCredentials'],
  request: async (params: { credentialId: string }): Promise<Credential> => {
    const res = await appInstance.post<Credential>(
      `${BASE}/${params.credentialId}/request-verification`,
      {}
    )
    return res.data
  }
})

export interface UploadAttachmentParams {
  credentialId: string
  file: File
}

export const uploadAttachment = () => ({
  key: ['uploadAttachment', 'listMyCredentials'],
  request: async (params: UploadAttachmentParams): Promise<Credential> => {
    const formData = new FormData()
    formData.append('file', params.file)
    const res = await appInstance.post<Credential>(
      `${BASE}/${params.credentialId}/attachment`,
      formData
    )
    return res.data
  }
})

export const deleteAttachment = () => ({
  key: ['deleteAttachment', 'listMyCredentials'],
  request: async (params: { credentialId: string }): Promise<Credential> => {
    const res = await appInstance.delete<Credential>(
      `${BASE}/${params.credentialId}/attachment`
    )
    return res.data
  }
})
