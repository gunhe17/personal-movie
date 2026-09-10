import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import { useScheduleDetail } from '@/features/schedule';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS, SPACING } from '@/shared/constants/theme';

/**
 * 일정 상세 라우트는 회기 상세(상담)·케이스 상세(검사)로 통합되었다.
 * 이 라우트는 schedule_type에 따라 적절한 상세 페이지로 자동 라우팅한다.
 *
 * - counseling + 회기 존재  → /(main)/counseling/session/[sessionId]
 * - assessment + 케이스 존재 → /(main)/assessment/[caseId]
 * - 그 외 (meeting, block, 회기 없음) → 폴백 안내
 */
export default function ScheduleDetailRedirect() {
  const { id, openNote, openWizard } = useLocalSearchParams<{
    id: string;
    openNote?: string;
    openWizard?: string;
  }>();
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);

  const { data: schedule, isLoading, isError } = useScheduleDetail(centerId, id);

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (!schedule || !id) return;

    const firstSession = schedule.sessions[0];

    if (schedule.schedule_type === 'counseling' && firstSession?.session_id) {
      redirectedRef.current = true;
      router.replace({
        pathname: '/(main)/counseling/session/[id]',
        params: {
          id: firstSession.session_id,
          scheduleId: id,
          ...(openNote ? { openNote } : {}),
          ...(openWizard ? { openWizard } : {}),
        },
      });
      return;
    }

    if (schedule.schedule_type === 'assessment' && firstSession?.case_id) {
      redirectedRef.current = true;
      router.replace({
        pathname: '/(main)/assessment/[id]',
        params: { id: firstSession.case_id },
      });
      return;
    }
  }, [schedule, id, openNote, openWizard, router]);

  // 로딩 / 리다이렉트 대기 — 회기·케이스를 가진 일정이면 곧 replace 됨
  if (isLoading || (schedule && schedule.sessions[0] && !redirectedRef.current)) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // 폴백 — 회기·케이스 없음 또는 지원하지 않는 일정 타입 (meeting, block 등)
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View
        className="flex-row items-center"
        style={{ height: 52, paddingHorizontal: SPACING.lg }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>
      <View
        className="flex-1 items-center justify-center"
        style={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}
      >
        <Ionicons
          name="calendar-outline"
          size={48}
          color={COLORS.gray[300]}
        />
        <Typography variant="body-01" weight="semibold" className="text-gray-700">
          {isError ? '일정을 불러올 수 없어요' : '상세를 표시할 수 없는 일정이에요'}
        </Typography>
        <Typography
          variant="body-03"
          className="text-gray-500"
          style={{ textAlign: 'center' }}
        >
          {isError
            ? '잠시 후 다시 시도해 주세요.'
            : '회기나 케이스가 연결되지 않은 일정이에요.'}
        </Typography>
      </View>
    </SafeAreaView>
  );
}
