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
 * 필드노트 녹음 충돌·복귀 흐름 비교 랩.
 *
 * 두 문제(뿌리 하나 = 진행 중 녹음을 '공간을 가로막는 모달'로 다룸):
 *   (A) 다중 녹음 트리거 충돌 — generic 마이크 vs 회기 연결 녹음. 회기 카드 녹음은 가드 없음.
 *   (B) 녹음 중 FAB → 시트로 직행 → 홈/목록에 갈 수 없는 덫.
 *
 * 확정 방향:
 *   - 단일 활성 녹음 + 최소화 가능한 진행 바(미니 바). 멈춤=폐기 아님(→분석으로 finalize).
 *   - FAB(녹음 중) → 홈(공간)으로. 시트는 가운데 마이크/미니 바로 다시 펼침 + 시트에 최소화(⌄).
 *   - 미연결 녹음 중 회기 B 녹음 탭 → "이 회기에 연결할까요?"(새 녹음 X).
 *   - 다른 회기 A 녹음 중 회기 B 탭 → "멈추고 새로?"(A는 멈춰도 분석으로 남음).
 *
 * 탭 — [현재(덫)] / [공간 복귀] / [연결 제안] / [회기 전환]. 전부 mock.
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote;
const NAV_BG = '#322C4A';
const NAV_BORDER = 'rgba(255,255,255,0.12)';

// ───────────────────────── 공용 조각 ─────────────────────────
function MiniRecBar({ link, dim }: { link: string; dim?: boolean }) {
  return (
    <View style={{ marginHorizontal: s(16), marginTop: s(6), flexDirection: 'row', alignItems: 'center', gap: s(8), borderRadius: s(12), backgroundColor: 'rgba(255,66,66,0.14)', borderWidth: 1, borderColor: 'rgba(255,66,66,0.3)', paddingHorizontal: s(12), paddingVertical: s(10), opacity: dim ? 0.6 : 1 }}>
      <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.error }} />
      <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>녹음 중 · 02:14</Typography>
      <View style={{ width: 1, height: s(12), backgroundColor: FN.line }} />
      <Typography variant="label-02" style={{ color: FN.sub, flex: 1 }} numberOfLines={1}>{link}</Typography>
      <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>탭하여 열기</Typography>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Typography variant="label-01" weight="semibold" style={{ marginTop: s(16), marginBottom: s(8), color: FN.sub }}>{children}</Typography>;
}

function SessionCard({ time, name, program, highlight }: { time: string; name: string; program: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12), borderWidth: highlight ? 1 : 0, borderColor: highlight ? FN.accent : 'transparent' }}>
      <Typography variant="label-01" weight="semibold" style={{ width: s(40), color: FN.text }}>{time}</Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>{name}</Typography>
        <Typography variant="caption-01" style={{ color: FN.sub }}>{program}</Typography>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
        <Ionicons name="mic" size={s(13)} color={COLORS.white} />
        <Typography variant="label-02" weight="semibold" className="text-white">녹음</Typography>
      </View>
    </View>
  );
}

function BottomNav({ live }: { live?: boolean }) {
  return (
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
          <View style={{ marginTop: s(-18) }}>
            {live && <View style={{ position: 'absolute', top: s(-2), right: s(-2), width: s(14), height: s(14), borderRadius: s(7), backgroundColor: COLORS.error, borderWidth: s(2), borderColor: NAV_BG, zIndex: 2 }} />}
            <LinearGradient colors={['#C9A6FF', '#9B5DFF', '#7C54E0']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: s(54), height: s(54), borderRadius: s(27), alignItems: 'center', justifyContent: 'center', borderWidth: s(3), borderColor: live ? COLORS.error : NAV_BG }}>
              {live ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), height: s(20) }}>
                  {[0.5, 0.9, 0.6, 0.85].map((h, i) => (
                    <View key={i} style={{ width: s(3), height: s(18) * h, borderRadius: s(2), backgroundColor: COLORS.white }} />
                  ))}
                </View>
              ) : (
                <Ionicons name="mic" size={s(24)} color={COLORS.white} />
              )}
            </LinearGradient>
          </View>
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
  );
}

