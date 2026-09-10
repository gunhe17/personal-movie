import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 샘플 실험 화면 — 신규 디자인 시도용 빈 캔버스.
 *
 * 이 파일을 복사해서 새 실험 화면을 만들 수 있다:
 *   1) `app/(main)/lab/<slug>.tsx` 로 복사
 *   2) `src/features/lab/registry.ts` 의 LAB_EXPERIMENTS 에 항목 추가
 */
export default function LabSampleScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-12 flex-row items-center px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            샘플 실험
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10">
        <View
          className="items-center justify-center rounded-lg bg-surface"
          style={{
            paddingVertical: s(64),
            borderWidth: 1,
            borderColor: COLORS.border.default,
            borderStyle: 'dashed',
          }}
        >
          <Typography variant="body-01" weight="semibold" className="text-gray-700">
            Sample experiment
          </Typography>
          <View style={{ height: s(6) }} />
          <Typography variant="body-03" className="text-gray-500">
            신규 디자인 시도용 빈 캔버스
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
