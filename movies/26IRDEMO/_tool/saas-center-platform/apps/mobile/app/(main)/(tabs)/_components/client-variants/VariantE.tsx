import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { ClientCardProps } from './types';
import {
  calculateAge,
  formatBirthDate,
  formatPhone,
  getGenderLabel,
  getInitial,
  getProfileColor,
} from './helpers';

/**
 * 시안 E → 재미 (Vibrant) 톤
 *
 * 디자인 톤 & 매너(§0):
 * - 2열 그리드 + 큰 원형 아바타로 시각 리듬
 * - 사람마다 다른 프로필 컬러로 컬러 액센트 풍부
 * - 정보는 컴팩트하되 시각적 다양성 강조
 */
export function VariantE({ client, onPress }: ClientCardProps) {
  const age = calculateAge(client.birth_date);
  const genderLabel = getGenderLabel(client.gender);
  const birth = formatBirthDate(client.birth_date);
  const phone = formatPhone(client.phone);
  const initial = getInitial(client.name);
  const profileColor = getProfileColor(client.id);
  const meta = [genderLabel, age !== null ? `${age}세` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      onPress={() => onPress(client.id)}
      activeOpacity={0.7}
      style={{ paddingVertical: s(16), paddingHorizontal: s(12), gap: s(8) }}
      className="flex-1 items-center rounded-lg bg-surface"
      accessibilityLabel={`${client.name} 내담자 상세`}
      accessibilityRole="button"
    >
      {/* 큰 원형 아바타 — 사람마다 다른 컬러 */}
      <View
        style={{
          width: s(56),
          height: s(56),
          borderRadius: s(28),
          backgroundColor: profileColor.bg,
        }}
        className="items-center justify-center"
      >
        <Typography
          variant="headline-02"
          weight="semibold"
          style={{ color: profileColor.fg }}
        >
          {initial}
        </Typography>
      </View>

      {/* 이름 */}
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
      >
        {client.name}
      </Typography>

      {/* 성별 · 나이 */}
      {meta.length > 0 && (
        <Typography variant="label-02" className="text-gray-500">
          {meta}
        </Typography>
      )}

      {/* 하단 정보 */}
      <View style={{ marginTop: s(4), gap: s(4) }} className="items-center">
        <View className="flex-row items-center" style={{ gap: s(4) }}>
          <Ionicons name="calendar-outline" size={s(13)} color={COLORS.gray[400]} />
          <Typography variant="label-01" className="text-gray-500">
            {birth}
          </Typography>
        </View>
        <View className="flex-row items-center" style={{ gap: s(4) }}>
          <Ionicons name="call-outline" size={s(13)} color={COLORS.gray[400]} />
          <Typography variant="label-01" className="text-gray-500" numberOfLines={1}>
            {phone}
          </Typography>
        </View>
      </View>
    </TouchableOpacity>
  );
}
