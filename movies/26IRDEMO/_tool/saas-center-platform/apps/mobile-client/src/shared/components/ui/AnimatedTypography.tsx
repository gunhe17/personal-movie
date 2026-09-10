/**
 * reanimated로 감싼 Typography — 글자색을 UI 스레드에서 보간할 때 쓴다.
 *
 * 배경만 애니메이션하고 글자색을 즉시 바꾸면, 배경이 넘어가는 동안 글자가
 * 같은 색 위에 놓여 잠깐 사라져 보인다(예: 흰 칩 → 다크 칩 전환의 흰 글자).
 * 배경과 글자를 같은 progress로 함께 보간하려고 둔 컴포넌트다.
 *
 * variant·weight는 Typography 그대로 — 화면에서 fontSize를 직접 쓰지 않는다.
 */
import Animated from 'react-native-reanimated';
import { Typography } from './Typography';

export const AnimatedTypography = Animated.createAnimatedComponent(Typography);
