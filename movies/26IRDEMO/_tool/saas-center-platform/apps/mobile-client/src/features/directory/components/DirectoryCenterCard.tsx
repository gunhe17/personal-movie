import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Badge, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import PinIcon16 from '@assets/icons/16/PinIcon16.svg';
import TimeIcon16 from '@assets/icons/16/TimeIcon16.svg';
import CallIcon20 from '@assets/icons/20/CallIcon20.svg';
import type { DirectoryCenter } from '../types';

export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${distanceM}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}

interface DirectoryCenterCardProps {
  center: DirectoryCenter;
  onPress?: () => void;
}

export function DirectoryCenterCard({ center, onPress }: DirectoryCenterCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View className="flex-row items-start gap-3 px-4 py-4">
        <View className="flex-1">
          <View className="flex-row items-center" style={{ columnGap: 6 }}>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default, flexShrink: 1 }}
              numberOfLines={1}
            >
              {center.name}
            </Typography>
            <Badge label={center.category} color="blue" />
          </View>

          <View className="mt-1 flex-row items-center" style={{ columnGap: 6 }}>
            <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[700] }}>
              {formatDistance(center.distance_m)}
            </Typography>
            <View style={{ width: 1, height: 12, backgroundColor: COLORS.border.default }} />
            <View className="flex-1 flex-row items-center" style={{ columnGap: 2 }}>
              <PinIcon16 width={16} height={16} />
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[600], flexShrink: 1 }}
                numberOfLines={1}
              >
                {center.address}
              </Typography>
            </View>
          </View>

          {center.operating_hours_text ? (
            <View className="mt-1 flex-row items-center" style={{ columnGap: 2 }}>
              <TimeIcon16 width={16} height={16} />
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[600] }}
                numberOfLines={1}
              >
                {center.operating_hours_text}
              </Typography>
            </View>
          ) : null}
        </View>

        {center.phone_number ? (
          <View style={{ width: s(36), height: s(36) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="전화 걸기"
              onPress={() => Linking.openURL(`tel:${center.phone_number}`)}
              className="h-full w-full items-center justify-center rounded-full"
              style={({ pressed }) => ({
                backgroundColor: pressed ? COLORS.gray[100] : COLORS.gray[50],
              })}
            >
              <CallIcon20 width={20} height={20} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
