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
 * 필드노트 "홈"이 필요한가? — 진단형 비교 랩.
 *
 * 출발 질문: 필드노트 프로세스의 어색함이 '홈/가이드 페이지 부재'에서 오는가?
 * 진단 — 어색함은 두 종류로 나뉜다.
 *   (1) 흐름 안의 어색함: "멈췄는데 왜 갇히지·뒤로가기는 어디로" → 녹음 화면이 7-state 머신인
 *       내비게이션 모델 문제. 홈으로 안 고쳐짐. → [필드노트 흐름 3안] 랩이 다루는 영역.
 *   (2) 장소(orientation)의 어색함: 필드노트는 FAB '액션'일 뿐 '도착하는 곳'이 없음 →
 *       매번 녹음으로 떨어지거나 평평한 목록으로 떨어질 뿐 "필드노트에 들어왔다"는 감각 부재(뿌리 없음).
 * 이 랩은 (2)만 다룬다.
 *
 * 결론 방향: 답은 '가이드(설명 페이지)'가 아니라 '허브(살아있는 홈)' — 액션을 장소로 승격.
 * 가이드의 유일한 진짜 역할(첫 사용 안내)은 허브의 '빈 상태'가 흡수한다.
 *
 * 탭 — [현재(홈X)] 대조군 / [가이드] 밴드에이드 / [허브] 권장 / [첫 사용] 허브 빈 상태.
 * 필드노트 도메인이라 허브·첫 사용은 다크 몰입 스킨. 전부 mock.
 */

const FN = COLORS.fieldnoteDark;

// ───────────────────────── mock ─────────────────────────
const TODAY = [
  { time: '14:00', name: '김민준', program: '놀이치료-개인', state: 'rec' as const },
  { time: '16:00', name: '이서연', program: '미술치료-개인', state: 'rec' as const },
  { time: '17:30', name: '박도윤', program: '놀이치료-개인', state: 'done' as const },
];
const RECENT = [
  { name: '정하늘', when: '어제', tag: '전사됨' },
  { name: '한지우', when: '3일 전', tag: '일지 옮김' },
];

