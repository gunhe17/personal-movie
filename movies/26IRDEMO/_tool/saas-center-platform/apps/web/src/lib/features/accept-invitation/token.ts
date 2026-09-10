/**
 * 초대 링크 토큰 인코딩/디코딩
 *
 * 지원 형식:
 * 1. JWT (초대 시 이메일 등에서 사용): ?token=eyJhbGci... → payload.invitation_id, center_id, center_name, role_name 등
 * 2. 레거시: base64url(JSON.stringify({ invitationId, centerId }))
 */

export interface InvitationTokenPayload {
  invitationId: string
  centerId: string
  /** JWT에 있을 때만 (표시용) */
  centerName?: string
  /** JWT에 있을 때만 (표시용, 예: "관리자") */
  roleName?: string
  inviterName?: string
  inviteeName?: string
  inviteeEmail?: string
  employmentType?: string
  exp?: number
  type?: string
}

function base64UrlEncode(str: string): string {
  const base64 =
    typeof btoa !== 'undefined' ? btoa(str) : Buffer.from(str, 'utf-8').toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad) base64 += '='.repeat(4 - pad)
  try {
    return typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

/**
 * invitationId, centerId로 레거시 형식 토큰 생성
 */
export function encodeInvitationToken(payload: { invitationId: string; centerId: string }): string {
  return base64UrlEncode(JSON.stringify(payload))
}

/** JWT payload (서버에서 발급한 초대 토큰) */
interface InvitationJwtPayload {
  invitation_id: string
  center_id: string
  center_name?: string
  role_name?: string
  inviter_name?: string
  invitee_name?: string
  invitee_email?: string
  employment_type?: string
  exp?: number
  type?: string
}

/**
 * JWT 초대 토큰 디코딩 (payload만 파싱, 서명 검증 없음)
 * 형식: header.payload.signature → payload를 base64url 디코딩
 */
function decodeInvitationJwt(token: string): InvitationTokenPayload | null {
  if (!token?.trim()) return null
  const parts = token.trim().split('.')
  if (parts.length !== 3) return null
  try {
    const decoded = base64UrlDecode(parts[1])
    if (!decoded) return null
    const raw = JSON.parse(decoded) as unknown
    const p = raw as InvitationJwtPayload
    if (!p || typeof p.invitation_id !== 'string' || typeof p.center_id !== 'string') return null
    return {
      invitationId: p.invitation_id,
      centerId: p.center_id,
      centerName: p.center_name,
      roleName: p.role_name,
      inviterName: p.inviter_name,
      inviteeName: p.invitee_name,
      inviteeEmail: p.invitee_email,
      employmentType: p.employment_type,
      exp: p.exp,
      type: p.type
    }
  } catch {
    return null
  }
}

/**
 * 레거시 단순 JSON(base64url) 디코딩
 */
function decodeLegacyToken(token: string): InvitationTokenPayload | null {
  if (!token?.trim()) return null
  try {
    const decoded = base64UrlDecode(token.trim())
    if (!decoded) return null
    const parsed = JSON.parse(decoded) as unknown
    const p = parsed as { invitationId?: string; centerId?: string }
    if (p && typeof p.invitationId === 'string' && typeof p.centerId === 'string') {
      return { invitationId: p.invitationId, centerId: p.centerId }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 초대 토큰 디코딩 (JWT 우선, 실패 시 레거시 형식 시도)
 */
export function decodeInvitationToken(token: string): InvitationTokenPayload | null {
  const jwt = decodeInvitationJwt(token)
  if (jwt) return jwt
  return decodeLegacyToken(token)
}
