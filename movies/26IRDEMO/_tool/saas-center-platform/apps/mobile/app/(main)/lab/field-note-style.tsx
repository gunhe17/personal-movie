import { useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 비주얼 정체성 — 보이스(목록) → morph → 스토리(상세) 조합.
 *
 *   현재   — 앱 공통(밝은 리스트) 대조군
 *   다크   — 딥 잉크 보라 글로우 카드 리스트
 *   조합   — 보이스 스레드(목록)에서 버블 탭 → 그 자리에서 풀스크린 스토리 상세로 morph
 *
 * morph 는 라우트 이동이 아니라 같은 화면 오버레이(Reanimated transform) — 상세가 종착점이라 안정적.
 * 모두 mock. 딥잉크/보라 등은 1회성 색(주석) — 방향 확정 후 토큰화.
 */

const FN = COLORS.fieldnote; // #9B5DFF
const INK = '#141220';
const INK_CARD = '#211D33';
const SUB_DARK = '#A39DBF';
const ACCENT_DARK = '#B98BFF';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const WAVE = [0.4, 0.7, 1, 0.55, 0.9, 0.45, 0.8, 0.5, 1, 0.6, 0.35, 0.75, 0.5, 0.85, 0.55, 0.7, 0.4];

interface MockNote {
  dateFull: string;
  dur: string;
  summary: string;
  keywords: string[];
  ai: boolean;
}
const NOTES: MockNote[] = [
  { dateFull: '5월 22일 (수)', dur: '2:30', summary: '웃으며 입장. 다음 회기 종결 논의 시작해도 좋겠음.', keywords: ['밝아짐', '종결논의'], ai: true },
  { dateFull: '5월 15일 (수)', dur: '3:06', summary: '분리 순간의 울음이 짧아짐. 보호자도 변화 체감.', keywords: ['안정화', '보호자협력'], ai: true },
  { dateFull: '5월 8일 (수)', dur: '4:12', summary: '오늘 처음으로 먼저 모래상자로 다가옴. 작은 전환점.', keywords: ['자발성', '전환점'], ai: false },
];

interface Rect { x: number; y: number; w: number; h: number }

// 상세(스토리) mock — 실제 CompletedScreen IA 반영용. 어느 노트를 열어도 공용으로 사용(시안).
const SPK_COLOR: Record<number, string> = { 1: ACCENT_DARK, 2: '#6FE0C8' }; // 화자2=민트(1회성)
const TRANSCRIPT: { spk: number; time: string; text: string }[] = [
  { spk: 1, time: '00:04', text: '오늘은 표정이 한결 편안해 보였어요.' },
  { spk: 2, time: '00:11', text: '응, 오늘은 엄마랑 안 울고 들어왔어.' },
  { spk: 1, time: '00:20', text: '모래상자 쪽으로 먼저 가던데, 거기서 뭘 만들고 싶었어요?' },
  { spk: 2, time: '00:28', text: '집이랑… 강아지. 강아지가 집을 지켜.' },
  { spk: 1, time: '00:41', text: '강아지가 집을 지켜주는구나. 든든하겠다.' },
];
const MEMOS: { time: string; content: string }[] = [
  { time: '00:25', content: '모래상자 자발적 접근 — 첫 사례. 다음 회기도 관찰.' },
  { time: '01:10', content: '보호자: 등원 거부 줄었다고 보고.' },
];
const SUMMARY_FULL =
  '이번 회기에서 아동은 분리 상황의 불안이 눈에 띄게 줄었습니다. 처음으로 모래상자에 자발적으로 접근했고, "집을 지키는 강아지" 상징으로 안전 욕구를 표현했습니다. 보호자 보고상 등원 거부도 감소했습니다. 다음 회기에서는 자발적 놀이의 지속성을 확인하고 종결 논의를 시작해볼 수 있겠습니다.';
const ACTIVE_ROW = 2; // 재생 위치 하이라이트(시안 고정)
const PLAY_PCT = 35; // 플레이어 진행(시안 고정)

type Skin = 'current' | 'dark' | 'combo';
const TABS: { key: Skin; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'dark', label: '다크' },
  { key: 'combo', label: '조합' },
];

