import { Stack } from 'expo-router';
import { STACK_SCREEN_OPTIONS } from '@/shared/constants/navigation';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={STACK_SCREEN_OPTIONS}
    />
  );
}
