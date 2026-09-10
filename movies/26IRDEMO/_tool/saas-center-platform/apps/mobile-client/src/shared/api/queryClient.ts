import { QueryClient } from '@tanstack/react-query';

/**
 * 앱 전역에서 공유하는 단일 QueryClient.
 *
 * React 컴포넌트 밖(예: auth store의 logout/forceLogout)에서도 캐시를 비울 수 있도록
 * 모듈 레벨로 분리한다. _layout.tsx의 QueryClientProvider도 이 인스턴스를 사용한다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      // 비활성 캐시 보존 30분 — 탭/화면 재방문 시 즉시 캐시 표시 (콜드 페치 감소)
      gcTime: 1000 * 60 * 30,
      // RN에는 window focus 이벤트가 없어 기본값(true)도 사실상 동작하지 않음 → 의도 명시
      refetchOnWindowFocus: false,
    },
  },
});
