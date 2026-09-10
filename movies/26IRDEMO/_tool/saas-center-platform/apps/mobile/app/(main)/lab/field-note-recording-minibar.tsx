import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 녹음 미니바 — 재사용 부품 lab.
 *
 * 단일 활성 녹음 모델(메모 확정: 단일 활성 녹음 + 최소화 미니바 + 멈춤≠폐기→분석 finalize)의
 * 핵심 부품. 화면을 가로막는 풀 시트가 아니라, 어디서든 떠 있는 최소화 바로 "지금 녹음 중"을
 * 유지하고, 검사·회기 사이를 오가도 안전하게 한다.
 *
 * 진입점(검사 항목 칩 / FAB / 회기 카드 등)은 이 바를 띄우는 방아쇠일 뿐 — 바 자체는 공통.
 * assessment-task-record-3beat 에서 뽑아 독립 부품으로 정리.
 *
 * 동작 — 시작 → (타이머) → 일시정지/재개 → 정지(폐기 아님, 분석으로 넘어감, 토스트).
 * 탭 = 시각 변형(다크 컴팩트 / 다크 라벨 / 라이트 / 확장 핸들). 상단 "녹음 시작"으로 띄움.
 *
 * 전부 mock. 확정 시 production 전역 RecordingMiniBar 컴포넌트로 추출(RecordingHost 연결).
 */

type TabKey = 'darkCompact' | 'darkLabel' | 'light' | 'handle';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'darkCompact',
    label: '다크 컴팩트',
    caption:
      '가장 작은 다크 바 — 펄스+파형+연결 라벨+타이머, 컨트롤은 아이콘만(일시정지·정지). 어디에 떠도 부담 없음. 공간 최소.',
  },
  {
    key: 'darkLabel',
    label: '다크 라벨',
    caption:
      '다크 바 + 글자 컨트롤(일시정지/정지). 누를 곳이 또렷해 오조작 ↓. 컴팩트보다 한 단계 큼.',
  },
  {
    key: 'light',
    label: '라이트',
    caption:
      'white surface + 보라 accent 버전. 다크가 무거운 맥락(밝은 화면 위)에서. 보더로 경계, 정체성색 보라.',
  },
  {
    key: 'handle',
    label: '확장 핸들',
    caption:
      '바 자체가 "녹음 화면으로 돌아가는 핸들" — 탭하면 풀 시트 열림 힌트 + 정지. 최소화↔복귀를 명확히. 가장 큼.',
  },
];

type Phase = 'idle' | 'recording' | 'paused';

const LINK_LABEL = '로르샤흐 검사'; // 연결 대상 mock (검사 task / 회기)

function fmt(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

// ──────────────── Page ────────────────

export default function RecordingMiniBarLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tabKey, setTabKey] = useState<TabKey>('darkCompact');
  const active = TABS.find((t) => t.key === tabKey)!;

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    setElapsed(0);
    setPhase('recording');
    setToast(false);
  };
  const togglePause = () => setPhase((p) => (p === 'recording' ? 'paused' : 'recording'));
  const stop = () => {
    setPhase('idle');
    setToast(true);
    setTimeout(() => setToast(false), 2200);
  };

  const barProps = { phase, elapsed, link: LINK_LABEL, onPause: togglePause, onStop: stop };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: COLORS.bg.base }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">
          필드노트 · 녹음 미니바
        </Typography>
      </View>

      {/* 탭 pill */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTabKey(t.key)}
                style={{ flex: 1, paddingVertical: s(8), paddingHorizontal: s(2), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? COLORS.white : 'transparent' }}
              >
                <Typography variant="label-02" weight={on ? 'semibold' : 'medium'} numberOfLines={1} style={{ color: on ? COLORS.gray[900] : COLORS.gray[500] }}>
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(8), paddingHorizontal: s(2), lineHeight: 16 }}>
          {active.caption}
        </Typography>
      </View>

      {/* mock 배경 (바가 떠 있는 맥락) + 시작 버튼 */}
      <ScrollView style={{ backgroundColor: COLORS.white, marginTop: s(12) }} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ padding: s(20), gap: s(12) }}>
          <Typography variant="body-03" className="text-gray-400">
            아래는 미니바가 떠 있는 맥락을 보여주는 더미 화면이에요.
          </Typography>
          {phase === 'idle' && (
            <TouchableOpacity
              onPress={start}
              activeOpacity={0.85}
              style={{ borderRadius: s(12), backgroundColor: FN, paddingVertical: s(13), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6) }}
            >
              <Ionicons name="mic" size={16} color={COLORS.white} />
              <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
                녹음 시작 (미니바 띄우기)
              </Typography>
            </TouchableOpacity>
          )}
          {/* 더미 카드들 */}
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), padding: s(16), gap: s(8) }}>
              <View style={{ height: s(12), width: `${60 - i * 8}%`, borderRadius: s(6), backgroundColor: COLORS.gray[200] }} />
              <View style={{ height: s(10), width: `${80 - i * 5}%`, borderRadius: s(5), backgroundColor: COLORS.gray[100] }} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 토스트 */}
      {toast && (
        <View style={{ position: 'absolute', left: s(16), right: s(16), bottom: insets.bottom + s(16), backgroundColor: COLORS.gray[800], borderRadius: s(16), paddingVertical: s(14), paddingHorizontal: s(18), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.white }}>
            녹음을 분석으로 넘겼어요
          </Typography>
        </View>
      )}

      {/* ── 미니바 (변형별) ── */}
      {phase !== 'idle' && !toast && (
        <View style={{ position: 'absolute', left: s(12), right: s(12), bottom: insets.bottom + s(10) }}>
          {tabKey === 'darkCompact' && <BarDarkCompact {...barProps} />}
          {tabKey === 'darkLabel' && <BarDarkLabel {...barProps} />}
          {tabKey === 'light' && <BarLight {...barProps} />}
          {tabKey === 'handle' && <BarHandle {...barProps} />}
        </View>
      )}
    </SafeAreaView>
  );
}

