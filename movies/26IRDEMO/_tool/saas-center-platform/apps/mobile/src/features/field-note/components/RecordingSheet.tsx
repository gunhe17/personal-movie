import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  BackHandler,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import RAnimated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { LayoutChangeEvent, ListRenderItem } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { WaveformBars } from './WaveformBars';
import { RecordingConfirmModal, type RecordingConfirmModalProps } from './StopConfirmModal';
import { formatTime } from '../utils';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '../constants';
import type { RecordingTimelineItem } from '../useRecordingTimeline';
import type { TagCategory } from '../types';
import { useFieldNotePlatform } from '../platform/context';
import { StreamingText } from './StreamingText';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

// 필드노트 다크 정체성 리컬러 토큰 (라이트 시트 → 다크 포팅, lab field-note-sheet-dark 매핑)
const FND = COLORS.fieldnoteDark;
const SHEET_BG = '#1F242A'; // 시트 배경(단색)
const SHEET_BG_FADE = 'rgba(31,36,42,0)'; // #1F242A 투명 — 상단 페이드용
const SHEET_GRAD: readonly [string, string] = [SHEET_BG, SHEET_BG];
const FND_SURFACE_BTN = 'rgba(255,255,255,0.08)'; // 다크 위 버튼/칩 표면
const FND_HANDLE = 'rgba(255,255,255,0.2)';
const NEWCAP_WAVE = '#3B82F6'; // 하단 독 블루 파형 (이미지 #8 — 선명한 블루)

