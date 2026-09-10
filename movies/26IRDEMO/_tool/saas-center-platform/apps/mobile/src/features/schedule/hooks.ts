import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getScheduleList,
  getScheduleDetail,
  updateScheduleNote,
  updateCounselingSessionStatus,
  updateAssessmentSessionStatus,
} from './api';
import { formatDateISO } from '@/shared/utils/date';
import type { ScheduleType } from './types';

/** 일정 목록 쿼리 (단일 날짜) */
export function useScheduleList(centerId: string | null, date: Date) {
  const dateStr = formatDateISO(date);

  return useQuery({
    queryKey: ['schedules', centerId, dateStr],
    queryFn: () => getScheduleList(centerId!, dateStr, dateStr),
    enabled: !!centerId,
  });
}

/** 일정 목록 쿼리 (날짜 범위) */
export function useScheduleRange(
  centerId: string | null,
  startDate: Date,
  endDate: Date
) {
  const startStr = formatDateISO(startDate);
  const endStr = formatDateISO(endDate);

  return useQuery({
    queryKey: ['schedules', centerId, startStr, endStr],
    queryFn: () => getScheduleList(centerId!, startStr, endStr),
    enabled: !!centerId,
  });
}

/** 일정 상세 쿼리 */
export function useScheduleDetail(centerId: string | null, scheduleId: string | null) {
  return useQuery({
    queryKey: ['schedule', centerId, scheduleId],
    queryFn: () => getScheduleDetail(centerId!, scheduleId!),
    enabled: !!centerId && !!scheduleId,
  });
}

/** 일정 메모 수정 mutation */
export function useUpdateScheduleNote(centerId: string | null, scheduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: string | null) => updateScheduleNote(centerId!, scheduleId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', centerId, scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
    },
  });
}

/** 세션 상태 변경 mutation */
export function useUpdateSessionStatus(centerId: string | null, scheduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      sessionId: string;
      scheduleType: ScheduleType;
      action: 'completed' | 'no_show' | 'cancelled';
    }) => {
      if (params.scheduleType === 'counseling') {
        return updateCounselingSessionStatus(centerId!, params.sessionId, params.action);
      }
      // assessment: map action names to API endpoint slugs
      const actionMap = { completed: 'attend', no_show: 'no-show', cancelled: 'cancel' } as const;
      return updateAssessmentSessionStatus(centerId!, params.sessionId, actionMap[params.action]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', centerId, scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false });
    },
  });
}
