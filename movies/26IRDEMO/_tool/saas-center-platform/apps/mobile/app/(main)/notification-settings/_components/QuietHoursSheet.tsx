import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';
import { WheelPicker } from './WheelPicker';

export type Meridiem = '오전' | '오후';

export interface TimeValue {
  meridiem: Meridiem;
  hour: number; // 1~12
  minute: number; // 0,5,10,...55
}

interface QuietHoursSheetProps {
  visible: boolean;
  onClose: () => void;
  start: TimeValue;
  end: TimeValue;
  initialTab?: 'start' | 'end';
  onChange: (next: { start: TimeValue; end: TimeValue }) => void;
}

const MERIDIEMS: Meridiem[] = ['오전', '오후'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function formatTime(t: TimeValue): string {
  const m = String(t.minute).padStart(2, '0');
  const h = String(t.hour).padStart(2, '0');
  return `${t.meridiem} ${h}:${m}`;
}

export function QuietHoursSheet({
  visible,
  onClose,
  start,
  end,
  initialTab = 'start',
  onChange,
}: QuietHoursSheetProps) {
  const [tab, setTab] = useState<'start' | 'end'>(initialTab);
  const current = tab === 'start' ? start : end;

  const setCurrent = (next: TimeValue) => {
    if (tab === 'start') onChange({ start: next, end });
    else onChange({ start, end: next });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text
        className="text-center text-gray-900 mb-4"
        style={{ fontSize: 17, fontWeight: '600', letterSpacing: TYPOGRAPHY.letterSpacing }}
      >
        방해금지 시간
      </Text>

      {/* 시작/종료 탭 */}
      <View className="flex-row bg-gray-50 rounded-xl p-1 mb-6">
        <TabButton
          label="시작 시간"
          value={formatTime(start)}
          active={tab === 'start'}
          onPress={() => setTab('start')}
        />
        <TabButton
          label="종료 시간"
          value={formatTime(end)}
          active={tab === 'end'}
          onPress={() => setTab('end')}
        />
      </View>

      {/* 휠 피커 3컬럼 */}
      <View className="flex-row relative">
        {/* 중앙 선택 표시 라인 */}
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 border-t border-b border-gray-100"
          style={{ top: 88, height: 44 }}
        />
        <WheelPicker
          data={MERIDIEMS}
          value={current.meridiem}
          onChange={(meridiem) => setCurrent({ ...current, meridiem })}
        />
        <WheelPicker
          data={HOURS}
          value={current.hour}
          onChange={(hour) => setCurrent({ ...current, hour })}
        />
        <WheelPicker
          data={MINUTES}
          value={current.minute}
          onChange={(minute) => setCurrent({ ...current, minute })}
          format={(v) => String(v).padStart(2, '0')}
        />
      </View>
    </BottomSheet>
  );
}

interface TabButtonProps {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}

function TabButton({ label, value, active, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-1 items-center py-2.5 rounded-lg"
      style={
        active
          ? {
              backgroundColor: COLORS.white,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
              elevation: 2,
            }
          : undefined
      }
    >
      <Text
        style={{
          fontSize: 12,
          color: active ? COLORS.gray[500] : COLORS.gray[400],
          letterSpacing: TYPOGRAPHY.letterSpacing,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: active ? COLORS.gray[900] : COLORS.gray[500],
          letterSpacing: TYPOGRAPHY.letterSpacing,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}
