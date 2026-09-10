import apiClient from '@/shared/api/client';
import type {
  ClaimRequest,
  ClaimResponse,
  InvitationVerifyResponse,
} from './types';

/** 초대 코드 열람 (비소모) — 404/410이면 코드 오류/만료 */
export async function verifyInvitation(code: string): Promise<InvitationVerifyResponse> {
  const { data } = await apiClient.post<InvitationVerifyResponse>(
    '/app/link-invitations/verify',
    { code },
  );
  return data;
}

/** 초대 코드로 자녀 ↔ 프로필 연결 확정 */
export async function claimLinks(body: ClaimRequest): Promise<ClaimResponse> {
  const { data } = await apiClient.post<ClaimResponse>('/app/links/claim', body);
  return data;
}
