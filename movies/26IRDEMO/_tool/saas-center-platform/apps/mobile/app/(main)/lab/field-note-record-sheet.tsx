import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, TextInput, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 녹음 바텀시트 — 재미·직관·필요 3박자 시안 비교 (탭 전환).
 *
 * 질문: 녹음 중 떠 있는 시트가 "재미(소리가 살아있다)·직관(지금 녹음 중·누구·얼마나)·
 *       필요(상담사가 현장에서 실제로 쓰는 정보/액션)" 세 박자를 어떻게 조화시킬까?
 *
 * 각 시안은 mock 타이머가 실제로 흐르고, 파형·오브·자막이 움직이며, 일시정지가 동작한다
 * → 정지된 그림이 아니라 "녹음 중인 느낌"을 직접 만져보고 3박자를 체감하도록.
 *
 * 탭:
 *  [신규 자막]  이미지 #5 채택안 — 전사 전면 + 하단 독(블루 파형 + 작은 타이머 + [메모|⏸|■]).
 *              메모 탭 시 컨트롤 행이 입력 행으로 morph(파형·타이머 유지). 우상단 닫기로 최소화.
 *  [현재]      production RecordingSheet 핵심 재현 — 그라디언트+REC+큰 타이머+파형+컨트롤+메모(대조군).
 *  [오브 호흡]  중앙 호흡 오브가 음성에 반응. 정보 절제·차분·명상적(재미·직관◎, 필요△).
 *  [파형 무대]  풀폭 라이브 파형이 주인공. "소리가 보인다"는 감각(재미◎).
 *  [라이브 자막] 상단 회기 정체성 고정 + 실시간 전사가 흐름. 도구가 일하는 게 보임(3박자 균형, 권장).
 *  [컨트롤 도크] 정보밀도·한손 조작 실용형. 타이머+파형+빠른 메모/태그 칩(필요◎).
 *
 * 하단 3박자 바를 펼치면 시안별 판정. 전부 mock — 확정 시 RecordingSheet 레이아웃에 반영.
 */

const DK = {
  bg: COLORS.fieldnoteDark.bg,
  card: COLORS.fieldnoteDark.card,
  line: COLORS.fieldnoteDark.line,
  text: COLORS.fieldnoteDark.text,
  sub: COLORS.fieldnoteDark.sub,
  accent: COLORS.fieldnoteDark.accent,
} as const;
const REC = COLORS.error; // 녹음 라이브 = 빨강
const FNP = COLORS.fieldnote;
const SHEET_GRAD = ['#2A2142', '#171327'] as const; // 시트 무대 그라디언트
const SURFACE = 'rgba(255,255,255,0.07)';

// ── mock 회기 정체성 (누구를 녹음 중인가 — 정보 스펙 §3-4-4 정체성 1순위) ──
const SESSION = { client: '이서연', kind: '상담 회기', meta: '놀이치료-개인 · 14:00' };

// ── mock 전사 (화자 분리) ──
interface Line { who: '내담자' | '상담사'; text: string }
const CAPTION: Line[] = [
  { who: '내담자', text: '요즘 잠을 잘 못 자요. 새벽에 자꾸 깨고...' },
  { who: '상담사', text: '언제부터 그런 패턴이 시작됐을까요?' },
  { who: '내담자', text: '한 두 달 전쯤이요. 회사 일이 많아지면서요.' },
  { who: '내담자', text: '아침에 일어나도 개운하지가 않아요.' },
  { who: '상담사', text: '그럴 때 어떤 생각이 가장 먼저 드세요?' },
  { who: '내담자', text: '또 하루가 시작되는구나... 그런 무거운 느낌요.' },
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
// HH:MM:SS (이미지 #5 하단 타이머)
function fmtLong(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── 라이브 파형 (mock, Animated equalizer) ──
function WaveBars({
  active,
  color = DK.accent,
  count = 30,
  height = 44,
  barW = 3,
  gap = 3,
}: {
  active: boolean;
  color?: string;
  count?: number;
  height?: number;
  barW?: number;
  gap?: number;
}) {
  const vals = useRef(Array.from({ length: count }, () => new Animated.Value(0.22))).current;
  useEffect(() => {
    if (!active) {
      vals.forEach((v) => v.stopAnimation());
      Animated.parallel(
        vals.map((v) => Animated.timing(v, { toValue: 0.18, duration: 220, useNativeDriver: true })),
      ).start();
      return;
    }
    const loops = vals.map((v, i) => {
      const dur = 260 + ((i * 47) % 360);
      return Animated.loop(
        Animated.sequence([
          Animated.delay((i * 53) % 320),
          Animated.timing(v, { toValue: 0.55 + ((i * 31) % 45) / 100, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: dur * 0.85, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, vals]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height, gap }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            height,
            borderRadius: barW,
            backgroundColor: color,
            transform: [{ scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

// ── 호흡 오브 ──
function BreathOrb({ active, size = s(168) }: { active: boolean; size?: number }) {
  const breath = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      breath.stopAnimation();
      halo.stopAnimation();
      return;
    }
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const h = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    b.start();
    h.start();
    return () => {
      b.stop();
      h.stop();
    };
  }, [active, breath, halo]);

  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: FNP, transform: [{ scale: haloScale }], opacity: haloOpacity }}
      />
      <Animated.View style={{ transform: [{ scale: coreScale }], opacity: active ? 1 : 0.6 }}>
        <LinearGradient
          colors={[DK.accent, FNP, '#6B3FD4']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: size * 0.74, height: size * 0.74, borderRadius: (size * 0.74) / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={active ? 'mic' : 'pause'} size={s(34)} color={COLORS.white} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ── REC 깜빡임 닷 ──
function RecDot({ active, label = 'REC' }: { active: boolean; label?: string }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      blink.stopAnimation();
      blink.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 620, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, blink]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      <Animated.View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: REC, opacity: blink }} />
      <Typography variant="label-02" weight="bold" style={{ color: REC, letterSpacing: 1 }}>
        {active ? label : '일시정지'}
      </Typography>
    </View>
  );
}

// ── 컨트롤 버튼들 (일시정지/정지) ──
function Controls({
  paused,
  onToggle,
  onStop,
  compact,
}: {
  paused: boolean;
  onToggle: () => void;
  onStop: () => void;
  compact?: boolean;
}) {
  const d = compact ? s(48) : s(60);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(28) }}>
      <Pressable
        onPress={onToggle}
        style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DK.line }}
      >
        <Ionicons name={paused ? 'play' : 'pause'} size={compact ? s(20) : s(24)} color={DK.text} />
      </Pressable>
      <Pressable
        onPress={onStop}
        style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: REC, alignItems: 'center', justifyContent: 'center', shadowColor: REC, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
      >
        <Ionicons name="stop" size={compact ? s(18) : s(22)} color={COLORS.white} />
      </Pressable>
    </View>
  );
}

