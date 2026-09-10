/**
 * 일정/기록 필터 칩 — 시안 414:4291(일정) · 414:4077(기록).
 *
 * 공용 Chip(66:8)과 다른 룩이라 별도 컴포넌트: 전체=다크 알약(bg/emphasis)·프로필=비활성
 * 알약, 둘 다 테두리 없음. h34·r12(피그마 Layout 스펙).
 *
 * ⚠️ 비활성 배경은 화면마다 다르다 — 일정 탭은 bg/base(회색), 기록 탭은 그라디언트
 * 배경 위에 놓이는 탓에 bg/surface-raised(흰색)로 그려져 있다. 시안이 실제로 갈리는
 * 지점이라 inactiveTone으로 분기한다(임의 통일 금지 — 디자이너 확인 대상).
 *
 * ⚠️ 스타일은 전부 내부 View의 정적 style에 둔다. Pressable의 style 함수
 * (`({pressed}) => ({배경·높이…})`)에 레이아웃/배경을 넣으면 실기기에서 무시된다
 * (mobile-client.md §5 — 바우처 티켓 카드와 동일 함정). Pressable은 opacity만 맡는다.
 *
 * 프로필 아바타: 연결된 Client 이미지(image_url, 기본아바타 포함)를 우선 쓰고, 없을 때만
 * 식별색 원 + 이니셜로 폴백한다(색은 달력 점·목록 카드 뱃지와 동색).
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  AnimatedTypography,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/** 공용 Chip(66:8)과 동일한 색 보간 속도 */
const DURATION = 150;

interface ScheduleFilterChipProps {
  label: string;
  active: boolean;
  /** 지정 시 프로필 칩(아바타 표시) — 없으면 '전체' 칩 */
  color?: BadgeColor;
  /** 프로필 이미지 URL — 있으면 이니셜 대신 사진 아바타 */
  imageUrl?: string | null;
  /** 비활성 배경 — 'base'(일정 탭 회색) | 'surface'(기록 탭 흰색) */
  inactiveTone?: 'base' | 'surface';
  onPress: () => void;
}

export function ScheduleFilterChip({
  label,
  active,
  color,
  imageUrl,
  inactiveTone = 'base',
  onPress,
}: ScheduleFilterChipProps) {
  const isProfile = !!color;
  const inactiveBg =
    inactiveTone === 'surface' ? COLORS.bg['surface-raised'] : COLORS.bg.base;

  const progress = useDerivedValue(
    () => withTiming(active ? 1 : 0, { duration: DURATION }),
    [active],
  );
  // 배경과 글자를 같은 progress로 — 따로 놀면 전환 중 흰 글자가 흰 배경에 묻힌다
  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveBg, COLORS.bg.emphasis],
    ),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [COLORS.text.body.default, COLORS.text.state.inverse],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            columnGap: s(4),
            height: s(34),
            paddingLeft: s(isProfile ? 8 : 12),
            paddingRight: s(isProfile ? 8 : 12),
            borderRadius: s(12),
          },
          containerStyle,
        ]}
      >
        {color ? (
          imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: s(16), height: s(16), borderRadius: s(8) }}
            />
          ) : (
            <View
              style={{
                width: s(16),
                height: s(16),
                borderRadius: s(8),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.tag[color].fg,
              }}
            >
              <Typography
                variant="caption-01"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                {label.trim().charAt(0)}
              </Typography>
            </View>
          )
        ) : null}
        <AnimatedTypography
          variant="body-03"
          // 시안: '전체'는 Regular, 프로필 칩만 Medium
          weight={isProfile ? 'medium' : 'regular'}
          style={labelStyle}
        >
          {label}
        </AnimatedTypography>
      </Animated.View>
    </Pressable>
  );
}