/** 경과 초 → HH:MM:SS (하단 독 타이머) */
function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(ss)}`;
}

/**
 * 키보드 lift 래퍼 — paddingBottom 을 키보드 높이에 프레임 동기로 키운다(인풋이 키보드에 sticky).
 * ⚠️ 반드시 Modal 안에 중첩한 KeyboardProvider 의 '자식'으로 실행돼야 한다 — RN Modal 은 별도
 *    네이티브 윈도우라 앱 루트 KeyboardProvider 가 Modal 윈도우의 키보드를 추적하지 못한다.
 *    그래서 이 훅을 Modal 안에서 호출해 Modal 윈도우 키보드를 직접 추적.
 */
function KeyboardLiftView({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height: kbHeightSV } = useReanimatedKeyboardAnimation();
  const liftStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -kbHeightSV.value - insets.bottom),
  }));
  return <RAnimated.View style={[styles.flex1, liftStyle]}>{children}</RAnimated.View>;
}

/**
 * '실시간 기록' pill — 누름 피드백 포함.
 */
function TranscriptPill({ onPress }: { onPress: () => void }) {
  const { animatedStyle, pressHandlers } = usePressScale();
  return (
    <AnimatedPressable
      {...pressHandlers}
      onPress={onPress}
      style={[styles.transcriptPillWrap, styles.transcriptPill, animatedStyle]}
    >
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: FND.text }}
      >
        실시간 기록
      </Typography>
      <Ionicons name="chevron-up" size={s(14)} color={FND.text} />
    </AnimatedPressable>
  );
}

type AiGuideState = 'idle' | 'loading' | 'result' | 'error';

/**
 * AI 상담 가이드 — pill ↔ 확장 카드 morph.
 *
 * 상태:
 * - idle:    우측 정렬된 작은 pill 버튼 (그라디언트 fill, 흰색 텍스트)
 * - loading: 풀 너비 카드 + 스피너 + "분석하고 있어요"
 * - result:  풀 너비 카드 + 추천 본문 + 닫기(chevron-up)
 *
 * 배경 morph:
 * - idle:    LinearGradient 가 pill 전체를 채움 (보더 없음)
 * - expanded: 흰 배경 + SVG hollow 그라디언트 보더
 * - 두 레이어를 FadeIn/FadeOut 으로 cross-fade 시켜 자연스럽게 전환
 *
 * 애니메이션:
 * - 외곽 컨테이너: `LinearTransition` 타이밍 + ease-out 베지어로 자연스러운 morph
 * - idle ↔ expanded 컨텐츠 / 배경: 동일 duration 으로 cross-fade
 */
function AiGuideMorph({
  onRequest,
  isReady,
}: {
  onRequest: () => Promise<string>;
  /** 가이드 요청 가능 여부 — 전사 또는 메모/태그가 하나라도 있을 때 true */
  isReady: boolean;
}) {
  const [state, setState] = useState<AiGuideState>('idle');
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { animatedStyle: pressStyle, pressHandlers } = usePressScale();

  // ===== 활성/비활성 마이크로 인터랙션 =====
  // readyProgress: 0(비활성) → 1(활성 정착) → 1.15(활성화 순간 bounce, 잠시 후 1로 settle)
  // sparklePulse:  활성화 순간 sparkle 아이콘이 1 → 1.5 → 1 로 부풀어 오름
  // shakeX:        비활성 상태에서 클릭 시 좌우로 흔들려 "지금은 안 돼요" 표시
  const readyProgress = useSharedValue(isReady ? 1 : 0);
  const sparklePulse = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const wasReadyRef = useRef(isReady);
  // 비활성 클릭 시 toast 안내 — 같은 비활성 세션에서 한 번만 노출 (스팸 방지).
  // isReady 가 true 로 전환되면 다음 비활성 사이클 위해 reset.
  const toastShownRef = useRef(false);
  const { notify: showToast } = useFieldNotePlatform();

  useEffect(() => {
    if (!wasReadyRef.current && isReady) {
      // 비활성 → 활성: spring bounce + sparkle pulse 시퀀스
      readyProgress.value = withSequence(
        withTiming(1.15, {
          duration: 340,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }),
        withTiming(1, {
          duration: 240,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      );
      sparklePulse.value = withSequence(
        withTiming(1.5, {
          duration: 200,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        }),
        withTiming(1, {
          duration: 280,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      );
    } else if (wasReadyRef.current && !isReady) {
      // 활성 → 비활성 (무음 청크 등 드문 케이스)
      readyProgress.value = withTiming(0, { duration: 220 });
    }
    wasReadyRef.current = isReady;
    // 활성화되면 toast shown flag reset — 다음 비활성 사이클(드물지만) 위해
    if (isReady) {
      toastShownRef.current = false;
    }
  }, [isReady, readyProgress, sparklePulse]);

  // 비활성 클릭 시 호출 — 좌우 shake 로 비활성 상태 인지시킴.
  // 추가로 같은 비활성 세션 첫 클릭에만 toast 로 명시적 안내.
  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 80 }),
      withTiming(-3, { duration: 70 }),
      withTiming(0, { duration: 60 }),
    );
    if (!toastShownRef.current) {
      toastShownRef.current = true;
      showToast({
        type: 'info',
        message: '대화가 시작되면 AI 상담 가이드를 받을 수 있어요',
        durationMs: 3500,
      });
    }
  };

  // 외곽 컨테이너 — bounce scale + opacity 페이드 + shake 합성.
  // press 효과는 활성 상태에서만 내부 wrapper 에 별도 적용 (transform 충돌 회피).
  const idleContainerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          readyProgress.value,
          [0, 1, 1.15],
          [1, 1, 1.06],
          Extrapolation.CLAMP,
        ),
      },
      { translateX: shakeX.value },
    ],
    opacity: interpolate(
      readyProgress.value,
      [0, 0.4, 1],
      [0.55, 0.85, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // 두 그라디언트 cross-fade — 비활성은 회색, 활성은 보라 브랜드 그라디언트
  const inactiveGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(readyProgress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const activeGradientStyle = useAnimatedStyle(() => ({
    opacity: interpolate(readyProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // sparkle 아이콘 단독 펄스
  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparklePulse.value }],
  }));

  // 실제 API 호출 — pill 클릭과 refresh 모두 이 함수를 거침.
  const runRequest = async () => {
    setState('loading');
    setErrorMsg(null);
    try {
      const text = await onRequest();
      setRecommendation(text);
      setState('result');
    } catch (e) {
      // 백엔드 detail 은 string 또는 {message, code, ...} 형태 (AI 크레딧/쿼터 에러).
      // 객체면 message 만 추출, 아니면 일반 Error.message 로 폴백.
      const err = e as {
        response?: { data?: { detail?: unknown } };
        message?: string;
      };
      const detail = err?.response?.data?.detail;
      let msg: string | null = null;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof (detail as { message: unknown }).message === 'string'
      ) {
        msg = (detail as { message: string }).message;
      } else if (typeof err?.message === 'string') {
        msg = err.message;
      }
      console.error('[AiGuide] recommendation failed:', msg, e);
      setErrorMsg(msg);
      setState('error');
    }
  };

  // pill 클릭 — 항상 새로 fetch (전사가 누적되는 상황에서 stale 캐시 노출 방지).
  // 비활성 상태에서 누르면 fetch 대신 shake 피드백.
  const handleAsk = () => {
    if (state !== 'idle') return;
    if (!isReady) {
      triggerShake();
      return;
    }
    runRequest();
  };

  // 결과/에러 카드 안 refresh 아이콘 — 닫지 않고 즉시 재분석.
  const handleRefresh = () => {
    if (state === 'loading') return;
    runRequest();
  };

  // 닫기 — 다음 오픈에서 깨끗한 상태로 fetch 하도록 캐시 정리.
  const handleClose = () => {
    setState('idle');
    setRecommendation(null);
    setErrorMsg(null);
  };

  const isIdle = state === 'idle';

  return (
    <RAnimated.View
      layout={LinearTransition.duration(360).easing(
        Easing.bezier(0.32, 0.72, 0.32, 1),
      )}
      style={[
        styles.aiGuideBase,
        isIdle ? styles.aiGuideIdleWrap : styles.aiGuideExpandedWrap,
        isIdle && idleContainerStyle,
      ]}
    >
      {/* 배경 레이어 — idle 일 땐 그라디언트 fill, expanded 일 땐 흰 배경 + 그라디언트 보더.
          두 레이어를 FadeIn/FadeOut 으로 cross-fade 시켜 morph 중간에 부드럽게 전환. */}
      {isIdle ? (
        <RAnimated.View
          key="bg-idle"
          entering={FadeIn.duration(220).delay(120)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        >
          {/* 비활성 그라디언트 (회색) — 활성화되면 opacity 0 으로 fade-out */}
          <RAnimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, inactiveGradientStyle]}
          >
            <LinearGradient
              colors={['#C7C9CC', '#9DA3AB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </RAnimated.View>
          {/* 활성 그라디언트 (보라 브랜드) — 활성화 시 opacity 0 → 1 cross-fade */}
          <RAnimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, activeGradientStyle]}
          >
            <LinearGradient
              colors={['#A56EFF', '#7B79FF', '#219EFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </RAnimated.View>
        </RAnimated.View>
      ) : (
        <RAnimated.View
          key="bg-expanded"
          entering={FadeIn.duration(240).delay(120)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        >
          {/* 그라디언트 보더 — padding 트릭으로 ring 처럼 보이게 함.
              외곽 LinearGradient 가 전체를 채우고, 위에 얹는 inner card 가 BORDER_WIDTH 만큼
              안쪽으로 inset 되어 가장자리에 균일한 그라디언트 ring 이 드러남.
              (SVG stroke 방식은 직선 변이 viewport clip 으로 절반만 보여 코너만 두꺼워 보이는 문제 있었음) */}
          <LinearGradient
            colors={['#A56EFF', '#7B79FF', '#219EFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* 글래스 카드 — 그라디언트 위에 1.5px inset 으로 얹어 보더 ring 을 드러냄.
              BlurView + milky tint 로 backdrop blur 글래스모르피즘 효과. */}
          <View style={styles.aiGuideInnerCard}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 55 : 90}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={[StyleSheet.absoluteFillObject, styles.aiGuideGlassTint]}
            />
          </View>
        </RAnimated.View>
      )}

      {isIdle ? (
        <RAnimated.View
          key="idle"
          entering={FadeIn.duration(220).delay(140)}
          exiting={FadeOut.duration(140)}
          // press scale 은 활성 상태에서만 — 비활성은 dim + shake 가 더 강한 신호
          style={[styles.aiGuideIdleFill, isReady && pressStyle]}
        >
          <Pressable
            {...(isReady ? pressHandlers : {})}
            onPress={handleAsk}
            style={styles.aiGuideIdleRow}
          >
            <RAnimated.View style={sparkleStyle}>
              <Ionicons name="sparkles" size={s(14)} color="#FFFFFF" />
            </RAnimated.View>
            {/* 라벨 자체를 상태별로 분기 — 비활성 시 "왜 못 누르는지" 가
                라벨만 봐도 명확. 활성/비활성 전환은 sparkle pulse + scale bounce
                마이크로 인터랙션 중에 함께 일어나 자연스럽게 묻힘. */}
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: '#FFFFFF' }}
            >
              {isReady ? 'AI 상담 가이드' : '대화 후 사용 가능'}
            </Typography>
          </Pressable>
        </RAnimated.View>
      ) : (
        <RAnimated.View
          key="expanded"
          entering={FadeIn.duration(220).delay(140)}
          exiting={FadeOut.duration(140)}
          style={styles.aiGuideExpandedInner}
        >
          <View style={styles.aiGuideHeader}>
            <Icon name="double-diamond" size={s(16)} />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: FND.accent, flex: 1 }}
            >
              AI 상담 가이드
            </Typography>
            {(state === 'result' || state === 'error') && (
              <>
                <Pressable
                  onPress={handleRefresh}
                  hitSlop={8}
                  style={styles.aiGuideHeaderBtn}
                >
                  <Ionicons
                    name="refresh"
                    size={s(18)}
                    color={FND.sub}
                  />
                </Pressable>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <Ionicons
                    name="chevron-up"
                    size={s(20)}
                    color={FND.sub}
                  />
                </Pressable>
              </>
            )}
          </View>

          {state === 'loading' && (
            <RAnimated.View
              key="loading-body"
              entering={FadeIn.duration(200).delay(60)}
              exiting={FadeOut.duration(120)}
              style={styles.aiGuideLoadingBody}
            >
              <ActivityIndicator size="small" color={FND.accent} />
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: FND.sub, marginTop: s(10) }}
              >
                대화를 바탕으로 분석하고 있어요
              </Typography>
            </RAnimated.View>
          )}

          {state === 'result' && recommendation && (
            <RAnimated.View
              key="result-body"
              entering={FadeIn.duration(220).delay(80)}
              exiting={FadeOut.duration(120)}
              style={styles.aiGuideResultBody}
            >
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: FND.text, lineHeight: s(22) }}
              >
                {recommendation}
              </Typography>
            </RAnimated.View>
          )}

          {state === 'error' && (
            <RAnimated.View
              key="error-body"
              entering={FadeIn.duration(220).delay(80)}
              exiting={FadeOut.duration(120)}
              style={styles.aiGuideResultBody}
            >
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: FND.sub, lineHeight: s(22) }}
              >
                {errorMsg ?? '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.'}
              </Typography>
            </RAnimated.View>
          )}
        </RAnimated.View>
      )}
    </RAnimated.View>
  );
}
/** 시트가 닫히는 임계 거리 (이 이상 드래그하면 minimize). 더 쉽게 닫히도록 낮춤. */
const DISMISS_THRESHOLD = 56;
/** 드래그로 닫히는 속도 임계값 (px/s). 약한 플릭에도 닫히도록 낮춤. */
const DISMISS_VELOCITY = 0.3;
/** 전사 자동 스크롤 게이트 — 바닥과 이 거리(px) 이내면 "맨 아래"로 보고 새 줄을 따라감. */
const AUTO_SCROLL_THRESHOLD = 80;

const AnimatedPressable = RAnimated.createAnimatedComponent(Pressable);

/**
 * 버튼 누름 피드백 — scale 0.96 + opacity 0.85 로 살짝 눌리는 느낌.
 * onPressIn/Out 핸들러와 animatedStyle 을 함께 반환.
 */
function usePressScale() {
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.04 }],
    opacity: 1 - progress.value * 0.15,
  }));
  const pressHandlers = {
    onPressIn: () => {
      progress.value = withTiming(1, { duration: 80 });
    },
    onPressOut: () => {
      progress.value = withTiming(0, { duration: 160 });
    },
  };
  return { animatedStyle, pressHandlers };
}

/**
 * 첫 청크 도착 전 (또는 무음 청크로 타임라인이 다시 빈 상태) 노출되는 안내.
 * - 녹음 중: lab 라이브 자막과 동일한 "[파형] 전사 중…" 인디케이터(전사 placeholder 재사용).
 * - 일시정지: "일시정지됐어요" 정적 안내.
 */
function ListeningStatusBubble({ isPaused }: { isPaused: boolean }) {
  if (isPaused) {
    return (
      <View style={statusStyles.row}>
        <View style={statusStyles.bubble}>
          <Animated.View style={[statusStyles.dot, { opacity: 0.4 }]} />
          <Text style={statusStyles.text}>일시정지됐어요</Text>
        </View>
      </View>
    );
  }
  return <TranscriptPlaceholderBubble />;
}

const statusStyles = StyleSheet.create({
  row: {
    flexDirection: 'column',
    gap: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  text: {
    fontSize: 14,
    color: FND.sub,
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});

/**
 * 전사 placeholder — 청크 업로드는 됐지만 transcript 가 아직 안 온 상태(청크·스트리밍 공통).
 * lab(field-note-record-sheet 라이브 자막)의 "전사 중…" 표현 — 미니 파형(scaleY 진동) +
 * "전사 중…" 텍스트 + 전체 opacity pulse. transcript 도착 시 실제 텍스트 bubble 로 교체됨.
 */
const TRANSCRIBING_BAR_DURATIONS = [360, 300, 420, 320, 380];

function TranscribingBar({ dur, base }: { dur: number; base: number }) {
  const v = useSharedValue(base);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: dur, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // 무한 반복
    );
  }, [v, dur]);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: v.value }] }));
  return <RAnimated.View style={[placeholderStyles.bar, barStyle]} />;
}

function TranscriptPlaceholderBubble() {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // 무한 반복
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <RAnimated.View style={[placeholderStyles.row, pulseStyle]}>
      <View style={placeholderStyles.wave}>
        {TRANSCRIBING_BAR_DURATIONS.map((dur, i) => (
          <TranscribingBar key={i} dur={dur} base={0.3 + (i % 3) * 0.18} />
        ))}
      </View>
      <Text style={placeholderStyles.label}>전사 중…</Text>
    </RAnimated.View>
  );
}

const placeholderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
    gap: 2,
  },
  bar: {
    width: 2.5,
    height: 16,
    borderRadius: 2,
    backgroundColor: FND.sub,
  },
  label: {
    fontSize: 13,
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});

/**
 * 전사 버블 1줄 — primitive props 로 메모이즈.
 * 1.5초 폴링마다 timeline 배열이 새로 만들어져도, 실제 text/상태가 바뀌지 않은
 * 행은 재렌더를 건너뛴다 (FlatList 가상화와 함께 누적 렌더 비용을 일정하게 유지).
 */
const RecordingTranscriptRow = React.memo(function RecordingTranscriptRow({
  seconds,
  text,
  chunkIndex,
  isPlaceholder,
  isSilent,
  animatedChunksRef,
}: {
  seconds: number;
  text: string;
  chunkIndex: number;
  isPlaceholder: boolean;
  isSilent?: boolean;
  animatedChunksRef: React.MutableRefObject<Set<number>>;
}) {
  return (
    <View style={styles.lineRow}>
      {/* 진행 중(스트리밍 partial, chunkIndex -1)은 아직 확정 시작시간이 없어 시간을 숨긴다.
          (확정 전 직전/0 시간이 떴다가 확정 시 실제 시간으로 바뀌는 어색함 제거) */}
      <Text style={styles.lineTime}>{chunkIndex === -1 ? '' : formatTime(seconds)}</Text>
      <View style={styles.lineBody}>
        {isPlaceholder ? (
          <TranscriptPlaceholderBubble />
        ) : isSilent ? (
          <Text style={[styles.lineText, styles.lineTextSilent]}>{text}</Text>
        ) : (
          <StreamingText
            text={text}
            chunkIndex={chunkIndex}
            animatedChunksRef={animatedChunksRef}
            textStyle={styles.lineText}
          />
        )}
      </View>
    </View>
  );
});

/** 메모/태그 1줄 — primitive props 로 메모이즈. */
const RecordingEntryRow = React.memo(function RecordingEntryRow({
  entryType,
  tagCategory,
  content,
  seconds,
}: {
  entryType: 'memo' | 'tag';
  tagCategory?: string | null;
  content: string;
  seconds: number;
}) {
  if (entryType === 'memo') {
    return (
      <View style={styles.memoRow}>
        <View style={styles.memoBubble}>
          <Text style={styles.memoTime}>{formatTime(seconds)}</Text>
          <Text style={styles.memoContent}>{content}</Text>
        </View>
      </View>
    );
  }

  const tagColor =
    TAG_CATEGORY_COLORS[tagCategory as TagCategory] || TAG_CATEGORY_COLORS.other;
  return (
    <View style={styles.bubbleRow}>
      <Text style={styles.bubbleTime}>{formatTime(seconds)}</Text>
      <View style={[styles.bubble, { backgroundColor: tagColor.bg }]}>
        <Text style={[styles.bubbleText, { color: tagColor.text }]}>
          {`#${TAG_CATEGORY_LABELS[tagCategory as TagCategory] || tagCategory} ${content}`}
        </Text>
      </View>
    </View>
  );
});