// ── 회기 정체성 칩 (상단 고정용) ──
function IdentityChip({ dim }: { dim?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), alignSelf: 'center', backgroundColor: SURFACE, paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(999), opacity: dim ? 0.8 : 1 }}>
      <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: COLORS.counseling }} />
      <Typography variant="label-01" weight="semibold" style={{ color: DK.text }}>
        {SESSION.client}
      </Typography>
      <Typography variant="label-01" style={{ color: DK.sub }}>
        {SESSION.kind}
      </Typography>
    </View>
  );
}

// ── 라이브 자막 행 ──
function CaptionRow({ line, fresh }: { line: Line; fresh?: boolean }) {
  const fade = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const slide = useRef(new Animated.Value(fresh ? 8 : 0)).current;
  useEffect(() => {
    if (!fresh) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fresh, fade, slide]);
  const isClient = line.who === '내담자';
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], marginBottom: s(12) }}>
      <Typography variant="label-02" weight="semibold" style={{ color: isClient ? DK.accent : DK.sub, marginBottom: s(2) }}>
        {line.who}
      </Typography>
      <Typography variant="body-02" style={{ color: isClient ? DK.text : DK.sub, lineHeight: s(21) }}>
        {line.text}
      </Typography>
    </Animated.View>
  );
}

// ── 드래그 핸들 ──
function Handle() {
  return <View style={{ alignSelf: 'center', width: s(40), height: s(4), borderRadius: s(2), backgroundColor: 'rgba(255,255,255,0.22)', marginTop: s(10), marginBottom: s(6) }} />;
}

// ═══════════════════ 시안별 시트 본문 ═══════════════════

interface SheetProps {
  elapsed: number;
  paused: boolean;
  onToggle: () => void;
  onStop: () => void;
  visibleCount: number;
}

// [현재] production 재현
function SheetCurrent({ elapsed, paused, onToggle, onStop }: SheetProps) {
  const [memo, setMemo] = useState('');
  return (
    <View style={{ flex: 1, paddingHorizontal: s(20) }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(20) }}>
        <RecDot active={!paused} />
        <Typography variant="time" weight="light" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
          {fmt(elapsed)}
        </Typography>
        <Typography variant="label-01" style={{ color: DK.sub }}>
          {SESSION.client} · {SESSION.kind}
        </Typography>
        <WaveBars active={!paused} count={32} height={s(52)} />
      </View>
      {/* 메모 입력 + 컨트롤 */}
      <View style={{ gap: s(14), paddingBottom: s(8) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: SURFACE, borderRadius: s(12), paddingHorizontal: s(14), height: s(46) }}>
          <Ionicons name="create-outline" size={s(18)} color={DK.sub} />
          <TextInput value={memo} onChangeText={setMemo} placeholder="메모 추가" placeholderTextColor={DK.sub} style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }} />
        </View>
        <Controls paused={paused} onToggle={onToggle} onStop={onStop} />
      </View>
    </View>
  );
}

// [오브 호흡]
function SheetOrb({ elapsed, paused, onToggle, onStop }: SheetProps) {
  return (
    <View style={{ flex: 1, paddingHorizontal: s(20), alignItems: 'center' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(28) }}>
        <BreathOrb active={!paused} />
        <View style={{ alignItems: 'center', gap: s(6) }}>
          <Typography variant="time" weight="light" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
            {fmt(elapsed)}
          </Typography>
          <Typography variant="body-03" style={{ color: DK.sub }}>
            {paused ? '잠시 멈춤' : `${SESSION.client}님과 듣는 중`}
          </Typography>
        </View>
      </View>
      <View style={{ paddingBottom: s(20) }}>
        <Controls paused={paused} onToggle={onToggle} onStop={onStop} />
      </View>
    </View>
  );
}

// [파형 무대]
function SheetWaveStage({ elapsed, paused, onToggle, onStop }: SheetProps) {
  return (
    <View style={{ flex: 1, paddingHorizontal: s(16) }}>
      <View style={{ alignItems: 'center', paddingTop: s(10), gap: s(4) }}>
        <RecDot active={!paused} />
        <Typography variant="time" weight="light" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
          {fmt(elapsed)}
        </Typography>
      </View>
      {/* 풀폭 파형 무대 */}
      <View style={{ flex: 1, justifyContent: 'center', gap: s(10) }}>
        <WaveBars active={!paused} color={REC} count={26} height={s(72)} barW={s(4)} gap={s(5)} />
        <WaveBars active={!paused} color={DK.accent} count={26} height={s(40)} barW={s(4)} gap={s(5)} />
        <View style={{ alignSelf: 'center', marginTop: s(6) }}>
          <IdentityChip />
        </View>
      </View>
      <View style={{ paddingBottom: s(20) }}>
        <Controls paused={paused} onToggle={onToggle} onStop={onStop} />
      </View>
    </View>
  );
}

// ═══ 자막 패밀리 공통 셸 (라이브 자막 = 베이스) ═══

// 상단: 회기 정체성 + REC + 타이머 (고정)
function CaptionHeader({ elapsed, paused }: { elapsed: number; paused: boolean }) {
  return (
    <View style={{ paddingHorizontal: s(20), paddingBottom: s(12), borderBottomWidth: 1, borderBottomColor: DK.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.counseling }} />
          <View>
            <Typography variant="body-01" weight="semibold" style={{ color: DK.text }}>
              {SESSION.client}
            </Typography>
            <Typography variant="label-02" style={{ color: DK.sub }}>
              {SESSION.meta}
            </Typography>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: s(2) }}>
          <RecDot active={!paused} />
          <Typography variant="headline-02" weight="light" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
            {fmt(elapsed)}
          </Typography>
        </View>
      </View>
    </View>
  );
}

// 하단: 시점 앵커 메모 + 컨트롤 (고정)
function CaptionFooter({ elapsed, paused, onToggle, onStop, hint }: SheetProps & { hint?: string }) {
  const [memo, setMemo] = useState('');
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(14), borderTopWidth: 1, borderTopColor: DK.line, gap: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: SURFACE, borderRadius: s(12), paddingHorizontal: s(14), height: s(44) }}>
        <Ionicons name="create-outline" size={s(18)} color={DK.accent} />
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder={hint ?? `${fmt(elapsed)} 지점에 메모 남기기`}
          placeholderTextColor={DK.sub}
          style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }}
        />
        <Ionicons name="arrow-up-circle" size={s(26)} color={memo ? DK.accent : DK.sub} />
      </View>
      <Controls paused={paused} onToggle={onToggle} onStop={onStop} compact />
    </View>
  );
}

