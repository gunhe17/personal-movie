import { get, postRaw, deleteResource } from './instances'
import type { AuthSuccess, UserRole } from './auth'

export interface InvitationSummary {
  id: string
  email: string
  name: string
  role: UserRole
  status: string
  expires_at: string
  invited_by_account_id: string
  inviter_name: string | null
  created_at: string
}

export interface InvitationListResponse {
  items: InvitationSummary[]
  total: number
}

export interface InvitationVerifyResponse {
  email: string
  name: string
  institution_name: string
  role: UserRole
  account_exists: boolean
}

/** 관리자: 기관의 pending 초대 목록 조회 */
export async function listPendingInvitations(
  institutionId: string
): Promise<InvitationListResponse> {
  return await get<InvitationListResponse>(
    `/institutions/${institutionId}/invitations`
  )
}

/** 관리자: 직원 초대 — 메일 발송 */
export async function createInvitation(
  institutionId: string,
  data: { email: string; name: string; role: UserRole }
): Promise<InvitationSummary> {
  return await postRaw<InvitationSummary>(
    `/institutions/${institutionId}/invitations`,
    data
  )
}

/** 관리자: 초대 취소 (status=revoked) */
export async function revokeInvitation(
  institutionId: string,
  invitationId: string
): Promise<void> {
  await deleteResource<void>(
    `/institutions/${institutionId}/invitations/${invitationId}`
  )
}

/** 관리자: 초대 재발송 (기존 토큰 무효화 + 새 토큰/메일) */
export async function resendInvitation(
  institutionId: string,
  invitationId: string
): Promise<InvitationSummary> {
  return await postRaw<InvitationSummary>(
    `/institutions/${institutionId}/invitations/${invitationId}/resend`
  )
}

/** 공개: 토큰 검증 + 미리보기 정보 */
export async function verifyInvitation(
  token: string
): Promise<InvitationVerifyResponse> {
  return await get<InvitationVerifyResponse>('/invitations/verify', { token })
}

/** 공개: 초대 수락 — account/member 생성 + 자동 로그인 */
export async function acceptInvitation(
  token: string,
  password: string
): Promise<AuthSuccess> {
  return await postRaw<AuthSuccess>('/invitations/accept', {
    token,
    password
  })
}
