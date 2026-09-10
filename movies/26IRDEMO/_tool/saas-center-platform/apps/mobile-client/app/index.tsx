import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { LoadingView } from '@/shared/components/ui';

export default function Index() {
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) {
    return <LoadingView className="flex-1 bg-background" />;
  }

  // 게스트도 탭 홈으로 — 가입 게이트는 행동 시점(초대 코드 입력 등)에 건다.
  return <Redirect href="/(main)/(tabs)" />;
}