/** 녹음 대상 컨텍스트 — 어떤 상담(회기)/검사의 녹음인지 좌상단 표기용. */
export interface RecordingContext {
  client: string;
  sub: string | null;
  kind: 'counseling' | 'assessment';
}

export interface RecordingSheetProps {
  visible: boolean;
  /** 녹음 대상(회기/검사) — 좌상단 표기. 미연결이면 null. */
  context?: RecordingContext | null;
  isRecording: boolean;
  isPaused: boolean;
  timerFormatted: string;
  /** 경과 시간(초) — 첫 청크 카운트다운용 */
  elapsedSeconds: number;
  /** useRecorder.meteringRef — WaveformBars가 직접 구독 */
  meteringRef: React.MutableRefObject<number>;
  /** REC 점 깜빡임 opacity */
  recOpacity: Animated.Value;
  /** 실시간 전사용 타임라인 */
  recordingTimeline: RecordingTimelineItem[];
  recordingScrollRef: React.RefObject<FlatList<RecordingTimelineItem> | null>;
  // Memo input
  memoText: string;
  setMemoText: (v: string) => void;
  onAddMemo: () => void;
  // AI 상담 가이드 — recommendation 텍스트를 반환 (실패 시 throw)
  onRequestAiGuide: () => Promise<string>;
  /** 가이드 요청 가능 여부 — 전사 또는 메모/태그 하나라도 있을 때 true */
  aiGuideReady: boolean;
  // Controls
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMinimize: () => void;
  /** 상단 '취소' — 녹음 폐기(삭제) 확인 요청 */
  onRequestCancel: () => void;
  // 종료/취소 확인 다이얼로그 — iOS 에선 RecordingSheet 의 Modal 안에 overlay 로 렌더 (Modal-on-Modal 회피)
  confirmModal: RecordingConfirmModalProps;
}

