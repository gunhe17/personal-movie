import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 개선 프로세스(대안 A) "적용한 모습" 인터랙티브 워크스루.
 *
 * 진단 랩(field-note-flow-audit)의 [개선] 레일을 실제 화면으로 눌러보게 만든 것.
 * 핵심: 정지 = 저장이고 끝 → 홈 복귀(처리 화면에 안 가둠) → 처리는 카드 배지+토스트(백그라운드)
 *      → 검토는 나중에 카드 탭 → 전사는 채워져 있고 AI 요약·일지초안은 '만들기' 버튼(opt-in).
 *
 * 단계: 녹음 → (정지)"마칠까요?" → 홈(전사 중→전사됨) → 검토(전사+메모 / AI 버튼) → AI 생성.
 * 전부 mock. 백그라운드 전사 완료는 버튼으로 시뮬(실제로는 ProcessingHost 자동).
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote;
const NAV_BG = '#322C4A';

type Step = 'recording' | 'stop' | 'home' | 'review';

// ───────────────────────── 공용 조각 ─────────────────────────
function Toast({ text }: { text: string }) {
  return (
    <View style={{ position: 'absolute', top: s(10), left: s(14), right: s(14), zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: COLORS.gray[800], borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: s(11), shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <Ionicons name="checkmark-circle" size={s(16)} color={COLORS.palette.green} />
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.white, flex: 1 }}>{text}</Typography>
    </View>
  );
}

function PrimaryBtn({ label, icon, onPress }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ height: s(48), borderRadius: s(14), backgroundColor: FNP, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
      {icon && <Ionicons name={icon} size={s(17)} color={COLORS.white} />}
      <Typography variant="body-01" weight="semibold" className="text-white">{label}</Typography>
    </Pressable>
  );
}

// ───────────────────────── 단계 1: 녹음 ─────────────────────────
function RecordingScreen({ onStop }: { onStop: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(40), alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(20) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.error }} />
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.error }}>녹음 중 · 02:14</Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), height: s(56) }}>
          {[0.4, 0.8, 0.5, 1, 0.6, 0.9, 0.45, 0.7, 1, 0.55, 0.85, 0.5, 0.75].map((h, i) => (
            <View key={i} style={{ width: s(4), height: s(52) * h, borderRadius: s(2), backgroundColor: FN.accent }} />
          ))}
        </View>
        <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(22) }}>김민준 · 놀이치료-개인</Typography>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: s(16), paddingBottom: s(28) }}>
        <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pause" size={s(24)} color={FN.text} />
        </View>
        <Pressable onPress={onStop} style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="stop" size={s(22)} color={COLORS.white} />
        </Pressable>
      </View>
    </View>
  );
}

