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
 * 필드노트 "홈"(FAB 진입 화면) 첫 진입 빈 상태 가이드 카드 비교 랩.
 *
 * 대상 정정: FAB 탭 → `field-note/home.tsx`(다크 sub-app 홈)가 뜬다. (목록 아님 —
 * 목록은 홈의 '노트' 탭/‘전체 노트 보기’로 진입.) 그래서 빈 상태 가이드의 대상은 '홈'.
 *
 * 홈의 현재 첫 진입(완전 신규 = 오늘 회기 0 + 노트 0):
 *   히어로 오브 + 헤드라인 "오늘은 예정된 회기가 없어요" + 체크라인 2줄 +
 *   최근 노트 자리 작은 빈 카드 "아직 녹음한 노트가 없어요".
 *   → 처음 쓰는 사람에겐 "회기 없어요"가 밋밋한 첫인상이고, 이 도구가 뭘 해주는지 안내 부재.
 *
 * 중요한 뉘앙스: 가이드 카드는 '완전 신규(노트 0건)'에서만 노출. '오늘 회기만 없는 기존
 *   사용자'(과거 노트 있음)에겐 띄우지 않는다 — 매일 보는 잔소리가 되면 안 됨.
 *
 * 탭 — [현재] 실제 빈 홈 대조군 / [3단계 가이드] 본문에 '이렇게 써요' 카드
 *      / [첫 사용 환영] 헤드라인까지 신규용으로 리프레이밍 / [샘플 미리보기] 최근 노트를 ghost로
 *      / [융합] ③헤드라인(why)+②스텝 압축(how)+accent CTA(next) 한 흐름(권장).
 * 하단 플로팅 네비([← 홈 ◉녹음 노트 검색])는 홈 정체성이라 함께 재현. 전부 mock.
 * 채택 시 production은 home.tsx 의 헤드라인/본문 빈 분기 + 최근 노트 빈 카드에 반영.
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote;
const NAV_BG = '#322C4A';
const NAV_BORDER = 'rgba(255,255,255,0.12)';

// ───────────────────────── 공용: 히어로 오브 (home.tsx HeroIllo 축약) ─────────────────────────
function HeroOrb({ bubble }: { bubble: string }) {
  return (
    <View style={{ height: s(116) }}>
      <View style={{ position: 'absolute', top: s(2), right: s(4), backgroundColor: 'rgba(185,139,255,0.18)', borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(6) }}>
        <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>{bubble}</Typography>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#C9A6FF', '#7C54E0', '#4B2F9E']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: s(84), height: s(84), borderRadius: s(42), alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ position: 'absolute', top: s(13), left: s(18), width: s(20), height: s(13), borderRadius: s(10), backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <Ionicons name="mic" size={s(34)} color={COLORS.white} />
        </LinearGradient>
      </View>
    </View>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
      <Ionicons name="checkmark-circle" size={s(15)} color={COLORS.palette.green} />
      <Typography variant="body-03" style={{ color: FN.sub }}>{text}</Typography>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="label-01" weight="semibold" style={{ marginTop: s(18), marginBottom: s(8), color: FN.sub }}>
      {children}
    </Typography>
  );
}

