import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 시그니처 시안 — A(눈치 있는 동반자 FAB) + B(회기 카드 컬렉션).
 *
 * 직관·필요·재미 3요소를 한 덩어리로:
 *  - 직관: 회기 끝나면 FAB 가 스스로 떠 "한마디?" 권유, 이미 그 회기에 연결됨
 *  - 필요: 녹음이 '회기 카드'로 남아 내담자 여정/일지 초안으로 이어짐
 *  - 재미: 매번 그날의 '결(기운)'이 색·스탬프로 남아 수집·여정이 됨
 *
 * 탭 — [현재] 평범한 목록(대조군) / [회기 카드] 여정 덱 / [눈치 FAB] 동반자 권유.
 * 모두 mock. 외부 API/실데이터 연동 없음.
 */

// ───────── Mood(결) 설계 — 상담사가 확정하는 주관 태그, AI 는 제안만 ─────────
type MoodKey = 'clear' | 'calm' | 'cloudy' | 'storm';
const MOODS: Record<
  MoodKey,
  { label: string; solid: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  clear: { label: '맑음', solid: COLORS.palette.yellow, bg: COLORS.paletteBg.yellow, icon: 'sunny' },
  calm: { label: '잔잔', solid: COLORS.palette.mint, bg: COLORS.paletteBg.mint, icon: 'partly-sunny' },
  cloudy: { label: '흐림', solid: COLORS.palette.blue, bg: COLORS.paletteBg.blue, icon: 'cloud' },
  storm: { label: '소나기', solid: COLORS.palette.coral, bg: COLORS.paletteBg.coral, icon: 'rainy' },
};

interface Note {
  id: string;
  date: string; // 짧은 표기
  dateFull: string;
  mood: MoodKey;
  dur: string;
  summary: string;
  keywords: string[];
  hasDraft: boolean; // 일지 초안 생성됨
}

// 김민준 — 위기에서 안정으로 가는 5회기 아크 (소나기 → 맑음)
const CLIENT = '김민준';
const PROGRAM = '놀이치료-개인';
const NOTES: Note[] = [
  {
    id: '1',
    date: '4/24',
    dateFull: '4월 24일 (수)',
    mood: 'storm',
    dur: '3분 41초',
    summary: '등원 거부가 심해졌다는 호소. 분리불안이 핵심으로 보임.',
    keywords: ['분리불안', '등원거부', '울음'],
    hasDraft: true,
  },
  {
    id: '2',
    date: '5/1',
    dateFull: '5월 1일 (수)',
    mood: 'cloudy',
    dur: '2분 58초',
    summary: '엄마와 떨어질 때 여전히 긴장. 놀이 안에서 조금 머무름.',
    keywords: ['긴장', '탐색시작'],
    hasDraft: true,
  },
  {
    id: '3',
    date: '5/8',
    dateFull: '5월 8일 (수)',
    mood: 'calm',
    dur: '4분 12초',
    summary: '오늘 처음으로 먼저 모래상자로 다가옴. 작은 전환점.',
    keywords: ['자발성', '모래놀이', '전환점'],
    hasDraft: true,
  },
  {
    id: '4',
    date: '5/15',
    dateFull: '5월 15일 (수)',
    mood: 'calm',
    dur: '3분 06초',
    summary: '분리 순간의 울음이 짧아짐. 보호자도 변화 체감.',
    keywords: ['안정화', '보호자협력'],
    hasDraft: false,
  },
  {
    id: '5',
    date: '5/22',
    dateFull: '5월 22일 (수)',
    mood: 'clear',
    dur: '2분 30초',
    summary: '웃으며 입장. 다음 회기 종결 논의 시작해도 좋겠음.',
    keywords: ['밝아짐', '종결논의'],
    hasDraft: false,
  },
];

type Tab = 'release' | 'cards' | 'current';
const TABS: { key: Tab; label: string }[] = [
  { key: 'release', label: '놓아주기' },
  { key: 'cards', label: '회기 카드' },
  { key: 'current', label: '현재' },
];

export default function FieldNoteSignatureLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('release');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              필드노트 시그니처
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 탭 */}
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={{
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? 'semibold' : 'regular'}
                    style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}
                  >
                    {t.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {tab === 'current' && <CurrentTab />}
      {tab === 'cards' && <CardsTab />}
      {tab === 'release' && <ReleaseTab />}
    </View>
  );
}

