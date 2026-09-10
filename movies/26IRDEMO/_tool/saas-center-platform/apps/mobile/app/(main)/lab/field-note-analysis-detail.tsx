import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 분석 결과(AI 분석) 페이지 개선 랩.
 *
 * 현재 CompletedScreen 의 'AI 분석' 탭은 summary 평문 한 덩어리만 보여줌(키워드·이슈 구조 없음).
 * 그런데 백엔드 counseling_note 스키마엔 이미 mood/main_topic/intervention/progress/homework/
 * next_goal 이 있음(상담일지 초안으로만 소비, 분석 화면엔 미노출).
 *
 * 개선 = (1) 이미 있는 구조를 분석 화면으로 surfacing (2) 키워드·주요이슈·하이라이트·살펴볼신호·
 * 액션을 추가(프롬프트 보강). 50분 상담을 상담사가 빠르게 스캔→임상 파악→후속 조치까지.
 *
 * 탭 — [현재] 평문 요약(대조군) / [개선] 구조화 분석 대시보드.
 * §3-4 필드노트는 '정의 예정' — 본 시안은 스펙 논의용 제안. 전부 mock.
 */

const FN = COLORS.fieldnoteDark;

// ───────────────────────── mock 분석 데이터 (김민준 · 놀이치료) ─────────────────────────
const DATA = {
  summary: '블록 놀이 중 실패에 대한 불안을 반복해 언급. "무너지면 어떡해요"를 호소했으나, 함께 다시 쌓는 재구성 후 자발적으로 큰 블록에 도전하며 안정 반응을 보임.',
  keywords: ['실패 불안', '또래 관계', '블록 놀이', '자기효능감', '재구성'],
  issues: ['실패·무너짐에 대한 두려움', '또래와의 비교 의식', '새 시도 앞의 망설임'],
  mood: '초반 불안·긴장 → 후반 안정. 좌절 후 회복 시간이 지난 회기보다 짧아짐.',
  interventions: ['정서 반영', '인지적 재구성', '놀이 동반', '격려'],
  progress: '지난 회기 대비 좌절 상황에서 회피가 줄고, 재시도까지 걸리는 시간이 단축됨.',
  homework: '집에서 작은 블록탑을 쌓고 사진 찍어 오기',
  nextGoal: '성공 경험 확장 + 또래 상호작용 장면 탐색',
  highlights: [
    { t: '03:12', text: '“저번처럼 무너지면 어떡해요” — 실패 불안 표출' },
    { t: '21:40', text: '상담사와 함께 무너진 블록 재구성' },
    { t: '38:05', text: '“그럼 큰 걸로 쌓아볼래요” — 자발적 도전' },
  ],
  watch: '실패에 대한 두려움이 최근 3회기 연속 반복 — 자기효능감 저하 패턴으로 주시 필요 (위기 신호 아님, 관찰 제안).',
  actions: ['보호자에게 가정 연계(블록 놀이) 공유', '다음 회기 놀이 도구 준비'],
  meta: { date: '2026. 06. 04 (수) 14:00', dur: '48분', client: '김민준 · 만 7세' },
};

// ───────────────────────── 조각 ─────────────────────────
function SectionLabel({ icon, children, color = FN.sub }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(18), marginBottom: s(8) }}>
      <Ionicons name={icon} size={s(14)} color={color} />
      <Typography variant="label-01" weight="semibold" style={{ color }}>{children}</Typography>
    </View>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ borderRadius: s(14), backgroundColor: FN.card, padding: s(14) }}>{children}</View>;
}
function Chip({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'green' }) {
  const c = tone === 'green' ? COLORS.palette.green : FN.accent;
  return (
    <View style={{ backgroundColor: c + '22', borderRadius: s(999), paddingHorizontal: s(11), paddingVertical: s(6) }}>
      <Typography variant="label-02" weight="medium" style={{ color: c }}>{label}</Typography>
    </View>
  );
}
function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: s(8) }}>
      <View style={{ width: s(4), height: s(4), borderRadius: s(2), backgroundColor: FN.accent, marginTop: s(8) }} />
      <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(20) }}>{text}</Typography>
    </View>
  );
}

