import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RAnimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 녹음 분석(ProcessingScreen) 스텝 표시 개선 시안.
 *
 * 현재는 점+라벨 느슨한 리스트라 "단계가 어디까지 왔는지"가 한눈에 안 들어옴.
 * → 연결선 있는 깔끔한 세로 스텝퍼로: 완료(체크·채운 선) / 진행(accent 펄스 링·강조) / 대기(흐림),
 *   단계별 아이콘 + 한 줄 설명 + 전체 진행도. 사인오프되면 ProcessingScreen 에 포팅.
 *
 * 탭 — [현재] 느슨한 리스트(대조군) / [스텝퍼] 개선. ▶로 단계 진행 시뮬.
 * 전부 mock.
 */

const FN = COLORS.fieldnoteDark;

const STEPS = [
  { key: 'transcribing', label: '음성 전사', icon: 'document-text-outline' as const, desc: '말한 내용을 텍스트로' },
  { key: 'refining', label: 'AI 보정', icon: 'sparkles-outline' as const, desc: '오타·끊김 정리' },
  { key: 'summarizing', label: '요약 생성', icon: 'list-outline' as const, desc: '핵심만 추려서' },
  { key: 'generating_note', label: '상담일지 초안', icon: 'create-outline' as const, desc: '회기 일지 작성' },
];

type StepState = 'completed' | 'active' | 'pending';
function stateOf(i: number, cur: number): StepState {
  if (cur >= STEPS.length) return 'completed';
  if (i < cur) return 'completed';
  if (i === cur) return 'active';
  return 'pending';
}

// 진행 시뮬 훅
function useStepSim() {
  const [cur, setCur] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || cur > STEPS.length) return;
    const t = setTimeout(() => setCur((c) => c + 1), 1300);
    return () => clearTimeout(t);
  }, [running, cur]);
  const done = cur >= STEPS.length;
  return { cur, running, setRunning, reset: () => { setCur(0); setRunning(false); }, done };
}

function PulseDot({ size = 24 }: { size?: number }) {
  // 라디에이팅 펄스 — 바깥 링이 퍼지며 사라지고, 안쪽 점은 은은히 숨쉼.
  const ring = useSharedValue(0);
  const core = useSharedValue(0);
  useEffect(() => {
    ring.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.ease) }), -1, false);
    core.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [ring, core]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + ring.value * 0.95 }],
    opacity: 0.45 * (1 - ring.value),
  }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + core.value * 0.2 }] }));
  return (
    <View style={{ width: s(size), height: s(size), alignItems: 'center', justifyContent: 'center' }}>
      <RAnimated.View style={[{ position: 'absolute', width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: FN.accent }, ringStyle]} />
      <RAnimated.View style={[{ width: s(size - 10), height: s(size - 10), borderRadius: s(size), backgroundColor: FN.accent }, coreStyle]} />
    </View>
  );
}

// ════════════════════ 현재 (대조군) ════════════════════
function CurrentList({ cur }: { cur: number }) {
  return (
    <View style={{ gap: s(12) }}>
      {STEPS.map((st, i) => {
        const stt = stateOf(i, cur);
        return (
          <View key={st.key} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), height: s(24) }}>
            {stt === 'completed' ? (
              <Ionicons name="checkmark-circle" size={s(20)} color={FN.accent} />
            ) : stt === 'active' ? (
              <View style={{ width: s(20), height: s(20), borderRadius: s(10), backgroundColor: FN.accent }} />
            ) : (
              <View style={{ width: s(20), height: s(20), borderRadius: s(10), borderWidth: 2, borderColor: FN.line }} />
            )}
            <Typography variant="body-03" weight={stt === 'active' ? 'semibold' : 'regular'} style={{ color: stt === 'active' ? FN.text : FN.sub }}>
              {STEPS[i].label} 중
            </Typography>
          </View>
        );
      })}
    </View>
  );
}

