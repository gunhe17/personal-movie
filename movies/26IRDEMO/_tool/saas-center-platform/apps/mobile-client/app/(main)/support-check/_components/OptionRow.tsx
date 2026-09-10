import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui';
import { COLORS, RADIUS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const ACCENT = COLORS.button.primary.bg;

/** 자격 문항 선택지 — 라디오 행(선택 시 액센트 테두리 + 틴트). */
export function OptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="mt-2 flex-row items-center px-4 py-3"
        style={{
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: selected ? ACCENT : COLORS.border.default,
          backgroundColor: selected ? COLORS.bg.selected : COLORS.surface,
          columnGap: s(8),
        }}
      >
        <View className="flex-1">
          <Typography
            variant="body-02"
            weight={selected ? 'semibold' : 'regular'}
            style={{ color: COLORS.text.title.default }}
          >
            {label}
          </Typography>
          {hint ? (
            <Typography
              variant="body-03"
              className="mt-0.5"
              style={{ color: COLORS.text.body.subtle }}
            >
              {hint}
            </Typography>
          ) : null}
        </View>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={s(20)}
          color={selected ? ACCENT : COLORS.gray[300]}
        />
      </View>
    </Pressable>
  );
}
