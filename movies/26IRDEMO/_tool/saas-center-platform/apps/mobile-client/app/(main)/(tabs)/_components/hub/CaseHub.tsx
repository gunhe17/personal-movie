/**
 * 여정 허브 — 활동 탭 표면 (활동 탭 기획 G★).
 *
 * 층 구조: 새 소식(조건부) → 요약 3칩 → 행동 우선 정렬 아코디언.
 * 상담·검사는 같은 목록에 섞이고 행 모양이 유형을 말한다(도트 트랙 vs 배송 스테퍼).
 * 축약 행 탭 = 펼침(동시 1개), 펼친 카드 헤더 탭 = 케이스 상세(L1) push.
 * 케이스 1개면 요약 스트립을 숨기고 그 카드를 상시 펼친다.
 */
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { differenceInCalendarDays } from 'date-fns';
import type {
  AssessmentProgress,
  CounselingProgress,
  ProfileProgress,
} from '@/features/progress';
import { useAssessmentReport } from '@/features/progress';
import {
  assessmentPhaseInfo,
  isCaseFinished,
  sortCounselingByImminence,
} from '@/features/progress/garden';
import { isTaskDone, taskStatusLabel } from '@/features/progress/constants';
import { Badge, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatKst, nowKst, toKst } from '@/shared/utils/date';
import { formatDateLabel, formatTime } from '@/shared/utils/format';
import { JourneyTrail } from '../garden/JourneyTrail';
import { AssessmentStepper, MiniStepper } from '../garden/AssessmentStepper';

// ───────────────────────── 정렬 — 행동 우선 ─────────────────────────

type HubCase =
  | { kind: 'counseling'; key: string; counseling: CounselingProgress }
  | { kind: 'assessment'; key: string; assessment: AssessmentProgress };

/**
 * ① 새 결과지 → ② 오늘·내일 일정 → ③ 다음 일정 가까운 순 →
 * ④ 대기(실시 중 · 결과 준비 중 · 일정 미정) → ⑤ 완주/종결
 */
function sortKey(hubCase: HubCase): [number, string] {
  if (hubCase.kind === 'assessment') {
    const phase = assessmentPhaseInfo(hubCase.assessment).phase;
    if (phase === 'arrived') return [0, ''];
    if (phase === 'testing') return [3, '0'];
    if (phase === 'preparing') return [3, '1'];
    return [3, '3']; // scheduled
  }
  const item = hubCase.counseling;
  if (isCaseFinished(item)) return [4, ''];
  if (!item.next_session_at) return [3, '2'];
  const diff = differenceInCalendarDays(toKst(item.next_session_at), nowKst());
  return [diff <= 1 ? 1 : 2, item.next_session_at];
}

function buildCases(progress: ProfileProgress): HubCase[] {
  const cases: HubCase[] = [
    ...sortCounselingByImminence(progress.counseling).map(
      (item): HubCase => ({
        kind: 'counseling',
        key: `c-${item.case_id}`,
        counseling: item,
      }),
    ),
    ...progress.assessments.map(
      (item): HubCase => ({
        kind: 'assessment',
        key: `a-${item.case_id}`,
        assessment: item,
      }),
    ),
  ];
  return cases.sort((a, b) => {
    const [ga, ta] = sortKey(a);
    const [gb, tb] = sortKey(b);
    if (ga !== gb) return ga - gb;
    return ta.localeCompare(tb);
  });
}

// ───────────────────────── 조각들 ─────────────────────────

function counselingCountLabel(item: CounselingProgress): string {
  const total = item.total_sessions;
  if (isCaseFinished(item)) return '완주';
  if (total == null || total <= 0)
    return `${item.completed_sessions}회 진행 중`;
  return `${item.completed_sessions}/${total}회`;
}

