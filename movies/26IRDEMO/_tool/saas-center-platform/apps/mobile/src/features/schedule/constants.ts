import { COLORS } from '@/shared/constants/theme';

export const SCHEDULE_TYPE_COLORS: Record<string, string> = {
  counseling: COLORS.counseling,
  assessment: COLORS.assessment,
  meeting: '#6c757d',
  block: '#ced4da',
};

export const SCHEDULE_PALETTE = [
  '#26B9BE',
  '#F94A73',
  '#BA6BE4',
  '#498CF1',
  '#F49937',
  '#00C0E2',
  '#F3BF11',
];

export const getScheduleColorByIndex = (index: number): string => {
  const length = SCHEDULE_PALETTE.length;
  return SCHEDULE_PALETTE[((index % length) + length) % length];
};
