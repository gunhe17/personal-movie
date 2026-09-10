import { useMutation, useQuery } from '@tanstack/react-query';
import { getAssessmentReport, getProfileProgress } from './api';

export function useProfileProgress(profileId: string | null) {
  return useQuery({
    queryKey: ['profile-progress', profileId],
    queryFn: () => getProfileProgress(profileId!),
    enabled: !!profileId,
  });
}

/**
 * 결과지 열람 — presigned URL이 1시간짜리라 캐시하지 않는다.
 * 탭한 시점에 발급받아 바로 연다.
 */
export function useAssessmentReport() {
  return useMutation({
    mutationFn: (taskId: string) => getAssessmentReport(taskId),
  });
}
