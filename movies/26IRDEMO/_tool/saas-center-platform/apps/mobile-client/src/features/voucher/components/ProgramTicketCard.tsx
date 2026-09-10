/**
 * 제도 카탈로그 티켓 카드 — 미연결 홈 '바우처 소식'·바우처 홈 '최신 바우처' 공용(시안 480:5026).
 *
 * 상·하단이 각자 r12로 맞붙어 접합부에 절취 노치가 생기고, 그 위에 점선을 겹쳐 티켓처럼 보인다.
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { VoucherProgram } from '../types';
import CalendarIcon16 from '@assets/icons/16/CalendarIcon16.svg';

/** 시안 카드 폭 230/375 */
export const TICKET_CARD_WIDTH = s(230);

function formatPeriod(start: string | null, end: string | null): string {
  const fmt = (d: string) => d.replaceAll('-', '. ');
  if (start && end) return `${fmt(start)} ~ ${fmt(end)}`;
  if (start) return `${fmt(start)} ~`;
  if (end) return `~ ${fmt(end)}`;
  return '신청 기간은 상세에서 확인';
}

interface ProgramTicketCardProps {
  program: VoucherProgram;
  onPress: () => void;
}

export function ProgramTicketCard({ program, onPress }: ProgramTicketCardProps) {
  return (
    // 너비는 래퍼 View에 고정 — Pressable은 pressed 피드백만 (mobile-client.md §5)
    <View style={{ width: TICKET_CARD_WIDTH }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <View className="rounded-xl bg-surface p-4">
          <Image
            source={require('@assets/images/home/org-welfare.png')}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          <Typography
            variant="body-01"
            weight="semibold"
            className="mt-2"
            numberOfLines={1}
            style={{ color: COLORS.text.title.default }}
          >
            {program.name}
          </Typography>
          <Typography
            variant="body-02-reading"
            className="mt-1"
            numberOfLines={1}
            style={{ color: COLORS.gray[700] }}
          >
            {program.program_organization}
          </Typography>
        </View>
        {/* 절취선 — 2-2 점선(gray/300), 접합부 위에 겹침 */}
        <View style={{ height: 0, marginHorizontal: 12, zIndex: 1 }}>
          <Svg width="100%" height={1} style={{ position: 'absolute', top: -0.5 }}>
            <Line
              x1="0"
              y1="0.5"
              x2="100%"
              y2="0.5"
              stroke={COLORS.border.strong}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          </Svg>
        </View>
        <View
          className="flex-row items-center rounded-xl bg-surface p-3"
          style={{ columnGap: 4 }}
        >
          <CalendarIcon16 width={16} height={16} />
          <Typography
            variant="body-02-reading"
            numberOfLines={1}
            className="flex-1"
            style={{ color: COLORS.text.body.subtle }}
          >
            {formatPeriod(program.application_start_date, program.application_end_date)}
          </Typography>
        </View>
      </Pressable>
    </View>
  );
}
