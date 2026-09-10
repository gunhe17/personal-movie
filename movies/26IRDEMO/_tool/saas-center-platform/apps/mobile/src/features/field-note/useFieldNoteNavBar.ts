import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * 기능 토글 — app.config.ts 의 FIELD_NOTE_DARK_NAVBAR 가 extra.fieldNoteDarkNavBar 로 들어온다.
 * false 면 버튼색 전환을 안 한다(롤백). 기본 true (값이 없으면 켜진 것으로 간주).
 */
const ENABLED = Constants.expoConfig?.extra?.fieldNoteDarkNavBar !== false;

/**
 * 필드노트 다크 화면용 — Android 시스템 내비게이션 바 버튼색 제어.
 *
 * edge-to-edge(Android 15)에서는 setBackgroundColorAsync 가 no-op 이라 배경색은 못 칠한다.
 * 대신 styles.xml 의 enforceNavigationBarContrast=false(=withNavBarNoContrast 플러그인) 로
 * 바를 투명하게 만들어 화면 다크 배경이 비치게 하고, 여기서는 **버튼 아이콘 색만** 바꾼다.
 * setButtonStyleAsync 는 edge-to-edge 에서도 동작한다.
 *
 * 다크 화면이 라우트(home/list/detail)와 오버레이(녹음/처리/완료)에 동시에 겹칠 수 있어
 * ref-count 로 관리한다 — 다크 표면이 하나라도 살아있으면 'light'(밝은 버튼), 전부 사라지면 'dark'.
 */

let darkCount = 0;

// 다크 내비 활성 여부(darkCount>0)를 외부에서 구독할 수 있게 한다.
// SystemNavBarScrim 이 이 신호를 읽어, 다크 화면(필드노트)에선 라이트 스크림을 끄고
// 기존 다크 몰입 내비를 그대로 둔다.
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

/** darkCount 가 0↔1 경계를 넘을 때(=다크 내비 on/off 가 실제로 바뀔 때) 알림을 받는다. */
export function subscribeDarkNav(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 현재 다크 내비가 활성인지(다크 표면이 하나라도 떠 있는지). */
export function isDarkNavActive(): boolean {
  return darkCount > 0;
}

function setButtons(style: 'light' | 'dark') {
  if (!ENABLED || Platform.OS !== 'android') return;
  // edge-to-edge 에서도 동작. 실패해도 앱에 영향 없게 무시.
  void NavigationBar.setButtonStyleAsync(style).catch(() => {});
}

function acquireDark(): () => void {
  darkCount += 1;
  if (darkCount === 1) {
    setButtons('light');
    notify(); // 다크 내비 on → 스크림 끄기
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    darkCount = Math.max(0, darkCount - 1);
    if (darkCount === 0) {
      setButtons('dark');
      notify(); // 다크 내비 off → 스크림 다시 켜기
    }
  };
}

/** 라우트(네비게이터) 화면용 — focus 동안 다크 버튼 유지, blur 시 복구. 중첩 네비게이션 안전. */
export function useDarkNavBarOnFocus() {
  useFocusEffect(
    useCallback(() => {
      const release = acquireDark();
      return release;
    }, []),
  );
}

/** 오버레이(라우트 아님, 조건부 mount) 화면용 — mount 동안 다크 버튼 유지, unmount 시 복구. */
export function useDarkNavBarWhileMounted() {
  useEffect(() => {
    const release = acquireDark();
    return release;
  }, []);
}
