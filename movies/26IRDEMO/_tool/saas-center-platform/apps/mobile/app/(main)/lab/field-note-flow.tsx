import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 녹음→분석 근본 흐름 3안 — 인터랙티브 워크스루.
 *
 * 출발점(상담사 페르소나): 회기 중 폰은 내려놓고 내담자에 집중 / 회기 직후엔 소진 상태라
 * 결정·대기를 강요받기 싫음 / 검토는 나중에 일지 쓸 때 따로. → "멈추면 그냥 저장·목록 복귀,
 * 처리는 백그라운드, 검토는 따로"가 자연스러움. 클로바노트·Otter·Granola 공통 표준 —
 * 어떤 앱도 '처리 중' 전체화면에 사용자를 가두지 않는다.
 *
 * 분석의 두 층위(상담사 결정 반영):
 *  · 전사 + 화자 분리 = 기반(자동·백그라운드). 녹음을 '읽을 수 있게' 만드는 가벼운 단계.
 *  · AI 요약 + 일지 초안 = 선택(원할 때 호출). 무거운 LLM 해석/생성 — 강제하지 않음.
 *  (백엔드: transcribing·refining = 자동 / summarizing·generating_note = 별도 호출)
 *
 * 현재 구현은 한 화면이 7모드로 변형되는 '화면=상태머신'이라 (1) 정지하면 처리에 갇히고
 * (2) 뒤로가기가 늘 전체 탈출이 됨.
 *
 * 탭 — [현재](대조군) / [대안 A ≈클로바노트] / [대안 B ≈Granola enhance] / [대안 C ≈ambient].
 * 상단 '상담사 기준' 스트립으로 잣대를 고정, 각 단계 주석에 '업계 표준 부합' 행. 전부 mock.
 */

// ───────────────────────── mock ─────────────────────────
const CLIENT = '김민준';
const PROGRAM = '놀이치료-개인';
const TIMER = '12:47';
const MEMO_N = 3;
const TAG_N = 2;
const SUMMARY = '분리불안으로 인한 등원 거부가 핵심. 놀이 안에서 처음으로 먼저 다가옴 — 작은 전환점.';

const FN = COLORS.fieldnoteDark;

// ───────────────────────── 공용: 호흡 파형 ─────────────────────────
function Waveform({ active, color, h = 40 }: { active: boolean; color: string; h?: number }) {
  const bars = useRef(Array.from({ length: 13 }, () => new Animated.Value(0.28))).current;
  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.3));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 340 + (i % 3) * 130, delay: i * 45, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 340 + (i % 3) * 130, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: s(h), gap: s(4) }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: s(4), height: s(h * 0.85), borderRadius: s(2), backgroundColor: color, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ───────────────────────── 공용: 폰 프레임 ─────────────────────────
function Phone({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <View
      style={{
        height: s(420),
        borderRadius: s(24),
        backgroundColor: dark ? FN.bg : COLORS.gray[50],
        borderWidth: 1,
        borderColor: dark ? FN.line : COLORS.gray[200],
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

// ───────────────────────── 공용: 상담사 기준 스트립 ─────────────────────────
function StandardStrip() {
  const chips = ['멈춤 = 저장·목록 복귀', '전사·화자분리 = 자동', 'AI 요약·일지초안 = 선택', '검토 = 나중에 따로'];
  return (
    <View style={{ marginBottom: s(14), borderRadius: s(12), backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[200], padding: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8) }}>
        <Ionicons name="person-circle-outline" size={s(15)} color={COLORS.gray[700]} />
        <Typography variant="label-01" weight="semibold" className="text-gray-700">상담사 기준 — 이 잣대로 각 탭을 보세요</Typography>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
        {chips.map((c) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.white, borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(5) }}>
            <Ionicons name="checkmark-circle" size={s(12)} color={COLORS.palette.green} />
            <Typography variant="label-02" weight="medium" className="text-gray-700">{c}</Typography>
          </View>
        ))}
      </View>
      <Typography variant="caption-01" style={{ marginTop: s(8), color: COLORS.gray[400] }}>
        전사·화자분리는 가벼운 기반이라 자동, AI 요약·일지 초안은 무거워서 원할 때만. 어떤 앱도 "처리 중" 전체화면에 가두지 않음.
      </Typography>
    </View>
  );
}

