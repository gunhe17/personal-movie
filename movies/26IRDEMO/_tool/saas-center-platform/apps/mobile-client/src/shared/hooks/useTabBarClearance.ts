import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from '@/shared/utils/scale';

/** 플로팅 pill 탭바 하단 ↔ 시스템 내비 영역 사이 간격(dp). 탭바·스크림이 공유. */
export const TAB_BAR_BOTTOM_GAP = 0;

/**
 * pill 아래 실제 하단 패딩 — 시스템 내비 인셋 + 간격.
 * 인셋이 0인 기기(iPhone SE·비 edge-to-edge Android)에선 최소 8을 확보해
 * pill이 화면 끝에 딱 붙지 않게 한다.
 */
export function useTabBarBottomPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, s(8)) + s(TAB_BAR_BOTTOM_GAP);
}

/**
 * 플로팅(투명 오버레이) 바텀 탭바가 가리는 영역 높이 — 전문가앱 구조 포팅.
 *
 * 탭바가 absolute 오버레이라 스크롤 콘텐츠가 pill 뒤로 가릴 수 있다.
 * 각 탭 화면의 스크롤 `contentContainerStyle.paddingBottom`에 이 값을 더해
 * 마지막 항목이 가리지 않게 한다.
 *
 * pill: paddingTop(8) + pill(68) + 여유(6) + 하단 패딩(useTabBarBottomPadding).
 * 인셋은 iOS 홈 인디케이터·Android 시스템 내비게이션 바(제스처/3버튼,
 * 투명 edge-to-edge 포함)를 모두 커버한다.
 */
export function useTabBarClearance(): number {
  return useTabBarBottomPadding() + s(82);
}
