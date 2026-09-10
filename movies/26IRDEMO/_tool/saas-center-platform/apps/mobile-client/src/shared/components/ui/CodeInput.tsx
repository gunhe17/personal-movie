/**
 * 초대 코드 입력 — 칸 N개(시안 1015:8454). 센터 연결·가족 합류가 같은 것을 쓴다.
 *
 * 칸은 그림이고 실제 입력은 그 위를 덮는 인풋이 받는다. 이 방식엔 실기기에서만 드러나는
 * 함정이 셋 있어 한곳에 모아 둔다 — 화면마다 복제하면 한쪽만 고쳐지고 갈라진다.
 *   1) 인풋 폭을 left/right로만 잡으면 안드로이드에서 0으로 측정돼 입력이 안 들어간다
 *      → width/height를 명시한다.
 *   2) 안 보이게 하는 건 opacity다 — color:'transparent'는 안드로이드 visible-password에서
 *      무시돼 인풋 글자가 칸 위에 겹쳐 보인다.
 *   3) 안드로이드는 ascii-capable을 무시하고 기본 IME(한글)를 띄운다 → 영숫자 필터에 전부
 *      걸려 한 글자도 안 써진다. visible-password가 한글 조합 없는 라틴 자판을 강제한다.
 */
import React, { useEffect, useRef } from "react";
import { Platform, TextInput, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AnimatedTypography } from "./AnimatedTypography";
import { Typography } from "./Typography";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";

/** 영문·숫자만. 대소문자는 그대로 둔다 — 앱이 바꾸면 서버가 발급한 코드와 어긋난다 */
const ALLOWED = /[^A-Za-z0-9]/g;

/** 시안 1015:8454 — 높이 76 · radius 12 · 칸 간격 11 */
const CELL_H = 76;
const CELL_GAP = 11;
const CELL_RADIUS = 12;

/** 글자가 들어차는 모션 — 아래에서 살짝 떠오르며 잡힌다 */
const FILL_MS = 170;
const FOCUS_MS = 150;
const FILL_RISE = 6;
const FILL_START_SCALE = 0.72;

/**
 * 틀린 코드 — 흔드는 건 "다시 보라"는 신호지, 혼내는 게 아니다.
 * 진폭을 작게(5px) 잡고 점점 줄여 멎게 한다. 문구는 아래에서 떠오르며 붙는다.
 */
const SHAKE_X = 5;
const SHAKE_STEP_MS = 55;
const ERROR_MS = 180;
const ERROR_RISE = 4;

/** 테두리 보간 스톱 — 0 기본 · 1 활성 · 2 오류 (LabeledInput과 같은 규약) */
const BORDER_STOPS = [
  COLORS.border.default,
  COLORS.border.active,
  COLORS.status.danger,
];

const KEYBOARD =
  Platform.OS === "android" ? "visible-password" : "ascii-capable";

/**
 * 칸 하나 — 글자가 들고 나는 것, 활성 테두리가 옮겨 오는 것을 UI 스레드에서 돌린다.
 * ⚠️ worklet 안에서 s()를 부르지 않는다 — 치수는 렌더 단계에서 숫자로 넘긴다.
 */
function Cell({
  char,
  active,
  error,
  height,
  radius,
}: {
  char: string;
  active: boolean;
  error: boolean;
  height: number;
  radius: number;
}) {
  const filled = char !== "";
  // 지워질 때도 글자가 남아 있어야 사라지는 모션이 보인다
  const lastCharRef = useRef(char);
  if (filled) lastCharRef.current = char;

  const fill = useDerivedValue(
    () => withTiming(filled ? 1 : 0, { duration: FILL_MS }),
    [filled],
  );
  const borderStop = error ? 2 : active ? 1 : 0;
  const border = useDerivedValue(
    () => withTiming(borderStop, { duration: FOCUS_MS }),
    [borderStop],
  );

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(border.value, [0, 1, 2], BORDER_STOPS),
  }));

  const charStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [
      { translateY: (1 - fill.value) * FILL_RISE },
      { scale: FILL_START_SCALE + fill.value * (1 - FILL_START_SCALE) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          height,
          borderRadius: radius,
          borderWidth: 1,
          backgroundColor: COLORS.surface,
        },
        boxStyle,
      ]}
    >
      <AnimatedTypography
        variant="headline-02"
        weight="semibold"
        style={[{ color: COLORS.text.body.strong }, charStyle]}
      >
        {lastCharRef.current}
      </AnimatedTypography>
    </Animated.View>
  );
}

