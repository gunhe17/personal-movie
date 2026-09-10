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
 * 필드노트 홈 — "토스 결" 비교 랩.
 *
 * 레퍼런스(토스 온보딩/미션 화면)에서 읽은 재료: 부드러운 파스텔 그라데이션 배경 / 큰 헤드라인 +
 * 핵심어만 컬러 / 둥둥 뜨는 3D 일러스트 + 말풍선 / 초록 체크 라인 / 라운드 CTA / 친근 ~해요 톤.
 *
 * 갈림길 — 필드노트 다크 정체성 vs 토스의 밝고 가벼운 톤. 둘 다 만들어 탭으로 비교.
 *  · [허브] 기본 다크(대조군) — 정보 위주, 평이한 톤
 *  · [다크 토스] 다크 보라 유지 + 토스의 구조·온기만 차용
 *  · [라이트 토스] 파스텔로 밝게 전환 (토스 원본에 가장 가까움)
 *
 * ⚠️ 3D 클레이 일러스트는 코드로 못 만든다 — 디자이너/3D 에셋 작업. 여기선 톤·레이아웃·말풍선·
 * CTA·그라데이션까지만 목업하고 일러스트 자리는 글로시 오브 placeholder로 대체. 전부 mock.
 *
 * 파스텔/오브 hex는 디자인 시스템 외 임시값 — 토스 결 탐색용 lab 한정.
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote; // #9B5DFF

const TODAY = [
  { time: '14:00', name: '김민준', program: '놀이치료-개인' },
  { time: '16:00', name: '이서연', program: '미술치료-개인' },
];

// ───────────────────────── 공용: 폰 프레임 ─────────────────────────
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: s(500), borderRadius: s(24), overflow: 'hidden', borderWidth: 1, borderColor: COLORS.gray[200] }}>
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
            <Ionicons name="star" size={s(11)} color={FNP} />
            <Typography variant="label-02" weight="semibold" style={{ color: FNP }}>토스 결</Typography>
          </View>
        )}
      </View>
      <Typography variant="body-03" className="text-gray-500">{desc}</Typography>
    </View>
  );
}