// ───────────────────────── 공용: 홈 chrome (헤더 + 본문 + 플로팅 네비) ─────────────────────────
function HomeChrome({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      {/* 미니 헤더 */}
      <View style={{ height: s(44), alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>필드노트</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(96) }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      {/* 플로팅 바텀 네비 (mock) */}
      <View style={{ position: 'absolute', left: s(14), right: s(14), bottom: s(16) }}>
        <View style={{ flexDirection: 'row', height: s(58), borderRadius: s(29), backgroundColor: NAV_BG, borderWidth: 1, borderColor: NAV_BORDER, alignItems: 'center', paddingHorizontal: s(16) }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <View style={{ width: s(36), height: s(36), borderRadius: s(18), backgroundColor: 'rgba(185,139,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={s(19)} color={FN.accent} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(16) }}>
            <View style={{ alignItems: 'center', gap: s(2), paddingHorizontal: s(8) }}>
              <Ionicons name="home" size={s(19)} color={FN.accent} />
              <Typography variant="caption-01" weight="semibold" style={{ color: FN.accent }}>홈</Typography>
            </View>
            <LinearGradient colors={['#C9A6FF', '#9B5DFF', '#7C54E0']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: s(54), height: s(54), borderRadius: s(27), alignItems: 'center', justifyContent: 'center', borderWidth: s(3), borderColor: NAV_BG, marginTop: s(-18) }}>
              <Ionicons name="mic" size={s(24)} color={COLORS.white} />
            </LinearGradient>
            <View style={{ alignItems: 'center', gap: s(2), paddingHorizontal: s(8) }}>
              <Ionicons name="documents-outline" size={s(19)} color={FN.sub} />
              <Typography variant="caption-01" style={{ color: FN.sub }}>노트</Typography>
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: s(8) }}>
            <View style={{ alignItems: 'center', gap: s(2) }}>
              <Ionicons name="search" size={s(19)} color={FN.sub} />
              <Typography variant="caption-01" style={{ color: FN.sub }}>검색</Typography>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ════════════════════ 시안 1: 현재(대조군) ════════════════════
function HomeCurrent() {
  return (
    <HomeChrome>
      <HeroOrb bubble="지금 담아둘까요?" />
      <View style={{ marginTop: s(6) }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>오늘은 예정된</Typography>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>회기가 없어요</Typography>
      </View>
      <View style={{ marginTop: s(12), gap: s(8) }}>
        <CheckLine text="전사·화자 정리는 자동으로 돼요" />
        <CheckLine text="AI 요약·일지 초안은 원할 때 골라서" />
      </View>
      <SectionLabel>최근 노트</SectionLabel>
      <View style={{ alignItems: 'center', paddingVertical: s(24), borderRadius: s(14), backgroundColor: FN.card }}>
        <Ionicons name="mic-outline" size={s(28)} color={FN.sub} />
        <Typography variant="body-03" weight="medium" style={{ marginTop: s(10), color: FN.text }}>아직 녹음한 노트가 없어요</Typography>
        <Typography variant="caption-01" style={{ marginTop: s(4), color: FN.sub }}>회기를 녹음하면 여기에 쌓여요</Typography>
      </View>
    </HomeChrome>
  );
}

// ════════════════════ 시안 2: 3단계 가이드 카드 ════════════════════
const STEPS = [
  { icon: 'mic' as const, title: '녹음해요', desc: '회기 중·후에 가운데 마이크를 누르면 바로 시작돼요' },
  { icon: 'sparkles' as const, title: 'AI가 정리해요', desc: '녹음이 끝나면 자동으로 전사하고 핵심을 요약해요' },
  { icon: 'link' as const, title: '회기에 연결해요', desc: '요약을 일정·상담일지로 옮겨 다음 회기에 활용해요' },
];
function HomeSteps() {
  return (
    <HomeChrome>
      <HeroOrb bubble="처음이신가요?" />
      <View style={{ marginTop: s(6) }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>필드노트를</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.accent }}>시작</Typography>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>해볼까요?</Typography>
        </View>
      </View>

      <SectionLabel>이렇게 써요</SectionLabel>
      <View style={{ borderRadius: s(16), backgroundColor: FN.card, paddingVertical: s(8) }}>
        {STEPS.map((step, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16), paddingVertical: s(12), gap: s(12) }}>
              <View style={{ width: s(38), height: s(38), borderRadius: s(12), backgroundColor: 'rgba(185,139,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={step.icon} size={s(18)} color={FN.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                  <Typography variant="label-02" weight="bold" style={{ color: FN.accent }}>{i + 1}</Typography>
                  <Typography variant="body-02" weight="semibold" style={{ color: FN.text }}>{step.title}</Typography>
                </View>
                <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(2) }}>{step.desc}</Typography>
              </View>
            </View>
            {i < STEPS.length - 1 && <View style={{ height: 1, backgroundColor: FN.line, marginLeft: s(66) }} />}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), marginTop: s(14) }}>
        <Typography variant="label-01" style={{ color: FN.accent }}>아래 마이크를 눌러 첫 회기를 담아보세요</Typography>
        <Ionicons name="arrow-down" size={s(14)} color={FN.accent} />
      </View>
    </HomeChrome>
  );
}

