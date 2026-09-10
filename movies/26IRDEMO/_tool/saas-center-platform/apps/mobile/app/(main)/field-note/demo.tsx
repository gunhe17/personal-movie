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
import type { RecordingTimelineItem } from '@/features/field-note/useRecordingTimeline';
import type { RecordingHandlers } from '@/features/field-note/useRecordingHandlers';

/**
 * 대본 — at: 화면에 나타나는 시각(초), seconds: **회기 안의 시각**(초).
 * `seconds`는 s06-setup.sql이 넣는 전사의 실제 시각이다(0:41 · 2:17 · 3:01).
 * 화면의 경과 타이머는 이 값을 따라간다 — 안 그러면 "00:14 녹음 중인데 전사는 03:34"처럼 어긋난다.
 */
const SCRIPT: { at: number; seconds: number; text: string }[] = [
  { at: 1.6, seconds: 41, text: '…네. 근데 별로 안 해요, 딱히 할 말이 없어서.' },
  { at: 5.0, seconds: 137, text: '이런 것도 말해도 돼요?' },
  { at: 8.6, seconds: 181, text: '말하면 걱정하잖아요. 그냥 제가 참으면 되니까요.' },
  { at: 12.4, seconds: 214, text: '잠이 잘 안 와요. 한 2~3주 됐어요.' },
];

/** 첫 줄이 뜨기 조금 전부터 시작한다 — 녹음은 이미 몇 분째 돌고 있다 */
const START_SECONDS = SCRIPT[0].seconds - 6;

const mmss = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function FieldNoteDemoScreen() {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(START_SECONDS);
  const [timeline, setTimeline] = useState<RecordingTimelineItem[]>([]);
  const [memoText, setMemoText] = useState('');

  // 파형 — 제품의 WaveformBars가 매 프레임 읽는 값이다. 말하는 듯한 진폭을 흘린다.
  const meteringRef = useRef(-40);
  const recOpacity = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList<RecordingTimelineItem> | null>(null);
  const memoInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
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
  }, [recOpacity]);

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
        handleStop: noop,
        handleStopSheetClose: noop,
        handleStopConfirm: noop,
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
        stopSheet: null,
        setStopSheet: () => {},
        recommendationText: null,
        showRecommendation: false,
        setShowRecommendation: () => {},
        recentMemo: null,
      }) as unknown as RecordingHandlers,
    [memoText]
  );

  return (
    <RecordingScreen
      sessionInfo="윤도현 · 개인상담 1회기"
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