// ───────────────────────── 공용: 둥둥 일러스트 placeholder ─────────────────────────
/** 토스의 3D 일러스트 자리 — 글로시 오브 + 떠다니는 미니 요소 + 말풍선. 실제는 에셋으로 교체. */
function FloatingIllo({ variant }: { variant: 'dark' | 'light' }) {
  const dark = variant === 'dark';
  const orb = dark ? (['#C9A6FF', '#7C54E0', '#4B2F9E'] as const) : (['#C9B0FF', '#9B5DFF'] as const);
  const subText = dark ? FN.sub : COLORS.gray[400];
  const chipBg = dark ? 'rgba(255,255,255,0.08)' : COLORS.white;
  const chipText = dark ? FN.text : COLORS.gray[700];
  return (
    <View style={{ height: s(150), marginVertical: s(6) }}>
      {/* 말풍선 */}
      <View style={{ position: 'absolute', top: s(6), right: s(16), backgroundColor: dark ? 'rgba(185,139,255,0.18)' : 'rgba(155,93,255,0.10)', borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(6) }}>
        <Typography variant="label-02" weight="medium" style={{ color: dark ? FN.accent : FNP }}>지금 담아둘까요?</Typography>
      </View>
      {/* 떠다니는 파형 pill */}
      <View style={{ position: 'absolute', top: s(40), left: s(20), flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: chipBg, borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(7), shadowColor: '#000', shadowOpacity: dark ? 0 : 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
        {[10, 16, 8, 14, 9].map((h, i) => (
          <View key={i} style={{ width: s(3), height: s(h), borderRadius: s(2), backgroundColor: dark ? FN.accent : FNP }} />
        ))}
      </View>
      {/* 떠다니는 미니 회기 카드 */}
      <View style={{ position: 'absolute', bottom: s(8), left: s(28), backgroundColor: chipBg, borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(8), shadowColor: '#000', shadowOpacity: dark ? 0 : 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
        <Typography variant="caption-01" weight="medium" style={{ color: chipText }}>14:00 · 김민준</Typography>
      </View>
      {/* 중앙 글로시 오브 */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={orb} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: s(104), height: s(104), borderRadius: s(52), alignItems: 'center', justifyContent: 'center', shadowColor: FNP, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
          {/* 하이라이트 */}
          <View style={{ position: 'absolute', top: s(16), left: s(22), width: s(26), height: s(16), borderRadius: s(13), backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <Ionicons name="mic" size={s(40)} color={COLORS.white} />
        </LinearGradient>
      </View>
      <Typography variant="caption-01" style={{ textAlign: 'center', marginTop: s(2), color: subText }}>↑ 3D 일러스트 자리 (에셋 교체)</Typography>
    </View>
  );
}

// ───────────────────────── 공용: 헤드라인 (핵심어 컬러) ─────────────────────────
function Headline({ accentColor, baseColor }: { accentColor: string; baseColor: string }) {
  return (
    <View>
      <Typography variant="headline-01" weight="semibold" style={{ color: baseColor }}>오늘 담을</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: accentColor }}>회기 3건</Typography>
        <Typography variant="headline-01" weight="semibold" style={{ color: baseColor }}>이 있어요</Typography>
      </View>
    </View>
  );
}

// ───────────────────────── 공용: 체크 라인 ─────────────────────────
function CheckLine({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
      <Ionicons name="checkmark-circle" size={s(16)} color={COLORS.palette.green} />
      <Typography variant="body-03" style={{ color: dark ? FN.sub : COLORS.gray[600] }}>{text}</Typography>
    </View>
  );
}

// ───────────────────────── 공용: 회기 카드 ─────────────────────────
function SessionCard({ time, name, program, variant }: { time: string; name: string; program: string; variant: 'plain' | 'dark' | 'light' }) {
  const dark = variant !== 'light';
  const bg = variant === 'light' ? COLORS.white : FN.card;
  const shadow = variant === 'light' ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } : {};
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(14), backgroundColor: bg, paddingHorizontal: s(14), paddingVertical: s(12) }, shadow]}>
      <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: dark ? FN.text : COLORS.gray[900] }}>{time}</Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="body-03" weight="medium" style={{ color: dark ? FN.text : COLORS.gray[900] }}>{name}</Typography>
        <Typography variant="caption-01" style={{ color: dark ? FN.sub : COLORS.gray[500] }}>{program}</Typography>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
        <Ionicons name="mic" size={s(13)} color={COLORS.white} />
        <Typography variant="label-02" weight="semibold" className="text-white">녹음</Typography>
      </View>
    </View>
  );
}

// ───────────────────────── 공용: 하단 CTA ─────────────────────────
function BottomCTA() {
  return (
    <View style={{ position: 'absolute', left: s(16), right: s(16), bottom: s(16), height: s(52), borderRadius: s(16), backgroundColor: FNP, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
      <Ionicons name="mic" size={s(18)} color={COLORS.white} />
      <Typography variant="body-02" weight="semibold" className="text-white">바로 녹음 시작</Typography>
    </View>
  );
}

// ════════════════════ 탭 1 · 허브 (기본 다크 · 대조군) ════════════════════
function PlainHub() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <View style={{ paddingHorizontal: s(16), paddingTop: s(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="headline-02" weight="semibold" style={{ color: FN.text }}>필드노트</Typography>
          <Ionicons name="search-outline" size={s(20)} color={FN.sub} />
        </View>
        <Typography variant="body-03" style={{ marginTop: s(2), color: FN.sub }}>오늘 담을 회기가 3건 있어요</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(80) }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.12)', padding: s(14), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Ionicons name="sync" size={s(15)} color={FN.accent} />
          <Typography variant="body-03" weight="semibold" style={{ flex: 1, color: FN.text }}>김민준 · 전사 중</Typography>
          <Ionicons name="chevron-forward" size={s(15)} color={FN.sub} />
        </View>
        <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), marginBottom: s(8), color: FN.sub }}>오늘 회기</Typography>
        <View style={{ gap: s(8) }}>
          {TODAY.map((t) => (
            <SessionCard key={t.time} {...t} variant="plain" />
          ))}
        </View>
      </ScrollView>
      <BottomCTA />
    </View>
  );
}