// "듣는 중…" 빈 구간 방어 (STT 지연·무음)
function ListeningHint({ paused }: { paused: boolean }) {
  if (paused) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), opacity: 0.7, marginTop: s(2) }}>
      <WaveBars active color={DK.sub} count={6} height={s(14)} barW={s(2)} gap={s(2)} />
      <Typography variant="label-01" style={{ color: DK.sub }}>
        듣는 중…
      </Typography>
    </View>
  );
}

// 자동 스크롤되는 전사 영역
function CaptionScroll({ visibleCount, children }: { visibleCount: number; children: ReactNode }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    ref.current?.scrollToEnd({ animated: true });
  }, [visibleCount]);
  return (
    <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: s(20), paddingBottom: s(8) }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// fresh 등장 애니메이션 (fade + slide-up)
function useFresh(fresh?: boolean) {
  const fade = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const slide = useRef(new Animated.Value(fresh ? 8 : 0)).current;
  useEffect(() => {
    if (!fresh) return;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fresh, fade, slide]);
  return { opacity: fade, transform: [{ translateY: slide }] };
}

// LIVE_LINES — 녹음 중엔 화자분리(diarization) 전이라 화자 라벨 없이 타임스탬프+텍스트만
const LIVE_LINES = CAPTION.map((c, i) => ({ t: 4 + i * 8, text: c.text }));

// 녹음 중 전사 placeholder ("전사 중…" pulse)
function TranscribingRow() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [pulse]);
  return (
    <View style={{ flexDirection: 'row', gap: s(10), marginBottom: s(12) }}>
      <View style={{ width: s(40) }} />
      <Animated.View style={{ opacity: pulse, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <WaveBars active color={DK.sub} count={5} height={s(12)} barW={s(2)} gap={s(2)} />
        <Typography variant="body-03" style={{ color: DK.sub }}>
          전사 중…
        </Typography>
      </Animated.View>
    </View>
  );
}

// 녹음 중 전사 한 줄 (화자 없음 — 타임스탬프 + 텍스트)
function LiveRow({ t, text, fresh }: { t: number; text: string; fresh?: boolean }) {
  const a = useFresh(fresh);
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: s(10), marginBottom: s(12) }, a]}>
      <Typography variant="label-02" style={{ color: DK.sub, width: s(40), marginTop: s(2), fontVariant: ['tabular-nums'] }}>
        {fmt(t)}
      </Typography>
      <Typography variant="body-02" style={{ color: DK.text, flex: 1, lineHeight: s(21) }}>
        {text}
      </Typography>
    </Animated.View>
  );
}

