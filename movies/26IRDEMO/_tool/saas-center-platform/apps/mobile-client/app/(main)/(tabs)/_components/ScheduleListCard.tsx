/**
 * 일정 목록 카드 — 피그마 523:4347.
 *
 * 센터명 = 상단 회색 헤더(border-bottom), 본문 = 흰색: [프로필 뱃지 + 제목] · 시간 ·
 * 상담실(위치 아이콘) · 상담사(유저 아이콘). 상담실·상담사는 nullable이라 있을 때만 렌더.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import type { AppSchedule } from '@/features/schedule';
import { Badge, Typography, type BadgeColor } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { toKst } from '@/shared/utils/date';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import SpotIcon20 from '@assets/icons/20/SpotIcon20.svg';
import UserIcon20 from '@assets/icons/20/UserIcon20.svg';

interface ScheduleListCardProps {
  schedule: AppSchedule;
  profileName?: string;
  profileColor: BadgeColor;
}

export function ScheduleListCard({
  schedule,
  profileName,
  profileColor,
}: ScheduleListCardProps) {
  const router = useRouter();
  // 서버 UTC naive → KST 벽시계(shared/utils/date.ts)
  const start = toKst(schedule.start_time);
  const end = toKst(schedule.end_time);

  const openDetail = () =>
    router.push({
      pathname: '/(main)/schedule-detail',
      params: {
        scheduleId: schedule.schedule_id,
        kind: schedule.kind,
        status: schedule.status,
        title: schedule.title ?? '',
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        ...(schedule.center_name ? { centerName: schedule.center_name } : {}),
        ...(schedule.room_name ? { roomName: schedule.room_name } : {}),
        ...(schedule.counselor_name
          ? { counselorName: schedule.counselor_name }
          : {}),
        ...(schedule.memo ? { memo: schedule.memo } : {}),
        ...(schedule.voucher_name
          ? { voucherName: schedule.voucher_name }
          : {}),
        ...(schedule.pending_change_request
          ? {
              pendingRequestStart:
                schedule.pending_change_request.requested_start,
            }
          : {}),
        ...(profileName ? { profileName } : {}),
        profileColor,
      },
    });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openDetail}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: COLORS.border.default,
          borderRadius: s(12),
          overflow: 'hidden',
        }}
      >
        {/* 헤더 — 센터명 */}
        {schedule.center_name ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              columnGap: s(4),
              height: s(42),
              paddingHorizontal: s(16),
              backgroundColor: COLORS.bg.base,
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border.default,
            }}
          >
            <CenterIcon20 width={20} height={20} />
            <Typography
              variant="body-02"
              weight="medium"
              numberOfLines={1}
              style={{ color: COLORS.text.label.default }}
            >
              {schedule.center_name}
            </Typography>
          </View>
        ) : null}

        {/* 본문 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: s(8),
            paddingHorizontal: s(16),
            paddingVertical: s(12),
            backgroundColor: COLORS.surface,
          }}
        >
          <View className="flex-1" style={{ rowGap: s(12) }}>
            <View style={{ rowGap: s(8) }}>
              <View
                className="flex-row items-center"
                style={{ columnGap: s(8) }}
              >
                {profileName ? (
                  <Badge
                    label={profileName}
                    color={profileColor}
                    shape="rect"
                    size="md"
                  />
                ) : null}
                <Typography
                  variant="body-01"
                  weight="semibold"
                  numberOfLines={1}
                  className="flex-1"
                  style={{ color: COLORS.text.body.strong }}
                >
                  {schedule.title}
                </Typography>
              </View>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.text.label.default }}
              >
                {`${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`}
              </Typography>
            </View>

            {schedule.room_name || schedule.counselor_name ? (
              <View style={{ rowGap: s(8) }}>
                {schedule.room_name ? (
                  <View
                    className="flex-row items-center"
                    style={{ columnGap: s(4) }}
                  >
                    <SpotIcon20 width={20} height={20} />
                    <Typography
                      variant="body-02"
                      numberOfLines={1}
                      style={{ color: COLORS.text.body.default }}
                    >
                      {schedule.room_name}
                    </Typography>
                  </View>
                ) : null}
                {schedule.counselor_name ? (
                  <View
                    className="flex-row items-center"
                    style={{ columnGap: s(4) }}
                  >
                    <UserIcon20 width={20} height={20} />
                    <Typography
                      variant="body-02"
                      numberOfLines={1}
                      style={{ color: COLORS.text.body.default }}
                    >
                      {`${schedule.counselor_name} 상담사`}
                    </Typography>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <ArrowRightIcon20 width={20} height={20} />
        </View>
      </View>
    </Pressable>
  );
}