/** 확인 바텀시트 (다이얼로그) — 딤 + 하단 시트. */
function ConfirmSheet({ icon, iconColor, title, desc, primary, secondary }: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; desc: string; primary: string; secondary: string }) {
  return (
    <View style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <View style={{ backgroundColor: FN.card, borderTopLeftRadius: s(20), borderTopRightRadius: s(20), paddingHorizontal: s(20), paddingTop: s(20), paddingBottom: s(28) }}>
        <View style={{ width: s(40), height: s(40), borderRadius: s(12), backgroundColor: iconColor + '22', alignItems: 'center', justifyContent: 'center', marginBottom: s(14) }}>
          <Ionicons name={icon} size={s(20)} color={iconColor} />
        </View>
        <Typography variant="headline-02" weight="bold" style={{ color: FN.text }}>{title}</Typography>
        <Typography variant="body-02" style={{ color: FN.sub, marginTop: s(8), lineHeight: s(22) }}>{desc}</Typography>
        <View style={{ marginTop: s(20), gap: s(8) }}>
          <View style={{ height: s(50), borderRadius: s(14), backgroundColor: FNP, alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body-01" weight="semibold" className="text-white">{primary}</Typography>
          </View>
          <View style={{ height: s(50), borderRadius: s(14), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body-01" weight="medium" style={{ color: FN.sub }}>{secondary}</Typography>
          </View>
        </View>
      </View>
    </View>
  );
}

// ───────────────────────── 폰 프레임 ─────────────────────────
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: s(560), borderRadius: s(24), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>{children}</View>
  );
}

function DarkHeader() {
  return (
    <View style={{ height: s(44), alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="label-01" weight="semibold" style={{ color: FN.sub }}>필드노트</Typography>
    </View>
  );
}

// ════════════════════ 시안 1: 현재(덫) ════════════════════
function TrapScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      {/* 녹음 시트 — 빠져나갈 길이 없음 (← 도, ⌄ 도 없음) */}
      <View style={{ height: s(44), alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(20) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.error }} />
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.error }}>녹음 중 · 02:14</Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), height: s(60) }}>
          {[0.4, 0.8, 0.5, 1, 0.6, 0.9, 0.45, 0.7, 1, 0.55, 0.85, 0.5, 0.75].map((h, i) => (
            <View key={i} style={{ width: s(4), height: s(56) * h, borderRadius: s(2), backgroundColor: FN.accent }} />
          ))}
        </View>
        <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(24) }}>미연결 녹음 (회기 연결 안 됨)</Typography>
        <View style={{ flexDirection: 'row', gap: s(16), marginTop: s(28) }}>
          <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pause" size={s(24)} color={FN.text} />
          </View>
          <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="stop" size={s(22)} color={COLORS.white} />
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: s(20), paddingBottom: s(20) }}>
        <View style={{ borderRadius: s(12), backgroundColor: 'rgba(255,66,66,0.1)', padding: s(12), flexDirection: 'row', gap: s(8) }}>
          <Ionicons name="warning-outline" size={s(15)} color={COLORS.error} />
          <Typography variant="label-02" style={{ color: FN.sub, flex: 1, lineHeight: s(17) }}>
            여기서 홈·목록으로 나갈 길이 없음. FAB를 다시 눌러도 이 시트로 직행. 회기 카드 녹음 버튼은 가드 없이 또 start.
          </Typography>
        </View>
      </View>
    </View>
  );
}

// ════════════════════ 시안 2: 공간 복귀 ════════════════════
function SpaceReturnScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <DarkHeader />
      {/* 최소화된 진행 바 — 녹음은 백그라운드, 공간은 자유 */}
      <MiniRecBar link="미연결 · 탭하여 열기" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(96) }} showsVerticalScrollIndicator={false}>
        <SectionLabel>오늘 회기</SectionLabel>
        <View style={{ gap: s(8) }}>
          <SessionCard time="14:00" name="김민준" program="놀이치료-개인" />
          <SessionCard time="16:00" name="이서연" program="미술치료-개인" />
        </View>
        <SectionLabel>최근 노트</SectionLabel>
        <View style={{ gap: s(8) }}>
          {['정하늘', '한지우'].map((n) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), borderRadius: s(14), backgroundColor: FN.card, paddingHorizontal: s(14), paddingVertical: s(12) }}>
              <Ionicons name="document-text-outline" size={s(16)} color={FN.accent} />
              <Typography variant="body-03" weight="medium" style={{ flex: 1, color: FN.text }}>{n}</Typography>
              <Typography variant="caption-01" style={{ color: FN.sub }}>어제 · 분석완료</Typography>
            </View>
          ))}
        </View>
        <View style={{ marginTop: s(16), borderRadius: s(12), backgroundColor: 'rgba(185,139,255,0.1)', padding: s(12), flexDirection: 'row', gap: s(8) }}>
          <Ionicons name="checkmark-circle-outline" size={s(15)} color={FN.accent} />
          <Typography variant="label-02" style={{ color: FN.sub, flex: 1, lineHeight: s(17) }}>
            FAB 녹음 중 → 홈. 녹음은 미니 바·가운데 마이크(빨강)로 표현. 목록·노트 자유 이동. 시트는 바/마이크 탭으로 펼침 + 시트엔 최소화(⌄).
          </Typography>
        </View>
      </ScrollView>
      <BottomNav live />
    </View>
  );
}