/** 상담 축약 행의 미니 트랙 — 접힌 절대 창(최근 완료≤3 · 다음 · 직후) */
function MiniTrack({ item }: { item: CounselingProgress }) {
  const finished = isCaseFinished(item);
  const total = item.total_sessions;
  const done = Math.min(item.completed_sessions, 3);
  const hasNext =
    !finished && (total == null || item.completed_sessions < total);
  const open = total == null || total <= 0;
  const hasFuture =
    !open && !finished && item.completed_sessions + 2 <= (total ?? 0);

  const dot = (key: string, color: string, ring = false) => (
    <View
      key={key}
      style={{
        width: s(9),
        height: s(9),
        borderRadius: s(4.5),
        backgroundColor: ring ? COLORS.white : color,
        borderWidth: ring ? s(2.5) : 0,
        borderColor: color,
      }}
    />
  );

  return (
    <View className="flex-row items-center" style={{ columnGap: s(4) }}>
      {Array.from({ length: done }).map((_, i) =>
        dot(`d${i}`, COLORS.brand[500]),
      )}
      {hasNext ? dot('next', COLORS.brand[500], true) : null}
      {hasFuture ? dot('future', COLORS.gray[200]) : null}
      {open && hasNext
        ? [0.55, 0.28].map((opacity, i) => (
            <View
              key={`dash${i}`}
              style={{
                width: s(10),
                height: s(2.5),
                borderRadius: s(1.5),
                backgroundColor: COLORS.brand[300],
                opacity,
              }}
            />
          ))
        : null}
    </View>
  );
}

/** 아코디언 셸 — 펼침/접힘 크기 변화와 형제 카드 재배치를 레이아웃 전환으로 */
function CardShell({
  children,
  onPress,
  expanded,
}: {
  children: React.ReactNode;
  onPress: () => void;
  expanded: boolean;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <View
          className="overflow-hidden rounded-2xl bg-surface"
          style={{ padding: expanded ? s(16) : undefined }}
        >
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** 단건 검사의 결과지 직행 버튼 — 체크리스트 없이 바로 열람 */
function SingleReportButton({ taskId }: { taskId: string }) {
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
        style={{ height: s(44), backgroundColor: COLORS.tag.teal.bg }}
      >
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.tag.teal.fg }}
        >
          결과지 보기
        </Typography>
      </View>
    </Pressable>
  );
}

/** 펼친 카드 하단의 상세 진입 링크 — 카드 탭은 접힘 토글이므로 진입은 명시적으로 */
function DetailLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="자세히 보기"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View
        className="mt-3.5 flex-row items-center justify-center"
        style={{ columnGap: 2 }}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.text.caption.default }}
        >
          자세히 보기
        </Typography>
        <Ionicons name="chevron-forward" size={12} color={COLORS.gray[400]} />
      </View>
    </Pressable>
  );
}

