import React, { useMemo } from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { useAuthStore, useMe } from "@/features/auth";
import { useUnreadCount } from "@/features/notification";
import { useSchedules } from "@/features/schedule";
import { ErrorView, LoadingView, Typography } from "@/shared/components/ui";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { kstToServerDateTime, nowKst } from "@/shared/utils/date";
import { useTabBarClearance } from "@/shared/hooks/useTabBarClearance";
import {
  refetchIfFetched,
  useRefreshControl,
} from "@/shared/hooks/useRefreshControl";
import { LinkedHome } from "./_components/LinkedHome";
import { UnlinkedHome } from "./_components/UnlinkedHome";
import { TabHeader } from "./_components/TabHeader";

export default function HomeScreen() {
  const unreadQuery = useUnreadCount();
  const tabClearance = useTabBarClearance();
  const meQuery = useMe(); // 게스트는 비활성
  const me = meQuery.data;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const activeLinks = useMemo(
    () => me?.links.filter((link) => link.status === "active") ?? [],
    [me],
  );
  const isLinked = activeLinks.length > 0;

  // 미연결 홈의 지원 확인 플로우 — 자녀 프로필이 있으면 아이 정보를 다시 묻지 않는다
  const childProfile = useMemo(
    () =>
      (me?.profiles ?? []).find(
        (p) => p.relation === "child" && p.birth_date,
      ) ?? null,
    [me],
  );

  // 오늘 ~ +14일
  const range = useMemo(() => {
    const now = nowKst();
    return {
      start: kstToServerDateTime(startOfDay(now)),
      end: kstToServerDateTime(endOfDay(addDays(now, 14))),
    };
  }, []);
  const schedulesQuery = useSchedules(range.start, range.end, isLinked);

  const refreshControl = useRefreshControl(() =>
    Promise.all([
      refetchIfFetched(meQuery),
      refetchIfFetched(unreadQuery),
      refetchIfFetched(schedulesQuery),
    ]),
  );

  const upcoming = useMemo(
    () =>
      [...(schedulesQuery.data ?? [])].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      ),
    [schedulesQuery.data],
  );

  return (
    // 연동 홈은 상단(헤더+히어로)이 흰 배경(시안 37:915) — 루트까지 흰색으로
    <View className={`flex-1 ${isLinked ? "bg-surface" : "bg-background"}`}>
      {/* 미연결 홈 배경 글로우 — 시안 Ellipse 1(1286:10258).
          원본은 582×608 타원(#EBFBE3→#DDF0F8)에 blur 50.4 — 블러가 사방 100.8을 부풀려
          내보낸 에셋은 809.6 높이가 되고, 화면 배치는 y=143−100.8=42.2에서 시작한다.
          top:0으로 깔면 글로우가 통째로 42 위로 뜬다(시안 대비 실측 확인). */}
      {!isLinked ? (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0"
          style={{ top: s(42), height: s(810) }}
        >
          <Image
            source={require("@assets/images/home/hero-glow-support.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="stretch"
          />
        </View>
      ) : null}

      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* 헤더 — 시안 1286:10261. 연동 홈(37:286)은 arrow_down 미적용(지시) */}
        <TabHeader title="마인드스코프" chevron={!isLinked} />

        {meQuery.isLoading ? (
          <LoadingView className="flex-1" />
        ) : meQuery.isError ? (
          <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={refreshControl}
            // 연동 홈: 히어로 흰 배경이 헤더에 바로 붙고, 하단 흰 섹션이 탭바 클리어런스를 내장
            contentContainerStyle={{
              paddingTop: isLinked ? 0 : s(16),
              paddingBottom: isLinked ? 0 : tabClearance,
            }}
          >
            {isLinked ? (
              // 연동 홈 — 피그마 37:286
              <LinkedHome
                personName={me?.person.name ?? ""}
                schedules={upcoming}
                schedulesLoading={schedulesQuery.isLoading}
                schedulesError={schedulesQuery.isError}
                onRetrySchedules={() => schedulesQuery.refetch()}
              />
            ) : (
              // 미연결 홈 — 시안 1286:10257 (게스트 포함 공통)
              <UnlinkedHome
                isGuest={!isAuthenticated}
                profileBirthDate={childProfile?.birth_date ?? null}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
