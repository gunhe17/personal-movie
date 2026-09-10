/**
 * Typography 컴포넌트 (내담자앱)
 *
 * 디자인 시스템(Pretendard)의 variant/weight 토큰을 실기기에 정확히 적용.
 *
 * - fontSize, lineHeight, letterSpacing은 모두 inline style로 제어
 *   → NativeWind className의 변동성 없이 값 정확히 렌더
 * - 기본적으로 `s()` 스케일 적용 (기기 폭 비례 보정)
 * - weight / color는 className 또는 사용자 className override
 *
 * ⚠️ 색 지정은 className("text-*")이 내부 기본색에 덮일 수 있어
 *    style={{ color }} 병행을 권장 (전문가앱과 동일 gotcha).
 */

import React from 'react';
import { Text, type TextProps } from 'react-native';
import { s } from '@/shared/utils/scale';

export type TypographyVariant =
  | 'display-01'
  | 'headline-large'
  | 'headline-01'
  | 'headline-02'
  | 'title-01'
  | 'title-02'
  | 'body-01'
  | 'body-01-reading'
  | 'body-02'
  | 'body-02-reading'
  | 'body-03'
  | 'body-03-reading'
  | 'label-01'
  | 'label-02'
  | 'caption-01';

export type TypographyWeight =
  | 'light'
  | 'regular'
  | 'medium'
  | 'semibold'
  | 'bold';

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  weight?: TypographyWeight;
  className?: string;
  /** false면 고정 픽셀. 기본 true (기기 폭 비례 보정). */
  scaled?: boolean;
}

// 디자인 시스템 variant 스펙 — letterSpacing은 전체 variant 공통 -0.41px
// ⚠️ 피그마 스타일명과 한 단계 어긋남(값은 동일): 피그마 Headline/Medium=headline-01,
//    Title_01/Normal=headline-02, Title_02/Normal=title-01. 리네임은 파급이 커서 보류.
const VARIANT_SIZE: Record<
  TypographyVariant,
  { fontSize: number; lineHeight: number }
> = {
  // 피그마 Title_01/Display-Light (48/52) — 숫자·수치 강조용, weight="light" 권장
  'display-01': { fontSize: 48, lineHeight: 52 },
  // 피그마 Headline/Large-Semibold (28/36)
  'headline-large': { fontSize: 28, lineHeight: 36 },
  'headline-01': { fontSize: 24, lineHeight: 36 },
  'headline-02': { fontSize: 20, lineHeight: 28 },
  'title-01': { fontSize: 18, lineHeight: 26 },
  // 웹 text-title-02-nomal-* 대응 (16/16 — 한 줄 헤더용)
  'title-02': { fontSize: 16, lineHeight: 16 },
  'body-01': { fontSize: 16, lineHeight: 24 },
  'body-01-reading': { fontSize: 16, lineHeight: 26 },
  'body-02': { fontSize: 15, lineHeight: 22 },
  'body-02-reading': { fontSize: 15, lineHeight: 24 },
  'body-03': { fontSize: 14, lineHeight: 20 },
  // 피그마 Body_03/Reading-Regular (14/22) — reading 계열의 14 판. 여러 줄 안내문에.
  'body-03-reading': { fontSize: 14, lineHeight: 22 },
  'label-01': { fontSize: 13, lineHeight: 20 },
  'label-02': { fontSize: 12, lineHeight: 16 },
  'caption-01': { fontSize: 11, lineHeight: 14 },
};

const LETTER_SPACING = -0.41;

// weight → Pretendard 폰트 패밀리명 (app/_layout.tsx에서 로딩)
const FONT_FAMILY: Record<TypographyWeight, string> = {
  light: 'Pretendard-Light',
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
};

/**
 * 디자인 시스템 variant/weight 기반 텍스트 스타일 객체를 반환.
 * `<Text>` 외 컴포넌트(TextInput 등)에서 동일한 타이포 토큰을 적용할 때 사용.
 */
export function getTypographyStyle(
  variant: TypographyVariant = 'body-02',
  weight: TypographyWeight = 'regular',
  scaled = true,
) {
  const base = VARIANT_SIZE[variant];
  return {
    fontFamily: FONT_FAMILY[weight],
    fontSize: scaled ? s(base.fontSize) : base.fontSize,
    lineHeight: scaled ? s(base.lineHeight) : base.lineHeight,
    letterSpacing: LETTER_SPACING,
  };
}

/**
 * ref를 Text로 넘긴다 — reanimated의 createAnimatedComponent가 네이티브 뷰 ref를
 * 잡아야 색·투명도 같은 스타일을 UI 스레드에서 갱신할 수 있다(AnimatedTypography).
 */
export const Typography = React.forwardRef<Text, TypographyProps>(
  function Typography(
    {
      variant = 'body-02',
      weight = 'regular',
      scaled = true,
      className = '',
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const composed = `text-text ${className}`.trim();
    const typeStyle = getTypographyStyle(variant, weight, scaled);

    return (
      <Text ref={ref} className={composed} style={[typeStyle, style]} {...rest}>
        {children}
      </Text>
    );
  },
);
