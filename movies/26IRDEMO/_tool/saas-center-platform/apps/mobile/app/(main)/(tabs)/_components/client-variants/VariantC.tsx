import { View, TouchableOpacity } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
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
 * 시안 C → 친근 (Friendly) 톤
 *
 * 2열 그리드용 세로 카드: 아바타 → 이름 → 성별·나이 → 메타정보(생년월일, 연락처).
 */
export function VariantC({ client, onPress }: ClientCardProps) {
  const age = calculateAge(client.birth_date);
  const genderLabel = getGenderLabel(client.gender);
  const birth = formatBirthDate(client.birth_date);
  const phone = formatPhone(client.phone);
  const initial = getInitial(client.name);
  const profileColor = getProfileColor(client.id);

  return (
    <TouchableOpacity
      onPress={() => onPress(client.id)}
      activeOpacity={0.85}
      className="flex-1 overflow-hidden rounded-lg bg-surface"
      accessibilityLabel={`${client.name} 내담자 상세`}
      accessibilityRole="button"
    >
      <View
        style={{
          paddingVertical: s(16),
          paddingHorizontal: s(16),
          gap: s(12),
        }}
        className="items-start"
      >
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

        <View className="w-full" style={{ gap: s(4) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {client.name}
          </Typography>
          {(genderLabel || age !== null) && (
            <View className="flex-row items-center">
              {genderLabel && (
                <Typography variant="label-01" weight="medium" className="text-gray-500">
                  {genderLabel}
                </Typography>
              )}
              {genderLabel && age !== null && (
                <View
                  style={{ marginHorizontal: s(6), height: s(8) }}
                  className="w-px bg-gray-300"
                />
              )}
              {age !== null && (
                <Typography variant="label-01" weight="medium" className="text-gray-500">
                  만 {age}세
                </Typography>
              )}
            </View>
          )}
        </View>

        {/* 절취선 */}
        <View className="h-px w-full bg-gray-100" />

        {/* 메타정보 */}
        <View className="w-full" style={{ gap: s(6) }}>
          <InfoLine label="생년월일" value={birth} />
          <InfoLine label="연락처" value={phone} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: s(4) }}>
      <View style={{ width: s(52) }}>
        <Typography variant="label-01" weight="medium" className="text-gray-400">
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="medium"
        className="flex-1 text-gray-800"
        numberOfLines={1}
      >
        {value}
      </Typography>
    </View>
  );
}