// ════════════════════ 시안 3: 첫 사용 환영 (헤드라인까지 리프레이밍) ════════════════════
function HomeWelcome() {
  return (
    <HomeChrome>
      <HeroOrb bubble="환영해요" />
      <View style={{ marginTop: s(6) }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>회기는 녹음에 맡기고</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.accent }}>대화에 집중</Typography>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>하세요</Typography>
        </View>
      </View>
      <Typography variant="body-02" style={{ color: FN.sub, marginTop: s(12), lineHeight: s(22) }}>
        녹음만 해두면 전사·요약까지 자동으로 정리돼요.{'\n'}첫 회기를 담는 것부터 시작해볼까요?
      </Typography>

      {/* 핵심 가치 칩 3개 */}
      <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(18) }}>
        {[
          { icon: 'document-text-outline' as const, label: '자동 전사' },
          { icon: 'sparkles-outline' as const, label: 'AI 요약' },
          { icon: 'link-outline' as const, label: '회기 연결' },
        ].map((c) => (
          <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FN.card, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(8) }}>
            <Ionicons name={c.icon} size={s(13)} color={FN.accent} />
            <Typography variant="label-02" weight="medium" style={{ color: FN.text }}>{c.label}</Typography>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), marginTop: s(26) }}>
        <Typography variant="label-01" style={{ color: FN.sub }}>아래 마이크로 첫 녹음을 시작해요</Typography>
        <Ionicons name="arrow-down" size={s(14)} color={FN.sub} />
      </View>
    </HomeChrome>
  );
}

// ════════════════════ 시안 4: 샘플 미리보기 (ghost 결과물) ════════════════════
const GHOST_NOTES = [
  { name: '김민준', day: '오늘', tag: '분석완료', color: COLORS.palette.green },
  { name: '이서연', day: '오늘', tag: '전사 중', color: FN.accent },
];
function HomeGhost() {
  return (
    <HomeChrome>
      <HeroOrb bubble="지금 담아둘까요?" />
      <View style={{ marginTop: s(6) }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>오늘은 예정된</Typography>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>회기가 없어요</Typography>
      </View>
      <View style={{ marginTop: s(12), gap: s(8) }}>
        <CheckLine text="전사·화자 정리는 자동으로 돼요" />
        <CheckLine text="AI 요약·일지 초안은 원할 때 골라서" />
      </View>

      <SectionLabel>최근 노트</SectionLabel>
      <Typography variant="caption-01" style={{ color: FN.sub, marginBottom: s(8) }}>녹음하면 이렇게 정리돼서 쌓여요 (예시)</Typography>
      <View style={{ opacity: 0.5, gap: s(8) }}>
        {GHOST_NOTES.map((n) => (
          <View key={n.name} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), borderRadius: s(14), borderWidth: 1, borderColor: FN.line, borderStyle: 'dashed', backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
            <Ionicons name="document-text-outline" size={s(16)} color={FN.accent} />
            <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>{n.name}</Typography>
            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: n.color }} />
            <Typography variant="caption-01" style={{ color: FN.sub }}>{n.day} · {n.tag}</Typography>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), marginTop: s(14) }}>
        <Typography variant="label-01" style={{ color: FN.accent }}>아래 마이크로 첫 노트를 만들어요</Typography>
        <Ionicons name="arrow-down" size={s(14)} color={FN.accent} />
      </View>
    </HomeChrome>
  );
}

