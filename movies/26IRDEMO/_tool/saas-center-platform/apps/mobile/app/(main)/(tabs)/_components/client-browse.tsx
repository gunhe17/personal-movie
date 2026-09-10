import { memo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Image } from 'react-native';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { Badge } from '@/shared/components/ui/Badge';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { ClientSummary } from '@/features/client';
import {
  calculateAge,
  getGenderLabel,
  getInitial,
  getProfileColor,
} from './client-variants/helpers';

/**
 * 내담자 목록 · 탐색(조화 D 믹스) 프레젠테이션 컴포넌트.
 *
 * lab `clients-browse` 의 "조화 D" 구성을 실데이터(ClientSummary)에 적용.
 *   · 관심 = 컬러 면 큰 카드 (FavClientCard)
 *   · 전체 = 초성 그룹 + 점프 레일 위에 ClientRow
 *   · "오늘 만나요" 섹션도 ClientRow 재사용
 *
 * 출석(최근 N회 참석)은 리스트 API에 데이터가 없어 제외(§3-3 준수).
 * 역할 뱃지는 구분이 필요한 '보호자'(role==='guardian')만 표시.
 */

/* ─── 초성 그룹핑 ─── */
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const DOUBLE_TO_BASE: Record<string, string> = {
  ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ',
};

export function getChoseong(name: string): string {
  const first = name?.trim()?.[0];
  if (!first) return '#';
  const code = first.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const raw = CHOSEONG[Math.floor((code - 0xac00) / 588)];
    return DOUBLE_TO_BASE[raw] ?? raw;
  }
  return '#';
}

/** 이름 가나다 정렬 후 초성으로 묶음 ('#' 그룹은 맨 뒤) */
export function groupByChoseong(list: ClientSummary[]): [string, ClientSummary[]][] {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const map = new Map<string, ClientSummary[]>();
  for (const c of sorted) {
    const key = getChoseong(c.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  const entries = Array.from(map.entries());
  // '#'(한글 외)은 맨 뒤로
  return entries.sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : 0));
}

/* ─── 다음 만남(next_session_at) 시각 처리 ─── */
function toLocalDate(isoUtc: string): Date {
  const utc = isoUtc.endsWith('Z') ? isoUtc : isoUtc + 'Z';
  return new Date(utc);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(isoUtc: string | null | undefined): boolean {
  if (!isoUtc) return false;
  const d = toLocalDate(isoUtc);
  if (Number.isNaN(d.getTime())) return false;
  return sameDay(d, new Date());
}

/** 다음 회기까지 남은 일수(D-day). 지난 일정·일정 없음은 null */
function dDayInfo(
  isoUtc: string | null | undefined,
): { label: string; imminent: boolean } | null {
  if (!isoUtc) return null;
  const d = toLocalDate(isoUtc);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOf(d).getTime() - startOf(now).getTime()) / 86_400_000);
  if (diff < 0) return null;
  return { label: diff === 0 ? 'D-DAY' : `D-${diff}`, imminent: diff <= 1 };
}

/* ─── 아바타 ─── */
function Avatar({
  client,
  size,
  textVariant = 'body-01',
  showHeart = true,
}: {
  client: ClientSummary;
  size: number;
  textVariant?: 'label-01' | 'body-02' | 'body-01' | 'title-01' | 'headline-02';
  showHeart?: boolean;
}) {
  const color = getProfileColor(client.id);
  const [imgError, setImgError] = useState(false);
  const showImage = !!client.profile_image_url && !imgError;
  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: color.bg, overflow: 'hidden' }}
        className="items-center justify-center"
      >
        {showImage ? (
          <Image
            source={{ uri: client.profile_image_url! }}
            style={{ width: s(size), height: s(size) }}
            onError={() => setImgError(true)}
          />
        ) : (
          <Typography variant={textVariant} weight="semibold" style={{ color: color.fg }}>
            {getInitial(client.name)}
          </Typography>
        )}
      </View>
      {showHeart && client.is_favorited && (
        <View
          style={{
            position: 'absolute',
            top: s(22),
            left: s(28),
            width: s(24),
            height: s(24),
            borderRadius: s(12),
            backgroundColor: COLORS.white,
            alignItems: 'center',
            justifyContent: 'center',
            // iOS만 그림자. Android elevation은 부모 scale 트랜스폼 중
            // 번쩍임 유발 → 제외 (카드와 동일 사유).
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <Icon name="like-16" size={s(14)} />
        </View>
      )}
    </View>
  );
}

