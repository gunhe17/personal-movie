import { useCallback, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** 두 번째 백을 받아주는 시간 창 (ms). ToastAndroid.SHORT(~2초)와 맞춤. */
const EXIT_WINDOW_MS = 2000;

/**
 * 안드로이드 하드웨어 백 "한 번 더 누르면 종료" 가드.
 *
 * 앱이 곧장 닫히는 화면(주로 탭 루트, 백을 누르면 더 갈 곳이 없어 종료되는 지점)에서 호출한다.
 *  - 1번째 백: 종료를 막고(`return true`) 하단 토스트 안내.
 *  - `EXIT_WINDOW_MS` 안에 2번째 백: 기본 동작에 맡겨(`return false`) 앱 종료.
 *
 * 안내는 안드로이드 네이티브 `ToastAndroid`(화면 하단, 다른 앱들과 동일한 익숙한 UX).
 * `useFocusEffect` 로 화면 포커스 동안만 리스너를 건다 — 상세 화면이 위로 push 되면 자동 해제되어
 * 일반 뒤로가기(스택 pop)를 가로채지 않는다. iOS 는 하드웨어 백이 없어 no-op.
 */
export function useDoubleBackExit(message = '한 번 더 누르면 종료돼요') {
  const lastPress = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBack = () => {
        const now = Date.now();
        if (now - lastPress.current < EXIT_WINDOW_MS) {
          return false; // 2번째 → 기본 동작(종료)
        }
        lastPress.current = now;
        ToastAndroid.show(message, ToastAndroid.SHORT); // 하단 네이티브 토스트
        return true; // 1번째 → 종료 막고 안내
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [message]),
  );
}