// ───────────────────────── 공용: 탭 인트로(앱 대응 + 권장 + 설명) ─────────────────────────
function TabIntro({ analog, recommended, desc }: { analog: string; recommended?: boolean; desc: string }) {
  return (
    <View style={{ marginBottom: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8), flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.gray[100], borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(4) }}>
          <Ionicons name="apps-outline" size={s(12)} color={COLORS.gray[600]} />
          <Typography variant="label-02" weight="medium" className="text-gray-600">{analog}</Typography>
        </View>
        {recommended && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: 'rgba(155,93,255,0.12)', borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(4) }}>
            <Ionicons name="star" size={s(11)} color={COLORS.fieldnote} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>권장 · 최소 변경</Typography>
          </View>
        )}
      </View>
      <Typography variant="body-03" className="text-gray-500">{desc}</Typography>
    </View>
  );
}

// ───────────────────────── 공용: 주석 스트립 ─────────────────────────
interface Ann {
  screen: string;
  back: string;
  mind: string;
  jail?: boolean;
  std: { ok: boolean; text: string };
}
function Annotation({ screen, back, mind, jail, std }: Ann) {
  const rows = [
    { label: '현재 화면', value: screen, color: COLORS.gray[700], icon: 'phone-portrait-outline' as const, bold: false },
    { label: '뒤로가기', value: back, color: jail ? COLORS.error : COLORS.primary700, icon: (jail ? 'lock-closed' : 'arrow-undo-outline') as keyof typeof Ionicons.glyphMap, bold: true },
    { label: '이 순간', value: mind, color: COLORS.gray[600], icon: 'bulb-outline' as const, bold: false },
  ];
  return (
    <View style={{ marginTop: s(12), borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(9), borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.gray[100] }}>
          <Ionicons name={r.icon} size={s(14)} color={r.color} style={{ marginTop: s(1) }} />
          <Typography variant="label-02" weight="medium" style={{ width: s(56), color: COLORS.gray[400] }}>{r.label}</Typography>
          <Typography variant="label-01" weight={r.bold ? 'semibold' : 'regular'} style={{ flex: 1, color: r.color }}>{r.value}</Typography>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(9), borderTopWidth: 1, borderTopColor: COLORS.gray[100], backgroundColor: std.ok ? 'rgba(1,119,80,0.05)' : 'rgba(255,66,66,0.05)' }}>
        <Ionicons name={std.ok ? 'checkmark-circle' : 'close-circle'} size={s(14)} color={std.ok ? COLORS.palette.green : COLORS.error} style={{ marginTop: s(1) }} />
        <Typography variant="label-02" weight="medium" style={{ width: s(56), color: COLORS.gray[400] }}>업계 표준</Typography>
        <Typography variant="label-01" weight="medium" style={{ flex: 1, color: std.ok ? COLORS.palette.green : COLORS.error }}>{std.text}</Typography>
      </View>
    </View>
  );
}

// ───────────────────────── 공용: 단계 컨트롤 ─────────────────────────
function Controls({ step, total, cta, onNext, onReset }: { step: number; total: number; cta: string; onNext: () => void; onReset: () => void }) {
  const last = step >= total - 1;
  return (
    <View style={{ marginTop: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <View style={{ flexDirection: 'row', gap: s(5), flex: 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: i <= step ? COLORS.fieldnote : COLORS.gray[200] }} />
        ))}
      </View>
      {step > 0 && (
        <Pressable onPress={onReset} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), paddingHorizontal: s(10), paddingVertical: s(8), borderRadius: s(999), backgroundColor: COLORS.gray[100] }}>
          <Ionicons name="refresh" size={s(13)} color={COLORS.gray[600]} />
          <Typography variant="label-01" weight="medium" className="text-gray-600">처음</Typography>
        </Pressable>
      )}
      <Pressable onPress={last ? onReset : onNext} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(16), paddingVertical: s(10), borderRadius: s(999), backgroundColor: last ? COLORS.gray[800] : COLORS.fieldnote }}>
        <Typography variant="label-01" weight="semibold" className="text-white">{last ? '다시 보기' : cta}</Typography>
        {!last && <Ionicons name="arrow-forward" size={s(14)} color={COLORS.white} />}
      </Pressable>
    </View>
  );
}

// ───────────────────────── 공용 화면 목업 조각 ─────────────────────────
function MiniBar({ dark }: { dark?: boolean }) {
  return (
    <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
      <Ionicons name="chevron-back" size={s(20)} color={dark ? FN.sub : COLORS.gray[400]} />
      <Typography variant="label-01" weight="semibold" style={{ color: dark ? FN.text : COLORS.gray[800] }}>필드노트</Typography>
      <View style={{ width: s(20) }} />
    </View>
  );
}