/** 보호자 뱃지 — 구분이 필요한 순수 보호자만 (client/both 는 내담자라 미표시) */
function RoleBadge({ role }: { role: ClientSummary['role'] }) {
  if (role !== 'guardian') return null;
  return (
    <Badge bg={COLORS.paletteBg.violet} color={COLORS.palette.violet}>
      보호자
    </Badge>
  );
}

/** 성별 · 나이 — 사이에 세로 구분선(10px, gray-200) */
function GenderAge({ gender, age }: { gender: string | null; age: number | null }) {
  return <GenderAgeMeta genderLabel={gender} age={age} emptyText="정보 없음" />;
}

/**
 * 다음 회기 D-day 뱃지 — 임박(D-DAY·D-1)은 빨강, 그 외는 회색.
 * 다음 일정이 없으면 미표시.
 */
function DdayBadge({ client }: { client: ClientSummary }) {
  const info = dDayInfo(client.next_session_at);
  if (!info) return null;
  return (
    <BadgeRound
      // D-DAY·D-1(임박)=빨강 틴트, D-2 이상=회색 (색은 기존 값 유지)
      bg={info.imminent ? '#FF2D550F' : '#F5F7F8'}
      color={info.imminent ? '#E23B3B' : COLORS.gray[600]}
    >
      {info.label}
    </BadgeRound>
  );
}