// ════════════════════ 시안 3: 연결 제안 (미연결 + 회기 B) ════════════════════
function LinkOfferScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <DarkHeader />
      <MiniRecBar link="미연결 · 탭하여 열기" dim />
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(96) }} showsVerticalScrollIndicator={false}>
        <SectionLabel>오늘 회기</SectionLabel>
        <View style={{ gap: s(8) }}>
          <SessionCard time="14:00" name="김민준" program="놀이치료-개인" highlight />
          <SessionCard time="16:00" name="이서연" program="미술치료-개인" />
        </View>
      </ScrollView>
      <ConfirmSheet
        icon="link"
        iconColor={FN.accent}
        title="이 회기에 연결할까요?"
        desc="진행 중인 미연결 녹음을 김민준 · 놀이치료-개인 회기에 연결해요. 녹음은 멈추지 않고 그대로 이어져요."
        primary="이 회기에 연결"
        secondary="취소"
      />
    </View>
  );
}

// ════════════════════ 시안 4: 회기 전환 (A≠B 충돌) ════════════════════
function SwitchScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: FN.bg }}>
      <DarkHeader />
      <MiniRecBar link="김민준 회기 · 탭하여 열기" dim />
      <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(96) }} showsVerticalScrollIndicator={false}>
        <SectionLabel>오늘 회기</SectionLabel>
        <View style={{ gap: s(8) }}>
          <SessionCard time="14:00" name="김민준" program="놀이치료-개인" />
          <SessionCard time="16:00" name="이서연" program="미술치료-개인" highlight />
        </View>
      </ScrollView>
      <ConfirmSheet
        icon="swap-horizontal"
        iconColor={COLORS.warning}
        title="녹음을 전환할까요?"
        desc="김민준 회기 녹음이 진행 중이에요. 멈추면 그 녹음은 분석으로 저장돼요. 이서연 회기를 새로 녹음할까요?"
        primary="멈추고 이서연 녹음"
        secondary="김민준 녹음 계속"
      />
    </View>
  );
}

// ───────────────────────── 탭 인트로 ─────────────────────────
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
            <Ionicons name="checkmark-circle" size={s(11)} color={COLORS.fieldnote} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>확정 방향</Typography>
          </View>
        )}
      </View>
      <Typography variant="body-03" className="text-gray-500">{desc}</Typography>
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'trap' | 'space' | 'link' | 'switch';
const TABS: { key: Tab; label: string }[] = [
  { key: 'trap', label: '현재(덫)' },
  { key: 'space', label: '공간 복귀' },
  { key: 'link', label: '연결 제안' },
  { key: 'switch', label: '회기 전환' },
];

export default function FieldNoteRecordingConflictLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('trap');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 녹음 충돌·복귀</Typography>
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
        {tab === 'trap' && (
          <>
            <TabIntro tone="문제 · 대조군" desc="녹음 중 FAB → 시트 직행. 시트에서 홈·목록으로 나갈 길이 없는 덫. 회기 카드 녹음 버튼은 진행 중 녹음을 무시하고 또 start (가드 없음). 두 문제가 한 화면에." />
            <Phone><TrapScreen /></Phone>
          </>
        )}
        {tab === 'space' && (
          <>
            <TabIntro tone="문제 B 해결 · 최소화" recommended desc="FAB 녹음 중 → 홈(공간). 녹음은 상단 미니 바 + 가운데 마이크(빨강)로 살아있고, 목록·노트로 자유 이동. 시트는 미니 바/마이크 탭으로 다시 펼침. 시트엔 최소화(⌄) 버튼." />
            <Phone><SpaceReturnScreen /></Phone>
          </>
        )}
        {tab === 'link' && (
          <>
            <TabIntro tone="문제 A · 미연결+회기탭" recommended desc="미연결 녹음 진행 중 회기 B '녹음' 탭 → 새 녹음 시작 대신 '이 회기에 연결할까요?'. 연결만 하고 녹음은 그대로 이어짐. record-first-link-later 실현." />
            <Phone><LinkOfferScreen /></Phone>
          </>
        )}
        {tab === 'switch' && (
          <>
            <TabIntro tone="문제 A · 다른 회기 충돌" recommended desc="회기 A 녹음 중 회기 B '녹음' 탭 → '멈추고 새로?' 확인. A는 멈춰도 분석으로 저장돼 안 사라짐(멈춤≠폐기). 같은 회기를 다시 누르면 그냥 시트만 열림." />
            <Phone><SwitchScreen /></Phone>
          </>
        )}
      </ScrollView>
    </View>
  );
}
