import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Typography, type BadgeColor } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import type { VoucherProgram } from '../types';

interface VoucherCardProps {
  program: VoucherProgram;
  onPress: () => void;
  /** 미지정 시 사업 연도를 뱃지로 노출 */
  badge?: { label: string; color: BadgeColor };
  /** 미지정 시 지원 대상(support_target) 노출 — 매칭 결과 화면에서 상태 설명으로 대체 */
  description?: string;
  /** blocked 결과 등 시각적으로 가라앉힐 때 */
  muted?: boolean;
}

/** 지원 제도 카드 — 홈·카탈로그·자격 확인 결과 공용 */
export function VoucherCard({
  program,
  onPress,
  badge,
  description,
  muted = false,
}: VoucherCardProps) {
  const amount = program.support_amount_text ?? program.support_scope;
  const caption = description ?? program.support_target;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="rounded-xl bg-surface p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : muted ? 0.6 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <View className="mr-3 flex-1 flex-row items-center">
          <Ionicons
            name="ticket-outline"
            size={18}
            color={COLORS.brand[500]}
            style={{ marginRight: 6 }}
          />
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            {program.name}
          </Typography>
        </View>
        <Badge
          label={badge?.label ?? `${program.program_year}년`}
          color={badge?.color ?? 'green'}
        />
      </View>
      {amount ? (
        <Typography
          variant="title-01"
          weight="semibold"
          className="mt-2"
          style={{ color: COLORS.text.title.default }}
        >
          {amount}
        </Typography>
      ) : null}
      {caption ? (
        <Typography
          variant="body-03"
          className="mt-1"
          style={{ color: COLORS.text.caption.default }}
        >
          {caption}
        </Typography>
      ) : null}
      <View className="mt-3 flex-row items-center">
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.text.body.default }}
        >
          제도 자세히 보기
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={COLORS.icon.secondary}
          style={{ marginLeft: 2 }}
        />
      </View>
    </Pressable>
  );
}