// ════════════════════ 탭 2 · 다크 토스 ════════════════════
function DarkToss() {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#241A40', '#181228', '#120E1E']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="chevron-back" size={s(20)} color={FN.sub} />
        <Typography variant="label-01" style={{ color: FN.sub }}>전체 노트</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(86) }} showsVerticalScrollIndicator={false}>
        <FloatingIllo variant="dark" />
        <View style={{ marginTop: s(4) }}>
          <Headline accentColor={FN.accent} baseColor={FN.text} />
        </View>
        <View style={{ marginTop: s(12), gap: s(8) }}>
          <CheckLine text="전사·화자 정리는 자동으로 돼요" dark />
          <CheckLine text="AI 요약·일지 초안은 원할 때 골라서" dark />
        </View>
        <Typography variant="label-01" weight="semibold" style={{ marginTop: s(18), marginBottom: s(8), color: FN.sub }}>오늘 회기</Typography>
        <View style={{ gap: s(8) }}>
          {TODAY.map((t) => (
            <SessionCard key={t.time} {...t} variant="dark" />
          ))}
        </View>
      </ScrollView>
      <BottomCTA />
    </View>
  );
}

// ════════════════════ 탭 3 · 라이트 토스 ════════════════════
function LightToss() {
  return (
    <View style={{ flex: 1 }}>
      {/* 파스텔 그라데이션 (라벤더 미스트 → 피치 → 화이트) */}
      <LinearGradient colors={['#F0E8FF', '#F8F2FF', '#FFF6F4', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', inset: 0 }} />
      <View style={{ height: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="chevron-back" size={s(20)} color={COLORS.gray[500]} />
        <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>전체 노트</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(86) }} showsVerticalScrollIndicator={false}>
        <FloatingIllo variant="light" />
        <View style={{ marginTop: s(4) }}>
          <Headline accentColor={FNP} baseColor={COLORS.gray[900]} />
        </View>
        <View style={{ marginTop: s(12), gap: s(8) }}>
          <CheckLine text="전사·화자 정리는 자동으로 돼요" />
          <CheckLine text="AI 요약·일지 초안은 원할 때 골라서" />
        </View>
        <Typography variant="label-01" weight="semibold" style={{ marginTop: s(18), marginBottom: s(8), color: COLORS.gray[600] }}>오늘 회기</Typography>
        <View style={{ gap: s(8) }}>
          {TODAY.map((t) => (
            <SessionCard key={t.time} {...t} variant="light" />
          ))}
        </View>
      </ScrollView>
      <BottomCTA />
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'plain' | 'dark' | 'light';
const TABS: { key: Tab; label: string }[] = [
  { key: 'plain', label: '허브(현재)' },
  { key: 'dark', label: '다크 토스' },
  { key: 'light', label: '라이트 토스' },
];

export default function FieldNoteHomeTossLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('plain');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 홈 · 토스 결</Typography>
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
        {tab === 'plain' && (
          <>
            <TabIntro tone="대조군 · 기본 다크" desc="앞서 만든 허브의 평이한 다크 톤. 정보 위주 — 헤드라인·일러스트·말풍선 없이 배너+리스트. 아래 두 탭의 '온기'와 비교 기준." />
            <Phone><PlainHub /></Phone>
          </>
        )}
        {tab === 'dark' && (
          <>
            <TabIntro tone="다크 보라 + 토스 구조" recommended desc="다크 정체성 유지한 채 토스의 재료만 차용 — 큰 헤드라인(핵심어 보라), 둥둥 글로시 오브 + 말풍선, 초록 체크 라인, 라운드 CTA, 보라 딥 그라데이션. 녹음·상세와 톤이 이어짐." />
            <Phone><DarkToss /></Phone>
            <Typography variant="caption-01" style={{ marginTop: s(10), color: COLORS.gray[400] }}>
              ⚠️ 중앙 오브는 placeholder — 실제 토스 느낌은 3D 클레이 일러스트 에셋이 채움.
            </Typography>
          </>
        )}
        {tab === 'light' && (
          <>
            <TabIntro tone="파스텔 전환 · 토스 원본 근접" desc="홈만 밝게 — 라벤더→피치→화이트 파스텔 그라데이션 + 흰 라운드 카드 + 큰 헤드라인 + 둥둥 일러스트 + 말풍선. 다크 정체성은 녹음·상세에만 남기고, 홈=밝고 환영하는 장소로 대비." />
            <Phone><LightToss /></Phone>
            <Typography variant="caption-01" style={{ marginTop: s(10), color: COLORS.gray[400] }}>
              ⚠️ 중앙 오브는 placeholder · 파스텔 hex는 DS 외 임시값(토스 결 탐색용 lab 한정).
            </Typography>
          </>
        )}
      </ScrollView>
    </View>
  );
}