// ─────────────────────────── 현재 (대조군) ───────────────────────────
function CurrentTab() {
  return (
    <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
      <Typography variant="body-03" className="text-gray-500" style={{ marginBottom: s(12) }}>
        지금의 목록 — 날짜 · 요약 · 상태 뱃지. 정보는 충실하지만 “이 앱만의 것”은 약함.
      </Typography>
      {[...NOTES].reverse().map((n) => (
        <View key={n.id} className="mb-2.5 rounded-lg bg-surface px-4 py-3.5">
          <View className="flex-row items-center justify-between">
            <Typography variant="label-01" className="text-gray-500">
              {n.dateFull} · {n.dur}
            </Typography>
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="sparkles" size={s(12)} color={COLORS.fieldnote} />
              <Typography variant="label-02" weight="medium" style={{ color: COLORS.fieldnote }}>
                AI 요약
              </Typography>
            </View>
          </View>
          <Typography variant="body-01" weight="semibold" className="mt-1.5 text-gray-900">
            {CLIENT}
          </Typography>
          <Typography variant="body-03" className="mt-1 text-gray-500" numberOfLines={2}>
            {n.summary}
          </Typography>
        </View>
      ))}
    </ScrollView>
  );
}

// ─────────────────────────── 회기 카드 (B) ───────────────────────────
function MoodSpine({ notes }: { notes: Note[] }) {
  return (
    <View className="mb-4 rounded-lg bg-surface px-4 py-3.5">
      <View className="mb-2.5 flex-row items-center justify-between">
        <Typography variant="label-01" weight="semibold" className="text-gray-600">
          {CLIENT}님의 결 — 5회기 흐름
        </Typography>
        <Typography variant="label-02" className="text-gray-400">
          소나기 → 맑음
        </Typography>
      </View>
      <View className="flex-row items-center justify-between">
        {notes.map((n, i) => {
          const m = MOODS[n.mood];
          return (
            <View key={n.id} className="flex-1 items-center">
              <View className="w-full flex-row items-center">
                {/* 연결선(왼쪽) */}
                <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : COLORS.gray[200] }} />
                <View
                  style={{
                    width: s(18),
                    height: s(18),
                    borderRadius: s(9),
                    backgroundColor: m.solid,
                  }}
                />
                <View style={{ flex: 1, height: 2, backgroundColor: i === notes.length - 1 ? 'transparent' : COLORS.gray[200] }} />
              </View>
              <Typography variant="caption-01" className="mt-1 text-gray-400">
                {n.date}
              </Typography>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SessionCard({ note }: { note: Note }) {
  const m = MOODS[note.mood];
  return (
    <View className="mb-3 flex-row overflow-hidden rounded-lg bg-surface">
      {/* 좌측 결 accent */}
      <View style={{ width: s(4), backgroundColor: m.solid }} />
      <View style={{ flex: 1, paddingHorizontal: s(16), paddingVertical: s(14) }}>
        {/* 상단: 날짜 · 시간 · 결 스탬프 */}
        <View className="flex-row items-center justify-between">
          <Typography variant="label-01" className="text-gray-500">
            {note.dateFull} · {note.dur}
          </Typography>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(4),
              backgroundColor: m.bg,
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              borderRadius: s(999),
            }}
          >
            <Ionicons name={m.icon} size={s(13)} color={m.solid} />
            <Typography variant="label-02" weight="semibold" style={{ color: m.solid }}>
              {m.label}
            </Typography>
          </View>
        </View>

        {/* 한 줄 요약 */}
        <Typography variant="body-02-reading" className="mt-2 text-gray-900">
          {note.summary}
        </Typography>

        {/* 키워드 스탬프 */}
        <View className="mt-2.5 flex-row flex-wrap" style={{ gap: s(6) }}>
          {note.keywords.map((k) => (
            <View
              key={k}
              style={{
                backgroundColor: COLORS.gray[50],
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(6),
              }}
            >
              <Typography variant="label-02" weight="medium" className="text-gray-600">
                #{k}
              </Typography>
            </View>
          ))}
        </View>

        {/* footer: 일지 초안 연결 (C 의 씨앗) */}
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: s(4) }}>
            <Ionicons
              name={note.hasDraft ? 'document-text' : 'mic-outline'}
              size={s(13)}
              color={note.hasDraft ? COLORS.fieldnote : COLORS.gray[400]}
            />
            <Typography variant="label-02" style={{ color: note.hasDraft ? COLORS.fieldnote : COLORS.gray[400] }}>
              {note.hasDraft ? '일지 초안 준비됨' : '녹음만 됨'}
            </Typography>
          </View>
          <View className="flex-row items-center" style={{ gap: s(2) }}>
            <Typography variant="label-01" weight="medium" style={{ color: COLORS.primary700 }}>
              일지로
            </Typography>
            <Ionicons name="arrow-forward" size={s(14)} color={COLORS.primary700} />
          </View>
        </View>
      </View>
    </View>
  );
}

