import { useQuery } from '@tanstack/react-query';
import { getMe } from './api';
import { useAuthStore } from './store';

/** GET /app/me — 계정·프로필·센터 연결 통합 조회 (인증 시에만) */
export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
    enabled: isAuthenticated,
  });
}
