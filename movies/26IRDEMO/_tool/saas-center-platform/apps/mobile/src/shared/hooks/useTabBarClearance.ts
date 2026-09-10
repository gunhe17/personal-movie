import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from '@/shared/utils/scale';

/**
 * 플로팅(투명 오버레이) 바텀 탭바가 가리는 영역 높이.
 *
 * 탭바를 absolute 오버레이로 띄우면 화면 배경(예: 홈 그라데이션)이 pill 주위로 자연스럽게
 * 흐르지만, 스크롤 콘텐츠는 탭바 뒤로 가릴 수 있다. 각 탭 화면의 스크롤
 * `contentContainerStyle.paddingBottom` 에 이 값을 더해 마지막 항목이 가리지 않게 한다.
 * (배경/full-bleed 그라데이션은 영향 없음 — 스크롤 콘텐츠 패딩만 늘림.)
 *
 * pill: paddingTop(8) + pill(64) + paddingBottom(insets.bottom + 10) + 여유 → insets.bottom + 88.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + s(88);
}
