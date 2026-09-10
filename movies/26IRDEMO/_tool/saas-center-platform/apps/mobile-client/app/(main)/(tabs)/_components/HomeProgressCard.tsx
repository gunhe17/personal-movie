import React from 'react';
import { View } from 'react-native';
import type { Profile } from '@/features/profile';
import { useProfileProgress } from '@/features/progress';
import { LoadingView, ProgressBar, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';

interface HomeProgressCardProps {
  profile: Profile;
}

/** 홈 "진행 중" 섹션 — 프로필별 상담 회기 진행바 (읽기 전용) */
export function HomeProgressCard({ profile }: HomeProgressCardProps) {
  const { data, isLoading, isError } = useProfileProgress(profile.id);

  return (
    <View className="rounded-xl bg-surface p-4">
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {profile.display_name}
      </Typography>

      {isLoading ? (
        <LoadingView className="py-4" />
      ) : isError ? (
        <Typography
          variant="body-03"
          className="mt-2"
          style={{ color: COLORS.text.caption.default }}
        >
          진행 정보를 불러오지 못했어요
        </Typography>
      ) : !data || data.counseling.length === 0 ? (
        <Typography
          variant="body-03"
          className="mt-2"
          style={{ color: COLORS.text.caption.default }}
        >
          진행 중인 상담이 없어요
        </Typography>
      ) : (
        <View className="mt-3 gap-3">
          {data.counseling.map((item) => (
            <View key={item.case_id}>
              <View className="flex-row items-center justify-between">
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.text.body.default }}
                >
                  {item.counseling_type ?? '상담'}
                </Typography>
                <Typography
                  variant="label-01"
                  weight="medium"
                  style={{ color: COLORS.text.caption.default }}
                >
                  {item.completed_sessions}/{item.total_sessions ?? 0}회
                </Typography>
              </View>
              <ProgressBar
                ratio={
                  item.total_sessions
                    ? item.completed_sessions / item.total_sessions
                    : 0
                }
                className="mt-1.5"
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
