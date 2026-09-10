/**
 * 공용 Badge — 피그마 Badge 셋(64:30) + Badge/Rectangle(150:2901) 구현.
 *
 * shape pill(기본) = 26 고정높이 둥근 뱃지, 라벨 13/16 Medium.
 * shape rect = radius 4 사각 뱃지(홈 일정 카드 등), 라벨 12/16 Medium.
 * 컬러 7종(tag/* 토큰) × variant 3종(subtle=틴트/solid=채움/outline=테두리만).
 */
import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export type BadgeColor =
  | 'gray'
  | 'green'
  | 'blue'
  | 'red'
  | 'orange'
  | 'teal'
  | 'purple'
  | 'pink';
export type BadgeVariant = 'subtle' | 'solid' | 'outline';
export type BadgeShape = 'pill' | 'rect';
export type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  /** subtle = 틴트 배경+컬러 텍스트 / solid = 컬러 채움+흰 텍스트 / outline = 배경 없이 테두리+컬러 텍스트 */
  variant?: BadgeVariant;
  /** pill = 둥근 26 고정높이 / rect = radius 4 사각(피그마 Badge/Rectangle) */
  shape?: BadgeShape;
  /**
   * pill — xs = 높이 20 · px 8 · 라벨 12/16 (자녀 목록 '연동' 뱃지, 시안 793:7620) / 그 외 = 높이 26 · 라벨 13/16
   * rect — md = 높이 24 · 라벨 14/16(Badge/Rectangle/24) / 그 외 = 라벨 12/16
   */
  size?: BadgeSize;
}

export function Badge({
  label,
  color = 'gray',
  variant = 'subtle',
  shape = 'pill',
  size = 'sm',
}: BadgeProps) {
  const palette = COLORS.tag[color];
  const solid = variant === 'solid';
  const outline = variant === 'outline';
  const bg = solid ? palette.fg : outline ? 'transparent' : palette.bg;
  const rect = shape === 'rect';
  const md = rect && size === 'md';
  const xs = !rect && size === 'xs';

  return (
    <View
      className={`items-center justify-center ${rect ? '' : `rounded-full ${xs ? 'px-2' : 'px-2.5'}`}`.trim()}
      style={
        rect
          ? {
              borderRadius: s(4),
              paddingHorizontal: s(6),
              ...(md ? { height: s(24) } : { paddingVertical: s(2) }),
              backgroundColor: bg,
              ...(outline ? { borderWidth: 1, borderColor: palette.fg } : null),
            }
          : {
              height: xs ? 20 : 26,
              backgroundColor: bg,
              ...(outline ? { borderWidth: 1, borderColor: palette.fg } : null),
            }
      }
    >
      <Typography
        weight="medium"
        style={{
          fontSize: s(md ? 14 : rect || xs ? 12 : 13),
          lineHeight: s(16),
          color: solid ? COLORS.white : palette.fg,
        }}
      >
        {label}
      </Typography>
    </View>
  );
}
