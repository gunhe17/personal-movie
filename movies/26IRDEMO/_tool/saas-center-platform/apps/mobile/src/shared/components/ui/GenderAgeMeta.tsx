import { View } from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 성별·나이 메타 표기 — 앱 전역 표준.
 *
 * - 텍스트: medium / text·label·default(gray-600)
 *   - size 'sm'(기본) = label-01(13pt) — 리스트·카드 등 일반 메타
 *   - size 'lg' = body-03(14pt) — 내담자 정보가 페이지의 메인으로 오는 히어로/상세 헤더
 * - 구분선: 세로선 height s(10), border/default(gray-200) — 점·텍스트(·) 대신 선으로 통일
 * - 데이터 ↔ 구분선 간격: s(6) (컨테이너 gap)
 *
 * genderLabel은 이미 라벨링된 문자열('남'/'여' 등), age는 숫자(만 나이).
 * 둘 다 없으면 emptyText(있을 때만) 또는 null.
 */
export function GenderAgeMeta({
  genderLabel,
  age,
  emptyText,
  size = 'sm',
  color = COLORS.text.label.default,
}: {
  genderLabel: string | null | undefined;
  age: number | null | undefined;
  /** 성별·나이 둘 다 없을 때 노출할 대체 텍스트 (미지정 시 아무것도 렌더 안 함) */
  emptyText?: string;
  /** 'sm'(label-01/13pt, 기본) · 'lg'(body-03/14pt — 페이지 메인 히어로) */
  size?: 'sm' | 'lg';
  /** 텍스트 색 override (기본 text/label/default = gray-600). 비활성·취소 카드에서 disabled 색 주입용 */
  color?: string;
}) {
  const variant = size === 'lg' ? 'body-03' : 'label-01';
  const hasGender = !!genderLabel;
  const hasAge = age != null;

  if (!hasGender && !hasAge) {
    if (!emptyText) return null;
    return (
      <Typography
        variant={variant}
        weight="medium"
        style={{ color: COLORS.text.label.default }}
      >
        {emptyText}
      </Typography>
    );
  }

  return (
    <View className="flex-row items-center" style={{ gap: s(6) }}>
      {hasGender && (
        <Typography
          variant={variant}
          weight="medium"
          numberOfLines={1}
          style={{ color }}
        >
          {genderLabel}
        </Typography>
      )}
      {hasGender && hasAge && (
        <View
          style={{ width: 1, height: s(10), backgroundColor: COLORS.border.default }}
        />
      )}
      {hasAge && (
        <Typography
          variant={variant}
          weight="medium"
          numberOfLines={1}
          style={{ color }}
        >
          만 {age}세
        </Typography>
      )}
    </View>
  );
}
