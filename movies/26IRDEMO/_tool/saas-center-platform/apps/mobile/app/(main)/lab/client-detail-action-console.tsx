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
 * 내담자 상세 — 액션 콘솔 모델 비교 lab.
 *
 * 정보 스펙 §3-3을 "정적 카탈로그" → "액션 콘솔"로 재정의하는 결정의 검증용.
 * 상담사 1:1 인터뷰에서 시안을 보여주고 "이 화면을 열고 뭘 하시겠어요?"를 묻기 위한 mock.
 *
 *   A — 컴팩트 콘솔 (현재 대조군 + 액션)
 *        빠른 액션 4-grid + Attention 가로 캐러셀(1행) + 카테고리 탭 그대로
 *   B — 콘솔 우선 (참고 앱 톤)
 *        빠른 액션 큰 pill 3개 + Attention 세로 스택 + 카드형 2-grid 진입
 *   C — 신호 우선 (Agentic 톤)
 *        Attention hero 1장 + 인라인 액션 + 기존 탭 + 신호 없으면 hero 자리 미니멀
 *
 * 실데이터 의존 없음. mock 인라인.
 */

// ── Mock ──
const MOCK_CLIENT = {
  name: '김민준',
  gender: '남',
  age: 32,
  phone: '010-1234-5678',
  memo: '지난 회기에 직장 스트레스 호소. 다음 회기 전 호흡 훈련 준비.',
  birth: '1993.07.12',
  email: 'minjun.kim@example.com',
  registeredAt: '2025.11.03',
};

const MOCK_UPCOMING = {
  date: '2026.05.23 (금) 14:00 - 15:00',
  program: '놀이치료-개인',
  room: '상담실 A',
  diff: '2일 뒤',
};

type SignalKey = 'unpaid' | 'unlogged' | 'today' | 'noshow';
interface SignalItem {
  key: SignalKey;
  label: string;
  detail: string;
  action: string;
  tone: 'warning' | 'info' | 'primary' | 'danger';
}

const MOCK_SIGNALS: SignalItem[] = [
  {
    key: 'unpaid',
    label: '청구 미수',
    detail: '50,000원 · 3일 경과',
    action: '결제 안내',
    tone: 'warning',
  },
  {
    key: 'unlogged',
    label: '일지 미작성',
    detail: '완료한 회기 2건',
    action: '일지 작성',
    tone: 'info',
  },
  {
    key: 'today',
    label: '오늘 회기 예정',
    detail: '오후 2시 · 놀이치료-개인',
    action: '회기 열기',
    tone: 'primary',
  },
];

const MOCK_CASES = [
  { id: 'c1', kind: '상담', name: '놀이치료-개인', meta: '4/12회 진행' },
  { id: 'c2', kind: '검사', name: 'K-WISC-V', meta: '완료 4/4' },
];

// ── Variants ──
type Variant = 'compact' | 'console' | 'signal';
const VARIANTS: { key: Variant; label: string; hint: string }[] = [
  { key: 'compact', label: 'A 컴팩트', hint: '대조군+액션' },
  { key: 'console', label: 'B 콘솔', hint: '참고앱 톤' },
  { key: 'signal', label: 'C 신호', hint: 'Agentic' },
];

export default function ClientDetailActionConsoleLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('compact');

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              내담자 상세 · 액션 콘솔
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? 'semibold' : 'medium'}
                    style={{
                      color: active ? COLORS.text.title.default : COLORS.gray[500],
                    }}
                  >
                    {v.label}
                  </Typography>
                  <Typography
                    variant="caption-01"
                    style={{
                      color: active ? COLORS.gray[600] : COLORS.gray[400],
                      marginTop: s(1),
                    }}
                  >
                    {v.hint}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(64),
          gap: s(20),
        }}
        showsVerticalScrollIndicator={false}
      >
        <ClientHeader />
        {variant === 'compact' && <CompactVariant />}
        {variant === 'console' && <ConsoleVariant />}
        {variant === 'signal' && <SignalVariant />}
      </ScrollView>
    </View>
  );
}

