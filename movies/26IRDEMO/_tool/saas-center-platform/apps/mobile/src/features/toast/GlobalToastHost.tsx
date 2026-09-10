import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { useToastStore, type ToastType } from "./store";

const ICON: Record<ToastType, React.ComponentProps<typeof Ionicons>["name"]> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

const BG: Record<ToastType, string> = {
  success: COLORS.gray[900],
  error: COLORS.error,
  info: COLORS.gray[800],
};

/**
 * 글로벌 토스트 호스트. (main)/_layout 에 1회 마운트.
 * Queue 의 첫 항목만 표시하고, 자동 닫힘 또는 사용자 탭으로 다음 항목으로 진행.
 * onPress 가 지정된 토스트는 클릭 가능 (전체 영역). 클릭 시 onPress 실행 후 자동 닫힘.
 *
 * absolute 오버레이로 렌더(Modal 미사용) — Modal은 안드로이드에서 뒤 화면 터치/스크롤을
 * 가로채므로, box-none 오버레이로 토스트 알약만 터치를 받고 나머지는 통과시킨다.
 * (트레이드오프: 열린 BottomSheet(RN Modal) 위에는 표시되지 않음)
 */
/**
 * @param elevated 시트(Modal) 안에서 마운트하는 호스트면 true.
 *   - elevated 호스트는 마운트 동안 store 에 등록되어, 루트(기본) 호스트의 렌더를 멈춤
 *     → 시트 뒤/앞으로 토스트가 2개 보이는 중복을 막는다.
 */
export function GlobalToastHost({ elevated = false }: { elevated?: boolean }) {
  const toasts = useToastStore((state) => state.toasts);
  const hide = useToastStore((state) => state.hide);
  const elevatedHostCount = useToastStore((state) => state.elevatedHostCount);
  const registerElevatedHost = useToastStore(
    (state) => state.registerElevatedHost,
  );
  const unregisterElevatedHost = useToastStore(
    (state) => state.unregisterElevatedHost,
  );
  const insets = useSafeAreaInsets();
  const current = toasts[0];

  // elevated 호스트는 마운트 동안 등록 (언마운트 시 해제)
  useEffect(() => {
    if (!elevated) return;
    registerElevatedHost();
    return () => unregisterElevatedHost();
  }, [elevated, registerElevatedHost, unregisterElevatedHost]);

  // 기본(루트) 호스트는 elevated 호스트가 떠 있으면 렌더 중단 (중복 방지)
  const suppressed = !elevated && elevatedHostCount > 0;

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // 현재 표시 중인 토스트 id — 새 항목이 들어오면 reset
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!current) {
      currentIdRef.current = null;
      return;
    }
    if (currentIdRef.current === current.id) return;
    currentIdRef.current = current.id;

    // 등장
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    // 자동 닫힘
    const duration = current.durationMs ?? 4000;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(() => hide(current.id));
    }, duration);

    return () => clearTimeout(timer);
  }, [current, hide, opacity, translateY]);

  const clickable = !!current?.onPress;
  const handlePress = () => {
    current?.onPress?.();
    if (current) hide(current.id);
  };

  if (!current || suppressed) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { top: insets.top + s(8) }]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: BG[current.type],
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Pressable
          onPress={handlePress}
          disabled={!clickable}
          style={styles.pressable}
          android_ripple={
            clickable ? { color: "rgba(255,255,255,0.12)" } : undefined
          }
        >
          <Ionicons
            name={ICON[current.type]}
            size={s(18)}
            color={COLORS.white}
          />
          <Text style={styles.text} numberOfLines={2}>
            {current.message}
          </Text>
          {clickable && (
            <Ionicons
              name="chevron-forward"
              size={s(16)}
              color={COLORS.white}
              style={styles.chevron}
            />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    borderRadius: RADIUS.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  pressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingHorizontal: s(16),
    paddingVertical: s(14),
  },
  text: {
    flex: 1,
    fontSize: s(14),
    fontWeight: "500",
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  chevron: {
    opacity: 0.7,
  },
});