function CardsTab() {
  return (
    <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
      <Typography variant="body-03" className="text-gray-500" style={{ marginBottom: s(12) }}>
        녹음 하나가 ‘회기 카드’로 남는다 — 그날의 결(색·스탬프) + 키워드 + 한 줄.
        내담자별로 쌓여 한눈에 보이는 여정이 됨.
      </Typography>

      <MoodSpine notes={NOTES} />

      {[...NOTES].reverse().map((n) => (
        <SessionCard key={n.id} note={n} />
      ))}
    </ScrollView>
  );
}

// ─────────────────────────── 막1 · 놓아주기 (A) ───────────────────────────
// 인지 흐름: 트리거(외부 단서) → 순수 스트림 덤프(구조 0) → 응결 종결(열린 고리 닫기).
type Stage = 'idle' | 'capture' | 'closing' | 'done';

/** 호흡하는 파형 — scaleY 만(네이티브 드라이버) 으로 흔들림. */
function Waveform({ active, color }: { active: boolean; color: string }) {
  const bars = useRef(Array.from({ length: 11 }, () => new Animated.Value(0.28))).current;
  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.28));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 360 + (i % 3) * 140, delay: i * 55, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 360 + (i % 3) * 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: s(56), gap: s(5) }}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{ width: s(5), height: s(48), borderRadius: s(3), backgroundColor: color, transform: [{ scaleY: b }] }}
        />
      ))}
    </View>
  );
}

