import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore, type UserCenterSummary } from '@/features/auth';
import { useCenterStore, usePermissionStore } from '@/features/center';
import { unregisterCurrentDevice } from '@/features/notification';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';
import { format } from 'date-fns';

export default function MyCentersScreen() {
  const router = useRouter();
  const centers = useAuthStore((s) => s.centers);
  const currentCenterId = useCenterStore((s) => s.centerId);
  const setCenterContext = useCenterStore((s) => s.setCenterContext);
  const fetchPermissions = usePermissionStore((s) => s.fetchPermissions);

  const handleSelect = async (center: UserCenterSummary) => {
    if (center.id === currentCenterId) {
      router.back();
      return;
    }
    if (currentCenterId) {
      await unregisterCurrentDevice(currentCenterId);
    }
    setCenterContext(center.id, center.name, center.role_code);
    fetchPermissions(center.id);
    router.replace('/(main)/(tabs)');
  };

  const formatJoinedDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'yyyy.MM.dd');
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1 px-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center"
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          내 센터
        </Typography>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <Typography variant="body-03" weight="medium" className="pb-[14px] pt-4 text-gray-500">
          현재 센터
        </Typography>

        <View className="gap-2">
          {centers.map((center) => {
            const isCurrent = center.id === currentCenterId;
            return (
              <TouchableOpacity
                key={center.id}
                onPress={() => handleSelect(center)}
                activeOpacity={0.7}
                style={{ height: s(78) }}
                className={`flex-row items-center gap-3 rounded-lg px-4 ${
                  isCurrent
                    ? 'border border-primary bg-primary-50'
                    : 'bg-surface'
                }`}
              >
                <Icon name="center-mint" size={28} />
                <View className="flex-1">
                  <Typography variant="body-01" weight="medium" className="text-gray-900">
                    {center.name}
                  </Typography>
                  {center.joined_at && (
                    <Typography variant="body-03" className="mt-0.5 text-gray-500">
                      가입일{'  '}
                      <Typography variant="body-03" className="text-gray-700">
                        {formatJoinedDate(center.joined_at)}
                      </Typography>
                    </Typography>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 내 워크스페이스 (placeholder) — 미구현 기능이라 개발 빌드에서만 노출.
              탭하면 "준비중" Alert뿐인 더미 진입점을 릴리즈(리빙랩)에 내보내지 않는다. */}
          {__DEV__ && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('내 워크스페이스', '준비중인 기능입니다.')}
              style={{ height: s(78) }}
              className="flex-row items-center gap-3 rounded-lg bg-surface px-4"
            >
              <Icon name="workspace" size={28} />
              <View className="flex-1">
                <Typography variant="body-01" weight="medium" className="text-gray-900">
                  내 워크스페이스
                </Typography>
                <Typography variant="body-03" className="mt-0.5 text-gray-500">
                  센터 일정과 개인 일정을 함께 관리할 수 있어요
                </Typography>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
