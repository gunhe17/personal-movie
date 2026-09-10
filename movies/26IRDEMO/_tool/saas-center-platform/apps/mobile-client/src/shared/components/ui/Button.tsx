/**
 * 공용 Button — 피그마 Button 컴포넌트 셋(내담자용 앱 · node 55:491) 구현.
 *
 * variant 7종 = solid(primary·secondary·assistive·white·billing) + outline(outline·danger)
 * size 4종   = sm(36) · md(40) · lg(44) · xl(52)
 * state      = default · pressed · disabled (hover는 RN에 없음)
 *
 * 색은 tokens.js `button/*` 시맨틱 토큰(피그마 변수 미러)만 사용한다.
 */
import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'assistive'
  | 'white'
  | 'billing'
  | 'outline'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = 액센트 (화면당 1개 수준으로 절제) */
  variant?: ButtonVariant;
  /** sm 36 / md 40 / lg 44 / xl 52 — 풀폭 CTA 기본 xl */
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** 라벨 왼쪽 아이콘 (gap 6) */
  icon?: React.ReactNode;
  /**
   * 시각 박스 최소 폭 — 시안이 버튼 폭을 고정한 경우(로그인 120 등) 짧은 라벨이
   * 내용폭으로 쪼그라드는 걸 막는다. 라벨이 더 길면 내용폭을 따른다.
   */
  minWidth?: number;
  style?: ViewStyle;
  className?: string;
}

interface VariantColors {
  bg: string;
  bgPressed: string;
  bgDisabled: string;
  text: string;
  textPressed?: string;
  textDisabled: string;
  border?: string;
  borderPressed?: string;
  borderDisabled?: string;
}

const VARIANTS = COLORS.button as Record<ButtonVariant, VariantColors>;

const SIZES: Record<
  ButtonSize,
  { height: number; paddingX: number; radius: number; fontSize: number; lineHeight: number }
> = {
  sm: { height: 36, paddingX: 12, radius: 8, fontSize: 13, lineHeight: 16 },
  md: { height: 40, paddingX: 14, radius: 10, fontSize: 14, lineHeight: 16 },
  lg: { height: 44, paddingX: 16, radius: 10, fontSize: 14, lineHeight: 16 },
  xl: { height: 52, paddingX: 24, radius: 12, fontSize: 15, lineHeight: 18 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'xl',
  disabled = false,
  loading = false,
  icon,
  minWidth,
  style,
  className = '',
}: ButtonProps) {
  const inactive = disabled || loading;
  const colors = VARIANTS[variant];
  const dims = SIZES[size];

  const labelColor = (pressed: boolean) =>
    disabled
      ? colors.textDisabled
      : pressed
        ? (colors.textPressed ?? colors.text)
        : colors.text;

  // 배경·높이·padding·borderRadius는 내부 View(정적 inline)에 둔다. Pressable의 style
  // 함수(`({pressed}) => ({배경…})`)에 넣으면 안드로이드에서 유실된다(mobile-client.md §5).
  // Pressable은 래퍼(외부 className/style·press 상태)만 맡고, 시각 박스는 내부 View가 그린다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      className={className || undefined}
      style={style}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: dims.height,
            paddingHorizontal: dims.paddingX,
            ...(minWidth !== undefined && { minWidth: s(minWidth) }),
            borderRadius: dims.radius,
            backgroundColor: disabled
              ? colors.bgDisabled
              : pressed
                ? colors.bgPressed
                : colors.bg,
            ...(colors.border && {
              borderWidth: 1,
              borderColor: disabled
                ? colors.borderDisabled
                : pressed
                  ? (colors.borderPressed ?? colors.border)
                  : colors.border,
            }),
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={labelColor(pressed)} />
          ) : (
            <>
              {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
              <Typography
                weight="medium"
                style={{
                  fontSize: s(dims.fontSize),
                  lineHeight: s(dims.lineHeight),
                  color: labelColor(pressed),
                }}
              >
                {label}
              </Typography>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}