// [라이브 자막] = 프로덕션 녹음 중 화면 (실시간 전사 · 화자 미구분 · 시점 메모)
function SheetLiveCaption({ elapsed, paused, onToggle, onStop, visibleCount }: SheetProps) {
  const [memo, setMemo] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const lines = LIVE_LINES.slice(0, visibleCount);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [visibleCount]);
  const ctl = { width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex: 1 }}>
      {/* 상단: REC + 타이머 + 컨트롤 (production 녹음 바) */}
      <View style={{ paddingHorizontal: s(20), paddingBottom: s(12), borderBottomWidth: 1, borderBottomColor: DK.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: s(3) }}>
          <RecDot active={!paused} label="녹음 중" />
          <Typography variant="headline-02" weight="light" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
            {fmt(elapsed)}
          </Typography>
        </View>
        <View style={{ flexDirection: 'row', gap: s(12) }}>
          <Pressable onPress={onToggle} style={[ctl, { backgroundColor: SURFACE, borderWidth: 1, borderColor: DK.line }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={s(20)} color={DK.text} />
          </Pressable>
          <Pressable onPress={onStop} style={[ctl, { backgroundColor: REC }]}>
            <Ionicons name="stop" size={s(18)} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
      {/* 실시간 전사 — 화자분리는 녹음 후라 여기선 화자 라벨 없음 */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: s(20), paddingBottom: s(8) }} showsVerticalScrollIndicator={false}>
        {lines.map((l, i) => (
          <LiveRow key={i} t={l.t} text={l.text} fresh={i === visibleCount - 1} />
        ))}
        {!paused ? <TranscribingRow /> : null}
      </ScrollView>
      {/* 하단: 시점 메모 입력 (production 하단 메모) */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(14), borderTopWidth: 1, borderTopColor: DK.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: SURFACE, borderRadius: s(999), paddingHorizontal: s(16), height: s(46) }}>
          <TextInput value={memo} onChangeText={setMemo} placeholder="메모 내용을 입력해주세요" placeholderTextColor={DK.sub} style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }} />
          <Pressable style={{ width: s(32), height: s(32), borderRadius: s(16), backgroundColor: FNP, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={s(18)} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// [자막·말풍선] = 분석 후 화자분리 상세 (필드노트 상세 '전체 대화' · 재생/탐색)
// 좌(내담자들)·우(상담사) 말풍선. 역할(상담사/내담자)은 화자분리 결과엔 없으므로
// **서버 분석 단계가 전사를 보고 판정**한다는 전제(speaker_roles) — 상담사=우측·그린.
// 그룹이면 내담자 여러 명을 좌측에 이름·색으로 구분.
type DetailRole = 'client' | 'counselor';
interface DetailSpeaker { name: string; role: DetailRole; color: string }
interface DetailLine { spk: string; text: string; t: number }
interface DetailConvo {
  header: { title: string; meta: string };
  speakers: Record<string, DetailSpeaker>;
  lines: DetailLine[];
  total: number;
}

const COUNSELOR_GREEN = '#34D399';

// 1:1 — 내담자 1 + 상담사 (실데이터급 다턴·길이 변주)
const CONVO_SOLO: DetailConvo = {
  header: { title: '이서연', meta: '놀이치료-개인 · 14:00' },
  speakers: {
    C1: { name: '이서연', role: 'client', color: '#B98BFF' },
    T: { name: '상담사', role: 'counselor', color: COUNSELOR_GREEN },
  },
  lines: [
    { spk: 'C1', text: '요즘 잠을 잘 못 자요. 새벽에 자꾸 깨고 다시 못 들어요.', t: 6 },
    { spk: 'T', text: '언제부터 그런 패턴이 시작됐을까요?', t: 18 },
    { spk: 'C1', text: '한 두 달 전쯤이요. 회사 일이 많아지면서 부쩍 심해졌어요.', t: 30 },
    { spk: 'C1', text: '아침에 일어나도 개운하지가 않고, 하루 종일 멍해요.', t: 44 },
    { spk: 'T', text: '그렇게 깬 새벽에는 어떤 생각이 가장 먼저 드세요?', t: 58 },
    { spk: 'C1', text: '또 하루가 시작되는구나... 그런 무거운 느낌이요.', t: 72 },
    { spk: 'T', text: '그 무거움을 몸 어디에서 가장 많이 느끼시는 것 같아요?', t: 88 },
    { spk: 'C1', text: '가슴이 답답하고, 어깨가 늘 굳어 있는 느낌이에요.', t: 103 },
    { spk: 'T', text: '지난주에 같이 연습한 호흡은 좀 해보셨어요?', t: 120 },
    { spk: 'C1', text: '두세 번 해봤는데, 할 때는 좀 가라앉는 것 같았어요.', t: 134 },
  ],
  total: 12 * 60 + 30,
};

// 그룹 — 내담자 3 + 상담사 (사회성 그룹). 좌측에 3명을 색·이름으로 구분.
const CONVO_GROUP: DetailConvo = {
  header: { title: '김민준 외 2명', meta: '사회성그룹-그룹 · 16:00' },
  speakers: {
    C1: { name: '김민준', role: 'client', color: '#B98BFF' },
    C2: { name: '박도윤', role: 'client', color: '#5CCBFF' },
    C3: { name: '정하린', role: 'client', color: '#FFB35C' },
    T: { name: '상담사', role: 'counselor', color: COUNSELOR_GREEN },
  },
  lines: [
    { spk: 'T', text: '오늘은 이번 주에 친구랑 있었던 일을 한 명씩 나눠볼까요?', t: 8 },
    { spk: 'C1', text: '저는 쉬는 시간에 축구하다가 민호랑 부딪혔어요.', t: 22 },
    { spk: 'C1', text: '근데 민호가 먼저 화를 내서 저도 같이 소리쳤어요.', t: 34 },
    { spk: 'T', text: '그때 민준이 마음은 어땠어요?', t: 47 },
    { spk: 'C1', text: '억울했어요. 일부러 그런 거 아닌데...', t: 58 },
    { spk: 'C2', text: '저도 그런 적 있어요. 그럴 땐 그냥 자리 피해요.', t: 72 },
    { spk: 'C3', text: '근데 피하면 더 답답하지 않아? 난 그냥 말로 해.', t: 86 },
    { spk: 'T', text: '도윤이랑 하린이가 서로 다른 방법을 쓰는구나. 둘 다 좋은 시도예요.', t: 101 },
    { spk: 'C2', text: '근데 말로 하면 또 싸움 나요. 잘 안 돼요.', t: 116 },
    { spk: 'T', text: '그럼 오늘은 "화났을 때 한 문장으로 말하기"를 같이 연습해볼까요?', t: 130 },
    { spk: 'C3', text: '저요! 저 먼저 해볼래요.', t: 142 },
  ],
  total: 18 * 60 + 10,
};

type DetailMode = 'solo' | 'group';
const DETAIL_CONVOS: Record<DetailMode, DetailConvo> = { solo: CONVO_SOLO, group: CONVO_GROUP };

function SheetCaptionBubble(_p: SheetProps) {
  const [mode, setMode] = useState<DetailMode>('solo');
  const convo = DETAIL_CONVOS[mode];
  const [playT, setPlayT] = useState(28);
  const [playing, setPlaying] = useState(true);
  // 모드(1:1↔그룹) 전환 시 재생 위치 리셋
  useEffect(() => setPlayT(0), [mode]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPlayT((t) => (t >= convo.total ? t : t + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, convo.total]);
  // 현재 재생 위치의 발화 = t <= playT 중 마지막
  let activeIdx = -1;
  for (let i = 0; i < convo.lines.length; i++) if (convo.lines[i].t <= playT) activeIdx = i;
  const pct = Math.min(1, playT / convo.total);
  return (
    <View style={{ flex: 1 }}>
      {/* 헤더: 정체성 + 화자분리 완료 (녹음 chrome 아님) */}
      <View style={{ paddingHorizontal: s(20), paddingBottom: s(12), borderBottomWidth: 1, borderBottomColor: DK.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.counseling }} />
          <View>
            <Typography variant="body-01" weight="semibold" style={{ color: DK.text }}>
              {convo.header.title}
            </Typography>
            <Typography variant="label-02" style={{ color: DK.sub }}>
              {convo.header.meta}
            </Typography>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: 'rgba(52,211,153,0.16)', paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(999) }}>
          <Ionicons name="people" size={s(13)} color="#34D399" />
          <Typography variant="label-02" weight="semibold" style={{ color: '#34D399' }}>
            화자분리 완료
          </Typography>
        </View>
      </View>

      {/* 1:1 ↔ 그룹 토글 + 상담사 판정 출처 안내 (서버 분석 단계가 역할 판정) */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(12), gap: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: s(10), padding: s(3) }}>
          {(['solo', 'group'] as DetailMode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{ flex: 1, paddingVertical: s(7), borderRadius: s(8), backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent', alignItems: 'center' }}
              >
                <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: active ? DK.text : DK.sub }}>
                  {m === 'solo' ? '1:1' : '그룹 (내담자 3)'}
                </Typography>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
          <Ionicons name="sparkles" size={s(11)} color={DK.accent} />
          <Typography variant="label-02" style={{ color: DK.sub, flex: 1 }}>
            상담사(우측·그린)는 분석 단계에서 전사 보고 판정 — 좌측은 내담자{mode === 'group' ? '들(이름·색 구분)' : ''}
          </Typography>
        </View>
      </View>

      {/* 화자 말풍선 — 탭하면 그 지점부터 재생(seek) */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: s(20), paddingBottom: s(8) }} showsVerticalScrollIndicator={false}>
        {convo.lines.map((l, i) => {
          const spk = convo.speakers[l.spk];
          const isClient = spk.role === 'client';
          const active = i === activeIdx;
          return (
            <Pressable key={i} onPress={() => setPlayT(l.t)} style={{ alignItems: isClient ? 'flex-start' : 'flex-end', marginBottom: s(12) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginBottom: s(3), paddingHorizontal: s(2) }}>
                <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: spk.color }} />
                <Typography variant="label-02" weight="semibold" style={{ color: spk.color }}>
                  {spk.name}
                </Typography>
                <Typography variant="label-02" style={{ color: DK.sub, fontVariant: ['tabular-nums'] }}>
                  {fmt(l.t)}
                </Typography>
              </View>
              <View
                style={{
                  maxWidth: '84%',
                  backgroundColor: active ? spk.color + '2E' : spk.color + '1A',
                  borderWidth: active ? 1 : 0,
                  borderColor: spk.color + '66',
                  paddingHorizontal: s(13),
                  paddingVertical: s(9),
                  borderRadius: s(16),
                  borderTopLeftRadius: isClient ? s(5) : s(16),
                  borderTopRightRadius: isClient ? s(16) : s(5),
                }}
              >
                <Typography variant="body-02" style={{ color: DK.text, lineHeight: s(21) }}>
                  {l.text}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* 하단: 재생 바 (상세 재생/탐색) */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(14), borderTopWidth: 1, borderTopColor: DK.line, flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        <Pressable onPress={() => setPlaying((pl) => !pl)} style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: FNP, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={s(20)} color={COLORS.white} />
        </Pressable>
        <View style={{ flex: 1, gap: s(6) }}>
          <View style={{ height: s(4), borderRadius: s(2), backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <View style={{ width: `${pct * 100}%`, height: s(4), borderRadius: s(2), backgroundColor: DK.accent }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="label-02" style={{ color: DK.sub, fontVariant: ['tabular-nums'] }}>
              {fmt(playT)}
            </Typography>
            <Typography variant="label-02" style={{ color: DK.sub, fontVariant: ['tabular-nums'] }}>
              {fmt(convo.total)}
            </Typography>
          </View>
        </View>
      </View>
    </View>
  );
}

// [자막·포커스] 최근 발화만 크게, 지나간 건 흐려져 위로
function SheetCaptionFocus(p: SheetProps) {
  const lines = CAPTION.slice(0, p.visibleCount);
  const tail = lines.slice(-3);
  return (
    <View style={{ flex: 1 }}>
      <CaptionHeader elapsed={p.elapsed} paused={p.paused} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: s(20), paddingBottom: s(12) }}>
        {tail.map((l, idx) => {
          const fromEnd = tail.length - 1 - idx; // 0 = 최신
          const opacity = fromEnd === 0 ? 1 : fromEnd === 1 ? 0.4 : 0.18;
          const big = fromEnd === 0;
          const isClient = l.who === '내담자';
          return (
            <View key={p.visibleCount - tail.length + idx} style={{ marginBottom: s(16), opacity }}>
              <Typography variant="label-02" weight="semibold" style={{ color: isClient ? DK.accent : DK.sub, marginBottom: s(4) }}>
                {l.who}
              </Typography>
              <Typography
                variant={big ? 'title-01' : 'body-02'}
                weight={big ? 'semibold' : 'regular'}
                style={{ color: isClient ? DK.text : DK.sub, lineHeight: big ? s(28) : s(22) }}
              >
                {l.text}
              </Typography>
            </View>
          );
        })}
        <ListeningHint paused={p.paused} />
      </View>
      <CaptionFooter {...p} />
    </View>
  );
}

// [자막·마킹] 발화 줄을 녹음 중 실시간 북마크 → 소견 인용 후보
function SheetCaptionMark(p: SheetProps) {
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const lines = CAPTION.slice(0, p.visibleCount);
  const toggle = (i: number) =>
    setMarked((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  return (
    <View style={{ flex: 1 }}>
      <CaptionHeader elapsed={p.elapsed} paused={p.paused} />
      {marked.size > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(20), paddingVertical: s(8), backgroundColor: 'rgba(185,139,255,0.10)' }}>
          <Ionicons name="bookmark" size={s(13)} color={DK.accent} />
          <Typography variant="label-01" weight="medium" style={{ color: DK.accent }}>
            {marked.size}개 표시 · 소견 인용 후보
          </Typography>
        </View>
      ) : null}
      <CaptionScroll visibleCount={p.visibleCount}>
        {lines.map((l, i) => {
          const on = marked.has(i);
          const isClient = l.who === '내담자';
          return (
            <Pressable key={i} onPress={() => toggle(i)} style={{ flexDirection: 'row', gap: s(10), marginBottom: s(12) }}>
              <View style={{ width: s(3), borderRadius: s(2), backgroundColor: on ? DK.accent : 'transparent' }} />
              <View style={{ flex: 1 }}>
                <Typography variant="label-02" weight="semibold" style={{ color: isClient ? DK.accent : DK.sub, marginBottom: s(2) }}>
                  {l.who}
                </Typography>
                <Typography variant="body-02" style={{ color: isClient ? DK.text : DK.sub, lineHeight: s(21) }}>
                  {l.text}
                </Typography>
              </View>
              <Ionicons name={on ? 'bookmark' : 'bookmark-outline'} size={s(18)} color={on ? DK.accent : 'rgba(255,255,255,0.25)'} style={{ marginTop: s(2) }} />
            </Pressable>
          );
        })}
        <ListeningHint paused={p.paused} />
      </CaptionScroll>
      <CaptionFooter {...p} hint="표시한 줄은 소견·하이라이트로 모여요" />
    </View>
  );
}

// [자막·요약레일] 대화에서 키워드가 실시간 누적 (AI 정리 중)
const RAIL: { at: number; text: string }[] = [
  { at: 4, text: '수면 곤란' },
  { at: 10, text: '새벽 각성' },
  { at: 14, text: '직장 스트레스' },
  { at: 20, text: '무기력' },
  { at: 26, text: '아침 피로' },
];
function RailChip({ text, fresh }: { text: string; fresh?: boolean }) {
  const a = useFresh(fresh);
  return (
    <Animated.View style={[{ paddingHorizontal: s(11), paddingVertical: s(6), borderRadius: s(999), backgroundColor: 'rgba(185,139,255,0.14)', borderWidth: 1, borderColor: DK.accent + '40' }, a]}>
      <Typography variant="label-01" weight="medium" style={{ color: DK.accent }}>
        {text}
      </Typography>
    </Animated.View>
  );
}
function SheetCaptionRail(p: SheetProps) {
  const lines = CAPTION.slice(0, p.visibleCount);
  const chips = RAIL.filter((k) => p.elapsed >= k.at);
  return (
    <View style={{ flex: 1 }}>
      <CaptionHeader elapsed={p.elapsed} paused={p.paused} />
      <View style={{ paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(10), borderBottomWidth: 1, borderBottomColor: DK.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8) }}>
          <Ionicons name="sparkles" size={s(13)} color={DK.accent} />
          <Typography variant="label-02" weight="semibold" style={{ color: DK.sub }}>
            실시간 키워드 · 정리 중
          </Typography>
        </View>
        {chips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(7) }}>
            {chips.map((c, i) => (
              <RailChip key={c.text} text={c.text} fresh={i === chips.length - 1} />
            ))}
          </ScrollView>
        ) : (
          <Typography variant="label-01" style={{ color: DK.sub }}>
            대화에서 키워드를 모으는 중…
          </Typography>
        )}
      </View>
      <CaptionScroll visibleCount={p.visibleCount}>
        {lines.map((l, i) => (
          <CaptionRow key={i} line={l} fresh={i === p.visibleCount - 1} />
        ))}
        <ListeningHint paused={p.paused} />
      </CaptionScroll>
      <CaptionFooter {...p} />
    </View>
  );
}