/* ─────────── 공통: 헤더 (이름·메타) ─────────── */

function ClientHeader() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(56),
          height: s(56),
          borderRadius: s(28),
          backgroundColor: COLORS.primary50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="headline-02"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          {MOCK_CLIENT.name[0]}
        </Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {MOCK_CLIENT.name}
        </Typography>
        <Typography variant="label-01" className="mt-0.5 text-gray-500">
          {MOCK_CLIENT.gender} · 만 {MOCK_CLIENT.age}세
        </Typography>
      </View>
      <Ionicons name="heart" size={22} color={COLORS.primary} />
    </View>
  );
}

/* ─────────── A: 컴팩트 콘솔 ─────────── */

function CompactVariant() {
  return (
    <>
      <QuickActions4Grid />
      <AttentionRowCarousel />
      <UpcomingScheduleCard />
      <CategoryTabsExisting />
      <MemoBlock />
      <BasicInfoBlock />
    </>
  );
}

/* ─────────── B: 콘솔 우선 ─────────── */

function ConsoleVariant() {
  return (
    <>
      <QuickActionsPill3 />
      <AttentionStack3 />
      <UpcomingScheduleCard />
      <CategoryCardsGrid />
      <MemoBlock />
      <BasicInfoBlock />
    </>
  );
}

/* ─────────── C: 신호 우선 ─────────── */

function SignalVariant() {
  return (
    <>
      <AttentionHero />
      <UpcomingScheduleCard />
      <CategoryTabsExisting />
      <MemoBlock />
      <BasicInfoBlock />
    </>
  );
}

/* ─────────── 빠른 액션 (3 variants) ─────────── */

const ACTIONS_4 = [
  { icon: 'call-outline', label: '전화', color: COLORS.primary },
  { icon: 'chatbubble-outline', label: '메시지', color: COLORS.primary },
  { icon: 'create-outline', label: '일지', color: COLORS.palette.orange },
  { icon: 'calendar-outline', label: '일정', color: COLORS.palette.mint },
] as const;

function QuickActions4Grid() {
  return (
    <View style={{ flexDirection: 'row', gap: s(8) }}>
      {ACTIONS_4.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: COLORS.white,
            borderRadius: s(12),
            paddingVertical: s(14),
            alignItems: 'center',
            gap: s(6),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name={a.icon} size={22} color={a.color} />
          <Typography variant="caption-01" weight="medium" className="text-gray-700">
            {a.label}
          </Typography>
        </Pressable>
      ))}
    </View>
  );
}

const ACTIONS_3 = [
  { icon: 'call-outline', label: '전화 걸기' },
  { icon: 'create-outline', label: '일지 작성' },
  { icon: 'calendar-outline', label: '일정 추가' },
] as const;

function QuickActionsPill3() {
  return (
    <View style={{ gap: s(8) }}>
      {ACTIONS_3.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.white,
            borderRadius: s(14),
            paddingVertical: s(14),
            paddingHorizontal: s(16),
            gap: s(12),
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.primary50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={a.icon} size={18} color={COLORS.primary700} />
          </View>
          <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900">
            {a.label}
          </Typography>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray[400]} />
        </Pressable>
      ))}
    </View>
  );
}

/* ─────────── Attention 카드 (3 variants) ─────────── */

function signalPalette(tone: SignalItem['tone']) {
  if (tone === 'warning')
    return { bg: COLORS.paletteBg.yellow, fg: COLORS.palette.yellow };
  if (tone === 'info')
    return { bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue };
  if (tone === 'danger')
    return { bg: COLORS.paletteBg.red, fg: COLORS.palette.red };
  return { bg: COLORS.primary50, fg: COLORS.primary700 };
}

