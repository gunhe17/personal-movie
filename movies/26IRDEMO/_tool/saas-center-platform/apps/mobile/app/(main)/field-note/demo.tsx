/**
 * 필드노트 녹음 — **촬영용 데모 라우트** (26IRDEMO).
 *
 * 왜 있나: 시뮬레이터에는 마이크 입력이 없어 실시간 전사가 돌지 않고, 촬영 기계에 `idb`가 없어
 * 화면 안 버튼도 못 누른다. 그래서 녹음 화면이 **움직이는 모습**을 시뮬레이터로는 찍을 수 없었다.
 *
 * 이 라우트는 제품의 `RecordingScreen`을 **그대로** 렌더하고 상태만 대본으로 흘린다.
 * 화면을 다시 그리지 않으므로 디자인·치수·색이 앱과 어긋날 수가 없다 — 그게 이 방식을 고른 이유다.
 * (s01의 목 에이전트 · s02의 목 전사와 같은 원칙: 제품 경로는 그대로 두고 **입력만 갈아 끼운다**.)
 *
 * 열기:  mindscope-dev:///field-note/demo
 * 대사:  `_scripts/s06-setup.sql`이 DB에 넣는 윤도현 1회기 전사와 같은 줄이다.
 *
 * ⚠️ 촬영용이다. 운영 빌드에 들어가면 안 되고, 이 파일 밖의 제품 코드는 한 줄도 건드리지 않는다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { RecordingScreen } from '@/features/field-note/components/RecordingScreen';
import { ProcessingScreen } from '@/features/field-note/components/ProcessingScreen';
import type { RecordingTimelineItem } from '@/features/field-note/useRecordingTimeline';
import type { RecordingHandlers } from '@/features/field-note/useRecordingHandlers';
import type { ProcessingStatus, ProcessingStep } from '@/features/field-note/types';

/**
 * 대본 — at: 화면에 나타나는 시각(초), seconds: **회기 안의 시각**(초).
 * `seconds`는 s06-setup.sql이 넣는 전사의 실제 시각이다(0:41 · 2:17 · 3:01).
 * 화면의 경과 타이머는 이 값을 따라간다 — 안 그러면 "00:14 녹음 중인데 전사는 03:34"처럼 어긋난다.
 */
const SCRIPT: { at: number; seconds: number; text: string }[] = [
  { at: 0.8, seconds: 41, text: '…네. 근데 별로 안 해요, 딱히 할 말이 없어서.' },
  { at: 2.0, seconds: 137, text: '이런 것도 말해도 돼요?' },
  { at: 3.2, seconds: 181, text: '말하면 걱정하잖아요. 그냥 제가 참으면 되니까요.' },
  { at: 4.4, seconds: 214, text: '잠이 잘 안 와요. 한 2~3주 됐어요.' },
];

/**
 * 종료 뒤 파이프라인 — `at`은 '녹음 종료'를 누른 뒤의 초.
 * **제품이 실제로 도는 단계만 쓴다**: `executor.py`의 `_PIPELINE_STEPS = [TRANSCRIBING, REFINING]`.
 * 요약·상담일지 초안은 파이프라인에 없고 상세 화면에서 온디맨드라, 여기서도 돌리지 않는다
 * (ProcessingScreen의 스텝퍼도 두 단계만 그린다 — 넣으면 영원히 '대기'로 남는다).
 */
const PIPELINE: { at: number; step: ProcessingStep }[] = [
  { at: 0.0, step: 'transcribing' },
  { at: 1.2, step: 'refining' },
];
const PIPELINE_DONE_AT = 2.6;

/** 좌상단 표기 — 시트에서 고른 그 회기(오늘 16:00 윤도현 C00003 1회기) */
const SESSION_INFO = '윤도현 · 개인상담 1회기';

/** 첫 줄이 뜨기 조금 전부터 시작한다 — 녹음은 이미 몇 분째 돌고 있다 */
const START_SECONDS = SCRIPT[0].seconds - 6;

