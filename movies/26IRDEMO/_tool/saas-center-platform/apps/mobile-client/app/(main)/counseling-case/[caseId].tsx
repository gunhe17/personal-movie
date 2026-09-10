/**
 * 상담 케이스 상세 (L1 · push) — 피그마 382:5236 "상세/상담".
 *
 * 블루 테마 헤더(치료명 + 블록 일러스트) → 다가오는 상담 카드 → 진행 현황 카드
 * (바우처 헤더 + 담당자 + 진행바) → 흰 시트로 올라오는 상담 기록(회기) 목록.
 * 회기 행은 센터가 상담 내용을 공유한 것만 눌린다(공유 전에는 앱에 내용이 없다).
 */
import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { differenceInCalendarDays } from "date-fns";
import { ko } from "date-fns/locale";
import { SessionShareSheet, useProfileProgress } from "@/features/progress";
import type { ProgressSession } from "@/features/progress";
import { useProfiles } from "@/features/profile";
import {
  Avatar,
  Badge,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
  type BadgeColor,
} from "@/shared/components/ui";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { formatKst, nowKst, toKst } from "@/shared/utils/date";
import { formatDateLabel, formatTime } from "@/shared/utils/format";
import { useRefreshControl } from "@/shared/hooks/useRefreshControl";
import VoucherIcon20 from "@assets/icons/20/VoucherIcon20.svg";

function ddayLabel(iso: string): string {
  const diff = differenceInCalendarDays(toKst(iso), nowKst());
  if (diff <= 0) return "오늘";
  return `D-${diff}`;
}

/** 회기 상태 → 배지 라벨·색 (완료 green · 취소 red · 그 외 중립) */
function sessionBadge(status: string): { label: string; color: BadgeColor } {
  switch (status) {
    case "completed":
      return { label: "완료", color: "green" };
    case "cancelled":
    case "canceled":
      return { label: "취소", color: "red" };
    case "no_show":
      return { label: "미진행", color: "gray" };
    case "in_progress":
      return { label: "진행 중", color: "blue" };
    default:
      return { label: "예정", color: "gray" };
  }
}

/** 회기 일시 — `5월 6일 (수) 13:00 - 14:00` (일정 미정이면 그 문구) */
function sessionWhen(session: ProgressSession): string {
  if (!session.scheduled_at) return "일정 미정";
  const time =
    formatTime(session.scheduled_at) +
    (session.end_at ? ` - ${formatTime(session.end_at)}` : "");
  return `${formatDateLabel(session.scheduled_at)} ${time}`;
}