// [컨트롤 도크] — 실용형
const TAGS = ['주호소', '정서', '개입', '관찰', '과제'];
function SheetDock({ elapsed, paused, onToggle, onStop }: SheetProps) {
  const [memo, setMemo] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  return (
    <View style={{ flex: 1, paddingHorizontal: s(20), justifyContent: 'flex-end', paddingBottom: s(16) }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: s(6) }}>
        <IdentityChip />
        <WaveBars active={!paused} color={DK.accent} count={20} height={s(34)} />
      </View>
      {/* 도크: 타이머 + 컨트롤 한 줄 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE, borderRadius: s(16), padding: s(12), gap: s(12), marginBottom: s(12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: paused ? DK.sub : REC }} />
          <Typography variant="title-01" weight="semibold" style={{ color: DK.text, fontVariant: ['tabular-nums'] }}>
            {fmt(elapsed)}
          </Typography>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onToggle} style={{ width: s(40), height: s(40), borderRadius: s(20), backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={paused ? 'play' : 'pause'} size={s(18)} color={DK.text} />
        </Pressable>
        <Pressable onPress={onStop} style={{ width: s(40), height: s(40), borderRadius: s(20), backgroundColor: REC, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="stop" size={s(16)} color={COLORS.white} />
        </Pressable>
      </View>
      {/* 빠른 태그 칩 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(8), paddingBottom: s(10) }}>
        {TAGS.map((t) => {
          const on = activeTag === t;
          return (
            <Pressable key={t} onPress={() => setActiveTag(on ? null : t)} style={{ paddingHorizontal: s(13), paddingVertical: s(7), borderRadius: s(999), backgroundColor: on ? DK.accent : SURFACE }}>
              <Typography variant="label-01" weight="medium" style={{ color: on ? '#1A1626' : DK.sub }}>
                #{t}
              </Typography>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* 빠른 메모 (한손) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: SURFACE, borderRadius: s(12), paddingHorizontal: s(14), height: s(48) }}>
        <Ionicons name="flash-outline" size={s(18)} color={DK.accent} />
        <TextInput value={memo} onChangeText={setMemo} placeholder={activeTag ? `#${activeTag} 메모 남기기` : '이 순간 빠른 메모'} placeholderTextColor={DK.sub} style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }} />
        <Ionicons name="arrow-up-circle" size={s(26)} color={memo ? DK.accent : DK.sub} />
      </View>
    </View>
  );
}

// ═══════════════════ 탭 메타 + 판정 ═══════════════════

// ═══ [신규 자막] = 이미지 #5 ═══
// 전사 전면 + 하단 독(블루 파형 + 작은 타이머 + [메모 | ⏸ | ■]). 우상단 닫기로 최소화.
// 메모 탭 시 컨트롤 행이 입력 행으로 morph(파형·타이머는 유지 → 녹음 지속 신호).
const NEWCAP_WAVE = '#5B8DEF'; // 이미지 블루 파형

// 기본 컨트롤 행 — [메모 | ⏸ 큰 흰 버튼 | ■ 정지]
function NewCaptionControls({ paused, onToggle, onStop, onMemo }: { paused: boolean; onToggle: () => void; onStop: () => void; onMemo: () => void }) {
  const a = useFresh(true);
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, a]}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <Pressable onPress={onMemo} hitSlop={12} style={{ paddingVertical: s(6), paddingRight: s(8) }}>
          <Typography variant="body-02" weight="medium" style={{ color: DK.sub }}>메모</Typography>
        </Pressable>
      </View>
      <Pressable
        onPress={onToggle}
        style={{ width: s(64), height: s(64), borderRadius: s(32), backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
      >
        <Ionicons name={paused ? 'play' : 'pause'} size={s(26)} color={COLORS.gray[900]} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Pressable
          onPress={onStop}
          style={{ width: s(48), height: s(48), borderRadius: s(16), backgroundColor: SURFACE, borderWidth: 1, borderColor: DK.line, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="stop" size={s(20)} color={DK.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// 메모 입력 행 — 컨트롤 자리에 morph (취소 × | 입력 | 전송 ↑)
function NewCaptionMemoInput({ elapsed, onCancel, onSubmit }: { elapsed: number; onCancel: () => void; onSubmit: () => void }) {
  const [memo, setMemo] = useState('');
  const a = useFresh(true);
  const canSend = memo.trim().length > 0;
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: s(8) }, a]}>
      <Pressable onPress={onCancel} hitSlop={8} style={{ width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={s(22)} color={DK.sub} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: SURFACE, borderRadius: s(999), paddingHorizontal: s(16), height: s(48), borderWidth: 1, borderColor: DK.line }}>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          autoFocus
          placeholder={`${fmt(elapsed)} 지점에 메모`}
          placeholderTextColor={DK.sub}
          style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }}
          onSubmitEditing={() => canSend && onSubmit()}
        />
        <Pressable
          onPress={() => canSend && onSubmit()}
          disabled={!canSend}
          style={{ width: s(34), height: s(34), borderRadius: s(17), backgroundColor: canSend ? FNP : SURFACE, alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.5 }}
        >
          <Ionicons name="arrow-up" size={s(18)} color={COLORS.white} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function SheetNewCaption({ elapsed, paused, onToggle, onStop, visibleCount, onClose }: SheetProps & { onClose: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [memoMode, setMemoMode] = useState(false);
  const lines = LIVE_LINES.slice(0, visibleCount);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [visibleCount]);
  return (
    <View style={{ flex: 1 }}>
      {/* 상단: 우측 닫기 (최소화) */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: s(20), paddingBottom: s(4) }}>
        <Pressable onPress={onClose} hitSlop={10} style={{ paddingVertical: s(4) }}>
          <Typography variant="body-02" style={{ color: DK.sub }}>닫기</Typography>
        </Pressable>
      </View>
      {/* 전사 전면 (주연) */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(6), paddingBottom: s(8) }} showsVerticalScrollIndicator={false}>
        {lines.map((l, i) => (
          <LiveRow key={i} t={l.t} text={l.text} fresh={i === visibleCount - 1} />
        ))}
        {!paused ? <TranscribingRow /> : null}
      </ScrollView>
      {/* 하단 독: 블루 파형 + 작은 타이머 + (컨트롤 ↔ 메모 입력 morph) */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(10), paddingBottom: s(14), borderTopWidth: 1, borderTopColor: DK.line, gap: s(12) }}>
        <WaveBars active={!paused} color={NEWCAP_WAVE} count={44} height={s(34)} barW={s(3)} gap={s(2.5)} />
        <Typography variant="headline-02" weight="light" style={{ color: DK.text, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {fmtLong(elapsed)}
        </Typography>
        {memoMode ? (
          <NewCaptionMemoInput elapsed={elapsed} onCancel={() => setMemoMode(false)} onSubmit={() => setMemoMode(false)} />
        ) : (
          <NewCaptionControls paused={paused} onToggle={onToggle} onStop={onStop} onMemo={() => setMemoMode(true)} />
        )}
      </View>
    </View>
  );
}

