import { Redirect } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { useCenterStore } from '@/features/center';
import { LoadingScreen } from '@/shared/components/ui/LoadingScreen';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const centerId = useCenterStore((s) => s.centerId);
  const centerHydrated = useCenterStore((s) => s.isHydrated);

  if (!authHydrated || !centerHydrated) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!centerId) {
    return <Redirect href="/(auth)/center-select" />;
  }

  return <Redirect href="/(main)/(tabs)" />;
}
