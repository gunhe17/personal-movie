/**
 * BadgeRound 컴포넌트 (Round/Pill 형태) — 상태 표시 배지 표준 (디자인 시스템 §4.5)
 *
 * 규격: 높이 28, 폭 최솟값 50, 좌우 패딩 10, fully rounded (pill), label-01 medium.
 * 변할 수 있는 것은 가로 너비(레이블 길이)와 컬러뿐 — 높이·레이블 사이즈는 고정.
 *
 * 색은 variant 프리셋을 쓰거나, 프리셋에 없는 색은 bg/color 로 직접 주입한다.
 *
 * @example
 *   <BadgeRound variant="primary">완료</BadgeRound>
 *   <BadgeRound bg={COLORS.tag.green.bg} color={COLORS.tag.green.fg}>완료</BadgeRound>
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export type BadgeRoundVariant =
  | 'primary'
  | 'warning'
  | 'success'
  | 'error'
  | 'gray';

export interface BadgeRoundProps extends ViewProps {
  variant?: BadgeRoundVariant;
  children: React.ReactNode;
  className?: string;
  /** 프리셋에 없는 색을 직접 주입할 때 (배경) */
  bg?: string;
  /** 프리셋에 없는 색을 직접 주입할 때 (텍스트) */
  color?: string;
}

const VARIANT_BG: Record<BadgeRoundVariant, string> = {
  primary: 'bg-primary-50',
  warning: 'bg-trans-yellow',
  success: 'bg-trans-green',
  error: 'bg-trans-red',
  gray: 'bg-gray-100',
};

// className-based 색상은 Typography 기본 `text-text` 와 utility 충돌이 있어
// inline style 로 직접 주입한다.
const VARIANT_TEXT_COLOR: Record<BadgeRoundVariant, string> = {
  primary: COLORS.primary,
  warning: COLORS.warning,
  success: COLORS.success,
  error: COLORS.error,
  gray: COLORS.gray[600],
};

export function BadgeRound({
  variant = 'gray',
  children,
  className = '',
  style,
  bg,
  color,
  ...rest
}: BadgeRoundProps) {
  // bg 가 직접 주입되면 variant 배경 className 은 생략 (style 로 덮음)
  const bgClass = bg ? '' : VARIANT_BG[variant];
  const textColor = color ?? VARIANT_TEXT_COLOR[variant];
  return (
    <View
      style={[
        { height: s(28), minWidth: s(50), paddingHorizontal: s(10) },
        bg ? { backgroundColor: bg } : null,
        style,
      ]}
      className={`items-center justify-center rounded-full ${bgClass} ${className}`.trim()}
      {...rest}
    >
      <Typography variant="label-01" weight="medium" style={{ color: textColor }}>
        {children}
      </Typography>
    </View>
  );
}
