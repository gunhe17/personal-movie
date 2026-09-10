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
 * 필드노트 = sub-app? — 토스 '증권' 패턴(고유 플로팅 바텀 네비 + ← 나가기) 적용 비교.
 *
 * 질문: FAB 탭 시 풀스크린 홈(현재 적용본) 대신, 필드노트를 독립 공간으로 만들고
 * 자체 플로팅 바텀 네비로 움직이게 하는 게 나은가?
 *
 * 관건 — 필드노트의 진짜 섹션은 홈 + 노트(목록) 2개뿐(녹음은 액션). 4칸 네비는 빈 느낌이 날 수
 * 있어 '녹음'을 네비 가운데 액션 버튼으로 올려 `[←] 홈 · ◉녹음 · 노트` 구성으로 채운다.
 *
 * 탭 — [현재] 풀스크린 홈 + 하단 CTA(대조군) / [플로팅 네비] sub-app(홈/노트 전환 + 가운데 녹음 + ← 나가기).
 * 다크 몰입 스킨. 전부 mock.
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote;

const TODAY = [
  { time: '14:00', name: '김민준', program: '놀이치료-개인', state: 'rec' as const },
  { time: '16:00', name: '이서연', program: '미술치료-개인', state: 'rec' as const },
  { time: '17:30', name: '박도윤', program: '놀이치료-개인', state: 'done' as const },
];
const NOTES = [
  { name: '정하늘', when: '어제', tag: '분석완료', color: COLORS.palette.green },
  { name: '한지우', when: '3일 전', tag: '저장됨', color: FN.sub },
  { name: '미연결 노트', when: '4일 전', tag: '전사 중', color: FN.accent },
  { name: '윤서아', when: '5일 전', tag: '분석완료', color: COLORS.palette.green },
];

// ───────────────────────── 공용: 폰 프레임 ─────────────────────────
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: s(500), borderRadius: s(24), overflow: 'hidden', borderWidth: 1, borderColor: COLORS.gray[200], backgroundColor: FN.bg }}>
      {children}
    </View>
  );
}

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
            <Ionicons name="sparkles" size={s(11)} color={FNP} />
            <Typography variant="label-02" weight="semibold" style={{ color: FNP }}>sub-app</Typography>
          </View>
        )}
      </View>
      <Typography variant="body-03" className="text-gray-500">{desc}</Typography>
    </View>
  );
}

// ───────────────────────── 공용: 히어로 (오브 + 헤드라인) ─────────────────────────
function Hero({ count }: { count: number }) {
  return (
    <>
      <View style={{ height: s(118) }}>
        <View style={{ position: 'absolute', top: s(2), right: s(4), backgroundColor: 'rgba(185,139,255,0.18)', borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(6) }}>
          <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>지금 담아둘까요?</Typography>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={['#C9A6FF', '#7C54E0', '#4B2F9E']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: s(84), height: s(84), borderRadius: s(42), alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', top: s(13), left: s(18), width: s(20), height: s(13), borderRadius: s(10), backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <Ionicons name="mic" size={s(34)} color={COLORS.white} />
          </LinearGradient>
        </View>
      </View>
      <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>오늘 담을</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.accent }}>회기 {count}건</Typography>
        <Typography variant="headline-01" weight="semibold" style={{ color: FN.text }}>이 있어요</Typography>
      </View>
    </>
  );
}

function SessionRow({ time, name, program, state }: (typeof TODAY)[number]) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
      <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>{time}</Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>{name}</Typography>
        <Typography variant="caption-01" style={{ color: FN.sub }}>{program}</Typography>
      </View>
      {state === 'rec' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
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
  );
}

function HomeContent() {
  return (
    <>
      <Hero count={3} />
      <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), marginBottom: s(8), color: FN.sub }}>오늘 회기</Typography>
      <View style={{ gap: s(8) }}>
        {TODAY.map((t) => <SessionRow key={t.time} {...t} />)}
      </View>
    </>
  );
}

function NotesContent() {
  const chips = ['전체', '분석완료', '분석중', '녹음만'];
  return (
    <>
      <Typography variant="headline-02" weight="semibold" style={{ marginTop: s(6), marginBottom: s(12), color: FN.text }}>전체 노트</Typography>
      <View style={{ flexDirection: 'row', gap: s(6), marginBottom: s(12) }}>
        {chips.map((c, i) => (
          <View key={c} style={{ backgroundColor: i === 0 ? 'rgba(185,139,255,0.18)' : FN.card, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(6) }}>
            <Typography variant="label-02" weight="medium" style={{ color: i === 0 ? FN.accent : FN.sub }}>{c}</Typography>
          </View>
        ))}
      </View>
      <View style={{ gap: s(8) }}>
        {NOTES.map((n) => (
          <View key={n.name} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
            <Ionicons name="document-text-outline" size={s(16)} color={FN.accent} />
            <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>{n.name}</Typography>
            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: n.color }} />
            <Typography variant="caption-01" style={{ color: FN.sub }}>{n.when} · {n.tag}</Typography>
          </View>
        ))}
      </View>
    </>
  );
}