function AttentionRowCarousel() {
  return (
    <View>
      <SectionLabel title="지금 확인해요" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: s(8), paddingRight: s(4) }}
      >
        {MOCK_SIGNALS.map((sig) => {
          const c = signalPalette(sig.tone);
          return (
            <Pressable
              key={sig.key}
              style={({ pressed }) => ({
                backgroundColor: COLORS.white,
                borderRadius: s(12),
                padding: s(12),
                width: s(220),
                gap: s(6),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: c.bg,
                  borderRadius: s(6),
                  paddingVertical: s(2),
                  paddingHorizontal: s(8),
                }}
              >
                <Typography variant="label-02" weight="semibold" style={{ color: c.fg }}>
                  {sig.label}
                </Typography>
              </View>
              <Typography variant="body-02" weight="semibold" className="text-gray-900">
                {sig.detail}
              </Typography>
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.primary700 }}
              >
                {sig.action} →
              </Typography>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AttentionStack3() {
  return (
    <View>
      <SectionLabel title="지금 확인해요" />
      <View style={{ gap: s(8) }}>
        {MOCK_SIGNALS.map((sig) => {
          const c = signalPalette(sig.tone);
          return (
            <Pressable
              key={sig.key}
              style={({ pressed }) => ({
                backgroundColor: COLORS.white,
                borderRadius: s(14),
                padding: s(14),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(12),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(10),
                  backgroundColor: c.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="alert-circle" size={20} color={c.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label-01" weight="semibold" style={{ color: c.fg }}>
                  {sig.label}
                </Typography>
                <Typography variant="body-02" weight="medium" className="mt-0.5 text-gray-900">
                  {sig.detail}
                </Typography>
              </View>
              <View
                style={{
                  backgroundColor: COLORS.gray[100],
                  borderRadius: s(8),
                  paddingVertical: s(6),
                  paddingHorizontal: s(10),
                }}
              >
                <Typography variant="label-01" weight="semibold" className="text-gray-800">
                  {sig.action}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AttentionHero() {
  // 최우선 신호 1개만 hero로 (mock: 청구 미수 가정)
  const hero = MOCK_SIGNALS[0];
  const c = signalPalette(hero.tone);
  return (
    <View>
      <View
        style={{
          backgroundColor: c.bg,
          borderRadius: s(16),
          padding: s(18),
          gap: s(12),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Ionicons name="alert-circle" size={20} color={c.fg} />
          <Typography variant="label-01" weight="semibold" style={{ color: c.fg }}>
            지금 가장 챙겨야 할 것
          </Typography>
        </View>
        <Typography variant="headline-02" weight="semibold" className="text-gray-900">
          {hero.label}
        </Typography>
        <Typography variant="body-02" className="text-gray-700">
          {hero.detail}
        </Typography>
        <View style={{ flexDirection: 'row', gap: s(8) }}>
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: COLORS.white,
              borderRadius: s(10),
              paddingVertical: s(12),
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Typography variant="body-02" weight="semibold" style={{ color: c.fg }}>
              {hero.action}
            </Typography>
          </Pressable>
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: 'transparent',
              borderRadius: s(10),
              paddingVertical: s(12),
              alignItems: 'center',
              borderWidth: 1,
              borderColor: c.fg,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Typography variant="body-02" weight="semibold" style={{ color: c.fg }}>
              나중에
            </Typography>
          </Pressable>
        </View>
      </View>
      {MOCK_SIGNALS.length > 1 && (
        <Pressable
          style={({ pressed }) => ({
            marginTop: s(8),
            alignSelf: 'flex-end',
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(2),
            paddingVertical: s(4),
            paddingHorizontal: s(6),
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Typography variant="label-01" weight="medium" className="text-gray-500">
            다른 신호 {MOCK_SIGNALS.length - 1}건 보기
          </Typography>
          <Ionicons name="chevron-forward" size={12} color={COLORS.gray[500]} />
        </Pressable>
      )}
    </View>
  );
}

/* ─────────── 다가오는 일정 (공통) ─────────── */

function UpcomingScheduleCard() {
  return (
    <View>
      <SectionLabel title="다가오는 일정" />
      <Pressable
        style={({ pressed }) => ({
          backgroundColor: COLORS.white,
          borderRadius: s(14),
          padding: s(14),
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(12),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: s(48),
            height: s(48),
            borderRadius: s(12),
            backgroundColor: COLORS.primary50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>
            {MOCK_UPCOMING.diff}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {MOCK_UPCOMING.date}
          </Typography>
          <Typography variant="label-01" className="text-gray-600">
            {MOCK_UPCOMING.program} · {MOCK_UPCOMING.room}
          </Typography>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.gray[400]} />
      </Pressable>
    </View>
  );
}

/* ─────────── 카테고리 진입 (2 variants) ─────────── */

function CategoryTabsExisting() {
  // 기존 상담/검사 탭 + 케이스 카드 (현재 production 구조)
  return (
    <View>
      <SectionLabel title="진행 중" />
      <View style={{ flexDirection: 'row', gap: s(8), marginBottom: s(8) }}>
        <Pill label="상담 1" active />
        <Pill label="검사 1" />
      </View>
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(14),
          padding: s(14),
        }}
      >
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {MOCK_CASES[0].name}
        </Typography>
        <Typography variant="label-01" className="mt-1 text-gray-500">
          {MOCK_CASES[0].meta}
        </Typography>
      </View>
    </View>
  );
}

function CategoryCardsGrid() {
  const items = [
    { label: '상담', count: 1 },
    { label: '검사', count: 1 },
    { label: '문서', count: 3 },
    { label: '청구', count: 1 },
  ];
  return (
    <View>
      <SectionLabel title="기록과 문서" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
        {items.map((it) => (
          <Pressable
            key={it.label}
            style={({ pressed }) => ({
              flexBasis: '48%',
              backgroundColor: COLORS.white,
              borderRadius: s(14),
              padding: s(14),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="body-02" weight="semibold" className="text-gray-900">
                {it.label}
              </Typography>
              <View
                style={{
                  minWidth: s(20),
                  height: s(20),
                  paddingHorizontal: s(6),
                  borderRadius: s(10),
                  backgroundColor: COLORS.gray[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption-01"
                  weight="semibold"
                  className="text-gray-700"
                >
                  {it.count}
                </Typography>
              </View>
            </View>
            <Typography variant="caption-01" className="mt-1 text-gray-400">
              열어 보기 →
            </Typography>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ─────────── 메모 (공통) ─────────── */

function MemoBlock() {
  return (
    <View>
      <SectionLabel title="메모" />
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(14),
          padding: s(14),
        }}
      >
        <Typography variant="body-02" className="text-gray-800" style={{ lineHeight: s(22) }}>
          {MOCK_CLIENT.memo}
        </Typography>
      </View>
    </View>
  );
}

/* ─────────── 기본 정보 (후순위) ─────────── */

function BasicInfoBlock() {
  return (
    <View>
      <SectionLabel title="기본 정보" />
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(14),
          padding: s(14),
          gap: s(8),
        }}
      >
        <InfoRow label="생년월일" value={MOCK_CLIENT.birth} />
        <InfoRow label="연락처" value={MOCK_CLIENT.phone} />
        <InfoRow label="이메일" value={MOCK_CLIENT.email} />
        <InfoRow label="등록일" value={MOCK_CLIENT.registeredAt} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Typography variant="label-01" style={{ width: s(72), color: COLORS.gray[500] }}>
        {label}
      </Typography>
      <Typography variant="label-01" weight="medium" className="flex-1 text-gray-800">
        {value}
      </Typography>
    </View>
  );
}

/* ─────────── 공통 위젯 ─────────── */

function SectionLabel({ title }: { title: string }) {
  return (
    <Typography
      variant="label-01"
      weight="semibold"
      className="mb-2 text-gray-600"
    >
      {title}
    </Typography>
  );
}

function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View
      style={{
        paddingVertical: s(6),
        paddingHorizontal: s(12),
        borderRadius: s(999),
        backgroundColor: active ? COLORS.gray[900] : COLORS.gray[100],
      }}
    >
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: active ? COLORS.white : COLORS.gray[700] }}
      >
        {label}
      </Typography>
    </View>
  );
}
