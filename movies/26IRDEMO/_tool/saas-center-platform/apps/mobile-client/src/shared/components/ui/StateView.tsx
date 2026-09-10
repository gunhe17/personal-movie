import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';

/** 콘텐츠 로딩 표시 */
export function LoadingView({ className = 'py-16' }: { className?: string }) {
  return (
    <View className={`items-center justify-center ${className}`.trim()}>
      <ActivityIndicator size="small" color={COLORS.gray[400]} />
    </View>
  );
}

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** 오류 상태 — 사용자를 탓하지 않는 톤 + 재시도 */
export function ErrorView({
  message = '정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
  onRetry,
  className = 'py-16',
}: ErrorViewProps) {
  return (
    <View className={`items-center justify-center px-6 ${className}`.trim()}>
      <Typography
        variant="body-02"
        className="text-center"
        style={{ color: COLORS.text.body.default }}
      >
        {message}
      </Typography>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-4 h-10 items-center justify-center rounded-md px-5"
          style={({ pressed }) => ({
            backgroundColor: pressed ? COLORS.gray[200] : COLORS.gray[100],
          })}
        >
          <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[700] }}>
            다시 시도
          </Typography>
        </Pressable>
      ) : null}
    </View>
  );
}

interface EmptyViewProps {
  title: string;
  description?: string;
  className?: string;
}

/** 빈 상태 — 무해한 톤 (채근·경고 없음) */
export function EmptyView({ title, description, className = 'py-14' }: EmptyViewProps) {
  return (
    <View className={`items-center justify-center px-6 ${className}`.trim()}>
      <Typography
        variant="body-01"
        weight="medium"
        className="text-center"
        style={{ color: COLORS.text.body.default }}
      >
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="body-03"
          className="mt-1.5 text-center"
          style={{ color: COLORS.text.caption.default }}
        >
          {description}
        </Typography>
      ) : null}
    </View>
  );
}
