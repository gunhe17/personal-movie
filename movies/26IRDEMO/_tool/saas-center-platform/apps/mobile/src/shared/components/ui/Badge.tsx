/**
 * Badge 컴포넌트 (Rectangle 형태) — 역할·부가정보 배지 표준 (디자인 시스템 §4.5)
 *
 * 규격: 높이 22, 폭 최솟값 33, 좌우 패딩 6, radius 4, label-02 medium.
 * 변할 수 있는 것은 가로 너비(레이블 길이)와 컬러뿐 — 높이·레이블 사이즈는 고정.
 *
 * 색은 variant 프리셋을 쓰거나, 프리셋에 없는 색은 bg/color 로 직접 주입한다.
 * (Typography는 className에 text-text를 강제 prepend → arbitrary text-[#hex]가 덮이므로
 *  style.color로 적용해야 안전하다.)
 *
 * @example
 *   <Badge>김은서</Badge>
 *   <Badge variant="blue">관리자</Badge>
 *   <Badge bg={COLORS.paletteBg.violet} color={COLORS.palette.violet}>보호자</Badge>
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';
import { Typography } from './Typography';
import { s } from '@/shared/utils/scale';
import { COLORS } from '@/shared/constants/theme';

export type BadgeVariant = 'gray' | 'blue' | 'green' | 'red' | 'outline';

export interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  /** 프리셋에 없는 색을 직접 주입할 때 (배경) */
  bg?: string;
  /** 프리셋에 없는 색을 직접 주입할 때 (텍스트) */
  color?: string;
}

const VARIANT_CONTAINER: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100',
  blue: '',
  green: '',
  red: 'bg-trans-red',
  outline: 'bg-surface border border-gray-200',
};

const VARIANT_TEXT: Record<BadgeVariant, string> = {
  gray: 'text-gray-600',
  blue: '',
  green: '',
  red: 'text-error',
  outline: 'text-gray-700',
};

/** 디자인 시스템 외 전용 색상 — 관리자/전문가 역할 뱃지 */
const VARIANT_COLOR: Partial<Record<BadgeVariant, { bg: string; text: string }>> = {
  blue: { bg: '#2E81FF14', text: '#2E81FF' }, // 관리자
  green: { bg: '#1DCA3A14', text: '#1DCA3A' }, // 전문가
};

export function Badge({
  variant = 'gray',
  children,
  className = '',
  style,
  bg,
  color,
  ...rest
}: BadgeProps) {
  const presetColor = VARIANT_COLOR[variant];
  const finalBg = bg ?? presetColor?.bg;
  const finalText = color ?? presetColor?.text;
  // 직접 색 주입 시 variant 배경/텍스트 className 은 생략 (style 로 덮음)
  const bgClass = finalBg ? '' : VARIANT_CONTAINER[variant];
  const textClass = finalText ? '' : VARIANT_TEXT[variant];
  const container =
    `rounded-[4px] items-center justify-center ${bgClass} ${className}`.trim();

  return (
    <View
      className={container}
      style={[
        { height: s(22), minWidth: s(33), paddingHorizontal: s(6) },
        finalBg ? { backgroundColor: finalBg } : null,
        style,
      ]}
      {...rest}
    >
      <Typography
        variant="label-02"
        weight="medium"
        className={textClass}
        style={finalText ? { color: finalText } : undefined}
      >
        {children}
      </Typography>
    </View>
  );
}

/**
 * 세트 배지 — 검사 세트 표시 (전 페이지 공통).
 * 사각형 Badge 규격(높이 22 / label-02 medium) + 흰 배경 · border/default · orange/500 텍스트.
 */
export function SetBadge({
  children = '세트',
  style,
  ...rest
}: Omit<BadgeProps, 'variant' | 'bg' | 'color' | 'children'> & {
  children?: React.ReactNode;
}) {
  return (
    <Badge
      bg={COLORS.white}
      color={COLORS.warning}
      style={[{ borderWidth: 1, borderColor: COLORS.border.default }, style]}
      {...rest}
    >
      {children}
    </Badge>
  );
}