type TabKey = 'newcap' | 'current' | 'orb' | 'wave' | 'dock' | 'caption' | 'bubble' | 'focus' | 'mark' | 'rail';
interface TabMeta {
  key: TabKey;
  label: string;
  fun: number;
  clear: number;
  need: number;
  notes: { tone: 'good' | 'bad' | 'note'; text: string }[];
}
const TABS: TabMeta[] = [
  {
    key: 'newcap',
    label: '신규 자막',
    fun: 3,
    clear: 3,
    need: 3,
    notes: [
      { tone: 'good', text: '= 이미지 #5. 전사(자막)가 전체 화면 주연 — 도구가 일하는 게 가장 잘 보임. 하단 독에 블루 파형 + 작은 타이머 + [메모 | ⏸ | ■].' },
      { tone: 'good', text: '메모 탭 → 컨트롤 행이 입력 행으로 morph(파형·타이머 유지 = 녹음 지속 신호). 전송/취소 시 컨트롤로 복귀. 전사를 안 가림.' },
      { tone: 'note', text: '히어로(큰 타이머·오브) 제거 — 타이머는 하단 독으로 강등. 우상단 닫기로 최소화(홈 복귀). 트레이드오프: 메모 입력 중엔 일시정지/정지가 잠깐 가려짐(취소 한 탭으로 복귀).' },
    ],
  },
  {
    key: 'current',
    label: '현재',
    fun: 2,
    clear: 3,
    need: 3,
    notes: [
      { tone: 'good', text: 'REC·큰 타이머·정체성·파형·메모까지 필요 정보는 다 있음(대조군).' },
      { tone: 'bad', text: '요소를 세로로 쌓아 "무대감"이 약함 — 소리가 살아있다는 재미가 파형 한 줄에 갇힘.' },
      { tone: 'note', text: '전사·메모·컨트롤이 한 화면에 다 들어가 밀도는 높지만 시선 우선순위가 평평함.' },
    ],
  },
  {
    key: 'orb',
    label: '오브 호흡',
    fun: 3,
    clear: 3,
    need: 1,
    notes: [
      { tone: 'good', text: '호흡 오브 + 할로가 "지금 듣고 있다"를 감성적으로 — 재미·차분함 최고. 녹음 시작 직후 몰입에 적합.' },
      { tone: 'bad', text: '전사·메모·태그 등 상담사가 현장에서 쓰는 실무 정보가 없음 → 필요 박자 약함.' },
      { tone: 'note', text: '단독보다 "녹음 시작 0~3초 인트로" 후 다른 레이아웃으로 morph하는 진입 연출로 적합.' },
    ],
  },
  {
    key: 'wave',
    label: '파형 무대',
    fun: 3,
    clear: 2,
    need: 2,
    notes: [
      { tone: 'good', text: '풀폭 2단(빨강+보라) 파형이 주인공 — "소리가 보인다"는 재미가 가장 강함.' },
      { tone: 'bad', text: '파형이 무음/소음을 mock으로만 흉내 — 실제 metering 신뢰도가 직관을 좌우(조용하면 죽은 화면처럼 보임).' },
      { tone: 'note', text: '정체성 칩만으로 누구·맥락은 전달되나 전사·메모 진입은 별도 필요.' },
    ],
  },
  {
    key: 'dock',
    label: '컨트롤 도크',
    fun: 1,
    clear: 2,
    need: 3,
    notes: [
      { tone: 'good', text: '타이머+일시정지+정지를 한 줄 도크로, 하단에 태그 칩 + 빠른 메모 → 한손·즉시 기록(필요 최고).' },
      { tone: 'bad', text: '시각적 재미는 의도적으로 절제 — 차분하지만 "녹음 중" 생동감은 약함.' },
      { tone: 'note', text: '#태그로 그 순간을 분류 → 전사/분석 단계에서 하이라이트 점프 단서로 재사용 가능(§3-4-1 highlights).' },
    ],
  },
  // ── 프로덕션 두 맥락: 녹음 중(라이브 자막) → 분석 후 화자분리(말풍선) ──
  {
    key: 'caption',
    label: '라이브 자막',
    fun: 3,
    clear: 3,
    need: 3,
    notes: [
      { tone: 'good', text: '= 프로덕션 녹음 중 화면. 타이머·REC·일시정지/정지 + 실시간 전사 흐름 + 하단 시점 메모. 지금 production(RecordingSheet)이 하는 그대로.' },
      { tone: 'note', text: '녹음 중엔 화자분리(diarization) 전 — 화자 라벨 없이 타임스탬프+텍스트만. 화자 구분은 분석 후 상세(말풍선)에서.' },
      { tone: 'note', text: '"전사 중…" pulse로 빈 구간 방어. 무음 타임아웃(15초) 자동 복구와 연계.' },
    ],
  },
  {
    key: 'bubble',
    label: '말풍선 · 상세',
    fun: 3,
    clear: 3,
    need: 3,
    notes: [
      { tone: 'good', text: '= 분석 후 화자분리 상세(필드노트 상세 "전체 대화"). 데이터 실재 — refined_transcript · diarized_transcript · speaker_map.' },
      { tone: 'good', text: '내담자(보라)/상담사(그린) 화자 버블 + 화자명 + 타임스탬프. 버블 탭 → 그 지점부터 재생(seek). 하단 재생바.' },
      { tone: 'note', text: '녹음 chrome(REC·정지) 아님 — 재생/탐색 맥락. 현 production은 화자 헤더行으로 표시 중 → 말풍선으로 바꾸는 안(CompletedScreen TimelineRow).' },
    ],
  },
  {
    key: 'focus',
    label: '자막·포커스',
    fun: 3,
    clear: 2,
    need: 2,
    notes: [
      { tone: 'good', text: '최근 발화만 크게 또렷, 이전은 흐려져 위로 — "지금 이 말"에 몰입. 글랜스(흘끗) 가독 최고.' },
      { tone: 'bad', text: '지나간 맥락이 안 보여 "되짚기"·과거 인용이 약함. 메모 시점 앞뒤 맥락도 빈약.' },
      { tone: 'note', text: '현장 몰입·진행 중 확인엔 강하나, 검토·인용형 작업은 흐름/마킹이 유리. 둘을 토글로 전환하는 안도.' },
    ],
  },
  {
    key: 'mark',
    label: '자막·마킹',
    fun: 2,
    clear: 3,
    need: 3,
    notes: [
      { tone: 'good', text: '발화 줄을 녹음 중 실시간 북마크 → 소견 인용 후보·하이라이트로 직결(§3-4-3 quotes · §3-4-1 highlights). 필요◎.' },
      { tone: 'good', text: '"표시 N개" 누적이 끝나면 소견·일지 초안 scaffold가 됨 — 사후 되감기 노동 절감.' },
      { tone: 'note', text: '탭 대상이 작으면 오터치 → 줄 전체를 터치 타깃으로. 재미는 절제(차분한 실무형).' },
    ],
  },
  {
    key: 'rail',
    label: '자막·요약레일',
    fun: 3,
    clear: 3,
    need: 2,
    notes: [
      { tone: 'good', text: '대화에서 키워드가 실시간 누적 → 도구가 "듣고 정리까지" 하는 게 보임(재미+직관).' },
      { tone: 'bad', text: '녹음 중 AI 해석성 출력은 임상 오염 위험 — 검사 렌즈(§3-4-3)는 해석 금지. 상담도 사실 명사구 키워드까지만, 정서·진단 추론 금지.' },
      { tone: 'note', text: '키워드 칩 탭→그 지점 점프 단서로 재사용 가능. 정확도 낮으면 신뢰 저하 → on/off 토글 권장.' },
    ],
  },
];

