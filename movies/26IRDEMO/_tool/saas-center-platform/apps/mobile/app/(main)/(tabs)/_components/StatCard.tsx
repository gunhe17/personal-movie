import { View, TouchableOpacity } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

interface StatCardProps {
  value: number;
  label: string;
  valueClassName?: string;
  onPress?: () => void;
}

export function StatCard({
  value,
  label,
  valueClassName = 'text-gray-900',
  onPress,
}: StatCardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{ paddingVertical: s(16) }}
      className="flex-1 items-center rounded-lg bg-gray-50"
    >
      <Typography variant="headline-01" weight="semibold" className={valueClassName}>
        {value}
      </Typography>
      <Typography variant="label-01" className="mt-1 text-gray-500">
        {label}
      </Typography>
    </Wrapper>
  );
}