// ════════════════════ 탭 1 · 현재 (풀스크린 홈 + 하단 CTA) ════════════════════
function CurrentFull() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(16) }}>
        <Ionicons name="chevron-back" size={s(20)} color={FN.text} />
        <Ionicons name="albums-outline" size={s(18)} color={FN.sub} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(86) }} showsVerticalScrollIndicator={false}>
        <HomeContent />
      </ScrollView>
      {/* 하단 풀폭 CTA — 시스템 네비와 겹치기 쉬운 지점 */}
      <View style={{ position: 'absolute', left: s(16), right: s(16), bottom: s(16) }}>
        <View style={{ height: s(52), borderRadius: s(16), backgroundColor: FNP, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
          <Ionicons name="mic" size={s(18)} color={COLORS.white} />
          <Typography variant="body-02" weight="semibold" className="text-white">바로 녹음 시작</Typography>
        </View>
      </View>
    </View>
  );
}

// ════════════════════ 탭 2 · 플로팅 네비 (sub-app) ════════════════════
function FloatingNavSubApp() {
  const [nav, setNav] = useState<'home' | 'notes'>('home');
  return (
    <View style={{ flex: 1 }}>
      {/* 상단 미니 헤더 — 공간(맥락) 이름 */}
      <View style={{ height: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(16) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>필드노트</Typography>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(100) }} showsVerticalScrollIndicator={false}>
        {nav === 'home' ? <HomeContent /> : <NotesContent />}
      </ScrollView>

      {/* 플로팅 바텀 네비 (토스 증권 패턴) — [←] 홈 · ◉녹음 · 노트 */}
      <View style={{ position: 'absolute', left: s(14), right: s(14), bottom: s(16), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        {/* ← 나가기 (별도 원형) */}
        <View style={{ width: s(46), height: s(46), borderRadius: s(23), backgroundColor: FN.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
          <Ionicons name="arrow-back" size={s(20)} color={FN.text} />
        </View>
        {/* 네비 pill */}
        <View style={{ flex: 1, height: s(56), borderRadius: s(28), backgroundColor: FN.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: s(10), shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
          <Pressable onPress={() => setNav('home')} style={{ alignItems: 'center', gap: s(2), width: s(52) }}>
            <Ionicons name={nav === 'home' ? 'home' : 'home-outline'} size={s(20)} color={nav === 'home' ? FN.accent : FN.sub} />
            <Typography variant="caption-01" weight={nav === 'home' ? 'semibold' : 'regular'} style={{ color: nav === 'home' ? FN.accent : FN.sub }}>홈</Typography>
          </Pressable>
          {/* 가운데 녹음 액션 (강조) */}
          <Pressable style={{ alignItems: 'center', justifyContent: 'center', width: s(54), height: s(54), borderRadius: s(27), backgroundColor: FNP, marginTop: s(-14), shadowColor: FNP, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
            <Ionicons name="mic" size={s(24)} color={COLORS.white} />
          </Pressable>
          <Pressable onPress={() => setNav('notes')} style={{ alignItems: 'center', gap: s(2), width: s(52) }}>
            <Ionicons name={nav === 'notes' ? 'documents' : 'documents-outline'} size={s(20)} color={nav === 'notes' ? FN.accent : FN.sub} />
            <Typography variant="caption-01" weight={nav === 'notes' ? 'semibold' : 'regular'} style={{ color: nav === 'notes' ? FN.accent : FN.sub }}>노트</Typography>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'current' | 'subapp';
const TABS: { key: Tab; label: string }[] = [
  { key: 'current', label: '현재(풀스크린)' },
  { key: 'subapp', label: '플로팅 네비' },
];

export default function FieldNoteSubAppNavLab() {
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 = sub-app?</Typography>
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
        {tab === 'current' && (
          <>
            <TabIntro tone="대조군 · 현재 적용본" desc="지금 production 홈 — 풀스크린 + 하단 풀폭 CTA. 한 화면에 오늘 회기·노트가 다 들어가고, '바로 녹음'은 하단 버튼. 안드로이드 시스템 네비와 겹치기 쉬운 지점." />
            <Phone><CurrentFull /></Phone>
          </>
        )}
        {tab === 'subapp' && (
          <>
            <TabIntro tone="토스 증권 패턴" recommended desc="필드노트를 독립 공간으로 — 플로팅 바텀 네비 [←] 홈 · ◉녹음 · 노트. 홈/노트 탭을 눌러 콘텐츠 전환(인터랙티브), 가운데 녹음은 항상 1탭, ←로 나가기. 시스템 네비 위에 떠서 겹침 없음." />
            <Phone><FloatingNavSubApp /></Phone>
            <Typography variant="caption-01" style={{ marginTop: s(10), color: COLORS.gray[400] }}>
              ↑ 홈·노트 탭을 눌러보세요. 가운데 녹음 = 액션(전역 시트), ← = 메인으로 나가기.
            </Typography>
          </>
        )}
      </ScrollView>
    </View>
  );
}
