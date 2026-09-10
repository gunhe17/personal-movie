import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RAnimated, {
  Easing,
  FadeIn,
  FadeInUp,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 녹음 전사 · 화자분리 모션 랩 (다듬기 v2).
 *
 * 모델: 녹음 중엔 전사 텍스트 O / 화자분리 X(그냥 텍스트). 분석(정지 후) 화자분리 적용.
 *
 * 이번 개선:
 *  · 애니메이션 — 파형 실제 모션(reanimated) · 도착 점 펄스 · 등장 spring.
 *  · 프로세스 — 화자분리를 '빈 화면에서 다시 그림'이 아니라 '녹음 중 보던 전사 텍스트가
 *    제자리에서 화자별로 갈라지는 morph'로. 녹음→검토 연속성.
 *  · 시트 형태 — 시트 유지 + 라이브 전사가 생겼으니 '최소화=미니바'를 1급으로. live 탭에서 토글.
 *
 * 탭 — [녹음 중 전사] 라이브 전사 + 풀시트↔미니바 / [화자분리 morph] 전사가 제자리서 갈라짐.
 * 전부 mock.
 */

const FN = COLORS.fieldnoteDark;

const LINES: { who: string; me: boolean; text: string }[] = [
  { who: '상담사', me: true, text: '오늘은 블록 놀이부터 해볼까요?' },
  { who: '민준', me: false, text: '음… 저번처럼 무너지면 어떡해요.' },
  { who: '상담사', me: true, text: '무너져도 괜찮아요. 같이 다시 쌓으면 되니까.' },
  { who: '민준', me: false, text: '그럼 큰 걸로 쌓아볼래요.' },
];

function fmt(sec: number) {
  return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
}

// ───────────────────────── 도착 점(펄스) ─────────────────────────
function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(1, { duration: 520 }), -1, true));
  }, [o, delay]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <RAnimated.View style={[{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: FN.sub }, st]} />;
}
function IncomingDots({ label }: { label: string }) {
  return (
    <RAnimated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(6) }}>
      {[0, 1, 2].map((i) => <Dot key={i} delay={i * 160} />)}
      <Typography variant="caption-01" style={{ color: FN.sub, marginLeft: s(4) }}>{label}</Typography>
    </RAnimated.View>
  );
}

function SpeakerChip({ who, me }: { who: string; me: boolean }) {
  const color = me ? FN.accent : COLORS.palette.green;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <View style={{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: color }} />
      <Typography variant="caption-01" weight="medium" style={{ color }}>{who}</Typography>
    </View>
  );
}

// ───────────────────────── 줄 도착 스트림 ─────────────────────────
function useLineStream(total: number) {
  const [n, setN] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running || n >= total) return;
    const t = setTimeout(() => setN((x) => x + 1), 850);
    return () => clearTimeout(t);
  }, [running, n, total]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const reset = () => { setN(0); setElapsed(0); setRunning(false); };
  return { n, running, setRunning, reset, elapsed, done: n >= total, incoming: running && n < total };
}

// ───────────────────────── 컨트롤 바 ─────────────────────────
function ControlBar({ running, done, playLabel, hint, onToggle, onReset }: { running: boolean; done: boolean; playLabel: string; hint: string; onToggle: () => void; onReset: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(12) }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), backgroundColor: COLORS.fieldnote, borderRadius: s(999), paddingHorizontal: s(14), paddingVertical: s(8) }}>
        <Ionicons name={running ? 'pause' : 'play'} size={s(14)} color={COLORS.white} />
        <Typography variant="label-01" weight="semibold" className="text-white">{running ? '멈춤' : done ? '다시 재생' : playLabel}</Typography>
      </Pressable>
      <Pressable onPress={onReset} hitSlop={8} style={{ width: s(36), height: s(36), borderRadius: s(18), backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="refresh" size={s(16)} color={COLORS.gray[600]} />
      </Pressable>
      <Typography variant="caption-01" className="text-gray-500" style={{ flex: 1 }}>{hint}</Typography>
    </View>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return <View style={{ height: s(540), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>{children}</View>;
}

// ───────────────────────── 차분한 호흡 인디케이터 ─────────────────────────
function BreathingPulse({ size = 76 }: { size?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [v]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.28 }], opacity: 0.22 - v.value * 0.16 }));
  return (
    <View style={{ width: s(size * 1.7), height: s(size * 1.7), alignItems: 'center', justifyContent: 'center' }}>
      <RAnimated.View style={[{ position: 'absolute', width: s(size * 1.5), height: s(size * 1.5), borderRadius: s(size), backgroundColor: FN.accent }, ring]} />
      <View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="mic" size={s(size * 0.42)} color={COLORS.white} />
      </View>
    </View>
  );
}

