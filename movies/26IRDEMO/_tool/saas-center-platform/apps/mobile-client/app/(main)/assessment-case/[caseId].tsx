/**
 * 검사 케이스 상세 (L1 · push) — 활동 탭 기획 C★ v2.1.
 *
 * 배송 스테퍼 + 검사(task) 목록 + 결과지 열람. 부분 도착 지원 —
 * 먼저 도착한 결과지는 나머지가 준비 중이어도 즉시 열람.
 */
import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAssessmentReport, useProfileProgress } from '@/features/progress';
import type { AssessmentTaskItem } from '@/features/progress';
import { assessmentPhaseInfo } from '@/features/progress/garden';
import { isTaskDone, taskStatusLabel } from '@/features/progress/constants';
import {
  Badge,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { AssessmentStepper } from '../(tabs)/_components/garden/AssessmentStepper';

function TaskRow({ task, isFirst }: { task: AssessmentTaskItem; isFirst: boolean }) {
  const reportMutation = useAssessmentReport();
  const done = isTaskDone(task.status);

  const openReport = () => {
    reportMutation.mutate(task.task_id, {
      onSuccess: (report) => {
        Linking.openURL(report.download_url);
      },
    });
  };

  return (
    <View
      className="flex-row items-center justify-between py-2.5"
      style={{ borderTopWidth: isFirst ? 0 : 1, borderTopColor: COLORS.gray[100] }}
    >
      <View className="mr-3 flex-1 flex-row items-center" style={{ columnGap: s(8) }}>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: s(18),
            height: s(18),
            backgroundColor: done ? COLORS.tag.teal.fg : COLORS.gray[100],
          }}
        >
          {done ? (
            <Ionicons name="checkmark" size={11} color={COLORS.white} />
          ) : null}
        </View>
        <Typography
          variant="body-03"
          numberOfLines={1}
          className="flex-1"
          style={{ color: COLORS.text.title.default }}
        >
          {task.name}
        </Typography>
      </View>

      {task.report_visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.name} 결과지 보기`}
          onPress={openReport}
          disabled={reportMutation.isPending}
          hitSlop={8}
          className="flex-row items-center"
          style={{ columnGap: 2, opacity: reportMutation.isPending ? 0.5 : 1 }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.tag.teal.fg }}
          >
            결과지 보기
          </Typography>
          <Ionicons name="chevron-forward" size={13} color={COLORS.tag.teal.fg} />
        </Pressable>
      ) : done ? (
        <View
          className="rounded"
          style={{
            paddingHorizontal: s(6),
            paddingVertical: s(2),
            backgroundColor: COLORS.gray[100],
          }}
        >
          <Typography variant="label-02" style={{ color: COLORS.text.caption.default }}>
            준비 중
          </Typography>
        </View>
      ) : (
        <Typography variant="label-01" style={{ color: COLORS.text.caption.subtle }}>
          {taskStatusLabel(task.status)}
        </Typography>
      )}
    </View>
  );
}

/** 단건 검사의 결과지 열람 버튼 — 체크리스트 없이 직행 */
function ReportButton({ taskId }: { taskId: string }) {
  const reportMutation = useAssessmentReport();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="결과지 보기"
      disabled={reportMutation.isPending}
      onPress={() =>
        reportMutation.mutate(taskId, {
          onSuccess: (report) => {
            Linking.openURL(report.download_url);
          },
        })
      }
      style={({ pressed }) => ({
        opacity: reportMutation.isPending ? 0.5 : pressed ? 0.88 : 1,
      })}
    >
      <View
        className="mt-3 items-center justify-center rounded-xl"
        style={{ height: s(48), backgroundColor: COLORS.tag.teal.bg }}
      >
        <Typography variant="body-03" weight="semibold" style={{ color: COLORS.tag.teal.fg }}>
          결과지 보기
        </Typography>
      </View>
    </Pressable>
  );
}

export default function AssessmentCaseScreen() {
  const router = useRouter();
  const { caseId, profileId } = useLocalSearchParams<{
    caseId: string;
    profileId: string;
  }>();
  const progressQuery = useProfileProgress(profileId ?? null);
  const item = progressQuery.data?.assessments.find((a) => a.case_id === caseId);
  const refreshControl = useRefreshControl(() => progressQuery.refetch());
  const phase = item ? assessmentPhaseInfo(item) : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-[52px] flex-row items-center px-4" style={{ columnGap: s(8) }}>
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        ) : null}
        <Typography
          variant="title-01"
          weight="semibold"
          numberOfLines={1}
          className="flex-1"
          style={{ color: COLORS.text.title.default }}
        >
          {item?.name ?? '검사'}
        </Typography>
      </View>

      {progressQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : progressQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => progressQuery.refetch()} />
      ) : !item || !phase ? (
        <EmptyView className="flex-1" title="검사 정보를 찾을 수 없어요" />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ padding: 16, paddingBottom: s(32) }}
        >
          {/* 배송 스테퍼 */}
          <View className="rounded-2xl bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Typography
                variant="body-03"
                numberOfLines={1}
                className="mr-3 flex-1"
                style={{ color: COLORS.text.caption.default }}
              >
                {item.center_name}
                {item.total_count > 1 ? ` · ${item.total_count}종` : ''}
              </Typography>
              <Badge shape="rect" color="teal" label={phase.label} />
            </View>
            <AssessmentStepper step={phase.step} />
          </View>

          {/* 단건 검사(1종) — 체크리스트 생략(케이스명과 중복), 결과지 도착 시에만 액션 카드 */}
          {item.tasks.length === 1 && item.tasks[0].report_visible ? (
            <View className="mt-3 rounded-2xl bg-surface p-4">
              <View
                className="rounded-xl px-3 py-2.5"
                style={{ backgroundColor: COLORS.gray[50] }}
              >
                <Typography variant="label-01" style={{ color: COLORS.text.caption.default }}>
                  결과지는 상담사 선생님의 설명과 함께 보시는 걸 권해요
                </Typography>
              </View>
              <ReportButton taskId={item.tasks[0].task_id} />
            </View>
          ) : null}

          {/* 검사 목록 (세트) */}
          {item.tasks.length > 1 ? (
            <View className="mt-3 rounded-2xl bg-surface p-4">
              <View className="flex-row items-center justify-between">
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default }}
                >
                  검사
                </Typography>
                {item.total_count > 0 ? (
                  <Typography variant="label-01" style={{ color: COLORS.text.caption.default }}>
                    {item.completed_count}/{item.total_count} 완료
                  </Typography>
                ) : null}
              </View>
              <View className="mt-2">
                {item.tasks.map((task, index) => (
                  <TaskRow key={task.task_id} task={task} isFirst={index === 0} />
                ))}
              </View>

              {/* 임상 톤 안내 — 기간 약속 없이, 상담 연결만 */}
              <View
                className="mt-3 rounded-xl px-3 py-2.5"
                style={{ backgroundColor: COLORS.gray[50] }}
              >
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.text.caption.default }}
                >
                  결과지는 상담사 선생님의 설명과 함께 보시는 걸 권해요
                </Typography>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
