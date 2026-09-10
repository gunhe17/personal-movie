import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  PanResponder,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import RAnimated, {
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "@/shared/constants/theme";

const SCREEN_HEIGHT = Dimensions.get("window").height;
/** 풀스크린 모드에서 safe area(노치/상태바) 아래 둥근 모서리가 보이도록 둘 추가 여백 */
const FULL_HEIGHT_EXTRA_GAP = 8;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** true면 시트가 safe area 바로 아래까지 확장됨 (둥근 모서리는 노출됨) */
  fullHeight?: boolean;
  /** 시트 표면 색 (기본: surface 화이트). 필드노트 다크 등 톤 커스텀용 */
  surfaceColor?: string;
  /** 드래그 핸들 색 (기본: gray-300). 다크 표면에서 가독성 보정용 */
  handleColor?: string;
  /** 시트 좌우 패딩 (기본: SPACING.lg=20). 섹션별 px 커스텀이 필요할 때 */
  horizontalPadding?: number;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  fullHeight = false,
  surfaceColor = COLORS.surface,
  handleColor = COLORS.gray[300],
  horizontalPadding,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const slide = useSharedValue(SCREEN_HEIGHT);
  const fade = useSharedValue(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.value = withTiming(1, { duration: 250 });
      slide.value = withTiming(0, { duration: 300 });
    } else {
      fade.value = withTiming(0, { duration: 200 });
      slide.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
  }));

  // 시트의 화면상 위치/높이 (드래그 존 판정용) — onLayout 으로 갱신.
  const sheetMetrics = useRef({ top: 0, height: SCREEN_HEIGHT });
  /** 상단에서부터 드래그-투-클로즈가 동작하는 구간 비율 */
  const DRAG_ZONE_RATIO = 0.3;

  // 공통 드래그 처리 — 손가락 따라 이동 + 임계치 넘으면 닫기.
  const dragMove = (dy: number) => {
    slide.value = Math.max(0, dy);
  };
  const dragRelease = (dy: number, vy: number) => {
    if (dy > 60 || vy > 0.5) onClose();
    else slide.value = withSpring(0, { damping: 22, stiffness: 220 });
  };
  const settle = () =>
    (slide.value = withSpring(0, { damping: 22, stiffness: 220 }));

  // 핸들 영역 — 어디서든 드래그하면 닫기.
  const handlePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
        onPanResponderMove: (_, g) => dragMove(g.dy),
        onPanResponderRelease: (_, g) => dragRelease(g.dy, g.vy),
        onPanResponderTerminate: settle,
      }),
    [onClose, slide],
  );

  // 본문 상단 30% 구간 — 명확한 '아래로' 드래그일 때만 닫기.
  // (탭·가로 칩 스크롤·하단 스크롤 영역은 그대로 동작하도록 조건부로만 제스처를 가져온다)
  const contentPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          const { top, height } = sheetMetrics.current;
          const inTopZone = g.y0 <= top + height * DRAG_ZONE_RATIO;
          return inTopZone && g.dy > 8 && g.dy > Math.abs(g.dx);
        },
        onPanResponderMove: (_, g) => dragMove(g.dy),
        onPanResponderRelease: (_, g) => dragRelease(g.dy, g.vy),
        onPanResponderTerminate: settle,
      }),
    [onClose, slide],
  );

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <RAnimated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </RAnimated.View>
        <RAnimated.View
          layout={LinearTransition.duration(320).easing(
            Easing.bezier(0.32, 0.72, 0.32, 1),
          )}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            sheetMetrics.current = { top: y, height };
          }}
          style={[
            styles.sheet,
            {
              backgroundColor: surfaceColor,
              ...(horizontalPadding !== undefined
                ? { paddingHorizontal: horizontalPadding }
                : {}),
              paddingBottom: insets.bottom + SPACING.lg,
              // children 컨텐츠가 길어도 화면 밖으로 흘러내리지 않도록 cap.
              // fullHeight면 explicit height로 잠가서 children flex:1이 확정적으로 동작하게.
              ...(fullHeight
                ? {
                    top: insets.top + FULL_HEIGHT_EXTRA_GAP,
                    height: SCREEN_HEIGHT - insets.top - FULL_HEIGHT_EXTRA_GAP,
                  }
                : {
                    maxHeight:
                      SCREEN_HEIGHT - insets.top - FULL_HEIGHT_EXTRA_GAP,
                  }),
            },
            sheetStyle,
          ]}
        >
          <View
            {...handlePan.panHandlers}
            style={styles.handleArea}
            accessibilityRole="adjustable"
            accessibilityLabel="아래로 드래그하여 닫기"
          >
            <View style={[styles.handle, { backgroundColor: handleColor }]} />
          </View>
          {/* children flex 컨테이너 — 상단 30% 구간 아래로 드래그 시 닫기 */}
          <View {...contentPan.panHandlers} style={styles.contentContainer}>
            {children}
          </View>
        </RAnimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: 6, // 핸들 바 위 여백 — 기존 SPACING.lg(16) → 6
    paddingBottom: SPACING.lg,
  },
  contentContainer: {
    flex: 1,
    minHeight: 0, // 자식 ScrollView가 flex:1로 줄어들 수 있게
  },
  handleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 14,
    marginBottom: SPACING.lg - 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[300],
  },
});