// ════════════════════ 탭 1: 녹음 중 (차분 / 최신 한 줄 / 펼침) ════════════════════
type LiveMode = 'calm' | 'oneline' | 'full';
const LIVE_MODES: { key: LiveMode; label: string }[] = [
  { key: 'calm', label: '차분' },
  { key: 'oneline', label: '최신 한 줄' },
  { key: 'full', label: '전사 펼침' },
];
const LIVE_CAP: Record<LiveMode, string> = {
  calm: '권장 — 회기 중엔 폰을 내려두니 화면은 차분하게. 호흡 인디케이터 + 타이머만, 전사는 조용히 기록(안 보임). 정신사납지 않음.',
  oneline: '절충 — 방금 잡힌 한 줄만 은은히 떠올랐다 사라짐(앰비언트 자막). "받아쓰고 있다"는 안심만, 피드는 없음.',
  full: '보고 싶을 때만 — 전사 전체 피드. 기본값 아님(회기 중엔 산만). 검토·확인용으로 펼침.',
};

function LiveTab() {
  const stream = useLineStream(LINES.length);
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<LiveMode>('calm');
  const ref = useRef<ScrollView>(null);
  const latest = stream.n > 0 ? LINES[stream.n - 1].text : null;

  return (
    <>
      <ControlBar
        running={stream.running}
        done={stream.done}
        playLabel="녹음 시작"
        hint={stream.done ? '끝 — 다시 재생' : '▶ 녹음 진행 · ⌄ 최소화 눌러 미니바'}
        onToggle={() => stream.setRunning((r) => !r)}
        onReset={() => { stream.reset(); setMinimized(false); }}
      />
      {/* 녹음 중 화면 결 선택 */}
      <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3), marginBottom: s(12) }}>
        {LIVE_MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Pressable key={m.key} onPress={() => setMode(m.key)} style={{ flex: 1, paddingVertical: s(7), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
              <Typography variant="label-02" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{m.label}</Typography>
            </Pressable>
          );
        })}
      </View>

      <PhoneFrame>
        {minimized ? (
          <View style={{ flex: 1, backgroundColor: FN.bg }}>
            <View style={{ height: s(44), alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>필드노트</Typography>
            </View>
            <View style={{ paddingHorizontal: s(16), gap: s(8), opacity: 0.5 }}>
              {['오늘 회기', '최근 노트'].map((t) => (
                <View key={t}>
                  <Typography variant="label-02" style={{ color: FN.sub, marginTop: s(8), marginBottom: s(6) }}>{t}</Typography>
                  <View style={{ height: s(52), borderRadius: s(14), backgroundColor: FN.card }} />
                </View>
              ))}
            </View>
            <RAnimated.View entering={SlideInDown} exiting={SlideOutDown} style={{ position: 'absolute', left: s(14), right: s(14), bottom: s(16) }}>
              <Pressable onPress={() => setMinimized(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: '#322C4A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: s(16), paddingHorizontal: s(14), paddingVertical: s(12) }}>
                <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.error }} />
                <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>녹음 중 · {fmt(stream.elapsed)}</Typography>
                <Typography variant="label-02" weight="medium" style={{ color: FN.accent, marginLeft: 'auto' }}>탭하여 열기</Typography>
              </Pressable>
            </RAnimated.View>
          </View>
        ) : (
          <RAnimated.View entering={SlideInDown} style={{ flex: 1, backgroundColor: FN.bg }}>
            {/* 핸들 + 최소화 */}
            <View style={{ height: s(40), alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line }} />
              <Pressable onPress={() => setMinimized(true)} hitSlop={8} style={{ position: 'absolute', right: s(14), top: s(8), width: s(28), height: s(28), borderRadius: s(14), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-down" size={s(20)} color={FN.sub} />
              </Pressable>
            </View>

            {mode === 'full' ? (
              // 펼침 — 전사 피드 (기본 아님)
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingHorizontal: s(18), marginBottom: s(8) }}>
                  <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.error }} />
                  <Typography variant="label-01" weight="semibold" style={{ color: FN.text }}>녹음 중 · {fmt(stream.elapsed)}</Typography>
                </View>
                <ScrollView ref={ref} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ paddingHorizontal: s(18), paddingVertical: s(6), gap: s(8) }} style={{ flex: 1 }}>
                  {stream.n === 0 && !stream.incoming && <Typography variant="body-02" style={{ color: FN.sub }}>전사가 여기 쌓여요.</Typography>}
                  {LINES.slice(0, stream.n).map((l, i) => (
                    <RAnimated.View key={i} entering={FadeInUp.springify().damping(16)} layout={LinearTransition.springify()}>
                      <Typography variant="body-02" style={{ color: FN.text, lineHeight: s(24) }}>{l.text}</Typography>
                    </RAnimated.View>
                  ))}
                  {stream.incoming && <IncomingDots label="전사 받는 중" />}
                </ScrollView>
              </>
            ) : (
              // 차분 / 최신 한 줄 — 호흡 인디케이터 중심
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(28) }}>
                <BreathingPulse size={mode === 'oneline' ? 64 : 76} />
                <Typography variant="headline-02" weight="semibold" style={{ color: FN.text, marginTop: s(16) }}>녹음 중 · {fmt(stream.elapsed)}</Typography>
                {mode === 'calm' ? (
                  <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(8), textAlign: 'center', lineHeight: s(20) }}>
                    말한 내용은 자동으로 기록되고 있어요.{'\n'}정리·화자 분리는 분석할 때 해드려요.
                  </Typography>
                ) : (
                  <View style={{ height: s(48), marginTop: s(14), alignItems: 'center', justifyContent: 'center' }}>
                    {latest ? (
                      <RAnimated.View key={stream.n} entering={FadeIn.duration(360)}>
                        <Typography variant="body-02" style={{ color: FN.sub, textAlign: 'center', lineHeight: s(22) }}>“{latest}”</Typography>
                      </RAnimated.View>
                    ) : (
                      <Typography variant="body-03" style={{ color: FN.sub }}>듣고 있어요…</Typography>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 메모 + 컨트롤 (공통) */}
            <View style={{ paddingHorizontal: s(16), marginBottom: s(8) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: FN.card, borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: s(10) }}>
                <Ionicons name="create-outline" size={s(16)} color={FN.sub} />
                <Typography variant="body-03" style={{ color: FN.sub, flex: 1 }}>메모 · 한마디 더…</Typography>
                <Ionicons name="arrow-up-circle" size={s(22)} color={FN.accent} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(16), paddingBottom: s(16) }}>
              <View style={{ width: s(50), height: s(50), borderRadius: s(25), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pause" size={s(22)} color={FN.text} />
              </View>
              <View style={{ width: s(50), height: s(50), borderRadius: s(25), backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="stop" size={s(20)} color={COLORS.white} />
              </View>
            </View>
          </RAnimated.View>
        )}
      </PhoneFrame>
      <Typography variant="body-03" className="text-gray-500" style={{ marginTop: s(14), lineHeight: s(20) }}>{LIVE_CAP[mode]}</Typography>
    </>
  );
}

