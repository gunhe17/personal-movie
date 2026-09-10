import { Stack } from 'expo-router';
import { STACK_SCREEN_OPTIONS } from '@/shared/constants/navigation';

/**
 * LAB 시안 공통 레이아웃 — 각 시안이 자체 SafeAreaView + 헤더를 그리므로
 * 여기서는 전 스택 공통 전환 규약만 상속한다.
 */
export default function LabLayout() {
  return <Stack screenOptions={STACK_SCREEN_OPTIONS} />;
}