function MiniWave({ color, count = 15, h = 22 }: { color: string; count?: number; h?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), height: s(h) }}>
      {WAVE.slice(0, count).map((v, i) => (
        <View key={i} style={{ width: s(2.5), height: s(h) * v, borderRadius: s(2), backgroundColor: color }} />
      ))}
    </View>
  );
}

function PlayButton({ size = 38, bg = FN }: { size?: number; bg?: string }) {
  return (
    <View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="play" size={s(size * 0.42)} color="#FFFFFF" style={{ marginLeft: s(2) }} />
    </View>
  );
}

export default function FieldNoteStyleLab() {
  const router = useRouter();
  const [skin, setSkin] = useState<Skin>('combo');
  // morph 상태
  const [open, setOpen] = useState<{ note: MockNote; rect: Rect } | null>(null);
  const progress = useSharedValue(0);
  const closingRef = useRef(false);

  const openStory = (note: MockNote, rect: Rect) => {
    closingRef.current = false;
    setOpen({ note, rect });
    progress.value = 0;
    progress.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
  };
  const clearOpen = () => setOpen(null);
  const closeStory = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(clearOpen)();
    });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      {/* lab 크롬 */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              필드노트 비주얼 정체성
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((tab) => {
              const active = skin === tab.key;
              return (
                <Pressable key={tab.key} onPress={() => setSkin(tab.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
                  <Typography variant="label-01" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>
                    {tab.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, backgroundColor: skin === 'current' ? COLORS.gray[50] : INK }}>
        {skin === 'current' && <ListView dark={false} />}
        {skin === 'dark' && <ListView dark />}
        {skin === 'combo' && <VoiceThread onOpen={openStory} />}
        {skin !== 'combo' && <RecordCta dark={skin !== 'current'} />}
      </View>

      {/* morph 오버레이 — 루트 전체를 덮어 measureInWindow 좌표와 정렬 */}
      {open && <StoryMorph note={open.note} rect={open.rect} progress={progress} onClose={closeStory} />}
    </View>
  );
}

// ─────────── 현재 / 다크 : 리스트 ───────────
function ListView({ dark }: { dark: boolean }) {
  const title = dark ? '#FFFFFF' : COLORS.gray[900];
  const sub = dark ? SUB_DARK : COLORS.gray[500];
  const body = dark ? '#E7E3F5' : COLORS.gray[900];
  const cardBg = dark ? INK_CARD : COLORS.white;
  const accent = dark ? ACCENT_DARK : FN;
  const chipBg = dark ? 'rgba(255,255,255,0.07)' : COLORS.gray[50];
  const chipText = dark ? '#C9C3E0' : COLORS.gray[600];

  return (
    <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(90) }} showsVerticalScrollIndicator={false}>
      <Typography variant="headline-02" weight="bold" style={{ color: title, marginBottom: s(16) }}>
        필드노트
      </Typography>
      {NOTES.map((n, i) => (
        <View
          key={i}
          style={{
            backgroundColor: cardBg, borderRadius: s(16), padding: s(16), marginBottom: s(12),
            ...(dark
              ? { borderWidth: 1, borderColor: 'rgba(155,93,255,0.20)', shadowColor: FN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 }
              : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="label-01" style={{ color: sub }}>{n.dateFull} · {n.dur}</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
              <Ionicons name={n.ai ? 'sparkles' : 'mic-outline'} size={s(12)} color={n.ai ? accent : sub} />
              <Typography variant="label-02" weight="medium" style={{ color: n.ai ? accent : sub }}>{n.ai ? 'AI 정리됨' : '녹음만'}</Typography>
            </View>
          </View>
          <Typography variant="body-02-reading" style={{ color: body, marginTop: s(8) }}>{n.summary}</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6), marginTop: s(10) }}>
            {n.keywords.map((k) => (
              <View key={k} style={{ backgroundColor: chipBg, paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(6) }}>
                <Typography variant="label-02" weight="medium" style={{ color: chipText }}>#{k}</Typography>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─────────── 조합: 보이스 스레드(목록) ───────────
function VoiceBubble({ note, onOpen }: { note: MockNote; onOpen: (n: MockNote, r: Rect) => void }) {
  const ref = useRef<View>(null);
  const press = () => {
    ref.current?.measureInWindow((x, y, w, h) => onOpen(note, { x, y, w, h }));
  };
  return (
    <View style={{ marginBottom: s(18) }}>
      <View style={{ alignItems: 'center', marginBottom: s(10) }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: s(999) }}>
          <Typography variant="caption-01" style={{ color: SUB_DARK }}>{note.dateFull}</Typography>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: s(8), alignItems: 'flex-end' }}>
        <View style={{ width: s(32), height: s(32), borderRadius: s(16), backgroundColor: 'rgba(185,139,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="label-01" weight="semibold" style={{ color: ACCENT_DARK }}>민</Typography>
        </View>
        {/* 측정 대상 = 버블 */}
        <View ref={ref} collapsable={false} style={{ flex: 1 }}>
          <Pressable
            onPress={press}
            style={{ backgroundColor: INK_CARD, borderTopLeftRadius: s(6), borderTopRightRadius: s(18), borderBottomLeftRadius: s(18), borderBottomRightRadius: s(18), padding: s(14), borderWidth: 1, borderColor: 'rgba(155,93,255,0.18)' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
              <PlayButton size={36} bg={FN} />
              <View style={{ flex: 1 }}><MiniWave color={ACCENT_DARK} count={16} h={20} /></View>
              <Typography variant="label-02" style={{ color: SUB_DARK }}>{note.dur}</Typography>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(12), marginBottom: s(4) }}>
              <Ionicons name={note.ai ? 'sparkles' : 'mic-outline'} size={s(11)} color={note.ai ? ACCENT_DARK : SUB_DARK} />
              <Typography variant="label-02" weight="semibold" style={{ color: note.ai ? ACCENT_DARK : SUB_DARK }}>{note.ai ? 'AI 정리' : '녹음만'}</Typography>
            </View>
            <Typography variant="body-02-reading" style={{ color: '#E7E3F5' }} numberOfLines={2}>{note.summary}</Typography>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6), marginTop: s(10) }}>
              {note.keywords.map((k) => (
                <View key={k} style={{ backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(6) }}>
                  <Typography variant="label-02" weight="medium" style={{ color: '#C9C3E0' }}>#{k}</Typography>
                </View>
              ))}
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function VoiceThread({ onOpen }: { onOpen: (n: MockNote, r: Rect) => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(16), paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
      <Typography variant="headline-02" weight="bold" style={{ color: '#FFFFFF', marginBottom: s(4) }}>김민준</Typography>
      <Typography variant="body-03" style={{ color: SUB_DARK, marginBottom: s(18) }}>놀이치료-개인 · 회기 음성 스레드 (버블 탭 → 상세)</Typography>
      {NOTES.map((n, i) => (
        <VoiceBubble key={i} note={n} onOpen={onOpen} />
      ))}
    </ScrollView>
  );
}

// ─────────── morph: 버블 → 풀스크린 스토리 상세 ───────────
function StoryMorph({
  note,
  rect,
  progress,
  onClose,
}: {
  note: MockNote;
  rect: Rect;
  progress: SharedValue<number>;
  onClose: () => void;
}) {
  // center-origin 보정으로 rect ↔ 풀스크린
  const sx0 = rect.w / SCREEN_W;
  const sy0 = rect.h / SCREEN_H;
  const tx0 = rect.x - (SCREEN_W - rect.w) / 2;
  const ty0 = rect.y - (SCREEN_H - rect.h) / 2;
  // worklet 안에선 s() 호출 금지 → 미리 숫자로 계산해 캡처
  const radiusStart = s(18);
  const [tab, setTab] = useState<'all' | 'memo' | 'ai'>('all');

  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 0.5]) }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1], [0, 1], Extrapolation.CLAMP),
    borderRadius: interpolate(progress.value, [0, 1], [radiusStart, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [tx0, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [ty0, 0]) },
      { scaleX: interpolate(progress.value, [0, 1], [sx0, 1]) },
      { scaleY: interpolate(progress.value, [0, 1], [sy0, 1]) },
    ],
  }));
  // 콘텐츠는 늦게 페이드인 → 비율 왜곡 안 보이게
  const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#000' }, scrimStyle]} />
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, overflow: 'hidden' }, panelStyle]}>
        <LinearGradient colors={['#1C1733', '#211A38', '#15111F']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
          <Animated.View style={[{ flex: 1 }, contentStyle]}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              {/* 상단바: 닫기 + 복사/공유 */}
              <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(12) }}>
                <Pressable onPress={onClose} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={s(24)} color="#FFFFFF" />
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                  <View style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="copy-outline" size={s(20)} color="#E7E3F5" />
                  </View>
                  <View style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="share-outline" size={s(21)} color="#E7E3F5" />
                  </View>
                </View>
              </View>

              {/* 헤더: 날짜·길이 / 제목 / 회기 연결 */}
              <View style={{ paddingHorizontal: s(24), paddingTop: s(4), paddingBottom: s(14) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(6) }}>
                  <Typography variant="label-01" style={{ color: SUB_DARK }}>{note.dateFull}</Typography>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                    <Ionicons name="time-outline" size={s(13)} color={SUB_DARK} />
                    <Typography variant="label-01" style={{ color: SUB_DARK }}>{note.dur}</Typography>
                  </View>
                </View>
                <Typography variant="headline-02" weight="bold" style={{ color: '#FFFFFF', marginBottom: s(10) }}>
                  김민준 회기 기록
                </Typography>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), alignSelf: 'flex-start', backgroundColor: 'rgba(185,139,255,0.16)', borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
                  <Ionicons name="calendar-outline" size={s(13)} color={ACCENT_DARK} />
                  <Typography variant="label-01" weight="semibold" style={{ color: ACCENT_DARK }}>연결된 회기 보기</Typography>
                  <Ionicons name="chevron-forward" size={s(13)} color={ACCENT_DARK} />
                </Pressable>
              </View>

              {/* 탭 */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingHorizontal: s(12) }}>
                {(['all', 'memo', 'ai'] as const).map((tk) => {
                  const active = tab === tk;
                  const label = tk === 'all' ? '전체 대화' : tk === 'memo' ? '메모 내용' : 'AI 분석';
                  return (
                    <Pressable key={tk} onPress={() => setTab(tk)} style={{ flex: 1, alignItems: 'center', paddingVertical: s(12), borderBottomWidth: 2, borderBottomColor: active ? ACCENT_DARK : 'transparent' }}>
                      <Typography variant="body-03" weight={active ? 'bold' : 'medium'} style={{ color: active ? '#FFFFFF' : SUB_DARK }}>
                        {label}
                      </Typography>
                    </Pressable>
                  );
                })}
              </View>

              {/* 콘텐츠 */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: s(24), paddingTop: s(16), paddingBottom: s(20) }} showsVerticalScrollIndicator={false}>
                {tab === 'all' && (
                  <View style={{ gap: s(16) }}>
                    {TRANSCRIPT.map((r, i) => {
                      const active = i === ACTIVE_ROW;
                      return (
                        <View key={i} style={{ ...(active ? { backgroundColor: 'rgba(185,139,255,0.12)', borderRadius: s(10), marginHorizontal: -s(8), paddingHorizontal: s(8), paddingVertical: s(6) } : {}) }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(4) }}>
                            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: SPK_COLOR[r.spk] }} />
                            <Typography variant="label-02" weight="semibold" style={{ color: '#FFFFFF' }}>화자 {r.spk}</Typography>
                            <Typography variant="label-02" style={{ color: SUB_DARK, marginLeft: s(2) }}>{r.time}</Typography>
                          </View>
                          <Typography variant="body-02-reading" style={{ color: '#E7E3F5' }}>{r.text}</Typography>
                        </View>
                      );
                    })}
                  </View>
                )}

                {tab === 'memo' && (
                  <View style={{ gap: s(12) }}>
                    {MEMOS.map((m, i) => (
                      <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: s(12), paddingHorizontal: s(14), paddingVertical: s(12), gap: s(6) }}>
                        <Typography variant="label-02" style={{ color: SUB_DARK }}>{m.time}</Typography>
                        <Typography variant="body-02-reading" style={{ color: '#E7E3F5' }}>{m.content}</Typography>
                      </View>
                    ))}
                  </View>
                )}

                {tab === 'ai' && (
                  <View style={{ gap: s(20) }}>
                    <Typography variant="body-02-reading" style={{ color: '#E7E3F5' }}>{SUMMARY_FULL}</Typography>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
                      {note.keywords.map((k) => (
                        <View key={k} style={{ borderWidth: 1, borderColor: 'rgba(185,139,255,0.4)', paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: s(999) }}>
                          <Typography variant="label-02" weight="medium" style={{ color: '#D9CFFF' }}>#{k}</Typography>
                        </View>
                      ))}
                    </View>
                    <Pressable style={{ height: s(48), borderRadius: s(14), backgroundColor: FN, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: s(6) }}>
                      <Ionicons name="document-text-outline" size={s(18)} color="#FFFFFF" />
                      <Typography variant="body-02" weight="semibold" style={{ color: '#FFFFFF' }}>상담일지 초안 만들기</Typography>
                    </Pressable>
                    <Pressable style={{ alignSelf: 'center', paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(8), backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <Typography variant="body-03" weight="medium" style={{ color: SUB_DARK }}>다시 분석</Typography>
                    </Pressable>
                  </View>
                )}
              </ScrollView>

              {/* 오디오 플레이어 */}
              <View style={{ paddingHorizontal: s(24), paddingTop: s(12), paddingBottom: s(8), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', left: 0, top: 0, height: 4, borderRadius: 2, width: `${PLAY_PCT}%`, backgroundColor: ACCENT_DARK }} />
                  <View style={{ position: 'absolute', left: `${PLAY_PCT}%`, top: -4, width: 12, height: 12, borderRadius: 6, marginLeft: -6, backgroundColor: ACCENT_DARK }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(28), marginTop: s(12) }}>
                  <Ionicons name="play-back-outline" size={s(26)} color="#C9C3E0" />
                  <View style={{ width: s(52), height: s(52), borderRadius: s(26), backgroundColor: FN, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={s(22)} color="#FFFFFF" style={{ marginLeft: s(2) }} />
                  </View>
                  <Ionicons name="play-forward-outline" size={s(26)} color="#C9C3E0" />
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─────────── 공통 녹음 CTA ───────────
function RecordCta({ dark }: { dark: boolean }) {
  if (!dark) {
    return (
      <View style={{ position: 'absolute', right: s(16), bottom: s(24), flexDirection: 'row', alignItems: 'center', gap: s(4), height: s(42), paddingHorizontal: s(14), borderRadius: s(999), backgroundColor: FN }}>
        <Ionicons name="mic" size={s(18)} color="#FFFFFF" />
        <Typography variant="body-03" weight="medium" style={{ color: '#FFFFFF' }}>필드노트</Typography>
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', right: s(16), bottom: s(24) }}>
      <LinearGradient colors={['#B98BFF', '#7B79FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), height: s(48), paddingHorizontal: s(18), borderRadius: s(999), shadowColor: FN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8 }}>
        <Ionicons name="mic" size={s(19)} color="#FFFFFF" />
        <Typography variant="body-03" weight="semibold" style={{ color: '#FFFFFF' }}>필드노트</Typography>
      </LinearGradient>
    </View>
  );
}
