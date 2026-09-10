import { Platform } from 'react-native';
import { COLORS } from './theme';

/**
 * 안드로이드는 Material 모션이 iOS보다 짧다 — 같은 250ms면 체감이 굼뜨다.
 * iOS는 관성 있는 슬라이드가 기본값이라 유지.
 */
const ANIMATION_DURATION = Platform.select({ android: 180, default: 250 });

/**
 * 전 스택 공통 전환 규약 — 화면 이동엔 항상 애니메이션이 붙는다.
 *
 * animationTypeForReplace: 'push' 가 없으면 router.replace()가 무전환으로 튄다
 * (로그인·가입 성공, 로그아웃이 replace라 체감이 크다).
 */
export const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: ANIMATION_DURATION,
  animationTypeForReplace: 'push',
  gestureEnabled: true,
  contentStyle: { backgroundColor: COLORS.bg.base },
} as const;
