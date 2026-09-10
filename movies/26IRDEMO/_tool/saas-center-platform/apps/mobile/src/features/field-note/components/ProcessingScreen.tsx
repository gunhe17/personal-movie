import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import { useDarkNavBarWhileMounted } from '../useFieldNoteNavBar';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import { PROCESSING_STEP_LABELS } from '../constants';
import type { ProcessingStatus, ProcessingStep } from '../types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProcessingScreenProps {
  sessionInfo: string;
  processingStatus: ProcessingStatus;
  processingStep: string | null;
  isQuickMode: boolean;
  onBack: () => void;
  onCompletionAnimationDone?: () => void;
}

const SPINNER_SIZE = s(72);
const STROKE_WIDTH = 3.5;
const RADIUS = (SPINNER_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SPINNER_COLOR = COLORS.fieldnote;

const EASING_DEFAULT = Easing.bezier(0.4, 0, 0.2, 1);
const EASING_ENTER = Easing.bezier(0, 0, 0.2, 1);
const EASING_EXIT = Easing.bezier(0.4, 0, 1, 1);
const EASING_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);
const EASING_INOUT = Easing.bezier(0.42, 0, 0.58, 1);

type StepName = Exclude<ProcessingStep, null>;
// 종료(분석) 파이프라인은 전사(+보정)까지만 자동 실행된다.
// AI 분석(summarizing)·상담일지 초안(generating_note)은 파이프라인 미포함(상세에서 온디맨드)
// 이라 진행 스텝에서 제외 — 넣어두면 영원히 '대기'로 남아 카운트가 끝까지 안 찼다.
const STEPS: StepName[] = ['transcribing', 'refining'];

// 필드노트 다크 토큰 (스텝퍼 전용 — lab field-note-processing-steps 매핑)
const FN = COLORS.fieldnoteDark;

// 스텝퍼 표시용 — 깔끔한 라벨('중' 없는) + 한 줄 설명 + 아이콘.
// (PROCESSING_STEP_LABELS 는 '~ 중' 형태라 상태 칩과 중복돼 스텝퍼에선 별도 사용)
const STEP_SHORT_LABEL: Record<StepName, string> = {
  transcribing: '음성 전사',
  refining: 'AI 보정',
  summarizing: '요약 생성',
  generating_note: '상담일지 초안',
};
const STEP_DESC: Record<StepName, string> = {
  transcribing: '말한 내용을 텍스트로',
  refining: '오타·끊김 정리',
  summarizing: '핵심만 추려서',
  generating_note: '회기 일지 작성',
};
const STEP_ICON: Record<StepName, React.ComponentProps<typeof Ionicons>['name']> = {
  transcribing: 'document-text-outline',
  refining: 'sparkles-outline',
  summarizing: 'list-outline',
  generating_note: 'create-outline',
};

function getStepState(step: StepName, currentStep: string | null): 'completed' | 'active' | 'pending' {
  if (!currentStep) return 'pending';
  const ci = STEPS.indexOf(currentStep as StepName);
  const si = STEPS.indexOf(step);
  if (ci < 0 || si < 0) return 'pending';
  return si < ci ? 'completed' : si === ci ? 'active' : 'pending';
}