export function RecordingSheet({
  visible,
  context,
  isRecording,
  isPaused,
  timerFormatted,
  elapsedSeconds,
  meteringRef,
  recOpacity,
  recordingTimeline,
  recordingScrollRef,
  memoText,
  setMemoText,
  onAddMemo,
  onRequestAiGuide,
  aiGuideReady,
  onPause,
  onResume,
  onStop,
  onMinimize,
  onRequestCancel,
  confirmModal,
}: RecordingSheetProps) {
  const insets = useSafeAreaInsets();
  const { ToastHost } = useFieldNotePlatform();
  const animatedChunksRef = useRef<Set<number>>(new Set());

  const keyExtractor = useCallback(
    (item: RecordingTimelineItem) =>
      item.kind === 'transcript' ? `t-${item.chunkIndex}` : item.entry.id,
    [],
  );

  const renderTimelineItem = useCallback<ListRenderItem<RecordingTimelineItem>>(
    ({ item }) => {
      if (item.kind === 'transcript') {
        return (
          <RecordingTranscriptRow
            seconds={item.seconds}
            text={item.text}
            chunkIndex={item.chunkIndex}
            isPlaceholder={item.isPlaceholder}
            isSilent={item.isSilent}
            animatedChunksRef={animatedChunksRef}
          />
        );
      }
      return (
        <RecordingEntryRow
          entryType={item.entry.entry_type}
          tagCategory={item.entry.tag_category}
          content={item.entry.content}
          seconds={item.entry.timestamp_seconds}
        />
      );
    },
    [],
  );

  const [mounted, setMounted] = useState(false);

  // 메모 입력 높이 — onContentSizeChange 측정값을 라인 단위로 round 하여 미세 jitter 제거
  const [memoInputHeight, setMemoInputHeight] = useState(s(46));
  // 하단 독 메모 morph — true면 컨트롤 행이 메모 입력 행으로 바뀜(파형·타이머는 유지)
  const [memoMode, setMemoMode] = useState(false);

  // 전송 후 memoText 가 비면 입력창 높이를 한 줄로 즉시 리셋.
  // (onContentSizeChange 가 빈 value 전환에서 항상 발화한다는 보장이 없어 명시적으로 처리.)
  useEffect(() => {
    if (memoText.length === 0 && memoInputHeight !== s(46)) {
      setMemoInputHeight(s(46));
    }
  }, [memoText, memoInputHeight]);

  // ===== compact 모드 토글 =====
  // - 진입 시 기본은 compact 모드 — 실시간 기록(전사)이 바로 보임.
  // - 흰박스(상단 바) 탭 → expanded 모드(큰 타이머 중앙 정렬)
  // - 첫 전사 청크 도착 시 자동 compact 진입은 이미 compact로 시작하므로 무력화.
  const initialIsCompact = true;
  const compactProgress = useSharedValue(initialIsCompact ? 1 : 0);
  const [isCompact, setIsCompact] = useState(initialIsCompact);
  const autoEnteredRef = useRef(initialIsCompact);
  // dismissArea의 실제 높이 — translateY 산출용
  const [areaHeight, setAreaHeight] = useState(0);
  // centered 요소들 자연 높이 — 흰 박스 expanded 높이로 사용
  const [contentHeight, setContentHeight] = useState(0);

  const handleAreaLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== areaHeight) setAreaHeight(h);
  };

  const handleContentLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // 첫 측정 한 번만 캡처 (compact 진입 후엔 클립으로 인해 onLayout 재호출돼도 무시)
    if (h > 0 && contentHeight === 0) setContentHeight(h);
  };

  const hasFirstTranscript = useMemo(
    () =>
      recordingTimeline.some(
        (item) => item.kind === 'transcript' && item.text !== '전사 중...',
      ),
    [recordingTimeline],
  );

  // 첫 전사 도착 시 자동 compact 진입 (세션당 한 번만)
  useEffect(() => {
    if (hasFirstTranscript && !autoEnteredRef.current && contentHeight > 0) {
      autoEnteredRef.current = true;
      setIsCompact(true);
    }
  }, [hasFirstTranscript, contentHeight]);

  // isCompact 변화 → 모프 애니메이션 트리거
  useEffect(() => {
    if (contentHeight === 0 || areaHeight === 0) return;
    compactProgress.value = withTiming(isCompact ? 1 : 0, {
      duration: isCompact ? 680 : 520,
      // ease-out-quart — 시작은 빠르게, 끝부분에서 깊게 감속하여 묵직하게 settle
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isCompact, contentHeight, areaHeight, compactProgress]);

  // shadow/elevation 은 compact 정착 후에만 활성. expand 진입 시엔 즉시 비활성.
  // (Android elevation 의 보간이 그림자 잔상을 만들기 때문에 JS state 토글로 처리)
  const [shadowOn, setShadowOn] = useState(false);
  useEffect(() => {
    if (isCompact) {
      const t = setTimeout(() => setShadowOn(true), 560);
      return () => clearTimeout(t);
    }
    setShadowOn(false);
  }, [isCompact]);

  // 흰 컨테이너 — 높이 축소 + translateY로 위로 이동 + 배경 페이드 인.
  // worklet 내부에서는 JS 함수(s)를 호출할 수 없으므로 외부에서 미리 계산.
  const compactBoxHeight = s(68);
  const whiteBoxStyle = useAnimatedStyle(() => {
    const p = compactProgress.value;
    // 측정 전엔 height 미지정 (자연 높이 사용).
    // 단, 이미 compact 로 시작하는 경우(reopen 직후) 측정 전이라도 즉시 compact 형태로 잡아줌
    // → centered 가 한 프레임 노출 후 morph 되는 깜빡임 방지.
    if (contentHeight === 0 || areaHeight === 0) {
      if (p >= 0.99) {
        return {
          top: 0,
          height: compactBoxHeight,
          backgroundColor: 'rgb(255,255,255)',
        };
      }
      return { opacity: 1 };
    }
    // compact 일 때 top:0 고정 — translateY 로 처리하면 areaHeight 가 키보드 닫힘 시
    // 살짝 늦게 갱신되며 박스가 잠깐 내려갔다 올라오는 jitter 가 발생함.
    // 절대 top 으로 처리하면 p=1 일 땐 areaHeight 변화와 무관하게 0 고정.
    const expandedTop = (areaHeight - contentHeight) / 2;
    return {
      top: interpolate(p, [0, 1], [expandedTop, 0], Extrapolation.CLAMP),
      height: interpolate(
        p,
        [0, 1],
        [contentHeight, compactBoxHeight],
        Extrapolation.CLAMP,
      ),
      backgroundColor: interpolateColor(
        p,
        [0, 0.1, 1],
        ['rgba(33,29,51,0)', 'rgb(33,29,51)', 'rgb(33,29,51)'], // FND.card #211D33
      ),
    };
    // shadow/elevation 은 보간하지 않고 JS state(`shadowOn`)로 토글
  }, [contentHeight, areaHeight, compactBoxHeight]);

  // 중앙 정렬 레이아웃 — bg 가 자리잡는 동안 함께 빠르게 페이드 아웃
  const centeredInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(compactProgress.value, [0.05, 0.45], [1, 0], Extrapolation.CLAMP),
  }));

  // compact bar — shape 가 거의 정착할 때 등장
  const compactInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(compactProgress.value, [0.55, 0.95], [0, 1], Extrapolation.CLAMP),
  }));

  // 전사 리스트 — compact bar 등장 직후 부드럽게 따라옴
  const transcriptListStyle = useAnimatedStyle(() => ({
    opacity: interpolate(compactProgress.value, [0.65, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(compactProgress.value, [0.65, 1], [12, 0]) },
    ],
  }));

  /** 시트 상단 여백 — 상태바 + 약간의 시각적 숨 */
  const TOP_INSET = insets.top + s(8);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  /** 드래그로 닫혔는지 표시 — visibility useEffect가 중복 애니메이션 스킵하도록 */
  const dismissedByDragRef = useRef(false);

  // 전사 자동 스크롤 — "사용자가 맨 아래 근처에 있을 때만" 따라간다.
  // 위로 올려 이전 전사를 읽는 중엔 새 청크가 와도 끌어내리지 않음(사용자와 안 싸움).
  // onScroll 로 바닥과의 거리를 추적해 ref 갱신 → onContentSizeChange 에서 게이트.
  const isAtBottomRef = useRef(true);

  // Visibility animation (slide up/down)
  useEffect(() => {
    if (visible) {
      dismissedByDragRef.current = false;
      setMounted(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start();
    } else if (mounted) {
      if (dismissedByDragRef.current) {
        // 이미 드래그로 화면 밖까지 애니메이션됨 → 즉시 정리만
        slideAnim.setValue(SCREEN_HEIGHT);
        dragY.setValue(0);
        setMounted(false);
        dismissedByDragRef.current = false;
      } else {
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          dragY.setValue(0);
          setMounted(false);
        });
      }
    }
  }, [visible, slideAnim, dragY, mounted]);

  // Android 백 버튼 → minimize
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onMinimize();
      return true;
    });
    return () => sub.remove();
  }, [visible, onMinimize]);

  // 드래그 다운 제스처 공통 동작 — grant/move/release/terminate.
  // 핸들 responder 와 흰박스 responder 가 동일한 dismiss 로직을 공유한다.
  const dragHandlers = useRef({
    onGrant: () => {
      dragY.stopAnimation();
    },
    onMove: (_: unknown, g: { dy: number }) => {
      if (g.dy > 0) dragY.setValue(g.dy);
    },
    onRelease: (_: unknown, g: { dy: number; vy: number }) => {
      if (g.dy > DISMISS_THRESHOLD || g.vy > DISMISS_VELOCITY) {
        // 드래그로 dismiss — dragY를 화면 밖까지 보내고 onMinimize 호출.
        // dragY는 리셋하지 않음 → visibility useEffect가 dismissedByDragRef
        // 를 보고 중복 애니메이션 스킵하면서 정리한다.
        Animated.timing(dragY, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          dismissedByDragRef.current = true;
          onMinimize();
        });
      } else {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 200,
        }).start();
      }
    },
    onTerminate: () => {
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    },
  }).current;

  // 핸들 전용 — 순수 드래그 손잡이(버튼 없음)라 start 에서 즉시 잡아 확실히 끌어내려진다.
  // (move 협상에 의존하면 얇은 핸들에서 첫 드래그를 놓쳐 "안 닫힌다"가 됨)
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 2,
      onPanResponderGrant: dragHandlers.onGrant,
      onPanResponderMove: dragHandlers.onMove,
      onPanResponderRelease: dragHandlers.onRelease,
      onPanResponderTerminate: dragHandlers.onTerminate,
    }),
  ).current;

  // 흰박스(상단 바/카드) — 안쪽 일시정지/정지 버튼 탭을 막지 않도록 start 는 false,
  // 아래로 명확히 끄는 동작(dy>4, 수직 우세)일 때만 responder 를 가져가 dismiss.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && g.dy > Math.abs(g.dx),
      onPanResponderGrant: dragHandlers.onGrant,
      onPanResponderMove: dragHandlers.onMove,
      onPanResponderRelease: dragHandlers.onRelease,
      onPanResponderTerminate: dragHandlers.onTerminate,
    }),
  ).current;

  // 상단 드래그 캐처(시트 위 ~40%) 전용 — 핸들과 동일하게 start 에서 즉시 잡는다.
  // 이 영역은 흰 박스(버튼 포함)보다 아래 z-order 라 버튼 탭을 가로채지 않고,
  // move 협상(panResponder)이 전사 FlatList 위에서 첫 드래그를 놓쳐 "안 닫힘"이 되던
  // 문제를 피한다. 아래로 끌면 dismiss, 가볍게 탭/위로 끌면 spring-back.
  const topCatcherPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 2,
      onPanResponderGrant: dragHandlers.onGrant,
      onPanResponderMove: dragHandlers.onMove,
      onPanResponderRelease: dragHandlers.onRelease,
      onPanResponderTerminate: dragHandlers.onTerminate,
    }),
  ).current;

  if (!mounted) return null;

  const canSend = memoText.trim().length > 0;
  const handleSubmitMemo = () => {
    if (canSend) onAddMemo();
  };

  // bottomArea의 padding — 항상 동일한 값. 키보드 보정은 외부 RAnimated.View가 담당.
  // memoPill bottom = (sheet bottom or 키보드 top) - bottomPad → 양 상태 모두 12dp visible gap
  const bottomPad = insets.bottom + s(12);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      // 안드로이드: Modal 은 별도 윈도우라 앱의 투명 내비바 설정을 안 물려받음 → 내비바가
      // 불투명으로 되돌아 보임. navigationBarTranslucent 로 Modal 윈도우도 edge-to-edge 투명 유지.
      navigationBarTranslucent
      onRequestClose={onMinimize}
    >
      {/* Modal 은 별도 네이티브 윈도우라 앱 루트 KeyboardProvider 가 키보드를 못 추적.
          여기서 한 번 더 감싸야 Modal 윈도우 키보드가 프레임 동기로 추적됨 → 인풋이 키보드에 sticky.
          (이전엔 Android softwareKeyboardLayoutMode="resize" 의 윈도우 reflow 가 키보드보다 늦게 따라와 어색했음) */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <View style={styles.modalRoot}>
      <Animated.View
        style={[
          styles.sheet,
          {
            top: TOP_INSET,
            transform: [
              { translateY: Animated.add(slideAnim, dragY) },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={SHEET_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        >
          <KeyboardLiftView>
            {/* 드래그 핸들 영역 — 전용 pan responder(start 즉시 잡음) 부착 */}
            <View {...handlePanResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            {/* 상단: 좌측 녹음 대상(회기/검사) + 우측 취소 */}
            <View style={styles.topBar}>
              {context ? (
                <View style={styles.ctxWrap}>
                  <View
                    style={[
                      styles.ctxDot,
                      { backgroundColor: context.kind === 'assessment' ? COLORS.assessment : COLORS.counseling },
                    ]}
                  />
                  <Typography variant="body-02" weight="semibold" style={{ color: FND.text, flexShrink: 1 }} numberOfLines={1}>
                    {context.client}
                  </Typography>
                  {context.sub ? (
                    <Typography variant="label-01" style={{ color: FND.sub, flexShrink: 1 }} numberOfLines={1}>
                      {context.sub}
                    </Typography>
                  ) : null}
                </View>
              ) : (
                <View style={styles.flex1} />
              )}
              <Pressable onPress={onRequestCancel} hitSlop={10} style={styles.closeBtn}>
                <Typography variant="body-02" style={{ color: FND.sub }}>취소</Typography>
              </Pressable>
            </View>

            {/* 전사 전면 — 항상 주연 (morph 히어로 제거, 이미지 #5) */}
            <View style={styles.flex1}>
                <FlatList
                  ref={recordingScrollRef}
                  data={recordingTimeline}
                  style={styles.transcriptScroll}
                  contentContainerStyle={styles.transcriptContentNew}
                  showsVerticalScrollIndicator={false}
                  keyExtractor={keyExtractor}
                  renderItem={renderTimelineItem}
                  initialNumToRender={12}
                  windowSize={11}
                  maxToRenderPerBatch={8}
                  updateCellsBatchingPeriod={50}
                  // 타임라인이 비어있는 동안 (첫 청크 도착 전 또는 무음 청크로 잠시 비는 케이스)
                  // "잘 듣고 있어요" 카드로 사용자에게 녹음/전사 진행 상태를 안내.
                  ListHeaderComponent={
                    isRecording && recordingTimeline.length === 0 ? (
                      <ListeningStatusBubble isPaused={isPaused} />
                    ) : null
                  }
                  // 바닥 여부는 "사용자가 직접 스크롤을 끝낸 시점"에만 갱신한다.
                  // 자동 스크롤(animated:false)은 drag/momentum 이벤트를 안 내므로 게이트를 안 건드려
                  // 피드백 루프(왔다갔다·깜빡임)가 생기지 않는다.
                  onScrollEndDrag={(e) => {
                    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                    isAtBottomRef.current =
                      contentSize.height - contentOffset.y - layoutMeasurement.height <= AUTO_SCROLL_THRESHOLD;
                  }}
                  onMomentumScrollEnd={(e) => {
                    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                    isAtBottomRef.current =
                      contentSize.height - contentOffset.y - layoutMeasurement.height <= AUTO_SCROLL_THRESHOLD;
                  }}
                  // 콘텐츠가 늘어날 때(새 발화/partial) 바닥 근처면 즉시 바닥으로 스냅(animated:false).
                  // animated 스크롤을 매 partial 마다 걸면 애니메이션이 서로 끼어들어 튕긴다(깜빡임).
                  onContentSizeChange={(_w, h) => {
                    if (isAtBottomRef.current) {
                      recordingScrollRef.current?.scrollToOffset({ offset: h, animated: false });
                    }
                  }}
                />
              {/* 상단 페이드 — 위로 스크롤되는 전사가 헤더 아래로 부드럽게 사라짐 (이미지 #6) */}
              <LinearGradient
                colors={[SHEET_BG, SHEET_BG_FADE]}
                pointerEvents="none"
                style={styles.transcriptTopFade}
              />
            </View>

            {/* 하단 독 — 블루 파형 + 작은 타이머 + (컨트롤 ↔ 메모 입력 morph) */}
            <View style={styles.dock}>
              {/* 시간 아래 파란빛 (Figma Ellipse 692) — dock 기준 absolute, 경계선에 중심.
                  waveTimerArea보다 먼저 그려져 타이머는 위, 재생바(#151D25)가 아래 절반을 덮음. */}
              <Svg width={SCREEN_WIDTH} height={s(120)} pointerEvents="none" style={styles.timerGlow}>
                <Defs>
                  <RadialGradient id="timerGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor="#84E8FF" stopOpacity="0.1" />
                    <Stop offset="1" stopColor="#84E8FF" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#timerGlow)" />
              </Svg>

              {/* 파형 + 시간 — 높이 80 (pt-4 px-4 pb-3) */}
              <View style={styles.waveTimerArea}>
                <WaveformBars
                  meteringRef={meteringRef}
                  isRecording={isRecording}
                  isPaused={isPaused}
                  color={NEWCAP_WAVE}
                  height={s(28)}
                  barMaxHeight={s(28)}
                />
                <Typography variant="headline-02" weight="light" style={styles.dockTimer}>
                  {formatHMS(elapsedSeconds)}
                </Typography>
              </View>

              {/* 재생 바 — bg #151D25. layout 으로 컨트롤↔메모 전환 시 크기 변화도 부드럽게 */}
              <RAnimated.View
                style={[styles.controlsBar, { paddingBottom: bottomPad }]}
                layout={LinearTransition.duration(160)}
              >
              {memoMode ? (
                // 메모 입력 — 컨트롤 자리에 morph (뒤로 ← | 입력 | 추가 +). FadeIn/Out 으로 크로스페이드.
                <RAnimated.View
                  key="memo"
                  entering={FadeIn.duration(110)}
                  exiting={FadeOut.duration(100)}
                  style={styles.memoMorphRow}
                >
                  <Pressable
                    onPress={() => {
                      setMemoText('');
                      setMemoMode(false);
                    }}
                    hitSlop={8}
                    style={styles.memoCancelBtn}
                  >
                    <Ionicons name="arrow-back" size={s(22)} color={FND.sub} />
                  </Pressable>
                  <View style={styles.memoMorphPill}>
                    <TextInput
                      value={memoText}
                      onChangeText={setMemoText}
                      autoFocus
                      placeholder="메모 내용을 입력해주세요"
                      placeholderTextColor={FND.sub}
                      style={[styles.memoInput, { height: memoInputHeight }]}
                      multiline
                      onContentSizeChange={(e) => {
                        const h = e.nativeEvent.contentSize.height;
                        const lineH = s(26);
                        const padding = s(20);
                        const contentLines = Math.max(1, Math.ceil((h - padding) / lineH));
                        const capped = Math.min(contentLines, 4);
                        const next = capped * lineH + padding;
                        if (Math.abs(next - memoInputHeight) > 0.5) {
                          setMemoInputHeight(next);
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (canSend) {
                          onAddMemo();
                          setMemoMode(false);
                        }
                      }}
                      activeOpacity={0.85}
                      disabled={!canSend}
                      style={[styles.sendBtn, !canSend && { opacity: 0.4 }]}
                    >
                      <Ionicons name="add" size={s(18)} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </RAnimated.View>
              ) : (
                // 기본 컨트롤 — [메모 | ⏸ 재생원 | ■ 정지]
                <RAnimated.View
                  key="controls"
                  entering={FadeIn.duration(140)}
                  exiting={FadeOut.duration(90)}
                  style={styles.dockControls}
                >
                  <View style={styles.dockSideLeft}>
                    <Pressable onPress={() => setMemoMode(true)} hitSlop={12} style={styles.memoBtn}>
                      <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[200] }}>
                        메모
                      </Typography>
                    </Pressable>
                  </View>
                  <TouchableOpacity
                    onPress={isPaused ? onResume : onPause}
                    activeOpacity={0.85}
                    style={styles.dockPauseBtn}
                  >
                    <Ionicons name={isPaused ? 'play' : 'pause'} size={s(26)} color={COLORS.gray[900]} />
                  </TouchableOpacity>
                  <View style={styles.dockSideRight}>
                    <TouchableOpacity onPress={onStop} activeOpacity={0.85} style={styles.dockStopBtn}>
                      <View style={styles.dockStopInner} />
                    </TouchableOpacity>
                  </View>
                </RAnimated.View>
              )}
              </RAnimated.View>
            </View>
          </KeyboardLiftView>
        </LinearGradient>
      </Animated.View>

      {/* iOS 에서는 Modal-on-Modal 가 동작하지 않으므로 RecordingSheet 의 Modal 내부에 overlay 로 렌더.
          Android 는 RecordingHost 에서 별도 RN Modal 로 렌더 (RecordingConfirmModal 내부 분기). */}
      {Platform.OS === 'ios' && <RecordingConfirmModal {...confirmModal} />}
      {/* 글로벌 토스트 — (main)/_layout 에도 마운트되어 있지만 RN Modal 은 별도 native window 라
          그쪽 토스트는 이 Modal 뒤로 깔림. 동일 store 를 구독하는 인스턴스를 Modal 내부에도
          마운트해서 sheet 가 떠 있을 때 토스트가 위에 보이도록 처리.
          (두 인스턴스가 동시 렌더되어도 위 layer 만 시각적으로 보임 + 같은 store 라 중복 표시 없음) */}
      <ToastHost />
      </View>
      </KeyboardProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // top은 inline에서 설정 (insets.top + s(8))
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  gradient: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  handleArea: {
    paddingTop: s(14),
    paddingBottom: s(20),
    alignItems: 'center',
    // 터치 히트 영역 확장 — 드래그 잡기 쉽도록 (얇은 핸들 바깥 여백까지 grab 가능)
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: FND_HANDLE,
  },
  dismissArea: {
    flex: 1,
    position: 'relative',
  },
  // 상단 ~40% 드래그-다운 dismiss 영역 (투명). 흰 박스보다 아래 z-order 라 버튼 탭은 안 막음.
  topDragCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // ===== morph: 흰 박스 (요소 자연 높이 → 상단 68dp로 축소+이동) =====
  // 절대 위치 + animated top — compact 일 때 top:0 고정 (areaHeight 변동 무관).
  // shadow/elevation 은 whiteBoxShadow (JS state 토글) 에서 정착 후에만 적용.
  whiteBox: {
    position: 'absolute',
    left: s(12),
    right: s(12),
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'stretch',
    borderRadius: 16,
  },
  whiteBoxShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  centeredInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: s(16),
  },
  compactInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: s(68),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
  },
  compactLeft: {
    gap: s(2),
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  compactControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: s(12),
  },
  recDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: COLORS.error,
  },
  timer: {
    color: FND.text,
    fontVariant: ['tabular-nums'],
    marginBottom: s(20),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(20),
    marginBottom: s(24),
  },
  pauseBtn: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    backgroundColor: FND_SURFACE_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: FND.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stopBtn: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    backgroundColor: '#FF6466',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6466',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  stopInner: {
    width: s(20),
    height: s(20),
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  bottomArea: {
    paddingHorizontal: SPACING.md,
    gap: s(10),
  },
  transcriptPillWrap: {
    alignSelf: 'center',
    borderRadius: 100,
  },
  transcriptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: s(16),
    height: 48,
    borderRadius: 100,
    backgroundColor: FND.card,
  },
  // ===== compact 내부 요소 (흰 박스가 bg/그림자 담당) =====
  compactDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: COLORS.error,
  },
  compactWaveform: {
    flex: 1,
    height: s(28),
    overflow: 'hidden',
  },
  compactTimer: {
    color: FND.text,
    fontVariant: ['tabular-nums'],
  },
  compactPauseBtn: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    backgroundColor: FND_SURFACE_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: FND.line,
  },
  compactStopBtn: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    backgroundColor: '#FF6466',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactStopInner: {
    width: s(13),
    height: s(13),
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  // ===== 인라인 transcript 영역 (흰 박스 뒤, 박스가 줄어들면 드러남) =====
  transcriptArea: {
    position: 'absolute',
    top: s(80), // whiteBox compact 높이(68) + 12 gap
    left: 0,
    right: 0,
    bottom: 0,
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: s(12),
    // AI 가이드 pill 이 떠 있을 공간 확보: pill 높이 s(44) + bottom inset s(12) + 여백 s(16)
    paddingBottom: s(72),
    gap: s(10),
  },
  // AI 상담 가이드 floating overlay — dismissArea 의 우측 하단에 떠 있음.
  // idle 일 땐 작은 pill (alignItems: flex-end 로 우측 정렬), expanded 일 땐 풀너비 카드 (자식 width:100%).
  // bottom 은 메모 인풋과의 시각적 여백 16dp.
  aiGuideOverlay: {
    position: 'absolute',
    left: s(12),
    right: s(12),
    bottom: s(16),
    alignItems: 'flex-end',
  },
  // ===== 전사 줄 (lab 라이브 자막: 타임스탬프 + 평문) =====
  lineRow: {
    flexDirection: 'row',
    gap: s(5),
  },
  lineTime: {
    fontSize: s(11),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    width: s(54), // HH:MM:SS
    marginTop: s(3),
  },
  lineBody: {
    flex: 1,
  },
  lineText: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(21),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  lineTextSilent: {
    color: FND.sub,
    fontStyle: 'italic',
  },
  // ===== 태그 칩 row (메모/태그 entry 전용) =====
  bubbleRow: {
    flexDirection: 'column',
    gap: s(4),
  },
  bubbleTime: {
    fontSize: s(11),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    paddingLeft: s(6),
  },
  bubble: {
    backgroundColor: FND.card,
    borderRadius: 16,
    paddingHorizontal: s(14),
    paddingVertical: s(10),
    maxWidth: '92%',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  // 무음 청크 — placeholder 와 유사하지만 "최종 상태(결과 없음)" 임을 더 dim 한 표현으로.
  // 그림자 제거 + 배경 거의 투명.
  bubbleSilent: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowOpacity: 0,
    elevation: 0,
  },
  bubbleText: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(20),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  bubbleTextSilent: {
    color: FND.sub,
    fontStyle: 'italic',
  },
  // ===== 메모 카드 (라벤더, 시간 안쪽) — 채팅 메시지 느낌 =====
  memoRow: {
    width: '100%',
  },
  memoBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: 'rgba(185,139,255,0.16)',
    borderRadius: 12,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(6),
  },
  memoTime: {
    fontSize: s(12),
    color: FND.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoContent: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(20),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== AI 상담 가이드 morph (pill ↔ 확장 카드) =====
  // 외곽 = 투명 + borderRadius + overflow:hidden — morph 동안 자식 컨텐츠 오버플로 클립.
  // 배경은 isIdle 분기로 layering:
  //   - idle:     LinearGradient absoluteFill (pill 전체를 그라디언트로 채움)
  //   - expanded: LinearGradient absoluteFill (보더 ring) + inner card (BlurView + milky tint, 1.5px inset)
  // overflow:hidden 으로 iOS shadow 가 클립되므로 깊이감은 inner card 가 그라디언트 위에 살짝
  // 떠 보이는 layering 으로 대체.
  aiGuideBase: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
  },
  // 글래스 카드 — 그라디언트 보더 위에 BORDER_WIDTH(1.5) 만큼 안쪽으로 inset.
  // borderRadius 는 외곽(16) - inset(1.5) = 14.5 로 동심원 곡률 일치.
  aiGuideInnerCard: {
    position: 'absolute',
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 14.5,
    overflow: 'hidden',
  },
  // 글래스 위에 얹는 milky white tint — blur 만으로는 너무 투명하여 가독성 보강.
  aiGuideGlassTint: {
    backgroundColor: 'rgba(20, 18, 32, 0.72)',
  },
  aiGuideIdleWrap: {
    height: s(44),
    // width 미지정 → 내용 크기 (intrinsic)
  },
  aiGuideExpandedWrap: {
    width: '100%',
    paddingHorizontal: s(16),
    paddingVertical: s(14),
  },
  // entering/exiting 컨테이너 — 부모 전체를 채워서 안쪽 Pressable 이 hit area 풀 사이즈 가짐.
  aiGuideIdleFill: {
    flex: 1,
  },
  aiGuideIdleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    paddingHorizontal: s(14),
  },
  aiGuideExpandedInner: {
    width: '100%',
  },
  aiGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  // 헤더 우측 액션 아이콘 — refresh 와 close 사이 약간의 여백.
  aiGuideHeaderBtn: {
    marginRight: s(4),
  },
  aiGuideLoadingBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(20),
  },
  aiGuideResultBody: {
    marginTop: s(10),
  },
  memoPill: {
    flexDirection: 'row',
    alignItems: 'flex-end', // multiline 시 send 버튼은 항상 하단 고정
    minHeight: 56,
    paddingLeft: s(18),
    paddingRight: s(8),
    paddingVertical: s(8),
    backgroundColor: FND.card,
    // 단일 라인일 땐 pill, 여러 줄일 땐 둥근 사각형 처럼 보이는 28px 라운드
    borderRadius: 28,
    borderWidth: 1,
    borderColor: FND.line,
  },
  memoInput: {
    flex: 1,
    fontSize: s(16), // body-01-reading-regular
    lineHeight: s(26),
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    padding: 0,
    // 텍스트 영역 vertical breathing — 단일 라인 기준 높이 = 10+26+10 = 46
    paddingTop: s(10),
    paddingBottom: s(10),
    marginRight: s(8),
    // height 는 상위 컴포넌트에서 onContentSizeChange 로 라인 단위로 round 하여 inline 주입.
  },
  sendBtn: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    backgroundColor: '#2566DD', // primary-600 (지정값) — 파란 + 버튼
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ===== [신규 자막] 레이아웃 (이미지 #5) =====
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(8),
    paddingHorizontal: s(20),
    paddingBottom: s(4),
  },
  ctxWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  ctxDot: {
    width: s(7),
    height: s(7),
    borderRadius: s(4),
  },
  closeBtn: {
    paddingVertical: s(4),
  },
  transcriptContentNew: {
    paddingHorizontal: s(16),
    // 상단 페이드 높이만큼 내려 시작 → 첫 줄이 가만히 있을 땐 안 가리고, 스크롤 시에만 페이드.
    paddingTop: s(48),
    paddingBottom: s(12),
    gap: s(10),
  },
  dock: {
    marginTop: s(8), // 전사(텍스트) 영역과 파형·시간 컨테이너 사이 간격
  },
  waveTimerArea: {
    height: s(80),
    paddingTop: s(16), // pt-4
    paddingHorizontal: s(16), // px-4
    paddingBottom: s(12), // pb-3
    justifyContent: 'center',
    gap: s(6),
  },
  // 재생 바 — 다크 패널(#151D25). 글로우 아래 절반을 덮어 "바 뒤에 가린" 느낌.
  controlsBar: {
    backgroundColor: '#151D25',
    paddingHorizontal: s(16),
    paddingTop: s(12),
    // paddingBottom 은 인라인(bottomPad = safe area)
  },
  // 시간 아래 파란 글로우(SVG radial) — dock 기준 absolute, 세로 중심을 영역 하단(재생 바 경계)에.
  // 위 절반은 시간 쪽, 아래 절반은 재생 바 패널이 덮음. 사방 soft fade라 사각형 느낌 없음.
  timerGlow: {
    position: 'absolute',
    left: 0, // dock 전체폭(패딩 없음) → 화면 전체폭 가운데
    top: s(20), // 경계선(waveTimerArea 하단 ≈80) - height120/2(60)
  },
  dockTimer: {
    color: FND.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  transcriptTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: s(44),
  },
  dockControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  dockSideRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memoBtn: {
    paddingVertical: s(6),
    paddingRight: s(8),
  },
  dockPauseBtn: {
    width: s(54),
    height: s(54),
    borderRadius: s(27),
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  dockStopBtn: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: FND.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockStopInner: {
    width: s(12),
    height: s(12),
    borderRadius: 1.2,
    backgroundColor: COLORS.white,
  },
  memoMorphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  memoCancelBtn: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoMorphPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: s(52),
    paddingLeft: s(18),
    paddingRight: s(8),
    paddingVertical: s(3),
    backgroundColor: COLORS.gray[800],
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.gray[700],
  },
});
