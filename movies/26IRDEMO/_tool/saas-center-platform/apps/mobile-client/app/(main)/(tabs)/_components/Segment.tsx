import React from 'react';
import { Pressable, View } from 'react-native';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** pill 세그먼트 — gray 배경 + 활성 white pill */
export function Segment<T extends string>({ options, value, onChange }: SegmentProps<T>) {
  return (
    <View className="flex-row rounded-full bg-gray-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={`h-9 flex-1 items-center justify-center rounded-full ${
              active ? 'bg-surface' : ''
            }`}
          >
            <Typography
              variant="body-03"
              weight={active ? 'semibold' : 'regular'}
              style={{
                color: active ? COLORS.text.title.default : COLORS.text.body.subtle,
              }}
            >
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
