import apiClient from '@/shared/api/client';
import type {
  CounselingSessionResponse,
  CounselingSessionListResponse,
  SessionParticipantResponse,
  UpdateAttendanceParams,
} from './types';

/** 케이스별 세션 목록 조회 */
export async function getSessionsByCase(
  centerId: string,
  caseId: string,
): Promise<CounselingSessionListResponse> {
  const response = await apiClient.get<CounselingSessionListResponse>(
    `/centers/${centerId}/counseling/cases/${caseId}/sessions`,
  );
  return response.data;
}

/** 세션 상세 조회 */
export async function getSessionDetail(
  centerId: string,
  sessionId: string,
): Promise<CounselingSessionResponse> {
  const response = await apiClient.get<CounselingSessionResponse>(
    `/centers/${centerId}/counseling/sessions/${sessionId}`,
  );
  return response.data;
}

/** 세션 참여자 목록 조회 */
export async function getSessionParticipants(
  centerId: string,
  sessionId: string,
): Promise<SessionParticipantResponse[]> {
  const response = await apiClient.get<SessionParticipantResponse[]>(
    `/centers/${centerId}/counseling/sessions/${sessionId}/participants`,
  );
  return response.data;
}

/** 세션 상태 변경 */
export async function updateSessionStatus(
  centerId: string,
  sessionId: string,
  status: 'completed' | 'no_show' | 'cancelled',
): Promise<CounselingSessionResponse> {
  const response = await apiClient.patch<CounselingSessionResponse>(
    `/centers/${centerId}/counseling/sessions/${sessionId}`,
    { status },
  );
  return response.data;
}

/** 세션 취소 */
export async function cancelSession(
  centerId: string,
  sessionId: string,
): Promise<CounselingSessionResponse> {
  const response = await apiClient.post<CounselingSessionResponse>(
    `/centers/${centerId}/counseling/sessions/${sessionId}/cancel`,
  );
  return response.data;
}

/** 세션 취소 되돌리기 */
export async function revertCancelSession(
  centerId: string,
  sessionId: string,
): Promise<CounselingSessionResponse> {
  const response = await apiClient.post<CounselingSessionResponse>(
    `/centers/${centerId}/counseling/sessions/${sessionId}/revert-cancel`,
  );
  return response.data;
}

/** 참여자 출석 상태 변경 */
export async function updateParticipantAttendance(
  centerId: string,
  participantId: string,
  data: UpdateAttendanceParams,
): Promise<SessionParticipantResponse> {
  const response = await apiClient.patch<SessionParticipantResponse>(
    `/centers/${centerId}/counseling/session-participants/${participantId}`,
    data,
  );
  return response.data;
}