// ───────────────────────── 공용: 폰 프레임 ─────────────────────────
function Phone({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <View
      style={{
        height: s(460),
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

// ───────────────────────── 공용: 진단 질문 스트립 ─────────────────────────
function QuestionStrip() {
  return (
    <View style={{ marginBottom: s(14), borderRadius: s(12), backgroundColor: COLORS.gray[50], borderWidth: 1, borderColor: COLORS.gray[200], padding: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(8) }}>
        <Ionicons name="help-circle-outline" size={s(15)} color={COLORS.gray[700]} />
        <Typography variant="label-01" weight="semibold" className="text-gray-700">핵심 질문 — 필드노트에 '홈'이 필요한가?</Typography>
      </View>
      <View style={{ gap: s(6) }}>
        <View style={{ flexDirection: 'row', gap: s(7) }}>
          <Typography variant="label-02" weight="semibold" style={{ width: s(64), color: COLORS.gray[400] }}>흐름 어색함</Typography>
          <Typography variant="label-02" style={{ flex: 1, color: COLORS.gray[600] }}>"멈췄는데 왜 갇히지" — 내비 모델 문제. 홈으로 안 고쳐짐 → [흐름 3안] 영역</Typography>
        </View>
        <View style={{ flexDirection: 'row', gap: s(7) }}>
          <Typography variant="label-02" weight="semibold" style={{ width: s(64), color: COLORS.fieldnote }}>장소 어색함</Typography>
          <Typography variant="label-02" style={{ flex: 1, color: COLORS.gray[600] }}>필드노트는 '액션'일 뿐 '도착하는 곳'이 없음 → 이 랩이 다룸</Typography>
        </View>
      </View>
      <Typography variant="caption-01" style={{ marginTop: s(8), color: COLORS.gray[400] }}>
        답은 '가이드(설명)'가 아니라 '허브(장소)'일 가능성. 가이드의 진짜 역할(첫 안내)은 허브의 빈 상태가 흡수.
      </Typography>
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

// ───────────────────────── 공용: 진단 판정 카드 ─────────────────────────
function Verdict({ identity, fix, note }: { identity: string; fix: 'no' | 'weak' | 'yes'; note: string }) {
  const fixMeta = {
    no: { icon: 'close-circle' as const, color: COLORS.error, text: '해소 안 됨' },
    weak: { icon: 'remove-circle' as const, color: COLORS.warning, text: '부분적 (밴드에이드)' },
    yes: { icon: 'checkmark-circle' as const, color: COLORS.palette.green, text: '해소' },
  }[fix];
  const rows = [
    { label: '정체성', value: identity, color: COLORS.gray[700], icon: 'pin-outline' as const, valueColor: COLORS.gray[700] },
    { label: '장소 어색함', value: fixMeta.text, color: fixMeta.color, icon: fixMeta.icon, valueColor: fixMeta.color },
    { label: '한 줄', value: note, color: COLORS.gray[600], icon: 'chatbubble-ellipses-outline' as const, valueColor: COLORS.gray[600] },
  ];
  return (
    <View style={{ marginTop: s(12), borderRadius: s(12), backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray[200], overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(9), borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.gray[100] }}>
          <Ionicons name={r.icon} size={s(14)} color={r.color} style={{ marginTop: s(1) }} />
          <Typography variant="label-02" weight="medium" style={{ width: s(64), color: COLORS.gray[400] }}>{r.label}</Typography>
          <Typography variant="label-01" weight={i === 1 ? 'semibold' : 'regular'} style={{ flex: 1, color: r.valueColor }}>{r.value}</Typography>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── 공용 조각 ─────────────────────────
function DarkHeader({ greeting }: { greeting?: boolean }) {
  return (
    <View style={{ paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="headline-02" weight="semibold" style={{ color: FN.text }}>필드노트</Typography>
        <Ionicons name="search-outline" size={s(20)} color={FN.sub} />
      </View>
      {greeting && (
        <Typography variant="body-03" style={{ marginTop: s(2), color: FN.sub }}>오늘 담을 회기가 3건 있어요</Typography>
      )}
    </View>
  );
}

function DarkSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), marginBottom: s(8), color: FN.sub }}>{children}</Typography>
  );
}

/** 다크 허브 — 진행 중 + 오늘 회기 + 최근 노트 */
function HubScreen() {
  return (
    <View style={{ flex: 1 }}>
      <DarkHeader greeting />
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}>
        {/* 진행 중 배너 */}
        <View style={{ marginTop: s(8), borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.12)', padding: s(14) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <Ionicons name="sync" size={s(15)} color={FN.accent} />
            <Typography variant="body-03" weight="semibold" style={{ flex: 1, color: FN.text }}>김민준 · 전사 중</Typography>
            <Ionicons name="chevron-forward" size={s(15)} color={FN.sub} />
          </View>
          <View style={{ marginTop: s(10), height: s(4), borderRadius: s(2), backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
            <View style={{ width: '46%', height: '100%', backgroundColor: FN.accent }} />
          </View>
        </View>

        {/* 오늘 회기 (스케줄 연동) */}
        <DarkSectionLabel>오늘 회기</DarkSectionLabel>
        <View style={{ gap: s(8) }}>
          {TODAY.map((t) => (
            <View key={t.time} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(12), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
              <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>{t.time}</Typography>
              <View style={{ flex: 1 }}>
                <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>{t.name}</Typography>
                <Typography variant="caption-01" style={{ color: FN.sub }}>{t.program}</Typography>
              </View>
              {t.state === 'rec' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: COLORS.fieldnote, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
                  <Ionicons name="mic" size={s(13)} color={COLORS.white} />
                  <Typography variant="label-02" weight="semibold" className="text-white">녹음</Typography>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                  <Ionicons name="checkmark-circle" size={s(14)} color={COLORS.palette.green} />
                  <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>분석완료</Typography>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* 최근 노트 */}
        <DarkSectionLabel>최근 노트</DarkSectionLabel>
        <View style={{ gap: s(8) }}>
          {RECENT.map((r) => (
            <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), borderRadius: s(12), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
              <Ionicons name="document-text-outline" size={s(16)} color={FN.accent} />
              <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>{r.name}</Typography>
              <Typography variant="caption-01" style={{ color: FN.sub }}>{r.when} · {r.tag}</Typography>
            </View>
          ))}
          <Pressable style={{ alignItems: 'center', paddingVertical: s(8) }}>
            <Typography variant="label-01" weight="medium" style={{ color: FN.sub }}>전체 노트 보기</Typography>
          </Pressable>
        </View>
      </ScrollView>

      {/* 빠른 녹음 */}
      <View style={{ position: 'absolute', left: s(16), right: s(16), bottom: s(14), height: s(48), borderRadius: s(14), backgroundColor: COLORS.fieldnote, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
        <Ionicons name="mic" size={s(18)} color={COLORS.white} />
        <Typography variant="body-03" weight="semibold" className="text-white">바로 녹음</Typography>
      </View>
    </View>
  );
}

/** 다크 허브 — 첫 사용(빈 상태). 회기는 연동돼 있지만 녹음/노트가 0건 */
function FirstUseScreen() {
  return (
    <View style={{ flex: 1 }}>
      <DarkHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(16) }} showsVerticalScrollIndicator={false}>
        {/* 첫 안내 (가이드 역할을 빈 상태가 흡수) */}
        <View style={{ marginTop: s(8), borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.10)', padding: s(16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <Ionicons name="sparkles" size={s(16)} color={FN.accent} />
            <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>필드노트가 처음이네요</Typography>
          </View>
          <Typography variant="caption-01" style={{ marginTop: s(8), lineHeight: s(18), color: FN.sub }}>
            회기를 녹음하면 전사·화자 정리가 자동으로 돼요.{'\n'}여기 오늘 회기에서 바로 시작할 수 있어요.
          </Typography>
        </View>

        {/* 오늘 회기 — 첫 회기 강조 */}
        <DarkSectionLabel>오늘 회기</DarkSectionLabel>
        <View style={{ gap: s(8) }}>
          {TODAY.filter((t) => t.state === 'rec').map((t, i) => (
            <View key={t.time} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(12), backgroundColor: i === 0 ? 'rgba(185,139,255,0.10)' : FN.card, borderWidth: i === 0 ? 1 : 0, borderColor: 'rgba(185,139,255,0.35)', paddingHorizontal: s(14), paddingVertical: s(12) }}>
              <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>{t.time}</Typography>
              <View style={{ flex: 1 }}>
                <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>{t.name}</Typography>
                <Typography variant="caption-01" style={{ color: FN.sub }}>{t.program}{i === 0 ? ' · 첫 녹음' : ''}</Typography>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: COLORS.fieldnote, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
                <Ionicons name="mic" size={s(13)} color={COLORS.white} />
                <Typography variant="label-02" weight="semibold" className="text-white">녹음</Typography>
              </View>
            </View>
          ))}
        </View>

        {/* 최근 노트 — 빈 상태 */}
        <DarkSectionLabel>최근 노트</DarkSectionLabel>
        <View style={{ alignItems: 'center', paddingVertical: s(24), borderRadius: s(12), backgroundColor: FN.card }}>
          <Ionicons name="mic-outline" size={s(28)} color={FN.sub} />
          <Typography variant="body-03" weight="medium" style={{ marginTop: s(10), color: FN.text }}>아직 녹음한 노트가 없어요</Typography>
          <Typography variant="caption-01" style={{ marginTop: s(4), color: FN.sub }}>첫 회기를 녹음하면 여기에 쌓여요</Typography>
        </View>
      </ScrollView>
    </View>
  );
}

/** 가이드(밴드에이드) — 설명형 온보딩 */
function GuideScreen() {
  const STEPS = [
    { icon: 'mic-outline' as const, t: '녹음', d: '회기 중 폰을 내려놓고 담아요' },
    { icon: 'chatbubbles-outline' as const, t: '전사·화자 분리', d: '끝나면 자동으로 읽을 수 있게' },
    { icon: 'document-text-outline' as const, t: '일지 초안', d: '원할 때 AI 요약·초안을 만들어요' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: s(16) }}>
        <Typography variant="label-01" style={{ color: FN.sub }}>건너뛰기</Typography>
      </View>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: s(24), paddingTop: s(10) }}>
        <View style={{ width: s(64), height: s(64), borderRadius: s(32), backgroundColor: 'rgba(185,139,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mic" size={s(30)} color={FN.accent} />
        </View>
        <Typography variant="headline-02" weight="semibold" style={{ marginTop: s(16), color: FN.text }}>필드노트란?</Typography>
        <Typography variant="body-03" style={{ marginTop: s(8), textAlign: 'center', color: FN.sub }}>
          상담 회기를 녹음하면 전사·정리를 거쳐 일지로 이어주는 기능이에요
        </Typography>
        <View style={{ marginTop: s(24), alignSelf: 'stretch', gap: s(14) }}>
          {STEPS.map((st, i) => (
            <View key={st.t} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
              <View style={{ width: s(40), height: s(40), borderRadius: s(20), backgroundColor: FN.card, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={st.icon} size={s(18)} color={FN.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>{i + 1}. {st.t}</Typography>
                <Typography variant="caption-01" style={{ color: FN.sub }}>{st.d}</Typography>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: s(24), paddingBottom: s(18) }}>
        <View style={{ height: s(48), borderRadius: s(14), backgroundColor: COLORS.fieldnote, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
          <Ionicons name="mic" size={s(18)} color={COLORS.white} />
          <Typography variant="body-03" weight="semibold" className="text-white">지금 녹음 시작</Typography>
        </View>
      </View>
    </View>
  );
}

/** 현재(홈 없음) — FAB 미니 메뉴 + 평평한 목록 */
function CurrentScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
      <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="chevron-back" size={s(20)} color={COLORS.gray[400]} />
        <Typography variant="label-01" weight="semibold" className="text-gray-800">필드노트 목록</Typography>
        <View style={{ width: s(20) }} />
      </View>
      <View style={{ paddingHorizontal: s(16), paddingTop: s(4), gap: s(10) }}>
        {['필드노트', '필드노트', '필드노트', '필드노트'].map((k, i) => (
          <View key={i} style={{ borderRadius: s(12), backgroundColor: COLORS.white, padding: s(14) }}>
            <Typography variant="body-02" weight="semibold" className="text-gray-900">{k}</Typography>
            <View style={{ marginTop: s(8), height: s(8), width: `${70 - i * 8}%`, borderRadius: s(4), backgroundColor: COLORS.gray[100] }} />
          </View>
        ))}
      </View>

      {/* FAB 미니 메뉴 (열린 상태) */}
      <View style={{ position: 'absolute', right: s(16), bottom: s(16), alignItems: 'flex-end', gap: s(10) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: COLORS.white, borderRadius: s(999), paddingHorizontal: s(14), paddingVertical: s(10) }}>
          <Ionicons name="mic-outline" size={s(16)} color={COLORS.fieldnote} />
          <Typography variant="label-01" weight="medium" className="text-gray-800">녹음하기</Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: COLORS.white, borderRadius: s(999), paddingHorizontal: s(14), paddingVertical: s(10) }}>
          <Ionicons name="list-outline" size={s(16)} color={COLORS.fieldnote} />
          <Typography variant="label-01" weight="medium" className="text-gray-800">목록보기</Typography>
        </View>
        <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: COLORS.fieldnote, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={s(24)} color={COLORS.white} />
        </View>
      </View>
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'guide' | 'hub' | 'first';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재(홈X)' },
  { key: 'guide', label: '가이드' },
  { key: 'hub', label: '허브' },
  { key: 'first', label: '첫 사용' },
];

export default function FieldNoteHomeLab() {
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 홈, 필요한가?</Typography>
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
        <QuestionStrip />

        {tab === 'current' && (
          <>
            <TabIntro tone="대조군 · 현재" desc="필드노트는 FAB 액션일 뿐, 도착하는 장소가 없음. 탭하면 '녹음하기 / 목록보기' 두 선택지뿐이고, 목록은 평평한 역순 나열. '지금 뭘 해야 하지'의 답이 화면에 없음." />
            <Phone>
              <CurrentScreen />
            </Phone>
            <Verdict identity="액션 (동사)" fix="no" note="뿌리 없음 — 매번 녹음/목록으로 떨어질 뿐 '들어왔다'는 감각 부재" />
          </>
        )}

        {tab === 'guide' && (
          <>
            <TabIntro tone="밴드에이드 · 설명형" desc="네가 가설로 떠올린 가이드 페이지. '필드노트란?' + 3단계 설명 + 시작 CTA. 처음엔 친절하지만 — 한 번 보면 다시 안 보고, 매일 쓰는 도구의 진입에 정적 설명이 자리만 차지하며 마찰만 늘림." />
            <Phone dark>
              <GuideScreen />
            </Phone>
            <Verdict identity="설명 (정적)" fix="weak" note="첫 안내는 되지만 2회차부터 죽은 화면 — 장소감은 안 생김" />
          </>
        )}

        {tab === 'hub' && (
          <>
            <TabIntro tone="장소로 승격 · 다크 몰입" recommended desc="액션을 '장소'로 승격. 진행 중인 전사 + 오늘 회기(스케줄 연동, 바로 녹음) + 최근 노트가 한 곳에. 매번 같은 곳에 도착하고, 진행 중인 작업이 살아있음. 다크 스킨으로 '필드노트의 자리'를 선언." />
            <Phone dark>
              <HubScreen />
            </Phone>
            <Verdict identity="장소 (명사)" fix="yes" note="회기와 한 몸 + 진행 상태가 살아있어 '필드노트에 들어왔다'가 성립" />
          </>
        )}

        {tab === 'first' && (
          <>
            <TabIntro tone="허브의 빈 상태" desc="같은 허브의 첫 사용 모습. 노트는 0건이지만 오늘 회기는 연동돼 있고, 상단의 가벼운 안내 + 빈 상태 메시지가 '가이드의 유일한 진짜 역할(첫 안내)'을 흡수. 노트가 쌓이면 자연히 허브로 자람 — 별도 가이드 페이지 불필요." />
            <Phone dark>
              <FirstUseScreen />
            </Phone>
            <Verdict identity="장소 (첫 사용)" fix="yes" note="가이드 없이도 첫 안내 충족 — 빈 상태가 온보딩을 겸함" />
          </>
        )}
      </ScrollView>
    </View>
  );
}
