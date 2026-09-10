import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { getBillableDetail, getBillables } from './api';

export function useBillables() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['billables'],
    queryFn: getBillables,
    enabled: isAuthenticated,
  });
}

export function useBillableDetail(billableId: string | null, centerId: string | null) {
  return useQuery({
    queryKey: ['app-billable', billableId, centerId],
    queryFn: () => getBillableDetail(billableId as string, centerId as string),
    enabled: !!billableId && !!centerId,
  });
}