function ContextChip() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: s(6), backgroundColor: 'rgba(185,139,255,0.16)', paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(999) }}>
      <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: FN.accent }} />
      <Typography variant="label-01" weight="medium" style={{ color: FN.text }}>{CLIENT} · {PROGRAM}</Typography>
    </View>
  );
}

/** 다크 녹음 화면 */
function RecordingMock({ active = true }: { active?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <MiniBar dark />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: s(20), paddingHorizontal: s(20) }}>
        <ContextChip />
        <View style={{ alignItems: 'center', gap: s(16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: COLORS.error }} />
            <Typography style={{ fontSize: s(44), lineHeight: s(50), fontWeight: '300', color: FN.text }}>{TIMER}</Typography>
          </View>
          <Waveform active={active} color={FN.accent} h={44} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(28) }}>
          <View style={{ alignItems: 'center', gap: s(4) }}>
            <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={s(20)} color={FN.sub} />
            </View>
            <Typography variant="caption-01" style={{ color: FN.sub }}>메모 {MEMO_N}</Typography>
          </View>
          <View style={{ width: s(68), height: s(68), borderRadius: s(34), backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: s(24), height: s(24), borderRadius: s(6), backgroundColor: COLORS.gray[900] }} />
          </View>
          <View style={{ alignItems: 'center', gap: s(4) }}>
            <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pause" size={s(20)} color={FN.sub} />
            </View>
            <Typography variant="caption-01" style={{ color: FN.sub }}>태그 {TAG_N}</Typography>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 처리 스피너 화면 — jail=true면 '갇힌' 강조 (현재 대조군 전용) */
