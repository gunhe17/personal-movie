import { useState } from 'react';
import { View, Image } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';

/**
 * 청구 도메인 공용 내담자 표시 헬퍼.
 * 청구 목록 카드(CompactBillingCard)와 청구 상세 시트(BillableDetailSheet)에서 공유한다.
 * 상담·검사 현황 카드(AssessmentCaseCard)와 동일한 이니셜 아바타 팔레트.
 */

// 청구 응답엔 프로필 이미지가 없을 수 있어 이니셜 컬러 아바타로 폴백한다.
export const AVATAR_PALETTE = [
  { bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  { bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
  { bg: COLORS.paletteBg.orange, fg: COLORS.palette.orange },
  { bg: COLORS.paletteBg.violet, fg: COLORS.palette.violet },
  { bg: COLORS.paletteBg.pink, fg: COLORS.palette.pink },
  { bg: COLORS.paletteBg.mint, fg: COLORS.palette.mint },
] as const;

export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function genderToLabel(g: string | null | undefined): string | null {
  if (!g) return null;
  const v = g.toLowerCase();
  if (v === 'male' || v === 'm' || v === '남' || v === '남자') return '남';
  if (v === 'female' || v === 'f' || v === '여' || v === '여자') return '여';
  return g;
}

/** 생년월일(ISO) → 만 나이. 잘못된 값이면 null */
export function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    const b = parseDate(birthDate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    return age >= 0 && age < 200 ? age : null;
  } catch {
    return null;
  }
}

/** 메타 구분 세로선 — 10px, gray-200 (AssessmentCaseCard와 동일) */
export function MetaDivider() {
  return (
    <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }} />
  );
}

/**
 * 내담자 아바타 — 프로필 이미지 우선, 실패/부재 시 이니셜 컬러 폴백.
 * AssessmentCaseCard와 동일 패턴.
 */
export function ClientAvatar({
  name,
  imageUrl,
  seed,
  size = 44,
}: {
  name: string;
  imageUrl: string | null;
  seed: string;
  /** 아바타 한 변 길이(px, s() 적용 전 기준값). 기본 44 */
  size?: number;
}) {
  const [error, setError] = useState(false);
  const showImage = !!imageUrl && !error;
  const avatar = avatarColor(seed);
  const dim = s(size);
  return (
    <View
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        backgroundColor: avatar.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={{ width: dim, height: dim }}
          onError={() => setError(true)}
        />
      ) : (
        <Typography variant="body-01" weight="semibold" style={{ color: avatar.fg }}>
          {name.trim()?.[0] ?? '?'}
        </Typography>
      )}
    </View>
  );
}