// ───────────────────────── 단계 2: "마칠까요?" 시트 ─────────────────────────
function StopSheet({ onFinish, onResume }: { onFinish: () => void; onResume: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      {/* 흐릿한 녹음 화면 위 시트 */}
      <View style={{ flex: 1, opacity: 0.3 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mic" size={s(40)} color={FN.accent} />
        </View>
      </View>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: FN.card, borderTopLeftRadius: s(20), borderTopRightRadius: s(20), paddingHorizontal: s(20), paddingTop: s(18), paddingBottom: s(28) }}>
          <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line, alignSelf: 'center', marginBottom: s(16) }} />
          <Typography variant="headline-02" weight="bold" style={{ color: FN.text }}>녹음을 마칠까요?</Typography>
          <Typography variant="body-02" style={{ color: FN.sub, marginTop: s(8), lineHeight: s(22) }}>
            마치면 저장하고, 전사·화자 정리는 백그라운드로 돼요. AI 요약·일지는 나중에 노트에서 골라 만들 수 있어요.
          </Typography>
          <View style={{ marginTop: s(20), gap: s(8) }}>
            <PrimaryBtn label="녹음 마치기" icon="checkmark" onPress={onFinish} />
            <Pressable onPress={onResume} style={{ height: s(48), borderRadius: s(14), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body-01" weight="medium" style={{ color: FN.text }}>계속 녹음</Typography>
            </Pressable>
            <Pressable style={{ height: s(40), alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body-02" weight="medium" style={{ color: COLORS.error }}>삭제 (녹음 폐기)</Typography>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ───────────────────────── 단계 3: 홈 (전사 중 → 전사됨) ─────────────────────────
function HomeScreen({ bgDone, onSimDone, onOpenNote }: { bgDone: boolean; onSimDone: () => void; onOpenNote: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(44), alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>필드노트</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(20) }}>
        <Typography variant="label-01" weight="semibold" style={{ marginTop: s(6), marginBottom: s(8), color: FN.sub }}>오늘 회기</Typography>
        {/* 방금 녹음한 회기 카드 — 배지가 전사중→전사됨 으로 전환, 탭 가능 */}
        <Pressable onPress={bgDone ? onOpenNote : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
          <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>14:00</Typography>
          <View style={{ flex: 1 }}>
            <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>김민준</Typography>
            <Typography variant="caption-01" style={{ color: FN.sub }}>놀이치료-개인</Typography>
          </View>
          {bgDone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
              <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.palette.green }} />
              <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>전사됨</Typography>
              <Ionicons name="chevron-forward" size={s(13)} color={FN.sub} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
              <Ionicons name="sync" size={s(12)} color={FN.accent} />
              <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>전사 중</Typography>
            </View>
          )}
        </Pressable>

        {/* 다른 회기들 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12), marginTop: s(8) }}>
          <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>16:00</Typography>
          <View style={{ flex: 1 }}>
            <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>이서연</Typography>
            <Typography variant="caption-01" style={{ color: FN.sub }}>미술치료-개인</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
            <Ionicons name="mic" size={s(13)} color={COLORS.white} />
            <Typography variant="label-02" weight="semibold" className="text-white">녹음</Typography>
          </View>
        </View>

        {/* 백그라운드 시뮬 버튼 (실제로는 ProcessingHost 자동) */}
        {!bgDone && (
          <Pressable onPress={onSimDone} style={{ marginTop: s(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), borderRadius: s(12), borderWidth: 1, borderColor: FN.line, borderStyle: 'dashed', paddingVertical: s(12) }}>
            <Ionicons name="play-forward-outline" size={s(14)} color={FN.sub} />
            <Typography variant="label-01" style={{ color: FN.sub }}>백그라운드 전사 완료 (시뮬)</Typography>
          </Pressable>
        )}
        {bgDone && (
          <View style={{ marginTop: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
            <Ionicons name="arrow-up" size={s(13)} color={FN.accent} />
            <Typography variant="label-01" style={{ color: FN.accent }}>카드를 탭해 검토로</Typography>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── 단계 4: 검토 (전사 + AI 버튼) ─────────────────────────
const DIALOG = [
  { who: '상담사', text: '오늘은 블록 놀이부터 해볼까요?', me: true },
  { who: '김민준', text: '음… 저번처럼 무너지면 어떡해요.', me: false },
  { who: '상담사', text: '무너져도 괜찮아요. 같이 다시 쌓으면 되니까.', me: true },
];
function ReviewScreen({ aiDone, onMakeAI, onBack }: { aiDone: boolean; onMakeAI: () => void; onBack: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14) }}>
        <Pressable onPress={onBack} hitSlop={8}><Ionicons name="chevron-back" size={s(22)} color={FN.text} /></Pressable>
        <Typography variant="body-01" weight="semibold" style={{ color: FN.text, marginLeft: s(6) }}>김민준 · 놀이치료-개인</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(24) }}>
        {/* 전사 (기반 — 자동으로 채워짐) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(10) }}>
          <Ionicons name="chatbubbles-outline" size={s(15)} color={FN.accent} />
          <Typography variant="label-01" weight="semibold" style={{ color: FN.text }}>대화 (전사 · 화자 분리)</Typography>
        </View>
        <View style={{ gap: s(8) }}>
          {DIALOG.map((d, i) => (
            <View key={i} style={{ alignItems: d.me ? 'flex-end' : 'flex-start' }}>
              <Typography variant="caption-01" style={{ color: FN.sub, marginBottom: s(2) }}>{d.who}</Typography>
              <View style={{ maxWidth: '82%', backgroundColor: d.me ? 'rgba(185,139,255,0.16)' : FN.card, borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(9) }}>
                <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(19) }}>{d.text}</Typography>
              </View>
            </View>
          ))}
        </View>

        {/* 메모 */}
        <Typography variant="label-01" weight="semibold" style={{ color: FN.text, marginTop: s(18), marginBottom: s(8) }}>내가 담은 메모</Typography>
        <View style={{ borderRadius: s(12), backgroundColor: FN.card, padding: s(12) }}>
          <Typography variant="body-03" style={{ color: FN.sub }}>· 실패에 대한 불안 ↑ — "무너지면 어떡해요"</Typography>
        </View>

        {/* AI 분석 (선택 — 버튼) */}
        <Typography variant="label-01" weight="semibold" style={{ color: FN.text, marginTop: s(18), marginBottom: s(8) }}>AI 분석</Typography>
        {aiDone ? (
          <View style={{ borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.10)', padding: s(14), gap: s(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <Ionicons name="sparkles" size={s(14)} color={FN.accent} />
              <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>요약</Typography>
            </View>
            <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>
              블록 놀이 중 실패에 대한 불안을 반복적으로 언급. "무너져도 같이 다시 쌓는다"는 재구성에 안정 반응.
            </Typography>
            <Pressable style={{ marginTop: s(4), flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
              <Ionicons name="document-text-outline" size={s(14)} color={FN.accent} />
              <Typography variant="label-01" weight="medium" style={{ color: FN.accent }}>일지 초안 보기 ›</Typography>
            </Pressable>
          </View>
        ) : (
          <View style={{ borderRadius: s(14), backgroundColor: FN.card, padding: s(14), gap: s(10) }}>
            <Typography variant="body-03" style={{ color: FN.sub }}>필요할 때 만들어요. 매 회기 자동으로 돌리지 않아요.</Typography>
            <View style={{ flexDirection: 'row', gap: s(8) }}>
              <Pressable onPress={onMakeAI} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5), borderRadius: s(10), backgroundColor: 'rgba(185,139,255,0.16)', paddingVertical: s(10) }}>
                <Ionicons name="sparkles" size={s(13)} color={FN.accent} />
                <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>AI 요약 만들기</Typography>
              </Pressable>
              <Pressable onPress={onMakeAI} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(5), borderRadius: s(10), backgroundColor: 'rgba(185,139,255,0.16)', paddingVertical: s(10) }}>
                <Ionicons name="document-text-outline" size={s(13)} color={FN.accent} />
                <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>일지 초안</Typography>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── 폰 + 단계 인디케이터 ─────────────────────────
const STEP_INFO: Record<Step, { n: number; cap: string }> = {
  recording: { n: 1, cap: '회기 중·후 녹음. 최소화 가능, 회기카드에 라이브 표시.' },
  stop: { n: 2, cap: '정지 = "마칠까요?"만. 분석을 이 순간에 강요하지 않음.' },
  home: { n: 3, cap: '곧장 홈 복귀(처리 화면에 안 가둠). 처리는 카드 배지 + 토스트(백그라운드).' },
  review: { n: 4, cap: '검토는 내가 앉을 때. 전사는 채워져 있고 AI는 "만들기" 버튼(opt-in).' },
};
const STEPPER = [
  { key: 'recording' as const, label: '녹음' },
  { key: 'stop' as const, label: '정지' },
  { key: 'home' as const, label: '홈·처리' },
  { key: 'review' as const, label: '검토' },
];

export default function FieldNoteFlowAppliedLab() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('recording');
  const [bgDone, setBgDone] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reset = () => {
    setStep('recording');
    setBgDone(false);
    setAiDone(false);
    setToast(null);
  };

  const info = STEP_INFO[step];

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">개선 흐름 적용 (워크스루)</Typography>
          </View>
          <TouchableOpacity onPress={reset} hitSlop={8} accessibilityLabel="처음부터">
            <Ionicons name="refresh" size={20} color={COLORS.gray[600]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
        {/* 단계 스텝퍼 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(12) }}>
          {STEPPER.map((st, i) => {
            const active = info.n === i + 1;
            const done = info.n > i + 1;
            const color = active ? COLORS.fieldnote : done ? COLORS.palette.green : COLORS.gray[300];
            return (
              <View key={st.key} style={{ flexDirection: 'row', alignItems: 'center', flex: i < STEPPER.length - 1 ? 1 : 0 }}>
                <Pressable onPress={() => setStep(st.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                  <View style={{ width: s(20), height: s(20), borderRadius: s(10), backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <Ionicons name="checkmark" size={s(12)} color={COLORS.white} /> : <Typography variant="caption-01" weight="bold" style={{ color: active ? COLORS.white : COLORS.gray[500] }}>{i + 1}</Typography>}
                  </View>
                  <Typography variant="label-02" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{st.label}</Typography>
                </Pressable>
                {i < STEPPER.length - 1 && <View style={{ flex: 1, height: 2, backgroundColor: COLORS.gray[200], marginHorizontal: s(6) }} />}
              </View>
            );
          })}
        </View>

        {/* 폰 프레임 */}
        <View style={{ height: s(540), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>
          {toast && <Toast text={toast} />}
          {step === 'recording' && (
            <RecordingScreen onStop={() => { setToast(null); setStep('stop'); }} />
          )}
          {step === 'stop' && (
            <StopSheet
              onFinish={() => { setStep('home'); setBgDone(false); setToast('저장했어요 · 전사 중'); }}
              onResume={() => { setToast(null); setStep('recording'); }}
            />
          )}
          {step === 'home' && (
            <HomeScreen
              bgDone={bgDone}
              onSimDone={() => { setBgDone(true); setToast('김민준 회기가 전사됐어요'); }}
              onOpenNote={() => { setToast(null); setStep('review'); }}
            />
          )}
          {step === 'review' && (
            <ReviewScreen
              aiDone={aiDone}
              onMakeAI={() => { setAiDone(true); setToast('AI 요약을 만들었어요'); }}
              onBack={() => { setToast(null); setStep('home'); }}
            />
          )}
        </View>

        {/* 단계 설명 캡션 */}
        <View style={{ marginTop: s(14), flexDirection: 'row', gap: s(8), alignItems: 'flex-start' }}>
          <View style={{ width: s(22), height: s(22), borderRadius: s(11), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center', marginTop: s(1) }}>
            <Typography variant="caption-01" weight="bold" className="text-white">{info.n}</Typography>
          </View>
          <Typography variant="body-03" className="text-gray-600" style={{ flex: 1, lineHeight: s(20) }}>{info.cap}</Typography>
        </View>

        <View style={{ marginTop: s(14), borderRadius: s(12), backgroundColor: COLORS.gray[50], padding: s(12), flexDirection: 'row', gap: s(8) }}>
          <Ionicons name="information-circle-outline" size={s(15)} color={COLORS.gray[500]} />
          <Typography variant="label-02" className="text-gray-500" style={{ flex: 1, lineHeight: s(17) }}>
            짝: 진단 랩 field-note-flow-audit. 백엔드 변경 0 — finish · ProcessingHost · generateSummary/Note · skipPipeline 모두 이미 존재. 백그라운드 전사 완료는 여기선 버튼으로 시뮬(실제는 자동). 전부 mock.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
