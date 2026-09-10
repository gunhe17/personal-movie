/**
 * 준비 중 스텁 — 마이 화면에서 아직 화면이 없는 목적지(계정 관리·가족관계·서류·앱 잠금·환경
 * 설정)를 임시로 받는다. 실제 화면이 생기면 각 라우트로 교체한다.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';

export default function ComingSoonScreen() {
  const router = useRouter();
  const { title } = useLocalSearchParams<{ title?: string }>();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-[52px] flex-row items-center px-4" style={{ columnGap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {title ?? ''}
        </Typography>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        <EmptyView
          title="준비 중이에요"
          description="곧 만나보실 수 있어요"
        />
      </View>
    </SafeAreaView>
  );
}