interface CodeInputProps {
  value: string;
  onChangeText: (code: string) => void;
  /** 마지막 자리를 채웠을 때 1회 — 한 자라도 지우면 다시 열린다(같은 코드 재시도 허용) */
  onComplete?: (code: string) => void;
  /** 틀린 코드 안내 — 값이 생기면 칸이 붉어지며 한 번 흔들리고 문구가 떠오른다 */
  errorText?: string | null;
  length?: number;
  autoFocus?: boolean;
}

export function CodeInput({
  value,
  onChangeText,
  onComplete,
  errorText = null,
  length = 6,
  autoFocus = true,
}: CodeInputProps) {
  const completedRef = useRef<string | null>(null);
  const hasError = !!errorText;

  const shake = useSharedValue(0);
  const errorIn = useDerivedValue(
    () => withTiming(hasError ? 1 : 0, { duration: ERROR_MS }),
    [hasError],
  );

  // 없다가 생긴 순간에만 흔든다 — 문구가 바뀔 때마다 다시 흔들면 산만하다
  const shookRef = useRef(false);
  useEffect(() => {
    if (!hasError) {
      shookRef.current = false;
      return;
    }
    if (shookRef.current) return;
    shookRef.current = true;
    shake.value = withSequence(
      withTiming(-SHAKE_X, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_X, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_X * 0.6, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_X * 0.6, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const messageStyle = useAnimatedStyle(() => ({
    opacity: errorIn.value,
    transform: [{ translateY: (1 - errorIn.value) * ERROR_RISE }],
  }));

  const handleChange = (raw: string) => {
    const normalized = raw.replace(ALLOWED, "").slice(0, length);
    if (normalized.length < length) completedRef.current = null;
    onChangeText(normalized);
  };

  useEffect(() => {
    if (value.length !== length) return;
    if (completedRef.current === value) return;
    completedRef.current = value;
    onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const height = s(CELL_H);
  const radius = s(CELL_RADIUS);

  return (
    <View>
      <View style={{ height }}>
        <Animated.View
          style={[
            { flexDirection: "row", columnGap: s(CELL_GAP), height: "100%" },
            rowStyle,
          ]}
          pointerEvents="none"
        >
          {Array.from({ length }).map((_, index) => (
            <Cell
              key={index}
              char={value[index] ?? ""}
              active={index === Math.min(value.length, length - 1)}
              error={hasError}
              height={height}
              radius={radius}
            />
          ))}
        </Animated.View>
        <TextInput
          value={value}
          onChangeText={handleChange}
          maxLength={length}
          keyboardType={KEYBOARD}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          importantForAutofill="no"
          textContentType="oneTimeCode"
          autoFocus={autoFocus}
          caretHidden
          accessibilityLabel="초대 코드 입력"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            opacity: 0,
            padding: 0,
          }}
        />
      </View>

      {/* 자리를 늘 잡아 두지 않는다 — 문구가 생길 때만 칸 아래로 붙는다 */}
      {errorText ? (
        <Animated.View style={[{ marginTop: s(12) }, messageStyle]}>
          <Typography variant="body-03" style={{ color: COLORS.status.danger }}>
            {errorText}
          </Typography>
        </Animated.View>
      ) : null}
    </View>
  );
}