// ════════════════════ 시안 5: 융합 (③헤드라인 + ②스텝 압축) ════════════════════
// 가치 헤드라인(why) → 압축 스텝(how) → accent CTA(지금 뭐). 4안 중 why·how·next를 한 흐름에.
const FUSION_STEPS = [
  { icon: 'mic' as const, title: '녹음', desc: '회기 중·후 마이크 한 번' },
  { icon: 'sparkles' as const, title: 'AI 정리', desc: '자동 전사 + 핵심 요약' },
  { icon: 'link' as const, title: '회기 연결', desc: '일정·상담일지로 이어서' },
];
function HomeFusion() {
  return (
    <HomeChrome>
      <HeroOrb bubble="환영해요" />
      {/* 헤드라인 — ③ 가치 제안 (why) */}
      <View style={{ marginTop: s(6) }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>회기는 녹음에 맡기고</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.accent }}>대화에 집중</Typography>
          <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>하세요</Typography>
        </View>
      </View>
      <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(10), lineHeight: s(20) }}>
        녹음만 해두면 정리는 필드노트가 알아서 해요.
      </Typography>

      {/* 압축 스텝 — ② how, 풀카드 대신 가벼운 행으로 */}
      <SectionLabel>이렇게 흘러가요</SectionLabel>
      <View style={{ gap: s(8) }}>
        {FUSION_STEPS.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: s(11) }}>
            <View style={{ width: s(34), height: s(34), borderRadius: s(11), backgroundColor: 'rgba(185,139,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={step.icon} size={s(16)} color={FN.accent} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1, gap: s(6) }}>
              <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>{step.title}</Typography>
              <Typography variant="caption-01" style={{ color: FN.sub }}>{step.desc}</Typography>
            </View>
          </View>
        ))}
      </View>

      {/* CTA — ② accent 강조로 마이크 유도 (③의 흐린 화살표 보완) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), marginTop: s(22) }}>
        <Typography variant="label-01" weight="medium" style={{ color: FN.accent }}>아래 마이크로 첫 회기를 담아보세요</Typography>
        <Ionicons name="arrow-down" size={s(14)} color={FN.accent} />
      </View>
    </HomeChrome>
  );
}

// ───────────────────────── 공용: 폰 프레임 ─────────────────────────
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: s(560), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>
      {children}
    </View>
  );
}

// ───────────────────────── 공용: 탭 인트로 ─────────────────────────
function TabIntro({ tone, recommended, desc }: { tone: string; recommended?: boolean; desc: string }) {
  return (
    <View style={{ marginBottom: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8), flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.gray[100], borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(4) }}>
          <Ionicons name="pricetag-outline" size={s(12)} color={COLORS.gray[600]} />
          <Typography variant="label-02" weight="medium" className="text-gray-600">{tone}</Typography>
        </View>
        {recommended && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: 'rgba(155,93,255,0.12)', borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(4) }}>
            <Ionicons name="star" size={s(11)} color={COLORS.fieldnote} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>권장</Typography>
          </View>
        )}
      </View>
      <Typography variant="body-03" className="text-gray-500">{desc}</Typography>
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'steps' | 'welcome' | 'ghost' | 'fusion';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'steps', label: '3단계 가이드' },
  { key: 'welcome', label: '첫 사용 환영' },
  { key: 'ghost', label: '샘플 미리보기' },
  { key: 'fusion', label: '융합' },
];

export default function FieldNoteEmptyGuideLab() {
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 홈 빈 상태 가이드</Typography>
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
        {tab === 'current' && (
          <>
            <TabIntro tone="대조군 · 현재" desc="실제 빈 홈(오늘 회기 0 + 노트 0). 히어로 오브 + '오늘은 예정된 회기가 없어요' + 체크라인 + 최근 노트 빈 카드. 처음 쓰는 사람에겐 '회기 없어요'가 밋밋한 첫인상이고, 이 도구가 뭘 해주는지 안내가 없음." />
            <Phone><HomeCurrent /></Phone>
          </>
        )}
        {tab === 'steps' && (
          <>
            <TabIntro tone="흐름 설명 · 정보 우선" desc="신규(노트 0건)일 때만 헤드라인을 '시작해볼까요?'로 바꾸고 본문에 녹음→AI정리→회기연결 3단계 카드를 노출. 도구가 뭘 해주는지 첫 진입에 분명히. 하단 마이크로 시선 유도. ⚠️ 노트가 1건이라도 있으면 이 카드는 숨기고 평소 홈으로." />
            <Phone><HomeSteps /></Phone>
          </>
        )}
        {tab === 'welcome' && (
          <>
            <TabIntro tone="온기 · 감정 우선" desc="헤드라인을 가치 제안('대화에 집중하세요')으로 리프레이밍 + 2줄 설명 + 가치 칩 3개. 단계 설명보다 첫인상·온기 우선. 신규 전용. 정보량은 적지만 '필드노트가 왜 좋은지'가 먼저 와닿음." />
            <Phone><HomeWelcome /></Phone>
          </>
        )}
        {tab === 'ghost' && (
          <>
            <TabIntro tone="결과물 미리보기 · 최소 개입" desc="헤드라인·본문은 현재 그대로 두고, 최근 노트 빈 카드만 '완성된 노트 ghost 예시'로 교체. 가장 변경이 작고, 녹음하면 뭐가 쌓이는지 실제 카드 모양으로 보여줌. 설명 카드 없이도 결과가 그려짐." />
            <Phone><HomeGhost /></Phone>
          </>
        )}
        {tab === 'fusion' && (
          <>
            <TabIntro tone="가치+흐름 · why→how→next" recommended desc="③ 헤드라인('대화에 집중하세요', 가치/온기)으로 첫인상을 잡고, ② 3단계를 풀카드 대신 압축 행으로 흐름(how)을 보여준 뒤, accent CTA로 마이크 유도. why·how·next를 한 흐름에 담아 ②(how만)·③(why만)의 빈틈을 메움. 신규(노트 0건) 전용." />
            <Phone><HomeFusion /></Phone>
          </>
        )}
      </ScrollView>
    </View>
  );
}
