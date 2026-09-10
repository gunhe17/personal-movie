import { useQuery } from '@tanstack/react-query';
import { getHomeSignals, getPrepSignals } from './api';

export function usePrepSignals(
  centerId: string | null,
  scheduleId: string | null,
) {
  return useQuery({
    queryKey: ['prepSignals', centerId, scheduleId],
    queryFn: () => getPrepSignals(centerId!, scheduleId!),
    enabled: !!centerId && !!scheduleId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHomeSignals(centerId: string | null) {
  return useQuery({
    queryKey: ['homeSignals', centerId],
    queryFn: () => getHomeSignals(centerId!),
    enabled: !!centerId,
    staleTime: 60 * 1000,
  });
}
