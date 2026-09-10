/**
 * Typography 컴포넌트 (모바일 전용)
 *
 * 디자인 시스템(Pretendard)의 variant/weight 토큰을 실기기에 정확히 적용.
 *
 * - fontSize, lineHeight, letterSpacing은 모두 inline style로 제어
 *   → NativeWind className의 변동성 없이 값 정확히 렌더
 * - 기본적으로 `s()` 스케일 적용 (기기 폭 비례 보정)
 * - weight / color는 className 또는 사용자 className override
 *
 * @example
 *   <Typography variant="title-01" weight="semibold" className="text-gray-900">
 *     필드노트
 *   </Typography>
 *
 *   // 스케일 끄기 (필요 시)
 *   <Typography variant="body-02" scaled={false}>...
 */

import React from "react";
import { Text, type TextProps } from "react-native";
import { s } from "@/shared/utils/scale";

export type TypographyVariant =
  | "time"
  | "headline-01"
  | "headline-02"
  | "title-01"
  | "body-01"
  | "body-01-reading"
  | "body-02"
  | "body-02-reading"
  | "body-03"
  | "label-01"
  | "label-02"
  | "caption-01";

export type TypographyWeight =
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold";

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  weight?: TypographyWeight;
  className?: string;
  /** false면 고정 픽셀. 기본 true (기기 폭 비례 보정). */
  scaled?: boolean;
}

// 디자인 시스템 variant 스펙 — letterSpacing은 전체 variant 공통 -0.41px
const VARIANT_SIZE: Record<
  TypographyVariant,
  { fontSize: number; lineHeight: number }
> = {
  time: { fontSize: 48, lineHeight: 52 },
  "headline-01": { fontSize: 24, lineHeight: 36 },
  "headline-02": { fontSize: 20, lineHeight: 28 },
  "title-01": { fontSize: 18, lineHeight: 26 },
  "body-01": { fontSize: 16, lineHeight: 24 },
  "body-01-reading": { fontSize: 16, lineHeight: 26 },
  "body-02": { fontSize: 15, lineHeight: 22 },
  "body-02-reading": { fontSize: 15, lineHeight: 24 },
  "body-03": { fontSize: 14, lineHeight: 20 },
  "label-01": { fontSize: 13, lineHeight: 20 }, // v2: 18→20
  "label-02": { fontSize: 12, lineHeight: 16 },
  "caption-01": { fontSize: 11, lineHeight: 14 },
};

const LETTER_SPACING = -0.41;

// weight → Pretendard 폰트 패밀리명 (app/_layout.tsx에서 로딩)
const FONT_FAMILY: Record<TypographyWeight, string> = {
  light: "Pretendard-Light",
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semibold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
};

/**
 * 디자인 시스템 variant/weight 기반 텍스트 스타일 객체를 반환.
 *
 * `<Text>` 외 컴포넌트(TextInput 등)에서 동일한 타이포 토큰을 적용할 때 사용.
 *
 * @example
 *   <TextInput style={[getTypographyStyle('body-01-reading'), { color: COLORS.text.body.strong }]} />
 */
export function getTypographyStyle(
  variant: TypographyVariant = "body-02",
  weight: TypographyWeight = "regular",
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

export function Typography({
  variant = "body-02",
  weight = "regular",
  scaled = true,
  className = "",
  style,
  children,
  ...rest
}: TypographyProps) {
  const composed = `text-text ${className}`.trim();
  const typeStyle = getTypographyStyle(variant, weight, scaled);

  return (
    <Text className={composed} style={[typeStyle, style]} {...rest}>
      {children}
    </Text>
  );
}