function ProcessingMock() {
  const STEPS = ['전사', 'AI 보정', '요약', '일지 초안'];
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16) }}>
        <Ionicons name="lock-closed" size={s(18)} color={'rgba(255,255,255,0.25)'} />
        <Typography variant="caption-01" style={{ marginLeft: s(6), color: 'rgba(255,255,255,0.3)' }}>뒤로 막힘</Typography>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(22) }}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <View style={{ width: s(64), height: s(64), borderRadius: s(32), borderWidth: s(4), borderColor: 'rgba(185,139,255,0.2)', borderTopColor: FN.accent }} />
        </Animated.View>
        <View style={{ gap: s(8) }}>
          {STEPS.map((st, i) => (
            <View key={st} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Ionicons name={i === 0 ? 'checkmark-circle' : i === 1 ? 'ellipse' : 'ellipse-outline'} size={s(15)} color={i === 0 ? COLORS.palette.green : i === 1 ? FN.accent : FN.sub} />
              <Typography variant="body-03" weight={i === 1 ? 'semibold' : 'regular'} style={{ color: i <= 1 ? FN.text : FN.sub }}>
                {st}{i === 1 ? ' 중…' : ''}
              </Typography>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** 완료 상세 — 헤더 + 3탭 + 요약 (현재 대조군 전용) */
function CompletedMock() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="close" size={s(20)} color={FN.sub} />
        <View style={{ flexDirection: 'row', gap: s(14) }}>
          <Ionicons name="copy-outline" size={s(18)} color={FN.sub} />
          <Ionicons name="share-outline" size={s(18)} color={FN.sub} />
        </View>
      </View>
      <View style={{ paddingHorizontal: s(16) }}>
        <Typography variant="body-01" weight="semibold" style={{ color: FN.text }}>{CLIENT} · {PROGRAM}</Typography>
        <Typography variant="label-01" style={{ marginTop: s(2), color: FN.sub }}>5월 8일 (수) · {TIMER}</Typography>
        <View style={{ flexDirection: 'row', gap: s(18), marginTop: s(14), borderBottomWidth: 1, borderBottomColor: FN.line, paddingBottom: s(8) }}>
          {['전체 대화', '메모', 'AI 분석'].map((t, i) => (
            <Typography key={t} variant="body-03" weight={i === 2 ? 'semibold' : 'regular'} style={{ color: i === 2 ? FN.accent : FN.sub }}>{t}</Typography>
          ))}
        </View>
        <View style={{ marginTop: s(14), flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
          <Ionicons name="sparkles" size={s(13)} color={FN.accent} />
          <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>요약</Typography>
        </View>
        <Typography variant="body-02-reading" style={{ marginTop: s(8), color: FN.text }}>{SUMMARY}</Typography>
        <View style={{ marginTop: s(16), borderRadius: s(12), backgroundColor: FN.card, padding: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
          <Ionicons name="document-text" size={s(18)} color={FN.accent} />
          <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>이 회기 일지로 옮기기</Typography>
          <Ionicons name="arrow-forward" size={s(15)} color={FN.sub} />
        </View>
      </View>
    </View>
  );
}

type ListTop = 'none' | 'transcribing' | 'done';
/** 라이트 목록 — 상단에 전사중/전사됨 카드 옵션 */
function ListMock({ top = 'none', highlightDone }: { top?: ListTop; highlightDone?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
      <MiniBar />
      <View style={{ paddingHorizontal: s(16), gap: s(10), paddingTop: s(4) }}>
        {top === 'transcribing' && (
          <View style={{ borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], padding: s(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body-02" weight="semibold" className="text-gray-900">{CLIENT}</Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                <Ionicons name="sync" size={s(13)} color={COLORS.fieldnote} />
                <Typography variant="label-01" weight="medium" style={{ color: COLORS.fieldnote }}>전사·화자 정리 중</Typography>
              </View>
            </View>
            <View style={{ marginTop: s(10), height: s(4), borderRadius: s(2), backgroundColor: COLORS.gray[100], overflow: 'hidden' }}>
              <View style={{ width: '38%', height: '100%', backgroundColor: COLORS.fieldnote }} />
            </View>
          </View>
        )}
        {top === 'done' && (
          <View style={{ borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: highlightDone ? COLORS.fieldnote : COLORS.gray[200], padding: s(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body-02" weight="semibold" className="text-gray-900">{CLIENT}</Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Ionicons name="checkmark-circle" size={s(14)} color={COLORS.palette.green} />
                <Typography variant="label-01" weight="medium" style={{ color: COLORS.palette.green }}>전사됨</Typography>
              </View>
            </View>
            <Typography variant="body-03" numberOfLines={1} style={{ marginTop: s(6), color: COLORS.gray[500] }}>대화·메모 정리됨 · AI 요약·일지 초안은 선택</Typography>
          </View>
        )}
        {[1, 2].map((k) => (
          <View key={k} style={{ borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], padding: s(14), opacity: 0.6 }}>
            <Typography variant="body-02" weight="semibold" className="text-gray-900">이전 필드노트</Typography>
            <View style={{ marginTop: s(8), height: s(8), width: '70%', borderRadius: s(4), backgroundColor: COLORS.gray[100] }} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <View style={{ position: 'absolute', left: s(12), right: s(12), bottom: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: COLORS.gray[800], borderRadius: s(14), paddingHorizontal: s(16), paddingVertical: s(12) }}>
      <Ionicons name="checkmark-circle" size={s(18)} color={COLORS.fieldnote} />
      <Typography variant="body-03" weight="medium" className="text-white">{text}</Typography>
    </View>
  );
}

// 단계 타입
interface Stage {
  cta: string;
  screen: React.ReactNode;
  dark?: boolean;
  ann: Ann;
}
function FlowRunner({ intro, stages }: { intro: React.ReactNode; stages: Stage[] }) {
  const [i, setI] = useState(0);
  const st = stages[i];
  return (
    <View>
      {intro}
      <Phone dark={st.dark}>{st.screen}</Phone>
      <Annotation {...st.ann} />
      <Controls step={i} total={stages.length} cta={st.cta} onNext={() => setI((v) => Math.min(v + 1, stages.length - 1))} onReset={() => setI(0)} />
    </View>
  );
}

// ════════════════════ 탭 1 · 현재 (대조군) ════════════════════
function CurrentFlow() {
  const stages: Stage[] = [
    { cta: '정지', dark: true, screen: <RecordingMock />, ann: { screen: '녹음 (풀스크린)', back: '확인 모달 → 흐름 전체 탈출', mind: '회기 진행 중. 폰은 거의 안 봄', std: { ok: true, text: '캡처 자체는 정상' } } },
    { cta: '분석 끝나면', dark: true, screen: <ProcessingMock />, ann: { screen: '처리 스피너 (같은 화면이 변형)', back: '비활성 — 끝날 때까지 갇힘', mind: '"방금 끝났는데 왜 스피너에 묶이지?"', jail: true, std: { ok: false, text: '표준 위반 — 전사·요약·일지초안을 한꺼번에 강제+가둠' } } },
    { cta: '', dark: true, screen: <CompletedMock />, ann: { screen: '완료 상세', back: 'router.back() — 어디로 가는지 불명확', mind: '결과는 좋지만 오는 길이 거칠었음', std: { ok: false, text: '복귀 지점이 예측 불가' } } },
  ];
  return (
    <FlowRunner
      intro={<TabIntro analog="현재 구현 (대조군)" desc="한 화면이 녹음→스피너→결과로 변형. 정지하면 곧장 처리에 갇히고(전사·요약·일지초안을 한꺼번에 강제), 뒤로가기는 늘 전체 탈출. 상담사 기준을 어김." />}
      stages={stages}
    />
  );
}

// ════════════════════ 탭 2 · 대안 A (마무리 + 백그라운드 · ≈클로바노트) ════════════════════
function FinishSheet() {
  return (
    <View style={{ flex: 1 }}>
      <RecordingMock active={false} />
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.white, borderTopLeftRadius: s(20), borderTopRightRadius: s(20), paddingHorizontal: s(20), paddingTop: s(10), paddingBottom: s(20) }}>
        <View style={{ alignSelf: 'center', width: s(36), height: s(4), borderRadius: s(2), backgroundColor: COLORS.gray[300], marginBottom: s(14) }} />
        <Typography variant="headline-02" weight="semibold" className="text-gray-900">녹음을 마칠까요?</Typography>
        <Typography variant="body-03" style={{ marginTop: s(6), color: COLORS.gray[500] }}>
          {CLIENT} · {TIMER} · 메모 {MEMO_N} · 태그 {TAG_N}{'\n'}전사·화자 정리는 자동으로 돼요. AI 요약은 나중에 골라서.
        </Typography>
        <View style={{ marginTop: s(16), height: s(48), borderRadius: s(12), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body-01" weight="semibold" className="text-white">녹음 마치기</Typography>
        </View>
        <View style={{ marginTop: s(8), flexDirection: 'row', gap: s(8) }}>
          <View style={{ flex: 1, height: s(40), borderRadius: s(10), backgroundColor: COLORS.gray[100], alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body-03" weight="medium" className="text-gray-700">이어서 녹음</Typography>
          </View>
          <View style={{ flex: 1, height: s(40), borderRadius: s(10), alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>삭제</Typography>
          </View>
        </View>
      </View>
    </View>
  );
}

function AltAFlow() {
  const stages: Stage[] = [
    { cta: '정지', dark: true, screen: <RecordingMock />, ann: { screen: '녹음 (풀스크린)', back: '마무리 시트 (무음 폐기 없음)', mind: '회기 진행 중', std: { ok: true, text: '캡처 정상' } } },
    { cta: '마치기', dark: true, screen: <FinishSheet />, ann: { screen: '마무리 시트', back: '시트 닫고 녹음으로', mind: '"끝낼까?" 차분한 확정 — 강제 분석 없음', std: { ok: true, text: '멈춤 = 저장. 전사는 자동, AI는 선택' } } },
    { cta: '전사 끝나면', dark: false, screen: <ListMock top="transcribing" />, ann: { screen: '목록 (복귀) + 전사중 카드', back: '이전 탭으로 — 자유', mind: '회기는 끝, 전사는 백그라운드. 손 떠남', std: { ok: true, text: '클로바노트 — 목록 변환중 카드' } } },
    { cta: '', dark: false, screen: <View style={{ flex: 1 }}><ListMock top="done" highlightDone /><Toast text={`${CLIENT} 필드노트 전사가 끝났어요`} /></View>, ann: { screen: '목록 — 전사됨 카드 + 토스트', back: '목록에 있음', mind: 'AI 요약·일지 초안은 노트에서 원할 때', std: { ok: true, text: '전사 알림 → AI·검토는 따로' } } },
  ];
  return (
    <FlowRunner
      intro={<TabIntro analog="≈ 클로바노트" recommended desc="정지 → 차분한 '마무리' 한 번 → 목록 복귀. 전사·화자분리는 백그라운드 카드로, AI 요약·일지 초안은 노트에서 원할 때. 풀스크린 처리 화면 제거. 최소 변경으로 상담사 기준 충족." />}
      stages={stages}
    />
  );
}

// ════════════════════ 탭 3 · 대안 B (검토 대기실 · ≈Granola enhance) ════════════════════
const MY_CAPTURE = [
  { t: '02:14', c: '분리 순간 울음이 짧아짐', tag: false },
  { t: '06:40', c: '먼저 모래상자로', tag: true },
  { t: '10:08', c: '보호자도 변화 체감', tag: false },
];
const TALK = [
  { sp: '상담사', dot: FN.accent, c: '오늘은 모래상자 쪽으로 가볼까?' },
  { sp: CLIENT, dot: COLORS.palette.mint, c: '(먼저 다가와 모래를 만진다) …응.' },
  { sp: '상담사', dot: FN.accent, c: '좋아, 천천히 만져보자.' },
];

/**
 * '녹음 정리' = 한 장소가 자라남. 두 층위로 분리:
 *  raw         : 방금 담음 — 저장·회기연결·한마디더·담은것 (전사·화자분리 백그라운드)
 *  transcribed : 전사·화자분리 완료 — 대화 타임라인 + 메모, AI는 '만들기' 버튼(아직 opt-in)
 *  ai          : AI 호출 후 — 요약·일지 초안이 채워짐
 */
function StagingScreen({ phase }: { phase: 'raw' | 'transcribed' | 'ai' }) {
  const raw = phase === 'raw';
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="chevron-back" size={s(20)} color={FN.sub} />
        <Typography variant="label-01" weight="semibold" style={{ color: FN.text }}>{raw ? '녹음 정리' : '필드노트'}</Typography>
        {raw ? <View style={{ width: s(20) }} /> : (
          <View style={{ flexDirection: 'row', gap: s(12) }}>
            <Ionicons name="copy-outline" size={s(17)} color={FN.sub} />
            <Ionicons name="share-outline" size={s(17)} color={FN.sub} />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}>
        {raw ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
              <Ionicons name="checkmark-circle" size={s(18)} color={COLORS.palette.mint} />
              <Typography variant="body-01" weight="semibold" style={{ color: FN.text }}>담겼어요</Typography>
              <Typography variant="label-01" style={{ color: FN.sub }}>· {TIMER}</Typography>
            </View>
            <View style={{ marginTop: s(10), flexDirection: 'row', alignItems: 'center', gap: s(6), alignSelf: 'flex-start', backgroundColor: 'rgba(185,139,255,0.14)', borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(5) }}>
              <Ionicons name="link" size={s(12)} color={FN.accent} />
              <Typography variant="label-02" weight="medium" style={{ color: FN.text }}>{CLIENT} · {PROGRAM} 회기에 연결됨</Typography>
            </View>
            <View style={{ marginTop: s(14), borderRadius: s(12), backgroundColor: 'rgba(185,139,255,0.10)', padding: s(12) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                <Ionicons name="sync" size={s(15)} color={FN.accent} />
                <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>전사·화자 정리 중</Typography>
                <Typography variant="label-02" style={{ color: FN.sub }}>백그라운드</Typography>
              </View>
              <View style={{ marginTop: s(8), height: s(3), borderRadius: s(2), backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                <View style={{ width: '32%', height: '100%', backgroundColor: FN.accent }} />
              </View>
              <Typography variant="caption-01" style={{ marginTop: s(8), color: FN.sub }}>AI 요약·일지 초안은 끝난 뒤 골라서 만들어요</Typography>
            </View>
            <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), color: FN.sub }}>한마디 더</Typography>
            <View style={{ marginTop: s(8), borderRadius: s(12), backgroundColor: FN.card, paddingHorizontal: s(12), paddingVertical: s(11), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Ionicons name="add-circle-outline" size={s(16)} color={FN.sub} />
              <Typography variant="body-03" style={{ flex: 1, color: FN.sub }}>회기 직후 떠오른 생각을 남겨요</Typography>
              <Ionicons name="mic-outline" size={s(16)} color={FN.accent} />
            </View>
            <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), color: FN.sub }}>내가 담은 것</Typography>
            {MY_CAPTURE.map((m) => (
              <View key={m.t} style={{ marginTop: s(8), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                <Typography variant="label-02" style={{ width: s(38), color: FN.sub }}>{m.t}</Typography>
                <Ionicons name={m.tag ? 'pricetag' : 'create-outline'} size={s(14)} color={FN.accent} />
                <Typography variant="body-03" style={{ flex: 1, color: FN.text }}>{m.c}</Typography>
              </View>
            ))}
          </>
        ) : (
          <>
            <Typography variant="body-01" weight="semibold" style={{ color: FN.text }}>{CLIENT} · {PROGRAM}</Typography>
            <Typography variant="label-01" style={{ marginTop: s(2), color: FN.sub }}>5월 8일 (수) · {TIMER} · {phase === 'ai' ? 'AI 분석 완료' : '전사·화자 분리 완료'}</Typography>

            {/* 전사·화자 분리 결과 (기반 — 자동) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginTop: s(14) }}>
              <Ionicons name="chatbubbles-outline" size={s(13)} color={FN.sub} />
              <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>전체 대화 · 화자 분리</Typography>
            </View>
            <View style={{ marginTop: s(8), gap: s(8) }}>
              {TALK.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
                  <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: t.dot, marginTop: s(6) }} />
                  <View style={{ flex: 1 }}>
                    <Typography variant="label-02" weight="medium" style={{ color: t.dot }}>{t.sp}</Typography>
                    <Typography variant="body-03" style={{ color: FN.text }}>{t.c}</Typography>
                  </View>
                </View>
              ))}
            </View>

            {/* AI 분석 — 선택(opt-in) */}
            <View style={{ marginTop: s(16), borderRadius: s(12), backgroundColor: FN.card, padding: s(14) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <Ionicons name="sparkles" size={s(14)} color={FN.accent} />
                <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>AI 분석</Typography>
                {phase === 'transcribed' && (
                  <View style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: s(999), paddingHorizontal: s(8), paddingVertical: s(3) }}>
                    <Typography variant="caption-01" style={{ color: FN.sub }}>선택</Typography>
                  </View>
                )}
              </View>
              {phase === 'transcribed' ? (
                <>
                  <Typography variant="body-03" style={{ marginTop: s(8), color: FN.sub }}>요약·일지 초안은 아직 안 만들었어요. 필요할 때 만들어요.</Typography>
                  <View style={{ marginTop: s(12), flexDirection: 'row', gap: s(8) }}>
                    <View style={{ flex: 1, height: s(38), borderRadius: s(10), borderWidth: 1, borderColor: 'rgba(185,139,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>AI 요약 만들기</Typography>
                    </View>
                    <View style={{ flex: 1, height: s(38), borderRadius: s(10), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="label-01" weight="semibold" className="text-white">일지 초안 만들기</Typography>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Typography variant="body-02-reading" style={{ marginTop: s(8), color: FN.text }}>{SUMMARY}</Typography>
                  <View style={{ marginTop: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8), borderTopWidth: 1, borderTopColor: FN.line, paddingTop: s(12) }}>
                    <Ionicons name="document-text" size={s(16)} color={FN.accent} />
                    <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>일지 초안 준비됨 — 이 회기 일지로</Typography>
                    <Ionicons name="arrow-forward" size={s(14)} color={FN.sub} />
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AltBFlow() {
  const stages: Stage[] = [
    { cta: '정지', dark: true, screen: <RecordingMock />, ann: { screen: '녹음 (장소 1)', back: '확인 후 정리로', mind: '회기 진행 중', std: { ok: true, text: '캡처 정상' } } },
    { cta: '전사 끝나면', dark: true, screen: <StagingScreen phase="raw" />, ann: { screen: '녹음 정리 — 방금 담음', back: '목록으로 — 저장됨, 안전(나가도 알림 옴)', mind: '"끝났다·담겼다." 회기연결·한마디 더를 차분히', std: { ok: true, text: '멈춤=저장. 전사·화자분리는 가벼운 기반 자동' } } },
    { cta: '일지 초안 만들기', dark: true, screen: <StagingScreen phase="transcribed" />, ann: { screen: '같은 장소 — 전사·화자 분리 완료', back: '목록으로 — 예측 가능', mind: '읽을 수 있는 대화가 됨. AI는 내가 부를 때', std: { ok: true, text: '전사=기본 / AI 요약·일지초안=선택' } } },
    { cta: '', dark: true, screen: <StagingScreen phase="ai" />, ann: { screen: 'AI 분석 — 요약·일지 초안', back: '목록으로', mind: '일지 쓸 그 순간에 불러서 만든 산출물', std: { ok: true, text: 'AI는 opt-in — 강제 안 함' } } },
  ];
  return (
    <FlowRunner
      intro={
        <TabIntro
          analog="≈ Granola (enhance)"
          desc="'정리 화면'과 '완료 노트'는 같은 한 장소가 자라남. 정지 → 머물 수 있는 '녹음 정리'(저장·회기연결·한마디 더), 전사·화자분리는 백그라운드 자동. 전사가 끝나면 같은 곳에 대화가 차고, AI 요약·일지 초안은 '만들기' 버튼으로 내가 부를 때만. 나가도 목록에 그대로 있다가 알림 오면 복귀."
        />
      }
      stages={stages}
    />
  );
}

// ════════════════════ 탭 4 · 대안 C (라이브 바 · ≈ambient) ════════════════════
function LiveBar({ mode }: { mode: 'rec' | 'transcribing' }) {
  const rec = mode === 'rec';
  return (
    <View style={{ marginHorizontal: s(12), marginTop: s(6), borderRadius: s(14), backgroundColor: FN.bg, paddingHorizontal: s(14), paddingVertical: s(10), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
      <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: rec ? COLORS.error : FN.accent }} />
      {rec ? (
        <>
          <Typography style={{ fontSize: s(16), fontWeight: '500', color: FN.text, width: s(52) }}>{TIMER}</Typography>
          <View style={{ flex: 1 }}><Waveform active color={FN.accent} h={20} /></View>
          <Ionicons name="pause" size={s(18)} color={FN.sub} />
          <View style={{ width: s(34), height: s(34), borderRadius: s(17), backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: s(12), height: s(12), borderRadius: s(3), backgroundColor: COLORS.gray[900] }} />
          </View>
        </>
      ) : (
        <>
          <Ionicons name="sync" size={s(14)} color={FN.accent} />
          <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>{CLIENT} 전사 중…</Typography>
          <Typography variant="label-02" style={{ color: FN.sub }}>백그라운드</Typography>
        </>
      )}
    </View>
  );
}

function AppWithBar({ mode }: { mode: 'rec' | 'transcribing' }) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16) }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-800">일정</Typography>
      </View>
      <LiveBar mode={mode} />
      <View style={{ paddingHorizontal: s(16), paddingTop: s(12), gap: s(10) }}>
        {[1, 2, 3].map((k) => (
          <View key={k} style={{ borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], padding: s(14) }}>
            <View style={{ height: s(8), width: '50%', borderRadius: s(4), backgroundColor: COLORS.gray[100] }} />
            <View style={{ marginTop: s(8), height: s(8), width: '80%', borderRadius: s(4), backgroundColor: COLORS.gray[100] }} />
          </View>
        ))}
      </View>
      <Typography variant="caption-01" style={{ textAlign: 'center', marginTop: s(10), color: COLORS.gray[400] }}>
        ↑ 녹음 중에도 일정·내담자를 자유롭게 오감
      </Typography>
    </View>
  );
}

function AltCFlow() {
  const stages: Stage[] = [
    { cta: '정지', dark: false, screen: <AppWithBar mode="rec" />, ann: { screen: '앱 어디든 + 상단 라이브 바', back: '앱 화면들 사이 — 녹음이 스택 점유 안 함', mind: '폰 내려놓고 내담자와 함께. 녹음은 주변 상태', std: { ok: true, text: 'Granola/Plaud — 녹음은 배경 활동' } } },
    { cta: '', dark: false, screen: <View style={{ flex: 1 }}><AppWithBar mode="transcribing" /><Toast text={`${CLIENT} 필드노트 전사가 끝났어요`} /></View>, ann: { screen: '바가 "전사 중" pill로 축소', back: '늘 자연스러움 — 가둘 화면이 없음', mind: 'AI 요약·일지 초안은 노트에서 원할 때', std: { ok: true, text: '멈춤=인라인 저장 + 전사 알림' } } },
  ];
  return (
    <FlowRunner
      intro={<TabIntro analog="≈ Granola/Plaud (ambient)" desc="녹음을 '화면'이 아니라 통화처럼 진행 중인 활동으로. 상단 라이브 바로 글랜스, 앱은 자유 이동. 정지하면 바가 전사 pill로 축소 → 토스트. AI 분석은 노트에서 따로. 가장 급진적·현실 일치." />}
      stages={stages}
    />
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'a' | 'b' | 'c';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'a', label: '대안 A' },
  { key: 'b', label: '대안 B' },
  { key: 'c', label: '대안 C' },
];

export default function FieldNoteFlowLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('current');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 흐름 3안</Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
                  <Typography variant="label-01" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{t.label}</Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
        <StandardStrip />
        {tab === 'current' && <CurrentFlow />}
        {tab === 'a' && <AltAFlow />}
        {tab === 'b' && <AltBFlow />}
        {tab === 'c' && <AltCFlow />}
      </ScrollView>
    </View>
  );
}
