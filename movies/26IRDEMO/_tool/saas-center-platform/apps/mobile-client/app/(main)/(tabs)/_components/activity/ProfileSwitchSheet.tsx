/**
 * 아이 전환 시트 — 활동 탭 헤더의 "{이름}의 활동 ▾"이 여는 선택 목록.
 * 아이가 둘 이상일 때만 헤더가 이 시트를 연다(하나면 고를 것이 없다, §7-5).
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, BottomSheet, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export interface SwitchableProfile {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface ProfileSwitchSheetProps {
  visible: boolean;
  onClose: () => void;
  profiles: SwitchableProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProfileSwitchSheet({
  visible,
  onClose,
  profiles,
  selectedId,
  onSelect,
}: ProfileSwitchSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="아이 선택">
      <View style={{ rowGap: s(4), paddingBottom: s(8) }}>
        {profiles.map((profile) => {
          const selected = profile.id === selectedId;
          return (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onSelect(profile.id);
                onClose();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View
                className="flex-row items-center rounded-xl"
                style={{
                  columnGap: s(12),
                  paddingHorizontal: s(12),
                  paddingVertical: s(12),
                  backgroundColor: selected
                    ? COLORS.bg.selected
                    : 'transparent',
                }}
              >
                <Avatar uri={profile.imageUrl} size={s(36)} />
                <Typography
                  variant="body-01"
                  weight={selected ? 'semibold' : 'regular'}
                  className="flex-1"
                  numberOfLines={1}
                  style={{ color: COLORS.text.title.default }}
                >
                  {profile.name}
                </Typography>
                {selected ? (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={COLORS.brand[500]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
