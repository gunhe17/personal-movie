import '../global.css';

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth';
import { useInviteCodeDeepLink } from '@/features/link';
import { queryClient } from '@/shared/api/queryClient';
import { SystemNavBarScrim } from '@/shared/components/SystemNavBarScrim';
import { STACK_SCREEN_OPTIONS } from '@/shared/constants/navigation';

// 앱 로드가 완료될 때까지 스플래시 유지
SplashScreen.preventAutoHideAsync();

// 초대 코드 딥링크 수신 — 렌더 없는 브리지 (Stack 마운트 이후에만 라우팅하도록 형제로 배치)
function InviteCodeDeepLinkBridge() {
  useInviteCodeDeepLink();
  return null;
}

// 풀블리드 화면 — 시스템 내비 영역까지 콘텐츠(지도)가 그대로 비쳐야 해 스크림을 깔지 않는다
const SCRIM_EXCLUDED_PATHS = ['/centers'];

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const pathname = usePathname();

  const [fontsLoaded] = useFonts({
    'Pretendard-Light': require('../assets/fonts/Pretendard-Light.otf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated, fontsLoaded]);

  if (!isHydrated || !fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {/* 키보드 상태·높이를 앱 전역에 제공 (KeyboardAvoidingView·KeyboardAwareScrollView 전제) */}
        <KeyboardProvider>
          <StatusBar style="dark" />
          <View style={styles.root}>
            {/* Slot이 아닌 Stack — 그룹 간 이동((main)↔(auth)↔(link))에도 전환이 붙는다 */}
            <Stack screenOptions={STACK_SCREEN_OPTIONS} />
            {/* 내비게이터 마운트 이후에만 딥링크 훅이 돌도록 Stack 옆에 둔다 */}
            <InviteCodeDeepLinkBridge />
          </View>
          {/* Android edge-to-edge: 투명 시스템 내비 영역으로 비치는 콘텐츠를
              페이지 배경 그라데이션으로 흐린다 */}
          {SCRIM_EXCLUDED_PATHS.includes(pathname) ? null : <SystemNavBarScrim />}
        </KeyboardProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
