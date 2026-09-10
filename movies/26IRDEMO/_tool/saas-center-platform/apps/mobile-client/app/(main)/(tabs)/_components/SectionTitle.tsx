import React from 'react';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';

/** 섹션 소제목 — 홈/일정 탭 공용 */
export function SectionTitle({ label, className = '' }: { label: string; className?: string }) {
  return (
    <Typography
      variant="title-01"
      weight="semibold"
      className={className}
      style={{ color: COLORS.text.title.default }}
    >
      {label}
    </Typography>
  );
}
