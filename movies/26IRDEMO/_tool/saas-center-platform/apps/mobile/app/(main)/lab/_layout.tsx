import { Stack } from 'expo-router';

/**
 * LAB 실험 화면 공통 레이아웃.
 *
 * 각 실험 화면이 자체적으로 SafeAreaView + 헤더를 그리도록 두고,
 * 여기서는 Stack 동작만 제공한다(상위 (main)/_layout 의 slide_from_right 상속).
 */
export default function LabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 125,
        gestureEnabled: true,
        // 화면 전체 폭에서 스와이프 뒤로가기 (가장자리뿐 아니라). 스와이프 전환은 위 animation 사용.
        fullScreenGestureEnabled: true,
        animationMatchesGesture: true,
      }}
    />
  );
}