// 검토 페이지 chrome (헤더 + 내부 탭 전사/메모/분석)
function DetailChrome({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14) }}>
        <Ionicons name="chevron-back" size={s(22)} color={FN.text} />
        <Typography variant="body-01" weight="semibold" style={{ color: FN.text, marginLeft: s(6), flex: 1 }}>김민준 · 놀이치료</Typography>
        <Ionicons name="share-outline" size={s(20)} color={FN.sub} />
      </View>
      {/* 내부 탭 (분석 활성) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: s(16), gap: s(16), borderBottomWidth: 1, borderBottomColor: FN.line }}>
        {['전체 대화', '메모', '분석'].map((t, i) => (
          <View key={t} style={{ paddingVertical: s(10), borderBottomWidth: 2, borderBottomColor: i === 2 ? FN.accent : 'transparent' }}>
            <Typography variant="body-03" weight={i === 2 ? 'semibold' : 'regular'} style={{ color: i === 2 ? FN.text : FN.sub }}>{t}</Typography>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// ════════════════════ 현재 (대조군) ════════════════════
function CurrentAnalysis() {
  return (
    <DetailChrome>
      <ScrollView contentContainerStyle={{ padding: s(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginBottom: s(10) }}>
          <Ionicons name="sparkles" size={s(14)} color={FN.accent} />
          <Typography variant="label-01" weight="semibold" style={{ color: FN.accent }}>AI 요약</Typography>
        </View>
        <Card>
          <Typography variant="body-02" style={{ color: FN.text, lineHeight: s(24) }}>{DATA.summary}</Typography>
        </Card>
        <View style={{ marginTop: s(20), borderRadius: s(12), backgroundColor: 'rgba(255,146,0,0.1)', padding: s(12), flexDirection: 'row', gap: s(8) }}>
          <Ionicons name="alert-circle-outline" size={s(15)} color={COLORS.warning} />
          <Typography variant="label-02" style={{ color: FN.sub, flex: 1, lineHeight: s(17) }}>
            지금은 요약 평문 한 덩어리뿐. 키워드·주요 이슈·정서·개입·진전·과제·하이라이트가 없어 50분 회기를 빠르게 스캔/활용하기 어려움.
          </Typography>
        </View>
      </ScrollView>
    </DetailChrome>
  );
}

// ════════════════════ 개선 (구조화 대시보드) ════════════════════
function ImprovedAnalysis() {
  return (
    <DetailChrome>
      <ScrollView contentContainerStyle={{ padding: s(16), paddingBottom: s(20) }}>
        {/* 메타 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flexWrap: 'wrap', marginBottom: s(4) }}>
          <Typography variant="caption-01" style={{ color: FN.sub }}>{DATA.meta.date}</Typography>
          <Typography variant="caption-01" style={{ color: FN.sub }}>· {DATA.meta.dur}</Typography>
          <Typography variant="caption-01" style={{ color: FN.sub }}>· {DATA.meta.client}</Typography>
        </View>

        {/* ⚠️ 살펴볼 신호 (조건부·상단) */}
        <View style={{ marginTop: s(10), borderRadius: s(14), backgroundColor: 'rgba(255,146,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,146,0,0.3)', padding: s(14) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(6) }}>
            <Ionicons name="alert-circle" size={s(15)} color={COLORS.warning} />
            <Typography variant="label-01" weight="semibold" style={{ color: COLORS.warning }}>살펴볼 신호</Typography>
          </View>
          <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>{DATA.watch}</Typography>
        </View>

        {/* 한 줄 요약 */}
        <SectionLabel icon="sparkles" color={FN.accent}>요약</SectionLabel>
        <Card>
          <Typography variant="body-02" style={{ color: FN.text, lineHeight: s(24) }}>{DATA.summary}</Typography>
        </Card>

        {/* 키워드 */}
        <SectionLabel icon="pricetags-outline">키워드</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
          {DATA.keywords.map((k) => <Chip key={k} label={k} />)}
        </View>

        {/* 주요 이슈 */}
        <SectionLabel icon="flag-outline">주요 이슈 · 호소</SectionLabel>
        <Card>
          <View style={{ gap: s(8) }}>
            {DATA.issues.map((it) => <Bullet key={it} text={it} />)}
          </View>
        </Card>

        {/* 정서 상태 */}
        <SectionLabel icon="happy-outline">정서 상태</SectionLabel>
        <Card><Typography variant="body-03" style={{ color: FN.text, lineHeight: s(21) }}>{DATA.mood}</Typography></Card>

        {/* 상담사 개입 */}
        <SectionLabel icon="construct-outline">상담사 개입</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
          {DATA.interventions.map((k) => <Chip key={k} label={k} tone="green" />)}
        </View>

        {/* 진전 */}
        <SectionLabel icon="trending-up-outline">진전 · 변화</SectionLabel>
        <Card><Typography variant="body-03" style={{ color: FN.text, lineHeight: s(21) }}>{DATA.progress}</Typography></Card>

        {/* 과제 + 다음 목표 */}
        <SectionLabel icon="bookmark-outline">과제 · 다음 회기</SectionLabel>
        <Card>
          <View style={{ gap: s(10) }}>
            <View>
              <Typography variant="caption-01" style={{ color: FN.sub, marginBottom: s(2) }}>과제</Typography>
              <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>{DATA.homework}</Typography>
            </View>
            <View style={{ height: 1, backgroundColor: FN.line }} />
            <View>
              <Typography variant="caption-01" style={{ color: FN.sub, marginBottom: s(2) }}>다음 회기 목표</Typography>
              <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>{DATA.nextGoal}</Typography>
            </View>
          </View>
        </Card>

        {/* 하이라이트 (타임스탬프 점프) */}
        <SectionLabel icon="time-outline">하이라이트</SectionLabel>
        <Card>
          <View style={{ gap: s(10) }}>
            {DATA.highlights.map((h) => (
              <View key={h.t} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: 'rgba(185,139,255,0.16)', borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3) }}>
                  <Ionicons name="play" size={s(10)} color={FN.accent} />
                  <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>{h.t}</Typography>
                </View>
                <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(19) }}>{h.text}</Typography>
              </View>
            ))}
          </View>
        </Card>

        {/* 액션 아이템 */}
        <SectionLabel icon="checkbox-outline">후속 액션</SectionLabel>
        <Card>
          <View style={{ gap: s(10) }}>
            {DATA.actions.map((a) => (
              <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                <Ionicons name="ellipse-outline" size={s(16)} color={FN.sub} />
                <Typography variant="body-03" style={{ color: FN.text, flex: 1 }}>{a}</Typography>
              </View>
            ))}
          </View>
        </Card>

        {/* 일지로 */}
        <Pressable style={{ marginTop: s(18), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7), borderRadius: s(14), backgroundColor: COLORS.fieldnote, paddingVertical: s(14) }}>
          <Ionicons name="document-text" size={s(16)} color={COLORS.white} />
          <Typography variant="body-01" weight="semibold" className="text-white">이 분석으로 상담일지 초안 만들기</Typography>
        </Pressable>

        {/* 데이터 출처 메모 */}
        <View style={{ marginTop: s(16), borderRadius: s(12), backgroundColor: 'rgba(255,255,255,0.05)', padding: s(12), gap: s(4) }}>
          <Typography variant="caption-01" weight="semibold" style={{ color: FN.sub }}>데이터 출처</Typography>
          <Typography variant="caption-01" style={{ color: FN.sub, lineHeight: s(16) }}>
            기존(이미 생성됨) — 요약 · 정서 · 개입 · 진전 · 과제 · 다음목표(counseling_note 스키마). 신규(프롬프트 보강 필요) — 키워드 · 주요이슈 · 하이라이트 · 살펴볼 신호 · 후속 액션.
          </Typography>
        </View>
      </ScrollView>
    </DetailChrome>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'improved';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'improved', label: '개선' },
];

export default function FieldNoteAnalysisDetailLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('improved');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">분석 결과 페이지 개선</Typography>
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
        <View style={{ height: s(600), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>
          {tab === 'current' ? <CurrentAnalysis /> : <ImprovedAnalysis />}
        </View>
        <Typography variant="body-03" className="text-gray-500" style={{ marginTop: s(14), lineHeight: s(20) }}>
          {tab === 'current'
            ? '현재 AI 분석 탭 — summary 평문 한 덩어리. 50분 회기를 스캔/활용하기 어려움.'
            : '개선 — ⚠️살펴볼 신호 · 요약 · 키워드 · 주요 이슈 · 정서 · 개입 · 진전 · 과제/다음목표 · 하이라이트(타임스탬프) · 후속 액션. 절반은 이미 백엔드에 있고(surfacing), 키워드/이슈/하이라이트/신호/액션만 프롬프트 보강.'}
        </Typography>
      </ScrollView>
    </View>
  );
}