function Dots({ n, color }: { n: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: s(3) }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: i < n ? color : 'rgba(255,255,255,0.18)' }} />
      ))}
    </View>
  );
}

function ThreeBeatBar({ meta, expanded, onToggle }: { meta: TabMeta; expanded: boolean; onToggle: () => void }) {
  return (
    <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderTopWidth: 1, borderTopColor: DK.line }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(20), paddingVertical: s(12), gap: s(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="label-02" style={{ color: DK.sub }}>재미</Typography>
          <Dots n={meta.fun} color={FNP} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="label-02" style={{ color: DK.sub }}>직관</Typography>
          <Dots n={meta.clear} color={COLORS.information} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="label-02" style={{ color: DK.sub }}>필요</Typography>
          <Dots n={meta.need} color={COLORS.success} />
        </View>
        <View style={{ flex: 1 }} />
        <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={s(18)} color={DK.sub} />
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: s(20), paddingBottom: s(16), gap: s(8) }}>
          {meta.notes.map((l, i) => {
            const tint = { good: COLORS.success, bad: COLORS.error, note: DK.sub } as const;
            const icon = { good: 'checkmark-circle', bad: 'close-circle', note: 'ellipse-outline' } as const;
            return (
              <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
                <Ionicons name={icon[l.tone] as keyof typeof Ionicons.glyphMap} size={s(14)} color={tint[l.tone]} style={{ marginTop: s(2) }} />
                <Typography variant="body-03" style={{ color: DK.text, flex: 1, lineHeight: s(20) }}>
                  {l.text}
                </Typography>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ═══════════════════ 화면 ═══════════════════

export default function FieldNoteRecordSheetLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('newcap');
  const [elapsed, setElapsed] = useState(8);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // mock 타이머
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const meta = useMemo(() => TABS.find((t) => t.key === tab)!, [tab]);
  // 라이브 자막 노출 개수 — 타이머 흐름에 맞춰 순차 등장
  const visibleCount = Math.min(CAPTION.length, Math.max(1, Math.floor(elapsed / 4)));

  const onStop = () => {
    setBanner('정지 → 저장/분석 시트로 (mock)');
    setPaused(true);
  };
  const onToggle = () => {
    setPaused((p) => !p);
    setBanner(null);
  };

  const sheetProps: SheetProps = { elapsed, paused, onToggle, onStop, visibleCount };

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* 헤더 */}
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={DK.text} />
          </Pressable>
          <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginLeft: s(2) }}>
            녹음 시트 · 3박자
          </Typography>
        </View>

        {/* 탭 */}
        <View style={{ paddingTop: s(8) }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(8), paddingHorizontal: s(20) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    setTab(t.key);
                    setBanner(null);
                  }}
                  style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.06)' }}
                >
                  <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : DK.sub }}>
                    {t.label}
                  </Typography>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* 시트 무대 — 실제 녹음 모달이 떠오른 모습 */}
        <View style={{ flex: 1, paddingHorizontal: s(12), paddingTop: s(12), paddingBottom: s(12) }}>
          <View style={{ flex: 1, borderRadius: s(24), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } }}>
            <LinearGradient colors={SHEET_GRAD} style={{ flex: 1 }}>
              <Handle />
              <View style={{ flex: 1 }}>
                {tab === 'newcap' ? (
                  <SheetNewCaption {...sheetProps} onClose={() => setBanner('닫기 → 최소화 (홈 복귀, mock)')} />
                ) : tab === 'current' ? (
                  <SheetCurrent {...sheetProps} />
                ) : tab === 'orb' ? (
                  <SheetOrb {...sheetProps} />
                ) : tab === 'wave' ? (
                  <SheetWaveStage {...sheetProps} />
                ) : tab === 'dock' ? (
                  <SheetDock {...sheetProps} />
                ) : tab === 'caption' ? (
                  <SheetLiveCaption {...sheetProps} />
                ) : tab === 'bubble' ? (
                  <SheetCaptionBubble {...sheetProps} />
                ) : tab === 'focus' ? (
                  <SheetCaptionFocus {...sheetProps} />
                ) : tab === 'mark' ? (
                  <SheetCaptionMark {...sheetProps} />
                ) : (
                  <SheetCaptionRail {...sheetProps} />
                )}
              </View>

              {/* 정지 배너 (mock) */}
              {banner ? (
                <View style={{ position: 'absolute', left: s(16), right: s(16), bottom: s(74), padding: s(12), borderRadius: s(12), backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                  <Ionicons name="arrow-forward-circle" size={s(16)} color={DK.accent} />
                  <Typography variant="body-03" style={{ color: DK.text, flex: 1 }}>
                    {banner}
                  </Typography>
                  <Pressable onPress={() => { setBanner(null); setPaused(false); }} hitSlop={8}>
                    <Typography variant="label-01" weight="semibold" style={{ color: DK.accent }}>다시</Typography>
                  </Pressable>
                </View>
              ) : null}

              {/* 3박자 판정 바 (시트 하단 고정) */}
              <ThreeBeatBar meta={meta} expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </LinearGradient>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