/* ─── 관심 내담자 — 흰 카드(상세 톤) + 컬러 아바타 한 점 ─── */
// memo: client(쿼리 데이터·참조 안정) + onPress(useCallback) 이므로
// 부모(검색 타이핑 등) 리렌더 시 행 재렌더를 건너뛴다.
export const FavClientCard = memo(function FavClientCard({
  client,
  onPress,
}: {
  client: ClientSummary;
  onPress: (id: string) => void;
}) {
  const age = calculateAge(client.birth_date);
  const gender = getGenderLabel(client.gender);
  const memo = client.memo?.trim();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(client.id)}
      className="bg-surface"
      // 흰 카드 · radius 16 · Figma 카드 그림자(X0 Y-1 / blur 15.8 / #000 6%)
      style={{
        width: s(260),
        height: s(176),
        borderRadius: s(16),
        padding: s(16),
        // iOS만 그림자(뷰와 함께 래스터라이즈돼 안전). Android elevation은
        // 부모 scale 트랜스폼(TabTransition) 중 별도 레이어가 재합성되며
        // 그림자가 번쩍이는 아티팩트를 만들어 제외 — 흰 카드 vs 회색 배경
        // 명도 대비로 분리(디자인 시스템 카드 보더 원칙).
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name} 내담자 상세`}
    >
      {/* 상단: 아바타 + 이름/정보 + D-day */}
      <View className="flex-row items-start">
        <Avatar client={client} size={44} />
        <View className="flex-1" style={{ marginLeft: s(16), gap: s(2) }}>
          <Typography variant="body-01" weight="semibold" className="text-gray-900" numberOfLines={1}>
            {client.name}
          </Typography>
          <GenderAge gender={gender} age={age} />
        </View>
        <DdayBadge client={client} />
      </View>

      {/* 메모 — 아바타 영역과 10 여백 */}
      <View
        className="bg-gray-50 rounded-md"
        style={{ marginTop: s(10), height: s(88), padding: s(12) }}
      >
        <Typography variant="label-02" className="text-gray-400">
          메모
        </Typography>
        <Typography
          variant="body-03"
          className={memo ? 'text-gray-600' : 'text-gray-400'}
          numberOfLines={3}
          style={{ marginTop: s(2) }}
        >
          {memo || '작성된 메모가 없어요'}
        </Typography>
      </View>
    </TouchableOpacity>
  );
});

/* ─── 전체/오늘 명단 행 ─── */
// memo: 위 FavClientCard 와 동일 — 부모 리렌더 때 목록 행들이 재렌더되지 않게.
export const ClientRow = memo(function ClientRow({
  client,
  onPress,
  isLast = false,
  isFirst = false,
  paddingX = 14,
}: {
  client: ClientSummary;
  onPress: (id: string) => void;
  isLast?: boolean;
  /** 그룹(자음)의 첫 행이면 상단 패딩 제거 */
  isFirst?: boolean;
  /** 좌우 패딩 — 컨테이너가 패딩을 가질 때 0으로 넘겨 행을 컨테이너 가장자리에 맞춘다 */
  paddingX?: number;
}) {
  const age = calculateAge(client.birth_date);
  const gender = getGenderLabel(client.gender);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(client.id)}
      className="flex-row items-center"
      style={{
        paddingTop: isFirst ? 0 : s(12),
        paddingBottom: s(12),
        paddingHorizontal: s(paddingX),
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
          <Typography variant="body-02" weight="semibold" className="text-gray-900" numberOfLines={1}>
            {client.name}
          </Typography>
          <RoleBadge role={client.role} />
        </View>
        <GenderAge gender={gender} age={age} />
      </View>
      <View style={{ flexShrink: 0 }}>
        <DdayBadge client={client} />
      </View>
    </TouchableOpacity>
  );
});

/* ─── 로딩 스켈레톤 — 실제 목록 레이아웃을 흉내 ─── */
export function ClientListSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40) }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* 관심 내담자 */}
      <View style={{ paddingHorizontal: s(20), marginBottom: s(24) }}>
        <Skeleton width={88} height={20} radius={4} style={{ marginBottom: s(12) }} />
        <View className="flex-row" style={{ gap: s(12) }}>
          <SkelFavCard />
          <SkelFavCard />
        </View>
      </View>

      {/* 전체 내담자 컨테이너 — 제목 + 검색 + 목록 */}
      <View
        className="bg-surface"
        style={{
          borderTopLeftRadius: s(24),
          borderTopRightRadius: s(24),
          paddingTop: s(24),
          paddingHorizontal: s(16),
          paddingBottom: s(40),
          gap: s(12),
        }}
      >
        <Skeleton width={88} height={20} radius={4} />
        <Skeleton width="100%" height={44} radius={12} />
        <View>
          <Skeleton width={14} height={13} radius={4} style={{ marginBottom: s(8), marginLeft: s(2) }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkelRow key={i} isLast={i === 5} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function SkelFavCard() {
  return (
    <View
      className="bg-surface"
      style={{ width: s(260), height: s(176), borderRadius: s(16), padding: s(16) }}
    >
      <View className="flex-row items-start">
        <SkeletonCircle size={44} />
        <View className="flex-1" style={{ marginLeft: s(16), gap: s(8) }}>
          <Skeleton width={72} height={14} radius={4} />
          <Skeleton width={48} height={12} radius={4} />
        </View>
      </View>
      <View style={{ marginTop: s(16), gap: s(8) }}>
        <Skeleton width={28} height={12} radius={4} />
        <Skeleton width="80%" height={12} radius={4} />
      </View>
    </View>
  );
}

function SkelRow({ isLast }: { isLast: boolean }) {
  return (
    <View
      className="flex-row items-center"
      style={{
        paddingVertical: s(12),
        gap: s(12),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
      }}
    >
      <SkeletonCircle size={40} />
      <View className="flex-1" style={{ gap: s(8) }}>
        <Skeleton width={90} height={14} radius={4} />
        <Skeleton width={60} height={12} radius={4} />
      </View>
      <Skeleton width={44} height={20} radius={999} />
    </View>
  );
}

/* ─── 우측 초성 점프 레일 ─── */
export function JumpRail({
  keys,
  onJump,
}: {
  keys: string[];
  onJump: (key: string) => void;
}) {
  if (keys.length <= 1) return null;
  return (
    <View
      className="absolute items-center justify-center"
      style={{ right: s(4), top: 0, bottom: 0 }}
      pointerEvents="box-none"
    >
      <View style={{ gap: s(2) }} className="items-center">
        {keys.map((k) => (
          <Pressable
            key={k}
            onPress={() => onJump(k)}
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
  );
}
