/**
 * 공용 Input — 피그마 Input 셋(287:2001 · atomic 168:17) 구현.
 *
 * Label(14/16 Medium) + 인풋(h52 r12 px14 · 16/20 Regular) + 하단 안내문구(14/20 + 알림 아이콘).
 * 상태: default → active(포커스, 액센트 테두리) · error(danger) · correct(info) · disabled.
 * active·filled는 포커스/값에서 자동 파생. 안내 아이콘은 피그마 export 벡터(원형 !) 색만 변주.
 * 테두리 액센트는 피그마 시안(블루) 기준 — 그린/블루 확정 시 button.primary와 함께 교체.
 */
import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export type InputStatus = 'default' | 'error' | 'correct';

interface LabeledInputProps extends TextInputProps {
  label?: string;
  /** 하단 안내/오류 문구 — status에 따라 중립·빨강·파랑 */
  helperText?: string;
  /** error = danger 테두리·문구 / correct = info 문구 (테두리는 기본) */
  status?: InputStatus;
  /** 인풋 우측 20px 아이콘 슬롯 */
  rightIcon?: React.ReactNode;
}

/** 피그마 안내문구 알림 아이콘(원형 !) — 상태색만 변주 */
function AlertCircle({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 14C3.1402 14 0 10.8598 0 6.99996C0 3.14016 3.1402 0 7 0C10.8598 0 14 3.14016 14 6.99996C14 10.8598 10.8598 14 7 14ZM7 1.27273C3.84194 1.27273 1.27273 3.84194 1.27273 6.99996C1.27273 10.158 3.84194 12.7273 7 12.7273C10.1581 12.7273 12.7273 10.158 12.7273 6.99996C12.7273 3.84194 10.158 1.27273 7 1.27273Z"
        fill={color}
      />
      <Path
        d="M6.99992 11.0303C6.53216 11.0303 6.15161 10.6495 6.15161 10.1814C6.15161 9.71378 6.53216 9.33332 6.99992 9.33332C7.46769 9.33332 7.84824 9.71378 7.84824 10.1814C7.84824 10.6495 7.46769 11.0303 6.99992 11.0303Z"
        fill={color}
      />
      <Path
        d="M6.99999 8.06061C6.64855 8.06061 6.36363 7.77569 6.36363 7.42425V3.60607C6.36363 3.25462 6.64855 2.9697 6.99999 2.9697C7.35144 2.9697 7.63636 3.25462 7.63636 3.60607V7.42425C7.63636 7.77569 7.35144 8.06061 6.99999 8.06061Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * 필드 라벨 — 시안 Title(287:2266) 14/16 Medium · text/title/subtle.
 * 14/16은 variant에 없는 컨트롤 전용 타이트 행간이라 여기 안에만 둔다(§2 예외).
 * 인풋이 없는 필드(성별 선택 등)도 화면 코드에 스펙을 베끼지 말고 이걸 쓴다.
 */
export function FieldLabel({ label }: { label: string }) {
  return (
    <Typography
      weight="medium"
      className="mb-2"
      style={{ fontSize: s(14), lineHeight: s(16), color: COLORS.text.title.subtle }}
    >
      {label}
    </Typography>
  );
}

const BORDER_ACTIVE = COLORS.blue[400];

/** 보간 스톱 — 0 rest · 1 focus · 2 error (Toggle과 같은 색 보간 규약) */
const BORDER_STOPS = [COLORS.border.default, BORDER_ACTIVE, COLORS.status.danger];
const BORDER_DURATION = 160;

export function LabeledInput({
  label,
  helperText,
  status = 'default',
  rightIcon,
  style,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: LabeledInputProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;

  const borderStop = status === 'error' ? 2 : focused ? 1 : 0;
  const borderProgress = useDerivedValue(
    () => withTiming(borderStop, { duration: BORDER_DURATION }),
    [borderStop],
  );
  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(borderProgress.value, [0, 1, 2], BORDER_STOPS),
  }));

  const helperColor =
    status === 'error'
      ? COLORS.status.danger
      : status === 'correct'
        ? COLORS.status.info
        : COLORS.text.caption.default;

  return (
    <View>
      {label ? <FieldLabel label={label} /> : null}
      <Animated.View
        style={[
          {
            // Animated.View는 NativeWind className 매핑을 보장하지 않아 레이아웃도 style로 준다
            flexDirection: 'row',
            alignItems: 'center',
            height: 52,
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 14,
            backgroundColor: disabled ? COLORS.bg['surface-sunken'] : COLORS.surface,
          },
          disabled ? { borderColor: COLORS.border.subtle } : animatedBorder,
        ]}
      >
        <TextInput
          placeholderTextColor={COLORS.text.placeholder}
          editable={editable}
          className="flex-1"
          style={[
            {
              fontFamily: 'Pretendard-Regular',
              fontSize: s(16),
              lineHeight: s(20),
              letterSpacing: -0.41,
              color: disabled ? COLORS.gray[500] : COLORS.text.body.strong,
              paddingVertical: 0,
            },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon ? (
          <View className="ml-1" style={{ width: 20, height: 20 }}>
            {rightIcon}
          </View>
        ) : null}
      </Animated.View>
      {helperText ? (
        <View
          className="flex-row items-center"
          style={{ marginTop: status === 'error' ? 4 : 8, columnGap: 2 }}
        >
          {status !== 'default' ? (
            <View className="items-center justify-center" style={{ width: 20, height: 20 }}>
              <AlertCircle color={helperColor} />
            </View>
          ) : null}
          <Typography
            weight="regular"
            style={{ fontSize: s(14), lineHeight: s(20), color: helperColor }}
          >
            {helperText}
          </Typography>
        </View>
      ) : null}
    </View>
  );
}
