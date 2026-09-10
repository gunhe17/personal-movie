import { Redirect, Stack } from 'expo-router';
import { STACK_SCREEN_OPTIONS } from '@/shared/constants/navigation';
import { useAuthStore } from '@/features/auth';

// 딥링크 코드 스태시는 루트의 useInviteCodeDeepLink가 담당한다 —
// 여기서 하면 라우팅이 /code까지 도달한 경우에만 동작해 콜드 스타트에서 유실된다.
export default function LinkLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/signup" />;
  }

  return (
    <Stack
      screenOptions={STACK_SCREEN_OPTIONS}
    />
  );
}
