import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSessionsByCase,
  getSessionDetail,
  getSessionParticipants,
  updateSessionStatus,
  cancelSession,
  revertCancelSession,
  updateParticipantAttendance,
} from './api';
import type { AttendanceStatus, UpdateAttendanceParams } from './types';

/** 케이스별 세션 목록 조회 */
export function useSessionsByCase(centerId: string | null, caseId: string | null) {
  return useQuery({
    queryKey: ['counselingSessions', centerId, caseId],
    queryFn: () => getSessionsByCase(centerId!, caseId!),
    enabled: !!centerId && !!caseId,
  });
}

/** 세션 상세 조회 */
export function useSessionDetail(centerId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['counselingSession', centerId, sessionId],
    queryFn: () => getSessionDetail(centerId!, sessionId!),
    enabled: !!centerId && !!sessionId,
  });
}

/** 세션 참여자 목록 조회 */
export function useSessionParticipants(centerId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['sessionParticipants', centerId, sessionId],
    queryFn: () => getSessionParticipants(centerId!, sessionId!),
    enabled: !!centerId && !!sessionId,
  });
}

/** 세션 상태 변경 뮤테이션 */
export function useUpdateSessionStatus(centerId: string | null, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: 'completed' | 'no_show' | 'cancelled') =>
      updateSessionStatus(centerId!, sessionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counselingSession', centerId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['counselingSessions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['sessionParticipants', centerId, sessionId] });
      // 스케줄 관련 캐시도 갱신
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['counselingCaseDetail'], exact: false });
    },
  });
}

/** 세션 취소 뮤테이션 */
export function useCancelSession(centerId: string | null, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelSession(centerId!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counselingSession', centerId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['counselingSessions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['sessionParticipants', centerId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['counselingCaseDetail'], exact: false });
    },
  });
}

/** 세션 취소 되돌리기 뮤테이션 */
export function useRevertCancelSession(
  centerId: string | null,
  sessionId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => revertCancelSession(centerId!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counselingSession', centerId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['counselingSessions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['sessionParticipants', centerId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['counselingCaseDetail'], exact: false });
    },
  });
}

/** 참여자 출석 상태 변경 뮤테이션 */
export function useUpdateAttendance(centerId: string | null, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { participantId: string; data: UpdateAttendanceParams }) =>
      updateParticipantAttendance(centerId!, params.participantId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessionParticipants', centerId, sessionId] });
      // 스케줄 상세의 attendance_status도 갱신
      queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['counselingCaseDetail'], exact: false });
    },
  });
}
