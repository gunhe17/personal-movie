import { useQuery } from '@tanstack/react-query';
import { getCounselingCaseList, getCounselingCaseDetail } from './api';

export function useCounselingCaseList(centerId: string | null, status?: string) {
  return useQuery({
    queryKey: ['counselingCaseList', centerId, status],
    queryFn: () =>
      getCounselingCaseList({
        centerId: centerId!,
        status: status || undefined,
        size: 50,
      }),
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCounselingCaseDetail(centerId: string | null, caseId: string | null) {
  return useQuery({
    queryKey: ['counselingCaseDetail', centerId, caseId],
    queryFn: () => getCounselingCaseDetail(centerId!, caseId!),
    enabled: !!centerId && !!caseId,
    staleTime: 5 * 60 * 1000,
  });
}
