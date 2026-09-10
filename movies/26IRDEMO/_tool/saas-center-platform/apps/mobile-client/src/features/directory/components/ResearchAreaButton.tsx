import React from 'react';
import { Pressable, View } from 'react-native';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/** 피그마 shadow/floating — 엘리베이션 정본 확정까지 인라인(탭바·Fab과 동일) */
const FLOATING_SHADOW = {
  shadowColor: '#000B14',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.08,
  shadowRadius: 7.9,
  elevation: 4,
} as const;

interface ResearchAreaButtonProps {
  onPress: () => void;
}

export function ResearchAreaButton({ onPress }: ResearchAreaButtonProps) {
  return (
    <View style={[{ borderRadius: s(17), backgroundColor: COLORS.surface }, FLOATING_SHADOW]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="items-center justify-center"
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          paddingHorizontal: s(14),
          height: s(34),
        })}
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.button.primary.bg }}
        >
          이 지역에서 재검색
        </Typography>
      </Pressable>
    </View>
  );
}