export default function CounselingCaseScreen() {
  const router = useRouter();
  const { caseId, profileId } = useLocalSearchParams<{
    caseId: string;
    profileId: string;
  }>();
  const progressQuery = useProfileProgress(profileId ?? null);
  const item = progressQuery.data?.counseling.find((c) => c.case_id === caseId);
  const refreshControl = useRefreshControl(() => progressQuery.refetch());

  const profilesQuery = useProfiles();
  const avatarUrl =
    profilesQuery.data?.find((p) => p.id === profileId)?.image_url ?? null;

  const [sharedSession, setSharedSession] = useState<ProgressSession | null>(
    null,
  );

  const sessions = useMemo(
    () => (item ? [...item.sessions].sort((a, b) => b.round - a.round) : []),
    [item],
  );

  const nextSession = useMemo(() => {
    if (!item?.next_session_at) return null;
    return (
      item.sessions.find(
        (sess) => sess.scheduled_at === item.next_session_at,
      ) ?? null
    );
  }, [item]);

  const total = item?.total_sessions ?? null;
  const completed = item?.completed_sessions ?? 0;
  const remaining = total != null ? Math.max(total - completed, 0) : 0;
  const progressPct = total && total > 0 ? Math.min(completed / total, 1) : 0;

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: COLORS.brand[50] }}
    >
      {/* 헤더 — 블루 배경, 뒤로가기만 (제목은 본문에) */}
      <View
        className="h-12 flex-row items-center px-4"
        style={{ backgroundColor: COLORS.brand[50] }}
      >
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
      </View>

      {progressQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : progressQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => progressQuery.refetch()} />
      ) : !item ? (
        <EmptyView className="flex-1" title="상담 정보를 찾을 수 없어요" />
      ) : (
        <ScrollView
          className="flex-1"
          style={{ backgroundColor: COLORS.brand[50] }}
          refreshControl={refreshControl}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ───────── 블루 섹션 — 제목 + 카드들 ───────── */}
          <View
            style={{
              backgroundColor: COLORS.brand[50],
              paddingHorizontal: s(16),
              paddingTop: s(12),
              paddingBottom: s(28),
            }}
          >
            {/* 블록 일러스트 — 우상단 (콘텐츠성 장식) */}
            <Image
              source={require("@assets/images/counseling-detail/blocks.png")}
              style={{
                position: "absolute",
                right: s(10),
                top: -s(4),
                width: s(96),
                height: s(96),
              }}
              resizeMode="contain"
            />

            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {item.counseling_type ?? "상담"}
            </Typography>

            {/* 다가오는 상담 카드 */}
            {item.next_session_at ? (
              <View
                style={[
                  {
                    marginTop: s(16),
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.action["primary-subtle"],
                    borderRadius: s(20),
                    padding: s(20),
                    rowGap: s(16),
                  },
                  SHADOWS.card,
                ]}
              >
                <View style={{ rowGap: s(8) }}>
                  <View className="flex-row items-center justify-between">
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      다가오는 상담
                    </Typography>
                    <Badge
                      shape="pill"
                      color="teal"
                      label={ddayLabel(item.next_session_at)}
                    />
                  </View>
                  <View style={{ rowGap: s(8) }}>
                    <Typography
                      variant="headline-02"
                      weight="semibold"
                      style={{ color: COLORS.text.body.strong }}
                    >
                      {formatKst(item.next_session_at, "M월 d일 EEEE")}
                    </Typography>
                    <View style={{ rowGap: s(4) }}>
                      {item.center_name ? (
                        <Typography
                          variant="body-02"
                          style={{ color: COLORS.text.body.default }}
                        >
                          {item.center_name}
                        </Typography>
                      ) : null}
                      <Typography
                        variant="body-02-reading"
                        style={{ color: COLORS.text.body.default }}
                      >
                        {[
                          formatTime(
                            nextSession?.scheduled_at ?? item.next_session_at,
                          ) +
                            (nextSession?.end_at
                              ? ` - ${formatTime(nextSession.end_at)}`
                              : ""),
                          nextSession?.room_name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
                    </View>
                  </View>
                </View>

                <Button
                  label="기록 공유"
                  variant="assistive"
                  size="md"
                  icon={
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={16}
                      color={COLORS.text.title.subtle}
                    />
                  }
                  onPress={() => router.push("/(main)/(tabs)/records")}
                />
              </View>
            ) : null}

            {/* 진행 현황 카드 — 바우처 헤더(있으면) + 담당자 + 진행바 */}
            <View style={{ marginTop: s(16) }}>
              {item.voucher_name ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/(main)/vouchers")}
                  style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                >
                  <View
                    className="flex-row items-center justify-between"
                    style={{
                      backgroundColor: COLORS.bg.emphasis,
                      borderTopLeftRadius: s(12),
                      borderTopRightRadius: s(12),
                      paddingHorizontal: s(12),
                      paddingVertical: s(10),
                    }}
                  >
                    <View
                      className="flex-1 flex-row items-center"
                      style={{ columnGap: s(4) }}
                    >
                      <VoucherIcon20 width={20} height={20} />
                      <Typography
                        variant="body-03"
                        weight="medium"
                        numberOfLines={1}
                        style={{ color: COLORS.text.state.inverse }}
                      >
                        {item.voucher_name}
                      </Typography>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.white}
                    />
                  </View>
                </Pressable>
              ) : null}

              <View
                style={[
                  {
                    backgroundColor: COLORS.surface,
                    borderWidth: 1,
                    borderColor: COLORS.border.subtle,
                    borderTopLeftRadius: item.voucher_name ? 0 : s(12),
                    borderTopRightRadius: item.voucher_name ? 0 : s(12),
                    borderBottomLeftRadius: s(12),
                    borderBottomRightRadius: s(12),
                    paddingHorizontal: s(16),
                    paddingTop: s(20),
                    paddingBottom: s(16),
                    rowGap: s(20),
                  },
                  SHADOWS.card,
                ]}
              >
                {/* 담당자 */}
                <View
                  className="flex-row items-center"
                  style={{ columnGap: s(12) }}
                >
                  <Avatar uri={avatarUrl} size={s(44)} />
                  <View className="flex-1" style={{ rowGap: s(4) }}>
                    {item.center_name ? (
                      <Typography
                        variant="body-03"
                        numberOfLines={1}
                        style={{ color: COLORS.text.body.default }}
                      >
                        {item.center_name}
                      </Typography>
                    ) : null}
                    <Typography
                      variant="body-02"
                      weight="medium"
                      numberOfLines={1}
                      style={{ color: COLORS.text.title.default }}
                    >
                      {item.counselor_name
                        ? `${item.counselor_name} 선생님과 함께 하는 중`
                        : "함께 하는 중"}
                    </Typography>
                  </View>
                </View>

                {/* 진행바 — 회기 수만큼 세그먼트 (완료 채움 · 나머지 회색) */}
                {total && total > 0 ? (
                  <View
                    style={{
                      backgroundColor: COLORS.bg.base,
                      borderRadius: s(12),
                      padding: s(12),
                      rowGap: s(12),
                    }}
                  >
                    <View className="relative">
                      <View className="flex-row" style={{ columnGap: s(4) }}>
                        {Array.from({ length: total }).map((_, i) => (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              height: s(6),
                              borderRadius: s(100),
                              backgroundColor:
                                i < completed
                                  ? COLORS.brand[500]
                                  : COLORS.gray[300],
                            }}
                          />
                        ))}
                      </View>
                      {/* 현재 위치 마커 — 채움 경계에 떠 있는 내담자 아바타 + 아래 꼬리 */}
                      {completed > 0 && completed < total ? (
                        <View
                          pointerEvents="none"
                          className="absolute items-center"
                          style={{
                            left: `${progressPct * 100}%`,
                            top: -s(30),
                            marginLeft: -s(16),
                          }}
                        >
                          <View
                            className="items-center justify-center rounded-full"
                            style={[
                              {
                                width: s(32),
                                height: s(32),
                                padding: s(2),
                                backgroundColor: COLORS.white,
                              },
                              SHADOWS.card,
                            ]}
                          >
                            <Avatar uri={avatarUrl} size={s(28)} />
                          </View>
                          <View
                            style={{
                              width: s(9),
                              height: s(9),
                              marginTop: -s(5),
                              backgroundColor: COLORS.white,
                              transform: [{ rotate: "45deg" }],
                            }}
                          />
                        </View>
                      ) : null}
                    </View>
                    <View
                      className="flex-row items-center"
                      style={{ columnGap: s(4) }}
                    >
                      <Typography
                        variant="body-03"
                        style={{ color: COLORS.text.body.subtle }}
                      >
                        {`${completed}/${total} 회기`}
                      </Typography>
                      {remaining > 0 ? (
                        <Typography
                          variant="body-03"
                          weight="medium"
                          style={{ color: COLORS.text.state.brand }}
                        >
                          {`앞으로 ${remaining}회 남았어요`}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body-03"
                          weight="medium"
                          style={{ color: COLORS.text.state.brand }}
                        >
                          모든 회기를 마쳤어요
                        </Typography>
                      )}
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: COLORS.bg.base,
                      borderRadius: s(12),
                      padding: s(12),
                    }}
                  >
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.state.brand }}
                    >
                      {`${completed}회 진행 중`}
                    </Typography>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ───────── 흰 시트 — 상담 기록(회기) 목록 ───────── */}
          <View
            style={{
              flexGrow: 1,
              backgroundColor: COLORS.surface,
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              marginTop: -s(16),
              paddingTop: s(28),
              paddingHorizontal: s(16),
              paddingBottom: s(40),
            }}
          >
            <View className="flex-row items-center" style={{ columnGap: s(4) }}>
              <Typography
                variant="title-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                상담 기록
              </Typography>
              <Typography
                variant="body-03"
                style={{ color: COLORS.text.body.default }}
              >
                {sessions.length}
              </Typography>
            </View>

            {sessions.length > 0 ? (
              <View style={{ marginTop: s(8) }}>
                {sessions.map((session, index) => {
                  const badge = sessionBadge(session.status);
                  const hasShare = !!session.share;
                  return (
                    <Pressable
                      key={session.session_id}
                      disabled={!hasShare}
                      onPress={() => setSharedSession(session)}
                      style={({ pressed }) => ({
                        opacity: pressed && hasShare ? 0.6 : 1,
                      })}
                    >
                      <View
                        className="flex-row items-center"
                        style={{
                          columnGap: s(8),
                          paddingVertical: s(16),
                          paddingHorizontal: s(4),
                          borderBottomWidth:
                            index === sessions.length - 1 ? 0 : 1,
                          borderBottomColor: COLORS.border.subtle,
                        }}
                      >
                        <View className="flex-1" style={{ rowGap: s(4) }}>
                          <Typography
                            variant="body-02"
                            weight="semibold"
                            style={{ color: COLORS.text.body.strong }}
                          >
                            {`${session.round}회기`}
                          </Typography>
                          <Typography
                            variant="body-03"
                            weight="medium"
                            style={{ color: COLORS.text.body.subtle }}
                          >
                            {sessionWhen(session)}
                          </Typography>
                          {hasShare ? (
                            <Typography
                              variant="label-02"
                              weight="medium"
                              style={{ color: COLORS.button.primary.bg }}
                            >
                              상담 내용 보기
                            </Typography>
                          ) : null}
                        </View>
                        <Badge
                          shape="rect"
                          color={badge.color}
                          label={badge.label}
                        />
                        {hasShare ? (
                          <Ionicons
                            name="chevron-forward"
                            size={s(16)}
                            color={COLORS.icon.tertiary}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <EmptyView
                className="py-8"
                title="아직 상담 기록이 없어요"
                description="회기가 진행되면 여기에 쌓여요"
              />
            )}
          </View>
        </ScrollView>
      )}

      <SessionShareSheet
        visible={!!sharedSession}
        onClose={() => setSharedSession(null)}
        session={sharedSession}
      />
    </SafeAreaView>
  );
}
