import type { BadgeColor } from '@/shared/components/ui';

/**
 * 프로필 식별 색 — 일정 탭의 필터 칩·달력 점·카드 뱃지가 같은 색을 공유한다.
 * 프로필 목록 순서로 순환 배정(서버가 색을 주지 않으므로 클라이언트 규약).
 */
const PROFILE_COLORS: BadgeColor[] = [
  'teal',
  'orange',
  'purple',
  'green',
  'blue',
  'red',
];

export function profileColorAt(index: number): BadgeColor {
  return PROFILE_COLORS[index % PROFILE_COLORS.length];
}

/** profile_id → 색 (목록 순서 기준) */
export function buildProfileColorMap(
  profiles: { id: string }[],
): Map<string, BadgeColor> {
  return new Map(profiles.map((p, i) => [p.id, profileColorAt(i)]));
}
