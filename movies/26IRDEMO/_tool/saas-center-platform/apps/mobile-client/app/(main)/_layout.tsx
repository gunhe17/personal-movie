import { Stack } from 'expo-router';
import { STACK_SCREEN_OPTIONS } from '@/shared/constants/navigation';
import { useAuthStore } from '@/features/auth';
import { useNotificationResponder } from '@/features/notification';

/** 게스트 열람 허용 — 인증이 필요한 행동(센터 연결 등)은 (link) 등 해당 지점에서 게이트. */
export default function MainLayout() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  useNotificationResponder();

  if (!isHydrated) {
    return null;
  }

  return (
    <Stack
      screenOptions={STACK_SCREEN_OPTIONS}
    />
  );
}
