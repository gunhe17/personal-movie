import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { router } from 'expo-router';

/** 두 번째 누름을 종료로 받아주는 창 — 짧으면 오조작, 길면 의도치 않은 종료 */
const EXIT_WINDOW_MS = 2000;

/**
 * 안드로이드 하드웨어 뒤로가기: 더 갈 곳이 없으면 토스트 → 한 번 더 누르면 종료.
 *
 * 되돌아갈 화면이 남아 있으면 false를 반환해 네비게이터가 그대로 처리한다
 * (탭 간 뒤로가기·스택 pop을 가로채면 안 된다).
 */
export function useAndroidBackExit() {
  const lastPressAt = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;

      const now = Date.now();
      if (now - lastPressAt.current < EXIT_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }

      lastPressAt.current = now;
      ToastAndroid.show('한 번 더 누르면 종료됩니다', ToastAndroid.SHORT);
      return true;
    });

    return () => subscription.remove();
  }, []);
}
