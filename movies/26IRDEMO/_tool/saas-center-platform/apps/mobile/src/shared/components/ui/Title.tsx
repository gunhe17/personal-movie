/**
 * Title 컴포넌트 (모바일 전용)
 *
 * 디자인 시스템의 Title 사이즈 프리셋을 한 줄로 적용.
 * Typography를 래핑해 variant/weight/color 조합을 size 한 prop으로 단순화.
 *
 * 사이즈 매핑:
 * - lg: Title-01 / SemiBold / title-default(gray-900) — 섹션 헤딩
 * - md: Body-01  / SemiBold / title-default(gray-900) — 서브 헤딩
 * - sm: Body-03  / Medium   / title-subtle(gray-600)  — 캡션/라벨·인풋 위 레이블
 *
 * @example
 *   <Title size="lg">타이틀영역</Title>
 *   <Title size="md">타이틀영역</Title>
 *   <Title size="sm">타이틀영역</Title>
 *
 *   // 색상 override 필요시 className
 *   <Title size="lg" className="text-primary">강조 타이틀</Title>
 */

import type { TextProps } from 'react-native';
import {
  Typography,
  type TypographyVariant,
  type TypographyWeight,
} from './Typography';

export type TitleSize = 'lg' | 'md' | 'sm';

export interface TitleProps extends TextProps {
  size?: TitleSize;
  className?: string;
  /** false면 고정 픽셀. 기본 true (기기 폭 비례 보정). */
  scaled?: boolean;
}

const SIZE_PRESET: Record<
  TitleSize,
  { variant: TypographyVariant; weight: TypographyWeight; className: string }
> = {
  // 컬러: L·M = title/default(gray-900) · S = title/subtle(gray-600)
  lg: { variant: 'title-01', weight: 'semibold', className: 'text-gray-900' },
  md: { variant: 'body-01', weight: 'semibold', className: 'text-gray-900' },
  sm: { variant: 'body-03', weight: 'medium', className: 'text-gray-600' },
};

export function Title({
  size = 'lg',
  className = '',
  scaled = true,
  children,
  ...rest
}: TitleProps) {
  const preset = SIZE_PRESET[size];
  const composed = `${preset.className} ${className}`.trim();

  return (
    <Typography
      variant={preset.variant}
      weight={preset.weight}
      scaled={scaled}
      className={composed}
      {...rest}
    >
      {children}
    </Typography>
  );
}
