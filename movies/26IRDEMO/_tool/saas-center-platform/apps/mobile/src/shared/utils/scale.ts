import { Dimensions } from 'react-native';

/**
 * 디바이스 폭 기반 스케일 유틸.
 *
 * Figma 디자인 프레임을 BASE_W 기준으로 잡고, 실기기 폭에 비례 변환한다.
 * 고정 dimension(카드 높이 등)에만 선택적으로 적용.
 *
 * @example
 *   <View style={{ height: s(216) }} className="rounded-lg bg-surface p-4" />
 */

const { width: W } = Dimensions.get('window');

/** Figma 디자인 프레임 기준 (iPhone 14/15). 디자이너 프레임에 맞춰 조정. */
const BASE_W = 390;

/** 가로축 기반 스케일 — 카드 height, fixed dimension 에 주로 사용 */
export const s = (size: number): number => (W / BASE_W) * size;

/**
 * Moderate scale — 스케일 강도 조절 (factor=0 원본, factor=1 = s()).
 * 폰트·radius·작은 spacing 등 너무 커지지 않길 바라는 값에 사용.
 */
export const ms = (size: number, factor = 0.5): number =>
  size + (s(size) - size) * factor;
