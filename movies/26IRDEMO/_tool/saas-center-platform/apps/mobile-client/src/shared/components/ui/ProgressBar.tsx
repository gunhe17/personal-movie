import React from 'react';
import { View } from 'react-native';
import { COLORS } from '@/shared/constants/theme';

interface ProgressBarProps {
  /** 0~1 */
  ratio: number;
  className?: string;
}

/** 상담 회기 N/M 진행바 — 채근 뉘앙스 없이 담백한 인라인 바 */
export function ProgressBar({ ratio, className = '' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View
      className={`h-1.5 overflow-hidden rounded-full ${className}`.trim()}
      style={{ backgroundColor: COLORS.gray[100] }}
    >
      <View
        className="h-full rounded-full"
        style={{ width: `${clamped * 100}%`, backgroundColor: COLORS.brand[400] }}
      />
    </View>
  );
}