const mmss = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function FieldNoteDemoScreen() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(START_SECONDS);
  const [timeline, setTimeline] = useState<RecordingTimelineItem[]>([]);
  const [memoText, setMemoText] = useState('');
  // 녹음 → (종료 시트) → 정리. 제품의 RecordingHost가 상태로 넘기는 그 전환을 대본으로 흘린다.
  const [phase, setPhase] = useState<'recording' | 'processing'>('recording');
  const [stopSheet, setStopSheet] = useState<'normal' | 'short' | null>(null);
  const [step, setStep] = useState<ProcessingStep>(null);
  const [status, setStatus] = useState<ProcessingStatus>('processing');

  // 파형 — 제품의 WaveformBars가 매 프레임 읽는 값이다. 말하는 듯한 진폭을 흘린다.
  const meteringRef = useRef(-40);
  const recOpacity = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<RecordingTimelineItem> | null>(null);
  const memoInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);

    // 진폭: 말–쉼이 번갈아 드는 모양. dBFS라 -60(무음) ~ -8(큰 소리) 사이를 쓴다.
    const t0 = Date.now();
    const meter = setInterval(() => {
      const t = (Date.now() - t0) / 1000;
      const speaking = Math.sin(t * 1.1) > -0.25;
      meteringRef.current = speaking ? -16 - Math.random() * 18 : -52 - Math.random() * 8;
    }, 60);

    // 녹음 배지 깜박임 — 제품이 recOpacity로 하는 그것
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(recOpacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(recOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    blink.start();

    const timeouts = SCRIPT.map((line) =>
      setTimeout(() => {
        // 타이머를 그 줄의 시각으로 맞춘다 — 전사와 경과 시간이 늘 같은 이야기를 하도록
        setElapsed(line.seconds + 2);
        setTimeline((prev) => [
          ...prev,
          {
            kind: 'transcript',
            text: line.text,
            seconds: line.seconds,
            endSeconds: line.seconds + 4,
            chunkIndex: prev.length,
            isPlaceholder: false,
          },
        ]);
      }, line.at * 1000)
    );

    return () => {
      clearInterval(timer);
      clearInterval(meter);
      blink.stop();
      timeouts.forEach(clearTimeout);
    };
  }, [recOpacity, phase]);

  // 종료 뒤 — 제품의 폴링이 processing_step을 갈아 끼우는 그 자리
  useEffect(() => {
    if (phase !== 'processing') return;
    const ts = PIPELINE.map((s) => setTimeout(() => setStep(s.step), s.at * 1000));
    const done = setTimeout(() => setStatus('completed'), PIPELINE_DONE_AT * 1000);
    return () => {
      ts.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [phase]);

  // 새 줄이 붙으면 끝으로 — 제품의 RecordingHost가 하는 것과 같다
  useEffect(() => {
    if (timeline.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [timeline.length]);

  const noop = async () => {};
  const handlers = useMemo<RecordingHandlers>(
    () =>
      ({
        handleStart: noop,
        handlePause: noop,
        handleResume: noop,
        handleStop: async () => setStopSheet('normal'),
        handleStopSheetClose: async () => setStopSheet(null),
        handleStopConfirm: async () => {
          setStopSheet(null);
          setPhase('processing');
        },
        handleStopSaveOnly: noop,
        handleStopDelete: noop,
        handleStartAdditional: noop,
        handleAddMemo: () => setMemoText(''),
        handleOpenMemo: () => {},
        handleCloseMemo: () => {},
        handleAddTag: () => {},
        handleRequestRecommendation: noop,
        memoText,
        setMemoText,
        showMemo: false,
        setShowMemo: () => {},
        memoInputRef,
        stopSheet,
        setStopSheet,
        recommendationText: null,
        showRecommendation: false,
        setShowRecommendation: () => {},
        recentMemo: null,
      }) as unknown as RecordingHandlers,
    [memoText, stopSheet]
  );

  if (phase === 'processing') {
    return (
      <ProcessingScreen
        sessionInfo={SESSION_INFO}
        processingStatus={status}
        processingStep={step}
        isQuickMode={false}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <RecordingScreen
      sessionInfo={SESSION_INFO}
      isQuickMode={false}
      isRecording
      isPaused={false}
      timerFormatted={mmss(elapsed)}
      meteringRef={meteringRef}
      recOpacity={recOpacity}
      recordingTimeline={timeline}
      recordingScrollRef={listRef}
      handlers={handlers}
      isRecommending={false}
      onBack={() => router.back()}
    />
  );
}
