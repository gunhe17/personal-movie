import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
} from 'react-native';
// 키보드 대응은 앱 전역 규약 — RN 기본 KeyboardAvoidingView/ScrollView 대신 이 둘을 쓴다
// (포커스된 인풋을 키보드 위로 자동 스크롤 + 안드로이드 네이티브 구동 애니메이션).
import {
  KeyboardAwareScrollView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import RAnimated, {
  Easing,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from './Typography';
import { COLORS, LAYOUT } from '@/shared/constants/theme';

/** 아래로 끌어 닫기 — 본문에선 시트 상단 이 비율 안에서 시작한 드래그만 잡는다(헤더는 전 영역) */
const DRAG_ZONE_RATIO = 0.5;
/** 이만큼(px) 또는 이 속도 이상 내리면 닫힘 (apps/mobile 시트와 동일한 검증된 값) */
const CLOSE_DISTANCE = 60;
const CLOSE_VELOCITY = 0.5;

/** 포커스된 인풋과 키보드 사이 여백 */
const KEYBOARD_GAP = 24;

const OPEN_MS = 300;
const CLOSE_MS = 240;
const SNAP_MS = 180;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** 제목 아래 보조 문구 — 시안 헤더(434:7289)의 두 번째 슬롯 */
  subtitle?: string;
  children: React.ReactNode;
  /** 제목 줄 오른쪽 슬롯 (툴팁·보조 액션) — 스크롤 영역 밖이라 잘리지 않는다 */
  titleAccessory?: React.ReactNode;
  /** 제목 타이포 — 시안이 18(title-01)인 시트가 있어 열어둔다 */
  titleVariant?: 'headline-02' | 'title-01';
  /** 안드로이드 back 전용 — 다단계 시트가 한 단계 뒤로 가려면 준다(없으면 onClose) */
  onBack?: () => void;
  /** 상단 세이프에어리어까지 채우는 전체 높이 시트 (긴 폼용) */
  fullHeight?: boolean;
  /** fullHeight 시트 상단의 세이프에어리어 아래 추가 오프셋 — 위 요소(검색바 등)를 남길 때 */
  topOffset?: number;
  /** 스크롤 밖 하단 고정 영역 (CTA 버튼 등) */
  footer?: React.ReactNode;
}

/**
 * 바텀시트 — 딤은 제자리에서 페이드, 시트만 아래에서 슬라이드.
 * (Modal animationType="slide"는 딤까지 통째로 올라와 어색하므로 reanimated로 분리)
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  titleAccessory,
  titleVariant = 'headline-02',
  onBack,
  fullHeight = false,
  topOffset = 12,
  footer,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // 키보드 높이(네이티브 구동 shared value) — 시스템 내비 영역을 포함하므로 insets.bottom을 뺀다.
  // ⚠️ 시트가 position:absolute라 부모 padding으로는 못 올린다(절대 위치 자식은 padding 무시)
  //    → 시트의 bottom 자체를 올린다. KeyboardAvoidingView가 이 시트에서 무력했던 이유.
  const keyboard = useReanimatedKeyboardAnimation();
  // 회전·키보드(adjustResize)로 창 높이가 바뀌므로 모듈 상수가 아닌 실시간 값
  const { height: winH } = useWindowDimensions();
  const slide = useSharedValue(winH);
  const fade = useSharedValue(0);
  const [mounted, setMounted] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  // 시트 위치·스크롤·닫는 중 여부는 ref로 (PanResponder 콜백이 stale 값을 보지 않도록)
  // 측정 전에도 제스처를 막지 않도록 fail-open 초기값을 둔다
  const sheetRef = useRef({ top: 0, height: winH });
  const scrollYRef = useRef(0);
  const closingRef = useRef(false);
  const dragYRef = useRef(0);
  /** 터치 다운 시점의 pageY — gestureState.y0는 grant 전엔 0이라 쓸 수 없다 */
  const startYRef = useRef(0);
  /** 스크롤 가능 여부(PanResponder 콜백용 미러) */
  const scrollableRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      scrollYRef.current = 0;
      closingRef.current = false;
      dragYRef.current = 0;
      // 열림 애니메이션은 여기서 시작하지 않는다 — Modal 마운트+무거운 내용 첫 렌더에
      // 프레임이 먹히면 보일 땐 이미 끝나 '뚝' 나타난다. 시작 상태만 고정하고 onShow에서 시작.
      fade.value = 0;
      slide.value = winH;
    } else {
      // 이미 드래그로 닫는 중이면 진행 중인 애니메이션을 재시작하지 않는다
      if (closingRef.current) return;
      closingRef.current = true;
      fade.value = withTiming(0, { duration: CLOSE_MS });
      slide.value = withTiming(
        winH,
        { duration: CLOSE_MS, easing: EASE_IN },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Modal이 실제로 표시된 뒤 한 프레임 양보하고 시작 — 레이아웃 완료 후라 프레임 드랍 없이 올라온다 */
  const startOpenAnimation = () => {
    requestAnimationFrame(() => {
      if (closingRef.current) return;
      fade.value = withTiming(1, { duration: 250 });
      slide.value = withTiming(0, { duration: OPEN_MS, easing: EASE_OUT });
    });
  };

  /** 드래그로 닫기 — 남은 거리에 비례한 시간으로 마저 내린 뒤 부모에 알린다 */
  const closeWithAnimation = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    // 이미 많이 내려온 상태면 짧게 — 고정 시간이면 끝에서 늘어지는 느낌이 난다
    const remaining = Math.max(0, winH - dragYRef.current);
    const duration = Math.max(120, Math.round((remaining / winH) * CLOSE_MS));
    fade.value = withTiming(0, { duration });
    slide.value = withTiming(
      winH,
      { duration, easing: EASE_IN },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
          runOnJS(onClose)();
        }
      },
    );
  };

  const settleBack = () => {
    dragYRef.current = 0;
    fade.value = withTiming(1, { duration: SNAP_MS });
    slide.value = withTiming(0, { duration: SNAP_MS, easing: EASE_OUT });
  };

  // PanResponder는 한 번만 생성한다 — 렌더마다 재생성하면 드래그 도중 핸들러가 교체되면서
  // 내부 gestureState(dy)가 초기화돼 "내려도 안 닫히는" 증상이 난다. 최신 값은 ref로 읽는다.
  const liveRef = useRef({
    winH,
    close: closeWithAnimation,
    settle: settleBack,
  });
  liveRef.current = { winH, close: closeWithAnimation, settle: settleBack };

  /** 드래그 공통 — 손가락 따라 이동(딤도 함께) */
  const dragMove = (dy: number) => {
    if (closingRef.current) return;
    const y = Math.max(0, dy);
    dragYRef.current = y;
    slide.value = y;
    fade.value = Math.max(
      0,
      1 - y / (sheetRef.current.height || liveRef.current.winH),
    );
  };
  const dragRelease = (dy: number, vy: number) => {
    if (dy > CLOSE_DISTANCE || vy > CLOSE_VELOCITY) liveRef.current.close();
    else liveRef.current.settle();
  };

  const dragRef = useRef({ move: dragMove, release: dragRelease });
  dragRef.current = { move: dragMove, release: dragRelease };

  // ① 헤더(핸들+제목) — 터치 다운에서 responder를 선점한다. move 협상에만 의존하면
  //    안드로이드에서 첫 드래그를 놓쳐 "안 닫힌다"가 된다(apps/mobile 동일 이슈).
  const headerPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_evt, g) => dragRef.current.move(g.dy),
        onPanResponderRelease: (_evt, g) => dragRef.current.release(g.dy, g.vy),
        onPanResponderTerminate: () => {
          if (!closingRef.current) liveRef.current.settle();
        },
      }),
    [],
  );

  // ② 본문 — 스크롤이 없으면 전 영역, 스크롤이 있으면 상단 구간의 아래 방향 드래그만.
  //    ⚠️ gestureState.x0/y0는 grant 이후에만 채워진다(협상 시점엔 0) → 터치 다운에서 직접 기록.
  const contentPan = useMemo(() => {
    const shouldGrab = (g: PanResponderGestureState) => {
      if (closingRef.current) return false;
      const { top, height } = sheetRef.current;
      const inTopZone = startYRef.current <= top + height * DRAG_ZONE_RATIO;
      return (
        inTopZone &&
        scrollYRef.current <= 4 && // 스크롤이 맨 위 근처일 때만 (아니면 위로 스크롤 우선)
        g.dy > 4 &&
        g.dy > Math.abs(g.dx)
      );
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        // responder는 가져가지 않고 터치 시작 좌표만 기록한다
        startYRef.current = evt.nativeEvent.pageY;
        return false;
      },
      // 스크롤할 내용이 없으면 본문도 터치 다운에서 선점한다 — 안드로이드에서 move 협상은
      // 첫 드래그를 놓쳐 "위쪽만 닫힌다"가 된다. 스크롤이 필요할 땐 양보하고 move 협상으로.
      onStartShouldSetPanResponder: () =>
        !scrollableRef.current && !closingRef.current,
      // 네이티브까지 막지는 않는다 — 막으면 TextInput 포커스·버튼이 죽는다
      onShouldBlockNativeResponder: () => false,
      // capture = 네이티브 ScrollView가 가로채기 전에 / bubble = capture 유실 경로 보험
      onMoveShouldSetPanResponderCapture: (_evt, g) => shouldGrab(g),
      onMoveShouldSetPanResponder: (_evt, g) => shouldGrab(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_evt, g) => dragRef.current.move(g.dy),
      onPanResponderRelease: (_evt, g) => dragRef.current.release(g.dy, g.vy),
      onPanResponderTerminate: () => {
        if (!closingRef.current) liveRef.current.settle();
      },
    });
  }, []);

  const handleSheetLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    sheetRef.current = { top: y, height };
  };
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  // 내용이 넘치지 않으면 스크롤을 꺼둔다 — 안드로이드 네이티브 ScrollView가 터치를
  // 가로채는 경쟁 자체를 없애야 본문 드래그로도 시트가 잡힌다.
  const viewportHRef = useRef(0);
  const contentHRef = useRef(0);
  const syncScrollable = () => {
    const next = contentHRef.current > viewportHRef.current + 1;
    scrollableRef.current = next;
    setScrollable((prev) => (prev === next ? prev : next));
  };
  const handleScrollLayout = (e: LayoutChangeEvent) => {
    viewportHRef.current = e.nativeEvent.layout.height;
    syncScrollable();
  };
  const handleContentSize = (_w: number, h: number) => {
    contentHRef.current = h;
    syncScrollable();
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  // 키보드가 올라온 만큼 시트 하단을 띄운다 (fullHeight면 top 고정이라 높이가 줄어
  // 내부 ScrollView가 자동으로 포커스 인풋을 스크롤할 수 있게 된다).
  //
  // ⚠️ 여기서 시트의 **크기**를 건드리면 안 된다 — 아래 layout={LinearTransition}이
  //    크기 변화를 감지해 320ms짜리 자기 애니메이션을 따로 돌린다. 키보드는 네이티브
  //    구동이라 이미 올라가 있는데 높이만 뒤늦게 한 번 더 움직이는 게 그 이유다.
  //    위치(bottom)만 바꾸면 키보드와 정확히 같은 곡선·같은 프레임으로 붙어 올라간다.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
    bottom: Math.max(0, Math.abs(keyboard.height.value) - insets.bottom),
  }));

  if (!mounted) return null;

  const body = (
    <>
      {/* 헤더(핸들+제목) 전체가 드래그 영역 — 스크롤 밖이고 인터랙션이 없어 통째로 잡아도 안전하다.
          안쪽 버튼(툴팁 ✕ 등)은 bubble 협상에서 더 깊은 쪽이 이기므로 그대로 눌린다. */}
      <View
        {...headerPan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="아래로 드래그하여 닫기"
      >
        <View
          style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 14 }}
        >
          <View className="h-1 w-9 rounded-full bg-gray-300" />
        </View>
        {title ? (
          <View className="mb-4">
            <View className="flex-row items-center">
              <Typography
                variant={titleVariant}
                weight="semibold"
                className="flex-1"
                style={{ color: COLORS.text.title.default }}
              >
                {title}
              </Typography>
              {/* 오버레이 — 제목 줄 레이아웃에 영향 없이 오른쪽에 떠 있고 아래로 넘칠 수 있다 */}
              {titleAccessory ? (
                <View
                  style={{ position: 'absolute', right: 0, top: 0, zIndex: 10 }}
                >
                  {titleAccessory}
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Typography
                variant="body-03-reading"
                className="mt-2"
                style={{ color: COLORS.text.body.default }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </View>
        ) : null}
      </View>
      {/* ⚠️ 키보드 보정은 딱 한 겹만. 시트 자체가 키보드 위로 올라가는 높이 가변 시트에서
          KeyboardAwareScrollView까지 쓰면 내부에 키보드 높이만큼 패딩이 또 붙어(이중 보정)
          내용이 부풀고 maxHeight까지 늘어난다 — 시트가 화면 밖으로 밀려 보이던 원인.
          top이 고정돼 시트 높이가 줄어드는 fullHeight에서만 내부 보정이 필요하다. */}
      {fullHeight ? (
        <KeyboardAwareScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          // 사용자 스크롤만 막는다 — 포커스 인풋으로의 자동(프로그래매틱) 스크롤은 계속 동작
          scrollEnabled={scrollable}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleScrollLayout}
          onContentSizeChange={handleContentSize}
          bottomOffset={KEYBOARD_GAP}
          style={{ flex: 1 }}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollable}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleScrollLayout}
          onContentSizeChange={handleContentSize}
          style={{ maxHeight: 480 }}
        >
          {children}
        </ScrollView>
      )}
      {footer ? <View className="pt-4">{footer}</View> : null}
    </>
  );

  return (
    // statusBar/navigationBarTranslucent — 없으면 keyboard-controller가 Modal 안에서
    // 키보드 인셋을 못 받아 시트가 키보드 위로 안 올라간다 (안드로이드 edge-to-edge).
    <Modal
      visible
      transparent
      animationType="none"
      onShow={startOpenAnimation}
      onRequestClose={onBack ?? onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <RAnimated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: COLORS.bg.overlay },
            backdropStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="닫기"
            onPress={onClose}
          />
        </RAnimated.View>
        <RAnimated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              // 전체 높이 시트는 상단 세이프에어리어 아래까지 차오른다
              ...(fullHeight ? { top: insets.top + topOffset } : null),
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              backgroundColor: COLORS.surface,
              paddingHorizontal: 16,
              paddingTop: 8,
              // 정적이어야 한다 — 키보드 상태에 따라 바꾸면 시트 높이가 변해
              // LinearTransition이 뒤늦게 한 번 더 움직인다(위 sheetStyle 주석).
              paddingBottom: Math.max(insets.bottom, LAYOUT.safeBottom),
            },
            sheetStyle,
          ]}
          // 단계 전환 등으로 시트 높이가 바뀔 때 튀지 않게 (apps/mobile 시트와 동일 곡선)
          layout={LinearTransition.duration(320).easing(
            Easing.bezier(0.32, 0.72, 0.32, 1),
          )}
          onLayout={handleSheetLayout}
          {...contentPan.panHandlers}
        >
          {body}
        </RAnimated.View>
      </View>
    </Modal>
  );
}
