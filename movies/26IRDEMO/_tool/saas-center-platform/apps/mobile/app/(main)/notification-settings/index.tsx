import { useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import {
  useNotificationSettings,
  useUpsertNotificationSetting,
  type NotificationSetting,
} from '@/features/notification';
import { COLORS } from '@/shared/constants/theme';
import { Icon, type IconName } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { Toggle } from '@/shared/components/ui/Toggle';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';
import { NotificationSettingsSkeleton } from './_components/NotificationSettingsSkeleton';

type ToggleItem = {
  category: string;
  event_type: string | null;
  label: string;
  description?: string;
  defaultEnabled?: boolean;
  icon: IconName;
  iconColor: string;
  iconBg: string;
};

type Section = {
  title?: string;
  items: ToggleItem[];
};

const SECTIONS: Section[] = [
  {
    title: '일정',
    items: [
      {
        category: 'schedule',
        event_type: 'reminder',
        label: '일정 리마인드',
        description: '상담·검사 일정 시작 전 알림',
        defaultEnabled: true,
        icon: 'alarm-24',
        iconColor: COLORS.warning,
        iconBg: 'rgba(255, 146, 0, 0.1)',
      },
    ],
  },
  {
    title: '검사',
    items: [
      {
        category: 'assessment',
        event_type: 'submitted',
        label: '검사 제출 완료',
        description: '내담자가 검사를 완료하여 상태가 변경된 경우',
        icon: 'assessment-20',
        iconColor: '#3495F5',
        iconBg: 'rgba(52, 149, 245, 0.08)',
      },
    ],
  },
  {
    title: '시스템',
    items: [
      {
        category: 'system',
        event_type: 'notice',
        label: '공지사항',
        description: '서비스 공지, 안내사항',
        icon: 'notice-20',
        iconColor: COLORS.gray[600],
        iconBg: COLORS.gray[100],
      },
    ],
  },
];

function settingKey(category: string, event_type: string | null) {
  return `${category}|${event_type ?? ''}`;
}

function buildSettingsMap(items: NotificationSetting[]): Record<string, NotificationSetting> {
  const map: Record<string, NotificationSetting> = {};
  for (const item of items) {
    map[settingKey(item.category, item.event_type)] = item;
  }
  return map;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);

  const { data, isLoading } = useNotificationSettings(centerId);
  const showSkeleton = useDelayedSkeleton(isLoading);
  const upsertSetting = useUpsertNotificationSetting(centerId);

  const settingsMap = useMemo(
    () => buildSettingsMap(data?.items ?? []),
    [data],
  );

  const masterSetting = settingsMap[settingKey('*', null)];
  const masterEnabled = masterSetting
    ? masterSetting.channel_in_app || masterSetting.channel_push
    : true;

  const handleToggle = useCallback(
    (category: string, event_type: string | null, currentValue: boolean) => {
      const existing = settingsMap[settingKey(category, event_type)];
      const next = !currentValue;
      upsertSetting.mutate({
        category,
        event_type,
        channel_in_app: next,
        channel_push: next,
        channel_alarmtalk: existing?.channel_alarmtalk ?? false,
      });
    },
    [settingsMap, upsertSetting],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-background px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          알림 설정
        </Typography>
      </View>

      {showSkeleton ? (
        <NotificationSettingsSkeleton />
      ) : isLoading ? (
        <View className="flex-1" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(48) }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 전체 알림 (master) ─── */}
          <View
            className="mx-5 rounded-lg p-4"
            style={{ backgroundColor: masterEnabled ? COLORS.primary50 : COLORS.surface }}
          >
            <View className="flex-row items-center">
              <View
                className="h-10 w-10 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: masterEnabled ? COLORS.primary200 : COLORS.gray[100] }}
              >
                <Icon
                  name="bell-20"
                  size={20}
                  color={masterEnabled ? COLORS.primary700 : COLORS.gray[400]}
                />
              </View>
              <View className="flex-1 ml-3 mr-3">
                <Typography variant="body-01" weight="semibold" className="text-gray-900">
                  전체 알림
                </Typography>
                <Typography variant="label-02" className="text-gray-500 mt-0.5">
                  {masterEnabled
                    ? '받고 싶은 알림만 아래에서 골라보세요'
                    : '알림이 모두 꺼져 있어요'}
                </Typography>
              </View>
              <Toggle
                value={masterEnabled}
                onChange={() => handleToggle('*', null, masterEnabled)}
                accessibilityLabel={`전체 알림 ${masterEnabled ? '끄기' : '켜기'}`}
              />
            </View>
          </View>

          {/* ─── 카테고리별 섹션 ─── */}
          <View style={{ opacity: masterEnabled ? 1 : 0.4 }} pointerEvents={masterEnabled ? 'auto' : 'none'}>
            {SECTIONS.map((section, sectionIdx) => (
              <View key={`section-${sectionIdx}`} className="mt-6">
                {section.title && (
                  <Typography
                    variant="label-01"
                    weight="semibold"
                    className="text-gray-600 px-5 mb-2"
                  >
                    {section.title}
                  </Typography>
                )}
                <View className="mx-5 rounded-lg bg-surface">
                  {section.items.map((item, itemIdx) => {
                    const setting = settingsMap[settingKey(item.category, item.event_type)];
                    const enabled = setting
                      ? setting.channel_in_app || setting.channel_push
                      : item.defaultEnabled ?? false;
                    const isLastItem = itemIdx === section.items.length - 1;

                    return (
                      <View key={settingKey(item.category, item.event_type)}>
                        <View className="flex-row items-center px-4 py-3.5">
                          <View
                            className="h-9 w-9 items-center justify-center rounded-[10px]"
                            style={{ backgroundColor: item.iconBg }}
                          >
                            <Icon name={item.icon} size={20} color={item.iconColor} />
                          </View>
                          <View className="flex-1 ml-3 mr-3">
                            <Typography
                              variant="body-02"
                              weight="medium"
                              className="text-gray-900"
                            >
                              {item.label}
                            </Typography>
                            {item.description && (
                              <Typography
                                variant="caption-01"
                                className="text-gray-500 mt-0.5"
                              >
                                {item.description}
                              </Typography>
                            )}
                          </View>
                          <Toggle
                            value={enabled}
                            onChange={() =>
                              handleToggle(item.category, item.event_type, enabled)
                            }
                            accessibilityLabel={`${item.label} ${enabled ? '끄기' : '켜기'}`}
                          />
                        </View>
                        {!isLastItem && <View className="h-px bg-gray-100 ml-[60px]" />}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
