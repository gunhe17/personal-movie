import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';

export interface OptionItem {
  key: string;
  label: string;
}

interface OptionListSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: OptionItem[];
  value: string | null;
  onSelect: (key: string) => void;
}

export function OptionListSheet({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
}: OptionListSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text
        className="text-center text-gray-900 mb-4"
        style={{ fontSize: 17, fontWeight: '600', letterSpacing: TYPOGRAPHY.letterSpacing }}
      >
        {title}
      </Text>

      <View>
        {options.map((opt, idx) => {
          const selected = opt.key === value;
          const isLast = idx === options.length - 1;
          return (
            <View key={opt.key}>
              <TouchableOpacity
                onPress={() => {
                  onSelect(opt.key);
                  onClose();
                }}
                activeOpacity={0.6}
                className="flex-row items-center py-4"
                accessibilityRole="button"
                accessibilityLabel={`${opt.label} 선택`}
              >
                <Text
                  className="flex-1"
                  style={{
                    fontSize: 15,
                    fontWeight: selected ? '600' : '400',
                    color: selected ? COLORS.primary : COLORS.gray[900],
                    letterSpacing: TYPOGRAPHY.letterSpacing,
                  }}
                >
                  {opt.label}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              {!isLast && <View className="h-px bg-gray-100" />}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}
