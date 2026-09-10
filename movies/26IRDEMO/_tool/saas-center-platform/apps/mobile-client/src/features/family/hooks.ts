import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import {
  getFamilyMembers,
  issueFamilyInvitation,
  joinFamily,
  leaveFamily,
  removeFamilyMember,
} from './api';

export function useFamilyMembers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['family-members'],
    queryFn: getFamilyMembers,
    enabled: isAuthenticated,
  });
}

export function useIssueFamilyInvitation() {
  return useMutation({ mutationFn: issueFamilyInvitation });
}

export function useJoinFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: joinFamily,
    // 합류하면 가족의 프로필·센터 연결·청구서가 통째로 바뀐다
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['billables'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useRemoveFamilyMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeFamilyMember,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['family-members'] }),
  });
}

/** 가족에서 나가면 아이·센터·청구서 접근이 통째로 사라진다 */
export function useLeaveFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leaveFamily,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['billables'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