function ReleaseTab() {
  const [stage, setStage] = useState<Stage>('idle');
  const breathe = useRef(new Animated.Value(0)).current;
  const condense = useRef(new Animated.Value(0)).current;

  // idle 권유 pill 호흡
  useEffect(() => {
    if (stage !== 'idle') {
      breathe.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [stage, breathe]);

  // 멈춤 → 응결 애니메이션 → done
  const stop = () => {
    setStage('closing');
    condense.setValue(0);
    Animated.timing(condense, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setStage('done');
    });
  };

  const pillScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const micOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  // 응결: 파형은 줄어들며 사라지고, 씨앗 카드가 솟아 떨어짐
  const waveScale = condense.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0.4], extrapolate: 'clamp' });
  const waveOpacity = condense.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const seedScale = condense.interpolate({ inputRange: [0.35, 1], outputRange: [0.3, 1], extrapolate: 'clamp' });
  const seedOpacity = condense.interpolate({ inputRange: [0.35, 0.7], outputRange: [0, 1], extrapolate: 'clamp' });
  const seedTranslate = condense.interpolate({ inputRange: [0.35, 1], outputRange: [s(-6), s(18)], extrapolate: 'clamp' });

  return (
    <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
      <Typography variant="body-03" className="text-gray-500" style={{ marginBottom: s(14) }}>
        가장 휘발성 높은 순간. 트리거 → 구조 0의 스트림 입력 → “담겼어요, 이제 놓아도 돼요”의
        응결 종결. 열린 고리를 닫아 안도가 보상이 되고, 그게 습관을 만든다.
      </Typography>

      {/* 무대 */}
      <View
        style={{
          minHeight: s(380),
          borderRadius: s(20),
          backgroundColor: stage === 'capture' || stage === 'closing' ? COLORS.gray[900] : COLORS.gray[50],
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          padding: s(20),
        }}
      >
        {stage === 'idle' && (
          <View style={{ alignItems: 'center', gap: s(16) }}>
            <Typography variant="body-02" className="text-gray-500" style={{ textAlign: 'center' }}>
              방금 회기가 끝났어요.{'\n'}버튼이 먼저 말을 걸어요.
            </Typography>
            <Animated.View style={{ transform: [{ scale: pillScale }] }}>
              <Pressable
                onPress={() => setStage('capture')}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: s(8),
                  height: s(48), paddingHorizontal: s(18), borderRadius: s(999),
                  backgroundColor: COLORS.fieldnote,
                  shadowColor: COLORS.fieldnote, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                }}
              >
                <Animated.View style={{ opacity: micOpacity }}>
                  <Ionicons name="mic" size={s(19)} color={COLORS.white} />
                </Animated.View>
                <Typography variant="body-02" weight="semibold" className="text-white">
                  방금 {CLIENT}님, 한마디?
                </Typography>
              </Pressable>
            </Animated.View>
            <Typography variant="caption-01" className="text-gray-400">
              누르면 이미 그 회기에 연결됨 · 선택 단계 없음
            </Typography>
          </View>
        )}

        {(stage === 'capture' || stage === 'closing') && (
          <View style={{ flex: 1, alignSelf: 'stretch', justifyContent: 'space-between' }}>
            {/* 맥락 칩 — 자동, 결정 0 */}
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(999) }}>
                <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.fieldnote }} />
                <Typography variant="label-01" weight="medium" className="text-white">
                  지금 · {CLIENT} · {PROGRAM}
                </Typography>
              </View>
            </View>

            {/* 중앙 — 오직 스트림. 필드·태그·버튼 없음 */}
            <View style={{ alignItems: 'center', gap: s(18) }}>
              <Animated.View style={{ transform: [{ scaleX: waveScale }, { scaleY: waveScale }], opacity: waveOpacity }}>
                <Waveform active={stage === 'capture'} color={COLORS.white} />
              </Animated.View>
              {stage === 'capture' && (
                <Typography variant="body-01" weight="medium" className="text-white" style={{ opacity: 0.9 }}>
                  편하게 말하세요
                </Typography>
              )}
              {/* 응결 씨앗 */}
              {stage === 'closing' && (
                <Animated.View style={{ opacity: seedOpacity, transform: [{ scale: seedScale }, { translateY: seedTranslate }] }}>
                  <View style={{ width: s(56), height: s(56), borderRadius: s(16), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="bookmark" size={s(24)} color={COLORS.white} />
                  </View>
                </Animated.View>
              )}
            </View>

            {/* 하단 — 멈춤 하나뿐 */}
            <View style={{ alignItems: 'center', height: s(64), justifyContent: 'center' }}>
              {stage === 'capture' && (
                <Pressable
                  onPress={stop}
                  style={{ width: s(64), height: s(64), borderRadius: s(32), backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: s(22), height: s(22), borderRadius: s(5), backgroundColor: COLORS.gray[900] }} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {stage === 'done' && (
          <View style={{ alignItems: 'center', gap: s(14) }}>
            <View style={{ width: s(60), height: s(60), borderRadius: s(30), backgroundColor: COLORS.paletteBg.mint, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={s(30)} color={COLORS.palette.mint} />
            </View>
            <Typography variant="headline-02" weight="semibold" className="text-gray-900" style={{ textAlign: 'center' }}>
              담겼어요.{'\n'}이제 놓아도 돼요.
            </Typography>
            <Typography variant="body-03" className="text-gray-500" style={{ textAlign: 'center' }}>
              {CLIENT}님 덱에 6번째 카드로 들어갔어요.{'\n'}식으면 흐름·다음 한 수로 다시 돌아와요.
            </Typography>
            <Pressable
              onPress={() => setStage('idle')}
              style={{ marginTop: s(4), flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: COLORS.gray[100] }}
            >
              <Ionicons name="refresh" size={s(15)} color={COLORS.gray[700]} />
              <Typography variant="body-03" weight="medium" className="text-gray-700">
                다시 보기
              </Typography>
            </Pressable>
          </View>
        )}
      </View>

      {/* 흐름 설명 */}
      <View style={{ marginTop: s(16), gap: s(8) }}>
        {[
          { n: '1', t: '트리거', d: '회기 종료를 앱이 감지 → 버튼이 먼저 권유 (구조 0)' },
          { n: '2', t: '스트림', d: '맥락만 자동, 오직 말. 필드·태그·선택 없음 — flow 안 깨짐' },
          { n: '3', t: '응결 종결', d: '멈추면 씨앗으로 응결 + “놓아도 돼요” → 열린 고리 닫힘' },
        ].map((step) => (
          <View key={step.n} className="flex-row items-start rounded-lg bg-surface px-4 py-3" style={{ gap: s(10) }}>
            <View style={{ width: s(20), height: s(20), borderRadius: s(10), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center', marginTop: s(1) }}>
              <Typography variant="label-02" weight="bold" className="text-white">
                {step.n}
              </Typography>
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body-03" weight="semibold" className="text-gray-900">
                {step.t}
              </Typography>
              <Typography variant="body-03" className="text-gray-500">
                {step.d}
              </Typography>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