export function ProcessingScreen({
  processingStatus,
  processingStep,
  onBack,
  onCompletionAnimationDone,
}: ProcessingScreenProps) {
  useDarkNavBarWhileMounted();
  const isCompleted = processingStatus === 'completed';
  const completionTriggered = useRef(false);
  const prevStepRef = useRef<string | null>(null);

  // --- Spinner shared values ---
  const rotation = useSharedValue(0);
  const arcFraction = useSharedValue(0.77);
  const trackOpacity = useSharedValue(1);

  // --- Icon shared values ---
  const iconScale = useSharedValue(1);
  const diamondOpacity = useSharedValue(1);
  const checkOpacity = useSharedValue(0);

  // --- Text cross-fade ---
  const titleOpacity = useSharedValue(1);
  const completedTitleOpacity = useSharedValue(0);

  // --- Screen exit ---
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);

  // --- Container scale (success pulse) ---
  const containerScale = useSharedValue(1);

  // --- Start spinning ---
  useEffect(() => {
    if (isCompleted) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: 1400, easing: EASING_DEFAULT }),
      -1,
      false,
    );
    arcFraction.value = withRepeat(
      withTiming(0.82, { duration: 2800, easing: EASING_INOUT }),
      -1,
      true,
    );
    iconScale.value = withRepeat(
      withTiming(1.06, { duration: 1800, easing: EASING_INOUT }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(arcFraction);
      cancelAnimation(iconScale);
    };
  }, [isCompleted]);

  // --- Step change pulse ---
  useEffect(() => {
    if (!processingStep || processingStep === prevStepRef.current) return;
    prevStepRef.current = processingStep;
    iconScale.value = withSequence(
      withTiming(1.12, { duration: 150, easing: EASING_SPRING }),
      withTiming(1.0, { duration: 300, easing: EASING_DEFAULT }),
    );
  }, [processingStep]);

  // --- Completion animation sequence ---
  useEffect(() => {
    if (!isCompleted || completionTriggered.current) return;
    completionTriggered.current = true;

    // Phase 1: Arc completion (0-500ms)
    cancelAnimation(rotation);
    cancelAnimation(arcFraction);
    cancelAnimation(iconScale);

    arcFraction.value = withTiming(1.0, { duration: 500, easing: EASING_ENTER });
    rotation.value = withTiming(360, { duration: 500, easing: EASING_DEFAULT });
    trackOpacity.value = withTiming(0, { duration: 300 });

    // Phase 2: Check morph (500-900ms)
    diamondOpacity.value = withDelay(500,
      withTiming(0, { duration: 200, easing: EASING_EXIT }),
    );
    checkOpacity.value = withDelay(600,
      withTiming(1, { duration: 200, easing: EASING_ENTER }),
    );
    containerScale.value = withDelay(500,
      withSequence(
        withTiming(1.10, { duration: 200, easing: EASING_SPRING }),
        withTiming(1.0, { duration: 300, easing: EASING_DEFAULT }),
      ),
    );
    iconScale.value = withDelay(500, withTiming(1.0, { duration: 100 }));

    // Phase 3: Text cross-fade (500-800ms)
    titleOpacity.value = withDelay(500,
      withTiming(0, { duration: 150, easing: EASING_EXIT }),
    );
    completedTitleOpacity.value = withDelay(650,
      withTiming(1, { duration: 200, easing: EASING_ENTER }),
    );

    // Phase 4: Screen fade-out (1200-1600ms)
    const triggerDone = () => onCompletionAnimationDone?.();
    screenOpacity.value = withDelay(1200,
      withTiming(0, { duration: 400, easing: EASING_EXIT }, (finished) => {
        if (finished) runOnJS(triggerDone)();
      }),
    );
    screenScale.value = withDelay(1200,
      withTiming(0.97, { duration: 400, easing: EASING_EXIT }),
    );
  }, [isCompleted]);

  // --- Animated props for SVG ---
  const spinnerAnimatedProps = useAnimatedProps(() => {
    const visible = CIRCUMFERENCE * arcFraction.value;
    const gap = CIRCUMFERENCE - visible;
    return {
      strokeDasharray: [visible, gap],
    };
  });

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const trackAnimatedProps = useAnimatedProps(() => ({
    opacity: trackOpacity.value * 0.12,
  }));

  const iconBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const diamondStyle = useAnimatedStyle(() => ({
    opacity: diamondOpacity.value,
    position: 'absolute' as const,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    position: 'absolute' as const,
  }));

  const containerScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
  }));

  const processingTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    position: 'absolute' as const,
  }));

  const completedTitleStyle = useAnimatedStyle(() => ({
    opacity: completedTitleOpacity.value,
    position: 'absolute' as const,
  }));

  const screenExitStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  const currentStepLabel = processingStep
    ? PROCESSING_STEP_LABELS[processingStep] ?? null
    : null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[DK.surface, DK.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.safe, screenExitStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onBack}
              style={styles.headerBtn}
              activeOpacity={0.6}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={DK.textSec} />
            </TouchableOpacity>
          </View>

          <View style={styles.center}>
            {/* Spinner */}
            <Animated.View style={[styles.spinnerContainer, containerScaleStyle]}>
              {/* Background track */}
              <Svg
                width={SPINNER_SIZE}
                height={SPINNER_SIZE}
                viewBox={`0 0 ${SPINNER_SIZE} ${SPINNER_SIZE}`}
                style={StyleSheet.absoluteFill}
              >
                <AnimatedCircle
                  cx={SPINNER_SIZE / 2}
                  cy={SPINNER_SIZE / 2}
                  r={RADIUS}
                  stroke={SPINNER_COLOR}
                  strokeWidth={2}
                  fill="none"
                  animatedProps={trackAnimatedProps}
                />
              </Svg>

              {/* Rotating arc */}
              <Animated.View style={[StyleSheet.absoluteFill, styles.spinnerCenter, rotationStyle]}>
                <Svg
                  width={SPINNER_SIZE}
                  height={SPINNER_SIZE}
                  viewBox={`0 0 ${SPINNER_SIZE} ${SPINNER_SIZE}`}
                >
                  <AnimatedCircle
                    cx={SPINNER_SIZE / 2}
                    cy={SPINNER_SIZE / 2}
                    r={RADIUS}
                    stroke={SPINNER_COLOR}
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    fill="none"
                    animatedProps={spinnerAnimatedProps}
                  />
                </Svg>
              </Animated.View>

              {/* Center icon (breathing + morph) */}
              <Animated.View style={[styles.spinnerCenter, iconBreathStyle]}>
                <Animated.View style={diamondStyle}>
                  <Icon name="double-diamond" size={28} color={SPINNER_COLOR} />
                </Animated.View>
                <Animated.View style={checkStyle}>
                  <Ionicons name="checkmark" size={s(28)} color={SPINNER_COLOR} />
                </Animated.View>
              </Animated.View>
            </Animated.View>

            {/* Title (cross-fade) */}
            <View style={styles.titleWrap}>
              <Animated.Text style={[styles.title, processingTitleStyle]}>
                녹음을 정리하고 있어요
              </Animated.Text>
              <Animated.Text style={[styles.title, completedTitleStyle]}>
                정리가 완료되었어요
              </Animated.Text>
            </View>

            {/* Subtitle */}
            <View style={styles.subtitleWrap}>
              <Animated.Text style={[styles.subtitle, processingTitleStyle]}>
                {/* 요약·화자분리는 온디맨드 — 종료 후엔 전사 정리·저장만 한다 */}
                {currentStepLabel ?? '전사 내용을 정리해 저장할게요'}
              </Animated.Text>
              <Animated.Text style={[styles.subtitle, completedTitleStyle]}>
                잠시 후 결과를 확인하세요
              </Animated.Text>
            </View>

            {/* Step indicator — 연결선 스텝퍼 (완료 체크·채운 선 / 진행 펄스·카드 강조 / 대기 흐림) */}
            <ProcessingStepper currentStep={processingStep} isCompleted={isCompleted} />

            {/* Hint */}
            <Animated.Text style={[styles.hint, isCompleted && { opacity: 0 }]}>
              다른 화면에서 작업하셔도 분석은 계속돼요
            </Animated.Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/* ─── 연결선 스텝퍼 (lab field-note-processing-steps 포팅) ─── */

