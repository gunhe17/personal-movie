import { useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 내담자 목록 · 일상 탐색 시안 (lab) — 조화(직관·필요성·재미) 3안 비교
 *
 * `clients-agentic`(강조 필요 내담자 우선)과 겹치지 않게, 매일 훑어보는 기본 명단을
 * 다듬는다. 한 축에 특화되지 않고 직관·필요성·재미가 **적절히 섞여** 만족감을 주는
 * 조화를 목표로, 균형점을 다르게 잡은 3안을 비교한다.
 * (관심 내담자 영역 + 전체 명단을 한 페이지에서 함께 봄)
 *
 * 탭 4시안:
 *   현재     — 관심 가로 카드 캐러셀 + 한 줄 카드 명단 (production 재현, 대조군)
 *   조화 A   — 균형 리스트: 초성 그룹 + 점프 레일 골격에 컬러 아바타·출석·다음 만남을 포인트로
 *   조화 B   — 풍성 카드: 한 명을 화사한 카드로 풍부하게(역할·출석·연락처·다음 만남)
 *   조화 C   — 강약 섹션: 위는 강조(관심 + 오늘 만나요), 아래는 차분한 전체 명단
 *
 * ⚠️ 스펙 메모: §3-3 "내담자 리스트 카드" 는 이름·성별/나이·생년월일·연락처만 정의.
 *   조화안의 출석 패턴 dots·역할 뱃지는 §3-3(상세)·역할 규칙에서 끌어온 스펙 밖 제안.
 *   방향이 좋으면 §3-3 리스트 카드 격상 여부 결정.
 */

type Variant = 'baseline' | 'blendA' | 'blendB' | 'blendC' | 'mix';

const TABS: { key: Variant; label: string; sub: string }[] = [
  { key: 'baseline', label: '현재', sub: '대조군' },
  { key: 'blendA', label: 'A 균형', sub: '리스트' },
  { key: 'blendB', label: 'B 풍성', sub: '카드' },
  { key: 'blendC', label: 'C 강약', sub: '섹션' },
  { key: 'mix', label: 'D 믹스', sub: '베스트' },
];

/* ────────────────────────────────────────────────
 * 아바타 컬러 — 사람마다 일관 (seed = id). production helpers 와 동일 팔레트.
 * ──────────────────────────────────────────────── */
const PROFILE_PALETTE = [
  { bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  { bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
  { bg: COLORS.paletteBg.orange, fg: COLORS.palette.orange },
  { bg: COLORS.paletteBg.violet, fg: COLORS.palette.violet },
  { bg: COLORS.paletteBg.pink, fg: COLORS.palette.pink },
  { bg: COLORS.paletteBg.mint, fg: COLORS.palette.mint },
] as const;

function getProfileColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PROFILE_PALETTE[Math.abs(hash) % PROFILE_PALETTE.length];
}

/* ────────────────────────────────────────────────
 * 초성 추출 — 한글 첫 글자 → 19 초성 → 14 자음 정규화(쌍자음 묶음).
 * ──────────────────────────────────────────────── */
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const DOUBLE_TO_BASE: Record<string, string> = {
  ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ',
};

function getChoseong(name: string): string {
  const code = name.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const raw = CHOSEONG[Math.floor((code - 0xac00) / 588)];
    return DOUBLE_TO_BASE[raw] ?? raw;
  }
  return '#';
}

function groupByChoseong(list: MockClient[]): [string, MockClient[]][] {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const map = new Map<string, MockClient[]>();
  for (const c of sorted) {
    const key = getChoseong(c.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries());
}

/* ────────────────────────────────────────────────
 * Mock 데이터 — 일상 명단(우선순위/신호 없음).
 *   attendance: 최근 5회기 (oldest→newest), true=참석 / false=결석
 *   role: 'child' 아동 / 'adult' 성인 / 'guardian' 보호자
 *   favorite: 관심 내담자 — m1·m3·m8·m13 (4명)
 * ──────────────────────────────────────────────── */
type Role = 'child' | 'adult' | 'guardian';

interface MockClient {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birth: string;
  age: number;
  phone: string;
  role: Role;
  attendance: boolean[];
  nextLabel: string | null;
  dday: string | null;
  favorite: boolean;
}

const MOCK: MockClient[] = [
  { id: 'm1', name: '강하늘', gender: 'male', birth: '2015.03.11', age: 11, phone: '010-2231-7781', role: 'child', attendance: [true, true, false, true, true], nextLabel: '오늘 16:00', dday: 'D-0', favorite: true },
  { id: 'm2', name: '김민준', gender: 'male', birth: '2017.04.12', age: 9, phone: '010-5512-3098', role: 'child', attendance: [true, true, true, true, true], nextLabel: '내일 10:00', dday: '내일', favorite: false },
  { id: 'm3', name: '김서연', gender: 'female', birth: '2009.11.02', age: 16, phone: '010-3340-1122', role: 'child', attendance: [true, false, true, true, false], nextLabel: '6/5 (목) 15:00', dday: 'D-3', favorite: true },
  { id: 'm4', name: '노아인', gender: 'female', birth: '1992.06.20', age: 33, phone: '010-7781-2245', role: 'adult', attendance: [true, true, true, false, true], nextLabel: null, dday: null, favorite: false },
  { id: 'm5', name: '도하준', gender: 'male', birth: '2013.09.30', age: 12, phone: '010-1102-8890', role: 'child', attendance: [true, true, false, false, false], nextLabel: '6/9 (월) 11:00', dday: 'D-7', favorite: false },
  { id: 'm6', name: '류지호', gender: 'male', birth: '2011.01.17', age: 15, phone: '010-4456-7720', role: 'child', attendance: [true, true, true, true, false], nextLabel: '6/6 (금) 17:00', dday: 'D-4', favorite: false },
  { id: 'm7', name: '문채원', gender: 'female', birth: '2016.07.08', age: 9, phone: '010-9981-3312', role: 'child', attendance: [true, false, false, true, true], nextLabel: '내일 14:00', dday: '내일', favorite: false },
  { id: 'm8', name: '박지훈', gender: 'male', birth: '1998.02.14', age: 28, phone: '010-2204-6678', role: 'adult', attendance: [true, true, false, true, true], nextLabel: '오늘 18:00', dday: 'D-0', favorite: true },
  { id: 'm9', name: '서윤아', gender: 'female', birth: '2018.12.25', age: 7, phone: '010-3312-0091', role: 'child', attendance: [true, true, true, true, true], nextLabel: null, dday: null, favorite: false },
  { id: 'm10', name: '송하린', gender: 'female', birth: '2010.05.19', age: 16, phone: '010-6678-4421', role: 'child', attendance: [false, false, true, false, false], nextLabel: '6/5 (목) 16:30', dday: 'D-3', favorite: false },
  { id: 'm11', name: '오태경', gender: 'male', birth: '1973.08.03', age: 52, phone: '010-1145-9982', role: 'guardian', attendance: [true, true, true, true, true], nextLabel: null, dday: null, favorite: false },
  { id: 'm12', name: '윤지원', gender: 'female', birth: '1999.10.10', age: 26, phone: '010-8890-2231', role: 'adult', attendance: [true, true, true, false, true], nextLabel: '6/10 (화) 13:00', dday: 'D-8', favorite: false },
  { id: 'm13', name: '이서연', gender: 'female', birth: '2019.04.01', age: 7, phone: '010-2231-5567', role: 'child', attendance: [true, true, true, true, true], nextLabel: '내일 09:30', dday: '내일', favorite: true },
  { id: 'm14', name: '정유나', gender: 'female', birth: '1994.03.22', age: 32, phone: '010-7720-1183', role: 'adult', attendance: [true, true, true, true, true], nextLabel: '6/7 (토) 10:00', dday: 'D-5', favorite: false },
  { id: 'm15', name: '최서아', gender: 'female', birth: '2012.06.06', age: 14, phone: '010-3390-4456', role: 'child', attendance: [false, true, false, true, false], nextLabel: '6/6 (금) 15:00', dday: 'D-4', favorite: false },
  { id: 'm16', name: '한도윤', gender: 'male', birth: '2001.09.09', age: 24, phone: '010-5567-7781', role: 'adult', attendance: [true, false, true, true, true], nextLabel: null, dday: null, favorite: false },
  { id: 'm17', name: '황민호', gender: 'male', birth: '1968.12.01', age: 57, phone: '010-9982-3340', role: 'guardian', attendance: [true, true, true, true, true], nextLabel: null, dday: null, favorite: false },
];

const FAVORITES = MOCK.filter((c) => c.favorite);
const TODAY_CLIENTS = MOCK.filter((c) => c.dday === 'D-0');

const ROLE_LABEL: Record<Role, string> = {
  child: '아동',
  adult: '성인',
  guardian: '보호자',
};

function genderLabel(g: 'male' | 'female') {
  return g === 'female' ? '여' : '남';
}

/** 다음 만남을 짧은 칩 라벨로 (오늘/내일/날짜) */
function shortWhen(c: MockClient): string {
  if (!c.nextLabel) return '일정 없음';
  if (c.dday === 'D-0') return '오늘';
  if (c.dday === '내일') return '내일';
  return c.nextLabel.split(' ')[0];
}

/* ════════════════════════════════════════════════
 * 메인
 * ════════════════════════════════════════════════ */
export default function ClientsBrowseLabScreen() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('mix');

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-12 flex-row items-center px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            내담자 목록 · 조화 3안
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      {/* 시안 전환 탭 */}
      <View style={{ paddingHorizontal: s(16), paddingTop: s(16) }}>
        <View style={{ padding: s(4), gap: s(4) }} className="flex-row rounded-md bg-gray-50">
          {TABS.map((tab) => {
            const active = tab.key === variant;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setVariant(tab.key)}
                activeOpacity={0.7}
                style={{ paddingVertical: s(8) }}
                className={`flex-1 items-center justify-center rounded-sm ${
                  active ? 'bg-surface' : 'bg-transparent'
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'semibold' : 'medium'}
                  className={active ? 'text-gray-900' : 'text-gray-500'}
                >
                  {tab.label}
                </Typography>
                <Typography
                  variant="caption-01"
                  weight="regular"
                  className={active ? 'text-gray-500' : 'text-gray-400'}
                  style={{ marginTop: s(2) }}
                >
                  {tab.sub}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 시안 내용 */}
      <View className="flex-1 bg-background" style={{ marginTop: s(16) }}>
        {variant === 'baseline' && <BaselinePage />}
        {variant === 'blendA' && <BlendAPage />}
        {variant === 'blendB' && <BlendBPage />}
        {variant === 'blendC' && <BlendCPage />}
        {variant === 'mix' && <MixPage />}
      </View>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────
 * 공용 컴포넌트
 * ──────────────────────────────────────────────── */
function SectionLabel({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <View style={{ marginBottom: s(10) }}>
      <View className="flex-row items-baseline" style={{ gap: s(6) }}>
        <Typography variant="label-01" weight="bold" className="text-gray-700" style={{ letterSpacing: 0.2 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Typography variant="label-01" className="text-gray-400">
            {count}
          </Typography>
        )}
      </View>
      {hint && (
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(2) }}>
          {hint}
        </Typography>
      )}
    </View>
  );
}

function IntentNote({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View
      className="flex-row items-start rounded-md bg-gray-100"
      style={{ padding: s(12), gap: s(8), marginBottom: s(20) }}
    >
      <View style={{ paddingTop: s(1) }}>
        <Ionicons name={icon} size={14} color={COLORS.gray[500]} />
      </View>
      <Typography variant="body-03" className="flex-1 text-gray-600">
        {text}
      </Typography>
    </View>
  );
}

function SearchBar() {
  return (
    <View
      className="flex-row items-center rounded-md bg-gray-100"
      style={{ height: s(44), paddingHorizontal: s(16), gap: s(8) }}
    >
      <Ionicons name="search-outline" size={s(18)} color={COLORS.gray[400]} />
      <Typography variant="body-02" className="text-gray-400">
        이름, 전화번호로 검색
      </Typography>
    </View>
  );
}

type AvatarTextVariant = 'label-01' | 'body-02' | 'body-01' | 'title-01' | 'headline-02';

function Avatar({
  client,
  size,
  textVariant = 'body-01',
  showHeart = true,
}: {
  client: MockClient;
  size: number;
  textVariant?: AvatarTextVariant;
  showHeart?: boolean;
}) {
  const color = getProfileColor(client.id);
  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: color.bg }}
        className="items-center justify-center"
      >
        <Typography variant={textVariant} weight="bold" style={{ color: color.fg }}>
          {client.name.slice(0, 1)}
        </Typography>
      </View>
      {showHeart && client.favorite && (
        <View
          style={{
            position: 'absolute',
            top: -s(2),
            right: -s(2),
            width: s(16),
            height: s(16),
            borderRadius: s(8),
            backgroundColor: COLORS.white,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <Ionicons name="heart" size={s(10)} color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const isGuardian = role === 'guardian';
  return (
    <View
      style={{
        paddingHorizontal: s(7),
        paddingVertical: s(2),
        borderRadius: s(6),
        backgroundColor: isGuardian ? COLORS.paletteBg.violet : COLORS.gray[100],
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: isGuardian ? COLORS.palette.violet : COLORS.gray[600] }}
      >
        {ROLE_LABEL[role]}
      </Typography>
    </View>
  );
}

/** 최근 3회기 중 결석 수 (§3-3 출석 주의 감지 기준) */
function recentAbsentCount(attendance: boolean[]): number {
  return attendance.slice(-3).filter((a) => !a).length;
}

/** 최근 5회기 참석 요약 (또박또박 텍스트용) */
function attendanceSummary(attendance: boolean[]): { total: number; attended: number } {
  const recent = attendance.slice(-5);
  return { total: recent.length, attended: recent.filter(Boolean).length };
}

/**
 * 출석 주의 칩 — 색 점(의미 불명) 대신 텍스트로.
 * 평소엔 숨기고, 최근 3회 중 2회 이상 결석일 때만 "최근 결석 N회" 노출.
 * 누적 회기 수(20회 등)와 무관 — 항상 '최근' 흐름만 본다.
 */
function AttendanceTag({ attendance }: { attendance: boolean[] }) {
  const absent = recentAbsentCount(attendance);
  if (absent < 2) return null;
  return (
    <View
      className="flex-row items-center rounded-md"
      style={{ backgroundColor: COLORS.paletteBg.orange, paddingHorizontal: s(7), paddingVertical: s(2), gap: s(3) }}
    >
      <Ionicons name="alert-circle" size={11} color={COLORS.palette.orange} />
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>
        최근 결석 {absent}회
      </Typography>
    </View>
  );
}

/**
 * 출석 텍스트 — 명단 행용. 항상 '최근 N회 M참석' 으로 또박또박.
 * 최근 3회 중 2회 이상 결석이면 끝에 ⚠ 아이콘(notice)만 덧붙여 주의 신호.
 * 누적 회기 수와 무관 — 늘 '최근 5회' 창만 본다.
 */
function AttendanceText({ attendance }: { attendance: boolean[] }) {
  const { total, attended } = attendanceSummary(attendance);
  const concern = recentAbsentCount(attendance) >= 2;
  return (
    <View className="flex-row items-center" style={{ gap: s(3) }}>
      <Typography variant="label-01" className="text-gray-500">
        최근 {total}회 {attended}참석
      </Typography>
      {concern && <Ionicons name="alert-circle" size={12} color={COLORS.palette.orange} />}
    </View>
  );
}

/** 다음 만남 칩 — 오늘은 primary, 그 외는 gray */
function WhenChip({ client }: { client: MockClient }) {
  if (!client.nextLabel) return null;
  const today = client.dday === 'D-0';
  return (
    <View
      className="rounded-full"
      style={{
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        backgroundColor: today ? COLORS.primary50 : COLORS.gray[100],
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        className={today ? 'text-primary' : 'text-gray-600'}
      >
        {shortWhen(client)}
      </Typography>
    </View>
  );
}

/* ════════════════════════════════════════════════
 * 현재 — 관심 가로 카드 캐러셀 + 한 줄 카드 명단 (대조군)
 * ════════════════════════════════════════════════ */
function BaselinePage() {
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: s(20) }}>
        <IntentNote
          icon="information-circle-outline"
          text="현재 디자인 — 관심 내담자는 가로 카드 캐러셀, 전체는 한 줄 카드. 정보는 충분하지만 두 영역 모두 카드라 톤이 비슷하고 평탄해요."
        />
        <SectionLabel title="관심 내담자" count={FAVORITES.length} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: s(20), gap: s(12), paddingBottom: s(4) }}
        style={{ marginBottom: s(24) }}
      >
        {FAVORITES.map((c) => (
          <FavWideCard key={c.id} client={c} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: s(20) }}>
        <SectionLabel title="전체 내담자" count={MOCK.length} />
        <View style={{ gap: s(10) }}>
          <SearchBar />
          <View style={{ gap: s(8) }}>
            {MOCK.map((c) => (
              <BaselineRow key={c.id} client={c} />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function FavWideCard({ client }: { client: MockClient }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-lg bg-surface"
      style={{ width: s(260), padding: s(16), gap: s(12) }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Avatar client={client} size={44} />
        <View className="flex-1" style={{ gap: s(2) }}>
          <Typography variant="body-01" weight="semibold" className="text-gray-900" numberOfLines={1}>
            {client.name}
          </Typography>
          <Typography variant="label-01" className="text-gray-500">
            {genderLabel(client.gender)} · 만 {client.age}세
          </Typography>
        </View>
      </View>
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Ionicons name="time-outline" size={12} color={COLORS.gray[400]} />
        <Typography variant="label-01" className={client.nextLabel ? 'text-gray-500' : 'text-gray-400'}>
          {client.nextLabel ? `다음 ${client.nextLabel}` : '일정 없음'}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function BaselineRow({ client }: { client: MockClient }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ paddingVertical: s(12), paddingHorizontal: s(16), gap: s(12) }}
      className="flex-row items-center rounded-lg bg-surface"
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <Avatar client={client} size={40} />
      <View className="flex-1" style={{ gap: s(2) }}>
        <View className="flex-row items-center">
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {client.name}
          </Typography>
          <Typography variant="body-03" weight="medium" style={{ marginLeft: s(8) }} className="text-gray-600">
            {genderLabel(client.gender)}
          </Typography>
          <View style={{ marginHorizontal: s(6), height: s(10) }} className="w-px bg-gray-300" />
          <Typography variant="body-03" weight="medium" className="text-gray-600">
            만 {client.age}세
          </Typography>
        </View>
        <View className="flex-row items-center">
          <Typography variant="body-03" className={client.nextLabel ? 'text-gray-500' : 'text-gray-400'}>
            {client.nextLabel ? `다음 ${client.nextLabel}` : '일정 없음'}
          </Typography>
          <View style={{ marginHorizontal: s(6), height: s(10) }} className="w-px bg-gray-300" />
          <Typography variant="body-03" className="text-gray-500">
            {client.phone}
          </Typography>
        </View>
      </View>
      <Icon name="arrow-right" size={s(16)} />
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
 * 조화 A — 균형 리스트
 *   관심: 컬러 링 아바타 + 다음 만남 칩 (재미 + 필요성, 컴팩트)
 *   전체: 초성 그룹 + gray 점프 레일(직관) 위에 컬러 아바타·출석·다음 만남 행
 *   색 절제: primary 는 '오늘' 칩에만, 역할 뱃지는 보호자만.
 * ════════════════════════════════════════════════ */
function BlendAPage() {
  const groups = useMemo(() => groupByChoseong(MOCK), []);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - s(4)), animated: true });
  };

  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingLeft: s(20), paddingRight: s(34), paddingTop: s(4), paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <IntentNote
          icon="sparkles-outline"
          text="균형 리스트 — 정돈된 명단을 골격으로(직관: 초성+점프 레일), 각 행에 컬러 아바타(재미)와 다음 만남(필요성)을 포인트로. 출석은 색 점 대신 '최근 5회 N참석' 텍스트로 또박또박, 결석 잦으면 ⚠ 표시."
        />

        <SectionLabel title="관심 내담자" count={FAVORITES.length} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: s(14), paddingVertical: s(4), paddingRight: s(8) }}
          style={{ marginBottom: s(20) }}
        >
          {FAVORITES.map((c) => (
            <FavRingItem key={c.id} client={c} />
          ))}
        </ScrollView>

        <SectionLabel title="전체 내담자" count={MOCK.length} />
        <View style={{ marginBottom: s(10) }}>
          <SearchBar />
        </View>
        {groups.map(([key, clients]) => (
          <View
            key={key}
            onLayout={(e: LayoutChangeEvent) => {
              sectionY.current[key] = e.nativeEvent.layout.y;
            }}
            style={{ marginBottom: s(8) }}
          >
            <View style={{ paddingVertical: s(6), paddingLeft: s(2) }}>
              <Typography variant="label-01" weight="bold" className="text-gray-400">
                {key}
              </Typography>
            </View>
            <View className="rounded-lg bg-surface" style={{ paddingVertical: s(4) }}>
              {clients.map((c, idx) => (
                <BalancedRow key={c.id} client={c} isLast={idx === clients.length - 1} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 우측 점프 레일 — gray (절제) */}
      <View className="absolute items-center justify-center" style={{ right: s(4), top: 0, bottom: 0 }} pointerEvents="box-none">
        <View style={{ gap: s(2) }} className="items-center">
          {groups.map(([k]) => (
            <Pressable
              key={k}
              onPress={() => jumpTo(k)}
              hitSlop={{ top: 2, bottom: 2, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`${k} 으로 이동`}
              style={{ paddingHorizontal: s(4), paddingVertical: s(1) }}
            >
              <Typography variant="caption-01" weight="semibold" className="text-gray-500">
                {k}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** 관심 — 사람별 컬러 링 아바타(재미) + 다음 만남 칩(필요성). 컴팩트(직관). */
function FavRingItem({ client }: { client: MockClient }) {
  const color = getProfileColor(client.id);
  return (
    <Pressable className="items-center" style={{ width: s(72), gap: s(6) }} accessibilityRole="button" accessibilityLabel={`${client.name} 내담자 상세`}>
      <View style={{ padding: s(2), borderRadius: s(32), borderWidth: s(2), borderColor: color.fg }}>
        <Avatar client={client} size={52} showHeart={false} textVariant="title-01" />
      </View>
      <Typography variant="caption-01" weight="semibold" className="text-gray-700" numberOfLines={1}>
        {client.name}
      </Typography>
      {client.nextLabel ? (
        <WhenChip client={client} />
      ) : (
        <Typography variant="label-02" className="text-gray-400">
          일정 없음
        </Typography>
      )}
    </Pressable>
  );
}

/** 균형 행 — 컬러 아바타 + 이름·식별·출석 + 다음 만남 칩. 보호자만 역할 뱃지. */
function BalancedRow({ client, isLast }: { client: MockClient; isLast: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="flex-row items-center"
      style={{
        paddingHorizontal: s(14),
        paddingVertical: s(11),
        gap: s(12),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
      }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <Avatar client={client} size={40} />
      <View className="flex-1" style={{ gap: s(3) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {client.name}
          </Typography>
          {client.role === 'guardian' && <RoleBadge role="guardian" />}
        </View>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="label-01" className="text-gray-500">
            {genderLabel(client.gender)} · 만 {client.age}세
          </Typography>
          <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[300] }} />
          <AttendanceText attendance={client.attendance} />
        </View>
      </View>
      <WhenChip client={client} />
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
 * 조화 B — 풍성 카드
 *   관심: 큰 컬러 카드(아바타 배경색을 카드 톤으로, 재미↑) + 다음 만남
 *   전체: 한 명을 풍부한 카드로 — 역할·식별 / 출석·연락처 / 다음 만남
 *   여백을 넉넉히 줘 정보가 많아도 숨 쉬게(필요성+재미, 몰입형).
 * ════════════════════════════════════════════════ */
function BlendBPage() {
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: s(20) }}>
        <IntentNote
          icon="albums-outline"
          text="풍성 카드 — 한 명 한 명을 화사한 카드로(재미) 역할·출석·연락처·다음 만남까지 풍부하게(필요성). 출석은 '최근 5회 중 4회 참석'처럼 또박또박 + 주의 시 칩. 카드 간 여백으로 숨 쉬어요."
        />
        <SectionLabel title="관심 내담자" count={FAVORITES.length} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: s(20), gap: s(12), paddingVertical: s(4) }}
        style={{ marginBottom: s(24) }}
      >
        {FAVORITES.map((c) => (
          <FavVibrantCard key={c.id} client={c} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: s(20) }}>
        <SectionLabel title="전체 내담자" count={MOCK.length} />
        <View style={{ marginBottom: s(12) }}>
          <SearchBar />
        </View>
        <View style={{ gap: s(12) }}>
          {MOCK.map((c) => (
            <RichCard key={c.id} client={c} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** 관심 — 컬러 면을 크게 쓴 통통한 카드 */
function FavVibrantCard({ client }: { client: MockClient }) {
  const color = getProfileColor(client.id);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="items-center rounded-lg"
      style={{ width: s(120), padding: s(16), gap: s(10), backgroundColor: color.bg }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <View style={{ position: 'absolute', top: s(10), right: s(10) }}>
        <Ionicons name="heart" size={s(14)} color={color.fg} />
      </View>
      <View style={{ width: s(56), height: s(56), borderRadius: s(28), backgroundColor: COLORS.white }} className="items-center justify-center">
        <Typography variant="headline-02" weight="bold" style={{ color: color.fg }}>
          {client.name.slice(0, 1)}
        </Typography>
      </View>
      <View className="items-center" style={{ gap: s(2) }}>
        <Typography variant="body-02" weight="bold" className="text-gray-900" numberOfLines={1}>
          {client.name}
        </Typography>
        <Typography variant="caption-01" className="text-gray-600">
          {client.nextLabel ? shortWhen(client) : '일정 없음'}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

/** 풍성 카드 — 역할·식별 / 출석·연락처(sunken) / 다음 만남 */
function RichCard({ client }: { client: MockClient }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-lg bg-surface"
      style={{ padding: s(16), gap: s(14) }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Avatar client={client} size={48} textVariant="title-01" />
        <View className="flex-1" style={{ gap: s(3) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography variant="body-01" weight="semibold" className="text-gray-900">
              {client.name}
            </Typography>
            <RoleBadge role={client.role} />
          </View>
          <Typography variant="label-01" className="text-gray-500">
            {genderLabel(client.gender)} · 만 {client.age}세 · {client.birth}
          </Typography>
        </View>
      </View>

      <View
        className="rounded-md"
        style={{ backgroundColor: COLORS.gray[50], paddingHorizontal: s(12), paddingVertical: s(9), gap: s(8) }}
      >
        {/* 출석 — 색 점 대신 또박또박 텍스트 + 주의 시 칩 */}
        <View className="flex-row items-center justify-between">
          {(() => {
            const { total, attended } = attendanceSummary(client.attendance);
            return (
              <Typography variant="label-01" weight="medium" className="text-gray-600">
                최근 {total}회 중 {attended}회 참석
              </Typography>
            );
          })()}
          <AttendanceTag attendance={client.attendance} />
        </View>
        <View className="flex-row items-center" style={{ gap: s(5) }}>
          <Ionicons name="call-outline" size={12} color={COLORS.gray[400]} />
          <Typography variant="label-01" className="text-gray-500">
            {client.phone}
          </Typography>
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Ionicons name="calendar-outline" size={13} color={client.nextLabel ? COLORS.primary : COLORS.gray[400]} />
        <Typography
          variant="body-03"
          weight={client.nextLabel ? 'medium' : 'regular'}
          className={client.nextLabel ? 'text-gray-800' : 'text-gray-400'}
        >
          {client.nextLabel ? `다음 상담 ${client.nextLabel}` : '예정된 상담 없음'}
        </Typography>
        {client.dday && (
          <View style={{ marginLeft: s(2), paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(6), backgroundColor: COLORS.primary50 }}>
            <Typography variant="label-02" weight="semibold" className="text-primary">
              {client.dday}
            </Typography>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
 * 조화 C — 강약 섹션
 *   위: 관심(컬러 링) + "오늘 만나요"(필요성 스포트라이트, 강)
 *   아래: 전체 명단을 차분한 compact 행으로(직관, 약)
 *   강약 리듬으로 "지금 챙길 사람"과 "전체 탐색"을 한 페이지에.
 * ════════════════════════════════════════════════ */
function BlendCPage() {
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(4), paddingBottom: s(40) }}
      showsVerticalScrollIndicator={false}
    >
      <IntentNote
        icon="contrast-outline"
        text="강약 섹션 — 위는 관심(컬러 링, 재미)과 '오늘 만나요'(필요성)를 강조하고, 아래는 전체 명단을 차분한 행으로(직관). 강약 리듬으로 지금 챙길 사람과 전체 탐색을 한 화면에."
      />

      {/* 관심 — 컬러 링 (강·재미) */}
      <SectionLabel title="관심 내담자" count={FAVORITES.length} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: s(14), paddingVertical: s(4), paddingRight: s(8) }}
        style={{ marginBottom: s(20) }}
      >
        {FAVORITES.map((c) => (
          <FavRingItem key={c.id} client={c} />
        ))}
      </ScrollView>

      {/* 오늘 만나요 — 필요성 스포트라이트 (강) */}
      {TODAY_CLIENTS.length > 0 && (
        <View style={{ marginBottom: s(24) }}>
          <SectionLabel title="오늘 만나요" count={TODAY_CLIENTS.length} hint="오늘 예정된 상담이 있는 내담자예요" />
          <View className="rounded-lg bg-surface" style={{ paddingVertical: s(4) }}>
            {TODAY_CLIENTS.map((c, idx) => (
              <BalancedRow key={c.id} client={c} isLast={idx === TODAY_CLIENTS.length - 1} />
            ))}
          </View>
        </View>
      )}

      {/* 전체 — 차분한 compact 행 (약·직관) */}
      <SectionLabel title="전체 내담자" count={MOCK.length} />
      <View style={{ marginBottom: s(10) }}>
        <SearchBar />
      </View>
      <View className="rounded-lg bg-surface" style={{ paddingVertical: s(4) }}>
        {MOCK.map((c, idx) => (
          <CalmRow key={c.id} client={c} isLast={idx === MOCK.length - 1} />
        ))}
      </View>
    </ScrollView>
  );
}

/** 차분한 행 — 최소 정보로 빠르게 훑기 (avatar + 이름 + 식별 + 관심 하트) */
function CalmRow({ client, isLast }: { client: MockClient; isLast: boolean }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="flex-row items-center"
      style={{
        paddingHorizontal: s(14),
        paddingVertical: s(10),
        gap: s(12),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
      }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      <Avatar client={client} size={36} textVariant="body-02" showHeart={false} />
      <View className="flex-1" style={{ gap: s(3) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {client.name}
          </Typography>
          {client.role === 'guardian' && <RoleBadge role="guardian" />}
        </View>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="label-01" className="text-gray-500">
            {genderLabel(client.gender)} · 만 {client.age}세
          </Typography>
          <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[300] }} />
          <AttendanceText attendance={client.attendance} />
        </View>
      </View>
      {client.favorite && <Ionicons name="heart" size={s(13)} color={COLORS.primary} />}
    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════
 * 조화 D — 믹스 (각 안에서 한 조각씩)
 *   · 관심 내담자 = B 의 컬러 면 큰 카드 (FavVibrantCard)
 *   · 오늘 만나요 = C 의 스포트라이트 섹션
 *   · 전체 명단   = A 의 검색 + 초성 그룹 + 점프 레일 (BalancedRow)
 * ════════════════════════════════════════════════ */
function MixPage() {
  const groups = useMemo(() => groupByChoseong(MOCK), []);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - s(4)), animated: true });
  };

  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingLeft: s(20), paddingRight: s(34), paddingTop: s(4), paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <IntentNote
          icon="git-merge-outline"
          text="각 안에서 한 조각씩 합친 믹스 — 관심은 B의 컬러 면 큰 카드, 그 아래 C의 '오늘 만나요' 스포트라이트, 전체는 A의 검색+초성 그룹+점프 레일."
        />

        {/* 관심 내담자 — B (컬러 면 큰 카드) */}
        <SectionLabel title="관심 내담자" count={FAVORITES.length} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: s(12), paddingVertical: s(4), paddingRight: s(8) }}
          style={{ marginBottom: s(24) }}
        >
          {FAVORITES.map((c) => (
            <FavVibrantCard key={c.id} client={c} />
          ))}
        </ScrollView>

        {/* 오늘 만나요 — C (스포트라이트) */}
        {TODAY_CLIENTS.length > 0 && (
          <View style={{ marginBottom: s(24) }}>
            <SectionLabel title="오늘 만나요" count={TODAY_CLIENTS.length} hint="오늘 예정된 상담이 있는 내담자예요" />
            <View className="rounded-lg bg-surface" style={{ paddingVertical: s(4) }}>
              {TODAY_CLIENTS.map((c, idx) => (
                <BalancedRow key={c.id} client={c} isLast={idx === TODAY_CLIENTS.length - 1} />
              ))}
            </View>
          </View>
        )}

        {/* 전체 명단 — A (검색 + 초성 그룹) */}
        <SectionLabel title="전체 내담자" count={MOCK.length} />
        <View style={{ marginBottom: s(10) }}>
          <SearchBar />
        </View>
        {groups.map(([key, clients]) => (
          <View
            key={key}
            onLayout={(e: LayoutChangeEvent) => {
              sectionY.current[key] = e.nativeEvent.layout.y;
            }}
            style={{ marginBottom: s(8) }}
          >
            <View style={{ paddingVertical: s(6), paddingLeft: s(2) }}>
              <Typography variant="label-01" weight="bold" className="text-gray-400">
                {key}
              </Typography>
            </View>
            <View className="rounded-lg bg-surface" style={{ paddingVertical: s(4) }}>
              {clients.map((c, idx) => (
                <BalancedRow key={c.id} client={c} isLast={idx === clients.length - 1} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 우측 점프 레일 — A 와 동일(gray) */}
      <View className="absolute items-center justify-center" style={{ right: s(4), top: 0, bottom: 0 }} pointerEvents="box-none">
        <View style={{ gap: s(2) }} className="items-center">
          {groups.map(([k]) => (
            <Pressable
              key={k}
              onPress={() => jumpTo(k)}
              hitSlop={{ top: 2, bottom: 2, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`${k} 으로 이동`}
              style={{ paddingHorizontal: s(4), paddingVertical: s(1) }}
            >
              <Typography variant="caption-01" weight="semibold" className="text-gray-500">
                {k}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
