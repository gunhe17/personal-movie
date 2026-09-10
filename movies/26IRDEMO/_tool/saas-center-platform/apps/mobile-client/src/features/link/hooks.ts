import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { claimLinks, verifyInvitation } from './api';
import { useLinkFlowStore } from './store';
import type { ClaimRequest } from './types';

const CODE_LENGTH = 6;

/**
 * 초대 코드 딥링크 수신 (루트 레이아웃에서 1회 호출).
 *
 * (link) 레이아웃의 파라미터 소비는 라우터가 /code까지 도달했을 때만 동작한다 —
 * 콜드 스타트(루트가 hydration 동안 null 반환)나 웜 인텐트에서 라우팅이 유실되면
 * 코드가 증발하므로, 라우팅 성공 여부와 무관하게 URL 이벤트에서 직접 스태시한다.
 */
export function useInviteCodeDeepLink() {
  const url = Linking.useURL();
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const pendingCode = useLinkFlowStore((s) => s.pendingCode);

  // URL → 코드 스태시 (초기 URL + 포그라운드 이벤트 모두 useURL이 커버)
  useEffect(() => {
    if (!url) return;
    const raw = Linking.parse(url).queryParams?.code;
    const code =
      typeof raw === 'string' ? raw.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH) : '';
    if (code.length === CODE_LENGTH) {
      useLinkFlowStore.getState().setPendingCode(code);
    }
  }, [url]);

  // 스태시 소비 라우팅 — 로그인 상태에서만 직접 이동한다.
  // 비로그인은 여기서 밀면 (link) 게이트의 가입 리다이렉트와 루프가 돈다 —
  // 가입/로그인 성공 핸들러가 pendingCode를 보고 코드 화면으로 복귀시킨다.
  useEffect(() => {
    if (!isHydrated || !pendingCode) return;
    if (!useAuthStore.getState().isAuthenticated) return;
    if (pathname === '/code') return;
    router.push('/(link)/code');
  }, [isHydrated, pendingCode, pathname, router]);
}

export function useVerifyInvitation() {
  return useMutation({
    mutationFn: (code: string) => verifyInvitation(code),
  });
}

export function useClaimLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClaimRequest) => claimLinks(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