// ════════════════════ 개선 스텝퍼 ════════════════════
function Stepper({ cur }: { cur: number }) {
  const doneCount = Math.min(cur, STEPS.length);
  return (
    <View>
      {/* 전체 진행도 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(14) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: FN.text }}>분석 진행</Typography>
        <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>{doneCount} / {STEPS.length}</Typography>
      </View>

      {STEPS.map((st, i) => {
        const stt = stateOf(i, cur);
        const isLast = i === STEPS.length - 1;
        const lineColor = i < cur ? FN.accent : FN.line; // 위 단계 완료면 채운 선
        return (
          <View key={st.key} style={{ flexDirection: 'row', gap: s(12) }}>
            {/* 레일 (선 + 노드) */}
            <View style={{ alignItems: 'center', width: s(24) }}>
              <View style={{ width: s(24), height: s(24), alignItems: 'center', justifyContent: 'center' }}>
                {stt === 'completed' ? (
                  <RAnimated.View key="done" entering={ZoomIn.springify().damping(11).stiffness(180)} style={{ width: s(24), height: s(24), borderRadius: s(12), backgroundColor: FN.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="checkmark" size={s(14)} color={COLORS.white} />
                  </RAnimated.View>
                ) : stt === 'active' ? (
                  <PulseDot size={24} />
                ) : (
                  <View style={{ width: s(20), height: s(20), borderRadius: s(10), borderWidth: 2, borderColor: FN.line }} />
                )}
              </View>
              {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: lineColor, marginVertical: s(2), minHeight: s(20) }} />}
            </View>

            {/* 내용 — active 면 accent 카드로 강조 */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : s(14) }}>
              <View style={{
                borderRadius: s(12),
                paddingHorizontal: stt === 'active' ? s(12) : 0,
                paddingVertical: stt === 'active' ? s(10) : s(1),
                backgroundColor: stt === 'active' ? 'rgba(185,139,255,0.12)' : 'transparent',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
                  <Ionicons name={st.icon} size={s(15)} color={stt === 'pending' ? FN.sub : FN.accent} />
                  <Typography variant="body-02" weight={stt === 'active' ? 'semibold' : 'medium'} style={{ color: stt === 'pending' ? FN.sub : FN.text }}>
                    {st.label}
                  </Typography>
                  <View style={{ marginLeft: 'auto' }}>
                    {stt === 'completed' ? (
                      <Typography variant="caption-01" weight="medium" style={{ color: COLORS.palette.green }}>완료</Typography>
                    ) : stt === 'active' ? (
                      <RAnimated.View entering={FadeIn}><Typography variant="caption-01" weight="medium" style={{ color: FN.accent }}>진행 중</Typography></RAnimated.View>
                    ) : (
                      <Typography variant="caption-01" style={{ color: FN.sub }}>대기</Typography>
                    )}
                  </View>
                </View>
                <Typography variant="caption-01" style={{ color: FN.sub, marginTop: s(3), marginLeft: s(22) }}>{st.desc}</Typography>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// 분석 화면 chrome (다크 + 헤더 + 타이틀)
function ProcessingChrome({ cur, children }: { cur: number; children: React.ReactNode }) {
  const done = cur >= STEPS.length;
  const activeLabel = !done && cur < STEPS.length ? `${STEPS[cur].label} 중` : '';
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(48), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14) }}>
        <Ionicons name="chevron-back" size={s(22)} color={FN.sub} />
      </View>
      <View style={{ alignItems: 'center', paddingHorizontal: s(28), paddingTop: s(8), paddingBottom: s(20) }}>
        {/* 작은 진행 인디케이터 — 완료 시 체크가 톡 등장 */}
        <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: done ? 'rgba(0,191,64,0.14)' : 'rgba(185,139,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: s(16) }}>
          {done ? (
            <RAnimated.View key="done" entering={ZoomIn.springify().damping(10).stiffness(160)}>
              <Ionicons name="checkmark" size={s(28)} color={COLORS.palette.green} />
            </RAnimated.View>
          ) : (
            <Ionicons name="sparkles" size={s(26)} color={FN.accent} />
          )}
        </View>
        <Typography variant="headline-02" weight="bold" style={{ color: FN.text }}>{done ? '분석이 완료되었어요' : '녹음을 분석하고 있어요'}</Typography>
        {/* 단계 라벨 — 단계 바뀔 때마다 크로스페이드 */}
        <View style={{ height: s(20), marginTop: s(6) }}>
          <RAnimated.View key={done ? 'done' : `s${cur}`} entering={FadeIn.duration(320)}>
            <Typography variant="body-03" style={{ color: FN.sub }}>{done ? '잠시 후 결과를 확인하세요' : activeLabel || '곧 시작해요'}</Typography>
          </RAnimated.View>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: s(24) }}>{children}</View>
      <View style={{ alignItems: 'center', paddingBottom: s(20) }}>
        <Typography variant="caption-01" style={{ color: FN.sub }}>다른 화면에서 작업하셔도 분석은 계속돼요</Typography>
      </View>
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'stepper';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'stepper', label: '스텝퍼' },
];

export default function FieldNoteProcessingStepsLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stepper');
  const sim = useStepSim();

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">녹음 분석 스텝</Typography>
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
        {/* 진행 시뮬 컨트롤 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(12) }}>
          <Pressable onPress={() => sim.setRunning((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), backgroundColor: COLORS.fieldnote, borderRadius: s(999), paddingHorizontal: s(14), paddingVertical: s(8) }}>
            <Ionicons name={sim.running ? 'pause' : 'play'} size={s(14)} color={COLORS.white} />
            <Typography variant="label-01" weight="semibold" className="text-white">{sim.running ? '멈춤' : sim.done ? '다시' : '진행 시뮬'}</Typography>
          </Pressable>
          <Pressable onPress={sim.reset} hitSlop={8} style={{ width: s(36), height: s(36), borderRadius: s(18), backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={s(16)} color={COLORS.gray[600]} />
          </Pressable>
          <Typography variant="caption-01" className="text-gray-500" style={{ flex: 1 }}>▶ 단계가 하나씩 완료돼요</Typography>
        </View>

        <View style={{ height: s(560), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>
          <ProcessingChrome cur={sim.cur}>
            {tab === 'current' ? <CurrentList cur={sim.cur} /> : <Stepper cur={sim.cur} />}
          </ProcessingChrome>
        </View>

        <Typography variant="body-03" className="text-gray-500" style={{ marginTop: s(14), lineHeight: s(20) }}>
          {tab === 'current'
            ? '현재 — 점+라벨 느슨한 리스트. 단계 위계·진행도가 약함.'
            : '개선 — 연결선 스텝퍼. 완료(체크·채운 선)/진행(accent 펄스+카드 강조)/대기(흐림) + 아이콘·한 줄 설명 + N/4 진행도. 사인오프되면 ProcessingScreen 에 포팅.'}
        </Typography>
      </ScrollView>
    </View>
  );
}