// ════════════════════ 탭 2: 화자분리 morph ════════════════════
function MorphTab() {
  const [stage, setStage] = useState<'plain' | 'analyzing' | 'diarized'>('plain');
  const ref = useRef<ScrollView>(null);

  const run = () => {
    if (stage === 'diarized') { setStage('plain'); return; }
    setStage('analyzing');
    setTimeout(() => setStage('diarized'), 1100);
  };
  const diarized = stage === 'diarized';

  return (
    <>
      <ControlBar
        running={stage === 'analyzing'}
        done={diarized}
        playLabel="화자 분리"
        hint={diarized ? '화자별로 갈라짐 — 다시(plain)' : stage === 'analyzing' ? '화자 분리 중…' : '▶ 녹음 중 보던 전사가 제자리서 갈라짐'}
        onToggle={run}
        onReset={() => setStage('plain')}
      />
      <PhoneFrame>
        <View style={{ flex: 1, backgroundColor: FN.bg }}>
          <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14) }}>
            <Ionicons name="chevron-back" size={s(22)} color={FN.text} />
            <Typography variant="body-01" weight="semibold" style={{ color: FN.text, marginLeft: s(6), flex: 1 }}>김민준 · 놀이치료-개인</Typography>
            {stage === 'analyzing' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Ionicons name="people-outline" size={s(13)} color={FN.accent} />
                <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>화자 분리 중</Typography>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: diarized ? COLORS.palette.green : FN.sub }} />
                <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>{diarized ? '화자 분리됨' : '전사됨'}</Typography>
              </View>
            )}
          </View>

          <ScrollView ref={ref} contentContainerStyle={{ padding: s(16), gap: s(8) }} style={{ flex: 1 }}>
            <Typography variant="caption-01" style={{ color: FN.sub, marginBottom: s(4) }}>대화 (전사{diarized ? ' · 화자 분리' : ''})</Typography>
            {LINES.map((l, i) => (
              <View key={i} style={{ width: '100%' }}>
                {diarized && (
                  <RAnimated.View entering={FadeIn.duration(320)} style={{ alignItems: l.me ? 'flex-end' : 'flex-start', marginBottom: s(2) }}>
                    <SpeakerChip who={l.who} me={l.me} />
                  </RAnimated.View>
                )}
                {/* 같은 줄이 제자리서 측면 버블로 morph — layout transition 이 위치·폭 변화를 애니메이션 */}
                <RAnimated.View
                  layout={LinearTransition.springify().damping(18).stiffness(140)}
                  style={{
                    alignSelf: diarized ? (l.me ? 'flex-end' : 'flex-start') : 'stretch',
                    maxWidth: diarized ? '84%' : '100%',
                    backgroundColor: diarized ? (l.me ? 'rgba(185,139,255,0.16)' : FN.card) : 'transparent',
                    borderRadius: s(14),
                    borderTopRightRadius: diarized && l.me ? s(4) : s(14),
                    borderTopLeftRadius: diarized && !l.me ? s(4) : s(14),
                    paddingHorizontal: diarized ? s(12) : 0,
                    paddingVertical: diarized ? s(9) : s(4),
                  }}
                >
                  <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>{l.text}</Typography>
                </RAnimated.View>
              </View>
            ))}
            {stage === 'analyzing' && <IncomingDots label="화자 가르는 중" />}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: s(8), padding: s(14) }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5), borderRadius: s(12), backgroundColor: 'rgba(185,139,255,0.16)', paddingVertical: s(11) }}>
              <Ionicons name="sparkles" size={s(14)} color={FN.accent} />
              <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>AI 요약 만들기</Typography>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5), borderRadius: s(12), backgroundColor: 'rgba(185,139,255,0.16)', paddingVertical: s(11) }}>
              <Ionicons name="document-text-outline" size={s(14)} color={FN.accent} />
              <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>일지 초안</Typography>
            </View>
          </View>
        </View>
      </PhoneFrame>
      <Typography variant="body-03" className="text-gray-500" style={{ marginTop: s(14), lineHeight: s(20) }}>
        프로세스 개선 — 분석을 '빈 화면에서 다시 그림'이 아니라, 녹음 중 보던 그 전사 텍스트가 제자리에서 화자별 버블로 갈라지게(연속성). ▶로 분석=화자분리 순간을 모사.
      </Typography>
    </>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'live' | 'morph';
const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: '녹음 중 전사' },
  { key: 'morph', label: '화자분리 morph' },
];

export default function FieldNoteRecordingSheetLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('live');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">녹음 전사 · 화자분리 모션</Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
                  <Typography variant="label-02" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{t.label}</Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
        {tab === 'live' ? <LiveTab /> : <MorphTab />}

        <View style={{ marginTop: s(14), borderRadius: s(12), backgroundColor: COLORS.gray[50], padding: s(12), flexDirection: 'row', gap: s(8) }}>
          <Ionicons name="information-circle-outline" size={s(15)} color={COLORS.gray[500]} />
          <Typography variant="label-02" className="text-gray-500" style={{ flex: 1, lineHeight: s(17) }}>
            모델: 녹음 중=전사 O·화자분리 X / 분석 후=화자분리. 시트는 유지 + 미니바로 최소화 가능(가두지 않음). 청크 도착·분석은 ▶로 모사(실제 약 4초 청크). 전부 mock.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
