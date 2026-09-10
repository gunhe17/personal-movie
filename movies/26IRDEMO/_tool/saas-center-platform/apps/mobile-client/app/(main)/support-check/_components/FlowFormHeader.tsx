import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const TOTAL_STEPS = 2;

/** 지원 확인 플로우 공통 헤더 — 뒤로 + N/2 + 진행바(몇 걸음인지 먼저 보여줘 이탈을 줄인다). */
export function FlowFormHeader({
  stepIndex,
  onBack,
}: {
  stepIndex: number;
  onBack: () => void;
}) {
  return (
    <>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={onBack}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <View className="flex-1" />
        <Typography variant="body-03" weight="medium" style={{ color: COLORS.text.body.subtle }}>
          {`${stepIndex}/${TOTAL_STEPS}`}
        </Typography>
      </View>

      <View className="flex-row px-4" style={{ columnGap: s(4) }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < stepIndex ? COLORS.button.primary.bg : COLORS.gray[100],
            }}
          />
        ))}
      </View>
    </>
  );
}
