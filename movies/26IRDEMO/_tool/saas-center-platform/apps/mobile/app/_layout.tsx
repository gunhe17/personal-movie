import '../global.css';

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { SystemNavBarScrim } from '@/shared/components/SystemNavBarScrim';
import { checkForUpdate } from '@/shared/utils';
import { queryClient } from '@/shared/api/queryClient';

// 앱 로드가 완료될 때까지 스플래시 유지
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

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
      // 앱 시작 시 OTA 업데이트 확인 (silent)
      checkForUpdate(true);
    }
  }, [isHydrated, fontsLoaded]);

  if (!isHydrated || !fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <StatusBar style="dark" />
            <View style={styles.root}>
              <Slot />
            </View>
            {/* 시스템 내비 영역(Android) 스크림 — 전역 최상위에 떠서, 투명한 시스템 내비
                영역으로 비치는 스크롤 콘텐츠를 페이지 배경 그라데이션으로 흐린다.
                다크 내비(필드노트)에선 자동으로 꺼짐. */}
            <SystemNavBarScrim />
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
