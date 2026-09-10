import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';

import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { ClientCardProps } from './types';
import {
  calculateAge,
  formatNextSession,
  formatPhone,
  getGenderLabel,
  getInitial,
  getProfileColor,
} from './helpers';

/**
 * 한 줄 카드 — 빠른 스캔에 최적화.
 *
 * - 좌측: 이름 이니셜 아바타 + (관심 표시 시) 우상단 corner 하트 badge
 * - 가운데: 이름·메타 + 생년월일·연락처
 * - 우측: chevron
 *
 * 캐러셀 CarouselCard와 아바타 톤 통일 (이니셜, 컬러 배경).
 */
export function VariantA({ client, onPress }: ClientCardProps) {
  const age = calculateAge(client.birth_date);
  const genderLabel = getGenderLabel(client.gender);
  const nextSession = formatNextSession(client.next_session_at);
  const phone = formatPhone(client.phone);
  const initial = getInitial(client.name);
  const profileColor = getProfileColor(client.id);

  return (
    <TouchableOpacity
      onPress={() => onPress(client.id)}
      activeOpacity={0.7}
      style={{ paddingVertical: s(12), paddingHorizontal: s(16), gap: s(12) }}
      className="flex-row items-center rounded-lg bg-surface"
      accessibilityLabel={`${client.name} 내담자 상세${client.is_favorited ? ', 관심 표시됨' : ''}`}
      accessibilityRole="button"
    >
      {/* 아바타 — 이니셜 + 컬러 배경 (캐러셀 카드와 일관). 우상단 하트 badge */}
      <View style={{ position: 'relative' }}>
        <View
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: profileColor.bg,
          }}
          className="items-center justify-center"
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: profileColor.fg }}
          >
            {initial}
          </Typography>
        </View>
        {client.is_favorited && (
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
              // 흰 카드 위에 흰 badge — shadow로 분리
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

      {/* 본문: 이름 줄 + 메타 줄 */}
      <View className="flex-1" style={{ gap: s(2) }}>
        {/* 1줄: 이름 · 성별 | 나이 */}
        <View className="flex-row items-center">
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {client.name}
          </Typography>
          {genderLabel && (
            <>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ marginLeft: s(8) }}
                className="text-gray-600"
              >
                {genderLabel}
              </Typography>
              {age !== null && (
                <>
                  <View
                    style={{ marginHorizontal: s(6), height: s(10) }}
                    className="w-px bg-gray-300"
                  />
                  <Typography variant="body-03" weight="medium" className="text-gray-600">
                    만 {age}세
                  </Typography>
                </>
              )}
            </>
          )}
        </View>

        {/* 2줄: 다음 상담일 · 연락처 */}
        <View className="flex-row items-center">
          <Typography
            variant="body-03"
            className={client.next_session_at ? 'text-gray-500' : 'text-gray-400'}
          >
            {nextSession}
          </Typography>
          <View
            style={{ marginHorizontal: s(6), height: s(10) }}
            className="w-px bg-gray-300"
          />
          <Typography variant="body-03" className="text-gray-500">
            {phone}
          </Typography>
        </View>
      </View>

      {/* 우측 chevron — 진입 어포던스 (하트는 좌측 아바타로 이동) */}
      <Icon name="arrow-right" size={s(16)} />
    </TouchableOpacity>
  );
}