function ProcessingStepper({
  currentStep,
  isCompleted,
}: {
  currentStep: string | null;
  isCompleted: boolean;
}) {
  // 진행 인덱스 — 완료면 전부 끝난 것으로. N/4 진행도와 채운 선 판단에 사용.
  const ci = currentStep ? STEPS.indexOf(currentStep as StepName) : -1;
  const completedCount = isCompleted ? STEPS.length : ci < 0 ? 0 : ci;

  return (
    <View style={styles.stepperWrap}>
      {/* 전체 진행도 */}
      <View style={styles.stepperHeader}>
        <Text style={styles.stepperHeaderLabel}>분석 진행</Text>
        <Text style={styles.stepperHeaderCount}>
          {completedCount} / {STEPS.length}
        </Text>
      </View>

      {STEPS.map((step, i) => {
        const state = isCompleted ? 'completed' : getStepState(step, currentStep);
        const isLast = i === STEPS.length - 1;
        // 위 단계가 완료면 노드 사이 선을 accent 로 채움.
        const lineFilled = isCompleted || (ci >= 0 && i < ci);
        return (
          <View key={step} style={styles.stepperRow}>
            {/* 레일 — 노드 + 연결선 */}
            <View style={styles.stepperRail}>
              <View style={styles.stepperNode}>
                {state === 'completed' ? (
                  <Animated.View
                    entering={ZoomIn.springify().damping(11).stiffness(180)}
                    style={styles.stepperNodeDone}
                  >
                    <Ionicons name="checkmark" size={s(14)} color={COLORS.white} />
                  </Animated.View>
                ) : state === 'active' ? (
                  <RadiatingDot size={24} />
                ) : (
                  <View style={styles.stepperNodePending} />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.stepperLine,
                    { backgroundColor: lineFilled ? FN.accent : FN.line },
                  ]}
                />
              )}
            </View>

            {/* 내용 — active 면 accent 카드로 강조 */}
            <View style={[styles.stepperContent, { paddingBottom: isLast ? 0 : s(14) }]}>
              <View style={[styles.stepperCard, state === 'active' && styles.stepperCardActive]}>
                <View style={styles.stepperCardHead}>
                  <Ionicons
                    name={STEP_ICON[step]}
                    size={s(15)}
                    color={state === 'pending' ? FN.sub : FN.accent}
                  />
                  <Text
                    style={[
                      styles.stepperLabel,
                      {
                        color: state === 'pending' ? FN.sub : FN.text,
                        fontWeight: state === 'active' ? '600' : '500',
                      },
                    ]}
                  >
                    {STEP_SHORT_LABEL[step]}
                  </Text>
                  <View style={styles.stepperStatusWrap}>
                    {state === 'completed' ? (
                      <Text style={[styles.stepperStatus, { color: COLORS.palette.green }]}>완료</Text>
                    ) : state === 'active' ? (
                      <Animated.View entering={FadeIn}>
                        <Text style={[styles.stepperStatus, { color: FN.accent }]}>진행 중</Text>
                      </Animated.View>
                    ) : (
                      <Text style={[styles.stepperStatus, { color: FN.sub }]}>대기</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.stepperDesc}>{STEP_DESC[step]}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** 라디에이팅 펄스 — 바깥 링이 퍼지며 사라지고, 안쪽 코어는 은은히 숨쉼 (active 노드). */
function RadiatingDot({ size = 24 }: { size?: number }) {
  const ring = useSharedValue(0);
  const core = useSharedValue(0);
  useEffect(() => {
    ring.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.ease) }), -1, false);
    core.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(ring);
      cancelAnimation(core);
    };
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + ring.value * 0.95 }],
    opacity: 0.45 * (1 - ring.value),
  }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + core.value * 0.2 }] }));
  return (
    <View style={{ width: s(size), height: s(size), alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: FN.accent },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          { width: s(size - 10), height: s(size - 10), borderRadius: s(size), backgroundColor: FN.accent },
          coreStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    height: s(48),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
  },
  headerBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: -s(48),
  },
  spinnerContainer: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(20),
  },
  spinnerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    height: s(26),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(8),
  },
  title: {
    fontSize: s(18),
    fontWeight: '700',
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  subtitleWrap: {
    height: s(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(24),
  },
  subtitle: {
    fontSize: s(13),
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    lineHeight: s(18),
  },
  // ─── 연결선 스텝퍼 ───
  stepperWrap: {
    alignSelf: 'stretch',
    marginBottom: s(16),
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(14),
  },
  stepperHeaderLabel: {
    fontSize: s(13),
    fontWeight: '600',
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  stepperHeaderCount: {
    fontSize: s(12),
    fontWeight: '500',
    color: FN.accent,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    fontVariant: ['tabular-nums'],
  },
  stepperRow: {
    flexDirection: 'row',
    gap: s(12),
  },
  stepperRail: {
    alignItems: 'center',
    width: s(24),
  },
  stepperNode: {
    width: s(24),
    height: s(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperNodeDone: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    backgroundColor: FN.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperNodePending: {
    width: s(20),
    height: s(20),
    borderRadius: s(10),
    borderWidth: 2,
    borderColor: FN.line,
  },
  stepperLine: {
    flex: 1,
    width: 2,
    marginVertical: s(2),
    minHeight: s(20),
  },
  stepperContent: {
    flex: 1,
  },
  stepperCard: {
    borderRadius: s(12),
    paddingVertical: s(1),
  },
  stepperCardActive: {
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    backgroundColor: 'rgba(185,139,255,0.12)',
  },
  stepperCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
  },
  stepperLabel: {
    fontSize: s(15),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  stepperStatusWrap: {
    marginLeft: 'auto',
  },
  stepperStatus: {
    fontSize: s(11),
    fontWeight: '500',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  stepperDesc: {
    fontSize: s(11),
    color: FN.sub,
    marginTop: s(3),
    marginLeft: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  hint: {
    fontSize: s(12),
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    lineHeight: s(16),
    marginTop: s(16),
  },
});