// ──────────────── 공통 ────────────────

const FN = COLORS.fieldnote;

type BarProps = {
  phase: Phase;
  elapsed: number;
  link: string;
  onPause: () => void;
  onStop: () => void;
};

const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
};

// ──────────────── 변형 A: 다크 컴팩트 ────────────────

function BarDarkCompact({ phase, elapsed, link, onPause, onStop }: BarProps) {
  const live = phase === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.gray[900], borderRadius: s(16), paddingVertical: s(12), paddingHorizontal: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10), ...SHADOW }}>
      {live ? <PulseDot color={COLORS.error} size={s(8)} /> : <Ionicons name="pause" size={s(13)} color={COLORS.gray[400]} />}
      <WaveBars count={5} color={live ? COLORS.white : COLORS.gray[600]} mode={live ? 'live' : 'static'} height={s(14)} barWidth={s(2)} gap={s(2)} />
      <View style={{ flex: 1 }}>
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }} numberOfLines={1}>
          {link} {live ? '녹음 중' : '일시정지'}
        </Typography>
        <Typography variant="caption-01" style={{ color: COLORS.gray[400] }}>{fmt(elapsed)}</Typography>
      </View>
      <IconBtn icon={live ? 'pause' : 'play'} onPress={onPause} bg="rgba(255,255,255,0.14)" fg={COLORS.white} />
      <IconBtn icon="stop" onPress={onStop} bg={COLORS.error} fg={COLORS.white} />
    </View>
  );
}

// ──────────────── 변형 B: 다크 라벨 ────────────────

function BarDarkLabel({ phase, elapsed, link, onPause, onStop }: BarProps) {
  const live = phase === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.gray[900], borderRadius: s(18), paddingVertical: s(12), paddingHorizontal: s(16), gap: s(10), ...SHADOW }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        {live ? <PulseDot color={COLORS.error} size={s(8)} /> : <Ionicons name="pause" size={s(14)} color={COLORS.gray[400]} />}
        <View style={{ flex: 1 }}>
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }} numberOfLines={1}>
            {link} {live ? '녹음 중' : '일시정지됨'}
          </Typography>
          <Typography variant="caption-01" style={{ color: COLORS.gray[400] }}>
            {fmt(elapsed)} · 정지하면 분석으로 넘어가요
          </Typography>
        </View>
        <WaveBars count={6} color={live ? COLORS.white : COLORS.gray[600]} mode={live ? 'live' : 'static'} height={s(16)} barWidth={s(2.5)} gap={s(2)} />
      </View>
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        <TextBtn icon={live ? 'pause' : 'play'} label={live ? '일시정지' : '재개'} onPress={onPause} bg="rgba(255,255,255,0.12)" fg={COLORS.white} flex />
        <TextBtn icon="stop" label="정지" onPress={onStop} bg={COLORS.error} fg={COLORS.white} flex />
      </View>
    </View>
  );
}

// ──────────────── 변형 C: 라이트 ────────────────