/** 펼친 카드의 메타 스트립 — 하어라인으로 나뉜 라벨/값 컬럼 */
function MetaRow({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;
  return (
    <View
      className="mt-3.5 flex-row rounded-xl"
      style={{ backgroundColor: COLORS.gray[50], paddingVertical: s(9) }}
    >
      {items.map((meta, index) => (
        <View
          key={meta.label}
          className="flex-1 items-center"
          style={{
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: COLORS.gray[100],
          }}
        >
          <Typography
            variant="caption-01"
            style={{ color: COLORS.text.caption.subtle }}
          >
            {meta.label}
          </Typography>
          <Typography
            variant="body-03"
            weight="semibold"
            className="mt-0.5"
            style={{ color: COLORS.text.title.default }}
          >
            {meta.value}
          </Typography>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── 메인 ─────────────────────────

interface CaseHubProps {
  progress: ProfileProgress;
  onOpenCounseling: (caseId: string) => void;
  onOpenAssessment: (caseId: string) => void;
}

export function CaseHub({
  progress,
  onOpenCounseling,
  onOpenAssessment,
}: CaseHubProps) {
  const router = useRouter();
  const cases = buildCases(progress);
  // null = 기본(최상위 자동 펼침) · NONE = 전부 접힘 · key = 해당 카드 펼침
  const NONE = '__collapsed__';
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const activeKey =
    expandedKey === NONE ? null : (expandedKey ?? cases[0]?.key ?? null);

  // 새 소식 — 도착한 결과지 (읽음 처리 전까지 노출)
  const arrivedTasks = progress.assessments.flatMap((assessment) =>
    assessment.tasks
      .filter((task) => task.report_visible)
      .map((task) => ({ task, assessment })),
  );
  const news = arrivedTasks[0] ?? null;

  const activeCount =
    progress.counseling.filter((c) => !isCaseFinished(c)).length +
    progress.assessments.length;
  const weekCount = progress.counseling.filter((c) => {
    if (!c.next_session_at) return false;
    const diff = differenceInCalendarDays(toKst(c.next_session_at), nowKst());
    return diff >= 0 && diff <= 6;
  }).length;

  return (
    <View style={{ rowGap: s(8) }}>
      {news ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="도착한 결과지 보기"
          onPress={() => onOpenAssessment(news.assessment.case_id)}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <View
            className="flex-row items-center rounded-2xl px-3.5 py-3"
            style={{ columnGap: s(10), backgroundColor: COLORS.tag.teal.bg }}
          >
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: s(30),
                height: s(30),
                backgroundColor: COLORS.tag.teal.fg,
              }}
            >
              <Ionicons name="document-text" size={15} color={COLORS.white} />
            </View>
            <View className="flex-1">
              <Typography
                variant="label-01"
                weight="semibold"
                numberOfLines={1}
                style={{ color: COLORS.text.title.default }}
              >
                {`${news.task.name} 결과지가 도착했어요${
                  arrivedTasks.length > 1
                    ? ` 외 ${arrivedTasks.length - 1}건`
                    : ''
                }`}
              </Typography>
              <Typography
                variant="label-02"
                style={{ color: COLORS.text.caption.default }}
              >
                {news.assessment.name}
              </Typography>
            </View>
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.tag.teal.fg }}
            >
              보기
            </Typography>
          </View>
        </Pressable>
      ) : null}

      {/* 요약 3칩 — G-① 목업. 케이스 1개면 화면 자체가 답이라 숨긴다 */}
      {cases.length > 1 ? (
        <View className="flex-row" style={{ columnGap: s(8) }}>
          {[
            { label: '진행 중', value: activeCount, accent: false },
            { label: '이번 주 일정', value: weekCount, accent: weekCount > 0 },
            {
              label: '새 결과지',
              value: arrivedTasks.length,
              accent: arrivedTasks.length > 0,
            },
          ].map((stat) => (
            <View
              key={stat.label}
              className="flex-1 items-center rounded-2xl bg-surface"
              style={{ paddingVertical: s(9) }}
            >
              <Typography
                variant="title-01"
                weight="semibold"
                style={{
                  color: stat.accent
                    ? COLORS.brand[500]
                    : COLORS.text.title.default,
                }}
              >
                {stat.value}
              </Typography>
              <Typography
                variant="caption-01"
                style={{ color: COLORS.text.caption.default }}
              >
                {stat.label}
              </Typography>
            </View>
          ))}
        </View>
      ) : null}

      {cases.map((hubCase) => {
        const expanded = hubCase.key === activeKey;
        if (hubCase.kind === 'counseling') {
          const item = hubCase.counseling;
          if (!expanded) {
            return (
              <CardShell
                key={hubCase.key}
                expanded={false}
                onPress={() => setExpandedKey(hubCase.key)}
              >
                <View
                  className="flex-row items-center"
                  style={{
                    columnGap: s(8),
                    paddingHorizontal: s(16),
                    paddingVertical: s(15),
                  }}
                >
                  <View className="flex-1">
                    <Typography
                      variant="body-02"
                      weight="semibold"
                      numberOfLines={1}
                      style={{ color: COLORS.text.title.default }}
                    >
                      {item.counseling_type ?? '상담'}
                    </Typography>
                    <Typography
                      variant="label-01"
                      className="mt-0.5"
                      style={{ color: COLORS.text.caption.default }}
                    >
                      {counselingCountLabel(item)}
                      {item.next_session_at
                        ? ` · 다음 ${formatDateLabel(item.next_session_at)}`
                        : ''}
                    </Typography>
                  </View>
                  <MiniTrack item={item} />
                  <Ionicons
                    name="chevron-down"
                    size={12}
                    color={COLORS.gray[300]}
                  />
                </View>
              </CardShell>
            );
          }
          const nextRound =
            item.sessions.find(
              (sess) => sess.scheduled_at === item.next_session_at,
            )?.round ?? null;
          const lastDone = item.sessions
            .filter((sess) => sess.status === 'completed' && sess.scheduled_at)
            .sort((a, b) =>
              (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''),
            )[0];
          const metaItems = [
            lastDone?.scheduled_at
              ? {
                  label: '지난 회기',
                  value: formatKst(lastDone.scheduled_at, 'M/d'),
                }
              : null,
            item.started_at
              ? {
                  label: '함께한 지',
                  value: `${Math.max(
                    1,
                    Math.floor(
                      differenceInCalendarDays(
                        nowKst(),
                        toKst(item.started_at),
                      ) / 7,
                    ) + 1,
                  )}주차`,
                }
              : null,
            item.total_sessions &&
            item.total_sessions > 0 &&
            !isCaseFinished(item)
              ? {
                  label: '남은 회기',
                  value: `${item.total_sessions - item.completed_sessions}회`,
                }
              : null,
          ].filter(Boolean) as { label: string; value: string }[];
          return (
            <CardShell
              key={hubCase.key}
              expanded
              onPress={() => setExpandedKey(NONE)}
            >
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1">
                  <Typography
                    variant="body-01"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ color: COLORS.text.title.default }}
                  >
                    {item.counseling_type ?? '상담'}
                  </Typography>
                  {item.counselor_name || item.center_name ? (
                    <Typography
                      variant="label-01"
                      numberOfLines={1}
                      className="mt-0.5"
                      style={{ color: COLORS.text.caption.default }}
                    >
                      {[item.counselor_name, item.center_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  ) : null}
                </View>
                <Badge
                  shape="rect"
                  color="green"
                  label={counselingCountLabel(item)}
                />
              </View>

              <Animated.View entering={FadeIn.duration(180)}>
                <JourneyTrail
                  completed={item.completed_sessions}
                  total={item.total_sessions}
                />

                <MetaRow items={metaItems} />

                {item.next_session_at ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="일정 탭에서 보기"
                    onPress={() => router.push('/(main)/(tabs)/schedule')}
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <View
                      className="mt-4 flex-row items-center rounded-xl px-3 py-2.5"
                      style={{
                        columnGap: s(8),
                        backgroundColor: COLORS.brand[50],
                      }}
                    >
                      <View
                        className="items-center justify-center rounded-full"
                        style={{
                          width: s(26),
                          height: s(26),
                          backgroundColor: COLORS.brand[500],
                        }}
                      >
                        <Ionicons name="play" size={12} color={COLORS.white} />
                      </View>
                      <View className="flex-1">
                        <Typography
                          variant="label-01"
                          weight="semibold"
                          style={{ color: COLORS.text.title.default }}
                        >
                          {`다음 회기${nextRound != null ? ` — ${nextRound}회차` : ''}`}
                        </Typography>
                        <Typography
                          variant="label-02"
                          style={{ color: COLORS.text.caption.default }}
                        >
                          {`${formatDateLabel(item.next_session_at)} ${formatTime(item.next_session_at)}`}
                        </Typography>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={COLORS.gray[400]}
                      />
                    </View>
                  </Pressable>
                ) : !isCaseFinished(item) ? (
                  // 다음 일정 미정 — 빈자리 대신 이유를 말해준다 (G★ 엣지 규칙)
                  <View
                    className="mt-4 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: COLORS.gray[50] }}
                  >
                    <Typography
                      variant="label-01"
                      style={{ color: COLORS.text.caption.default }}
                    >
                      다음 일정이 잡히면 여기에서 알려드릴게요
                    </Typography>
                  </View>
                ) : null}

                <DetailLink onPress={() => onOpenCounseling(item.case_id)} />
              </Animated.View>
            </CardShell>
          );
        }

        const item = hubCase.assessment;
        const phase = assessmentPhaseInfo(item);
        if (!expanded) {
          return (
            <CardShell
              key={hubCase.key}
              expanded={false}
              onPress={() => setExpandedKey(hubCase.key)}
            >
              <View
                className="flex-row items-center"
                style={{
                  columnGap: s(8),
                  paddingHorizontal: s(16),
                  paddingVertical: s(15),
                }}
              >
                <View className="flex-1">
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ color: COLORS.text.title.default }}
                  >
                    {item.name}
                  </Typography>
                  <Typography
                    variant="label-01"
                    className="mt-0.5"
                    style={{
                      color:
                        phase.phase === 'arrived'
                          ? COLORS.tag.teal.fg
                          : COLORS.text.caption.default,
                    }}
                  >
                    {phase.label}
                  </Typography>
                </View>
                <MiniStepper step={phase.step} />
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={COLORS.gray[300]}
                />
              </View>
            </CardShell>
          );
        }
        return (
          <CardShell
            key={hubCase.key}
            expanded
            onPress={() => setExpandedKey(NONE)}
          >
            <View className="flex-row items-center justify-between">
              <View className="mr-3 flex-1">
                <Typography
                  variant="body-01"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ color: COLORS.text.title.default }}
                >
                  {item.name}
                </Typography>
                <Typography
                  variant="label-01"
                  numberOfLines={1}
                  className="mt-0.5"
                  style={{ color: COLORS.text.caption.default }}
                >
                  {item.center_name}
                  {item.total_count > 1 ? ` · ${item.total_count}종` : ''}
                </Typography>
              </View>
              <Badge shape="rect" color="teal" label={phase.label} />
            </View>

            <Animated.View entering={FadeIn.duration(180)}>
              <AssessmentStepper step={phase.step} />

              {/* 단건 검사(1종)는 체크리스트 생략 — 이름 중복 방지, 결과지 직행 버튼만 */}
              {item.tasks.length === 1 && item.tasks[0].report_visible ? (
                <SingleReportButton taskId={item.tasks[0].task_id} />
              ) : null}

              {item.tasks.length > 1 ? (
                <View className="mt-3">
                  <View className="flex-row items-center justify-between pb-1">
                    <Typography
                      variant="label-01"
                      weight="semibold"
                      style={{ color: COLORS.text.title.default }}
                    >
                      검사
                    </Typography>
                    {item.total_count > 0 ? (
                      <Typography
                        variant="label-02"
                        style={{ color: COLORS.text.caption.default }}
                      >
                        {item.completed_count}/{item.total_count} 실시
                      </Typography>
                    ) : null}
                  </View>
                  {item.tasks.slice(0, 3).map((task, index) => (
                    <View
                      key={task.task_id}
                      className="flex-row items-center justify-between py-2"
                      style={{
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: COLORS.gray[100],
                      }}
                    >
                      <Typography
                        variant="body-03"
                        numberOfLines={1}
                        className="mr-3 flex-1"
                        style={{ color: COLORS.text.body.default }}
                      >
                        {task.name}
                      </Typography>
                      <Typography
                        variant="label-02"
                        weight={task.report_visible ? 'semibold' : 'regular'}
                        style={{
                          color: task.report_visible
                            ? COLORS.tag.teal.fg
                            : COLORS.text.caption.subtle,
                        }}
                      >
                        {task.report_visible
                          ? '결과지 보기'
                          : isTaskDone(task.status)
                            ? '준비 중'
                            : taskStatusLabel(task.status)}
                      </Typography>
                    </View>
                  ))}
                  {item.tasks.length > 3 ? (
                    <Typography
                      variant="label-02"
                      className="pt-1"
                      style={{ color: COLORS.text.caption.subtle }}
                    >
                      외 {item.tasks.length - 3}개 — 자세히 보기에서 확인
                    </Typography>
                  ) : null}
                </View>
              ) : null}

              {/* 임상 톤 안내 — 결과지 도착 시에만 */}
              {phase.phase === 'arrived' ? (
                <View
                  className="mt-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: COLORS.gray[50] }}
                >
                  <Typography
                    variant="label-02"
                    style={{ color: COLORS.text.caption.default }}
                  >
                    결과지는 상담사 선생님의 설명과 함께 보시는 걸 권해요
                  </Typography>
                </View>
              ) : null}

              <DetailLink onPress={() => onOpenAssessment(item.case_id)} />
            </Animated.View>
          </CardShell>
        );
      })}
    </View>
  );
}