function BarLight({ phase, elapsed, link, onPause, onStop }: BarProps) {
  const live = phase === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: s(16), borderWidth: 1, borderColor: COLORS.gray[200], paddingVertical: s(12), paddingHorizontal: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10), ...SHADOW }}>
      {live ? <PulseDot color={COLORS.error} size={s(8)} /> : <Ionicons name="pause" size={s(14)} color={COLORS.gray[400]} />}
      <WaveBars count={5} color={live ? COLORS.error : COLORS.gray[300]} mode={live ? 'live' : 'static'} height={s(14)} barWidth={s(2)} gap={s(2)} />
      <View style={{ flex: 1 }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-900" numberOfLines={1}>
          {link} {live ? '녹음 중' : '일시정지'}
        </Typography>
        <Typography variant="caption-01" style={{ color: FN }}>{fmt(elapsed)}</Typography>
      </View>
      <IconBtn icon={live ? 'pause' : 'play'} onPress={onPause} bg={COLORS.gray[100]} fg={COLORS.gray[700]} />
      <IconBtn icon="stop" onPress={onStop} bg={COLORS.error} fg={COLORS.white} />
    </View>
  );
}

// ──────────────── 변형 D: 확장 핸들 ────────────────

function BarHandle({ phase, elapsed, link, onPause, onStop }: BarProps) {
  const live = phase === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.gray[900], borderRadius: s(20), paddingTop: s(8), paddingBottom: s(12), paddingHorizontal: s(16), gap: s(10), ...SHADOW }}>
      {/* 드래그/복귀 힌트 핸들 */}
      <View style={{ alignSelf: 'center', width: s(36), height: s(4), borderRadius: s(2), backgroundColor: COLORS.gray[600] }} />
      <TouchableOpacity activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        {live ? <PulseDot color={COLORS.error} size={s(9)} /> : <Ionicons name="pause" size={s(15)} color={COLORS.gray[400]} />}
        <View style={{ flex: 1 }}>
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }} numberOfLines={1}>
            {link}에 {live ? '녹음 중' : '일시정지됨'}
          </Typography>
          <Typography variant="caption-01" style={{ color: COLORS.gray[400] }}>
            {fmt(elapsed)} · 탭하면 녹음 화면으로
          </Typography>
        </View>
        <WaveBars count={7} color={live ? COLORS.white : COLORS.gray[600]} mode={live ? 'live' : 'static'} height={s(18)} barWidth={s(2.5)} gap={s(2.5)} />
        <Ionicons name="chevron-up" size={18} color={COLORS.gray[500]} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        <TextBtn icon={live ? 'pause' : 'play'} label={live ? '일시정지' : '재개'} onPress={onPause} bg="rgba(255,255,255,0.12)" fg={COLORS.white} flex />
        <TextBtn icon="stop" label="정지하고 분석" onPress={onStop} bg={COLORS.error} fg={COLORS.white} flex />
      </View>
    </View>
  );
}

// ──────────────── 버튼 ────────────────

function IconBtn({ icon, onPress, bg, fg }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; bg: string; fg: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={{ width: s(34), height: s(34), borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={16} color={fg} />
    </TouchableOpacity>
  );
}

function TextBtn({ icon, label, onPress, bg, fg, flex }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; bg: string; fg: string; flex?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flex: flex ? 1 : undefined, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5), backgroundColor: bg, borderRadius: s(12), paddingVertical: s(11) }}
    >
      <Ionicons name={icon} size={14} color={fg} />
      <Typography variant="label-01" weight="semibold" style={{ color: fg }}>{label}</Typography>
    </TouchableOpacity>
  );
}

// ──────────────── 모션 프리미티브 ────────────────

const STATIC_WAVE = [0.4, 0.7, 0.5, 0.95, 0.6, 1, 0.45, 0.8, 0.5, 0.7, 0.55, 0.85];

function WaveBars({ count = 5, color, mode, height = 14, barWidth = 2, gap = 2 }: { count?: number; color: string; mode: 'live' | 'static'; height?: number; barWidth?: number; gap?: number }) {
  const animsRef = useRef(Array.from({ length: count }, () => new Animated.Value(0.4)));
  const anims = animsRef.current;
  useEffect(() => {
    if (mode !== 'live') return;
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i % 5) * 60),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [mode, anims]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap, height }}>
      {anims.map((v, i) => {
        const h = mode === 'live' ? v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.25, height] }) : height * STATIC_WAVE[i % STATIC_WAVE.length];
        return <Animated.View key={i} style={{ width: barWidth, height: h, borderRadius: barWidth, backgroundColor: color }} />;
      })}
    </View>
  );
}

function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.3, duration: 650, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size, backgroundColor: color, opacity: a }} />;
}
