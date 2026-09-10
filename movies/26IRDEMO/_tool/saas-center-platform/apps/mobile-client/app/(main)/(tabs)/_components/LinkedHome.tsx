/**
 * 연동 홈 — 피그마 1286:9967 (센터 연동 완료 시).
 *
 * 전부 실데이터다 — 일정 카드(/app/schedules), 히어로 말풍선·인사말(오늘 일정·검사 결과).
 * 옛 시안(37:286)의 '우리 아이에게 필요한 치료는?'·'육아 이야기'는 콘텐츠 시스템이 없어
 * 더미로 두던 자리였는데, 새 시안에서 빠져 함께 걷어냈다.
 */
import React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { differenceInCalendarDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import type { AppSchedule } from "@/features/schedule";
import {
  Badge,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
} from "@/shared/components/ui";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { nowKst, toKst } from "@/shared/utils/date";
import { useTabBarClearance } from "@/shared/hooks/useTabBarClearance";
import PersonIcon16 from "@assets/icons/16/PersonIcon16.svg";
import SpotIcon16 from "@assets/icons/16/SpotIcon16.svg";
import NoteClip from "@assets/images/home/note-clip.svg";

/** 오늘 일정 카드의 강조 테두리 — 시안 1286:9984 고정값(콘텐츠성, 토큰 아님) */
const TODAY_CARD_BORDER = "#ACDCFF";
/** 바우처 배너 바탕 — 시안 1286:10069 고정값 */
const VOUCHER_BANNER_BG = "#D4EFF9";
/** 기록 카드 위 집게 장식 — 시안 1286:10110 (카드 위로 걸쳐 나온다) */
const CLIP_W = 40;
const CLIP_H = 23;

function ddayLabel(iso: string): string {
  const diff = differenceInCalendarDays(toKst(iso), nowKst());
  if (diff <= 0) return "오늘";
  return `D-${diff}`;
}

/** 히어로 말풍선 — 다크 버블 + 꼬리 (피그마 Tooltip 37:718) */
function HeroTooltip({
  label,
  tailAlign,
}: {
  label: string;
  tailAlign: "left" | "right";
}) {
  return (
    <View
      style={{ alignItems: tailAlign === "left" ? "flex-start" : "flex-end" }}
    >
      <View
        className="rounded-lg px-2 py-1.5"
        style={{ backgroundColor: COLORS.gray[800] }}
      >
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.text.state["on-primary"] }}
        >
          {label}
        </Typography>
      </View>
      {/* 꼬리 — 45도 회전 사각형이 버블 아래로 살짝 겹친다 */}
      <View
        style={{
          width: s(10),
          height: s(10),
          marginTop: -s(6),
          marginHorizontal: s(14),
          backgroundColor: COLORS.gray[800],
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

interface LinkedHomeProps {
  personName: string;
  schedules: AppSchedule[];
  schedulesLoading: boolean;
  schedulesError: boolean;
  onRetrySchedules: () => void;
}

export function LinkedHome({
  personName,
  schedules,
  schedulesLoading,
  schedulesError,
  onRetrySchedules,
}: LinkedHomeProps) {
  const router = useRouter();
  const tabClearance = useTabBarClearance();

  const today = nowKst();
  const hasTodayCounseling = schedules.some(
    (sc) =>
      sc.kind === "counseling" &&
      differenceInCalendarDays(toKst(sc.start_time), today) === 0,
  );
  // 시안 말풍선은 '오늘 검사 일정'이 아니라 '검사 결과 도착' — 끝난 검사가 있으면 띄운다
  const hasAssessmentResult = schedules.some(
    (sc) => sc.kind === "assessment" && sc.status === "completed",
  );
  const todayCount = schedules.filter(
    (sc) => differenceInCalendarDays(toKst(sc.start_time), today) === 0,
  ).length;

  return (
    <View className="bg-background">
      {/* 배경 레이어 — 상단 흰 블록(37:915) + 파스텔 글로우(37:607).
          글로우 PNG는 블러 패딩 포함 렌더(노드 582×608 → 패딩 784×810).
          캐릭터 기준 앵커: 시안에서 패딩 박스가 캐릭터 상단보다 33.8 위(52.2-86)라
          캐릭터 marginTop 24 - 34 ≈ -10. 타원 본체는 캐릭터 어깨쯤부터 시작해
          우산 영역은 흰 배경 위에 얹힌다. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0 bg-surface"
        style={{ height: s(360) }}
      />
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 items-center"
        style={{ top: -s(10) }}
      >
        <Image
          source={require("@assets/images/home/hero-glow.png")}
          style={{ width: s(784), height: s(810) }}
          resizeMode="stretch"
        />
      </View>

      {/* 히어로 — 캐릭터 + 오늘 일정 말풍선 + 인사 */}
      <View className="items-center">
        <View style={{ width: s(197), height: s(268), marginTop: s(24) }}>
          <Image
            source={require("@assets/images/home/hero-character.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
          {hasTodayCounseling ? (
            <View style={{ position: "absolute", top: s(28), right: -s(52) }}>
              <HeroTooltip label="오늘 상담 일정이 있어요!" tailAlign="left" />
            </View>
          ) : null}
          {hasAssessmentResult ? (
            <View style={{ position: "absolute", top: s(120), left: -s(46) }}>
              <HeroTooltip label="검사 결과가 도착했어요!" tailAlign="right" />
            </View>
          ) : null}
        </View>

        <Typography
          variant="body-02"
          className="mt-4"
          style={{ color: COLORS.text.body.default }}
        >
          {format(today, "yyyy년 M월 d일 EEEE", { locale: ko })}
        </Typography>
        <Typography
          variant="headline-01"
          weight="semibold"
          className="mt-1 text-center"
          style={{ color: COLORS.gray[900] }}
        >
          {todayCount > 0
            ? `${personName}님, 오늘 ${todayCount}건의\n일정이 있어요!`
            : `${personName}님, 오늘도\n좋은 하루 보내세요!`}
        </Typography>
      </View>

      {/* 다가오는 일정 — 가로 스크롤 카드 */}
      <View className="mt-7">
        {schedulesLoading ? (
          <LoadingView className="py-8" />
        ) : schedulesError ? (
          <ErrorView className="py-8" onRetry={onRetrySchedules} />
        ) : schedules.length === 0 ? (
          <View className="mx-4 rounded-2xl bg-surface" style={SHADOWS.card}>
            <EmptyView
              title="다가오는 일정이 없어요"
              description="새 일정이 잡히면 여기에서 알려드릴게요"
              className="py-8"
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // 세로 패딩 = 그림자 여백 (ScrollView가 경계 밖 그림자를 잘라내므로),
            // 음수 마진으로 레이아웃상 차지 공간은 상쇄
            style={{ marginVertical: -s(16) }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: s(16),
              columnGap: 12,
            }}
          >
            {schedules.slice(0, 5).map((schedule) => {
              const start = toKst(schedule.start_time);
              const end = toKst(schedule.end_time);
              // 완료된 검사 → 결과 보기 카드 (시안 37:641). 결과지 공개 여부는 활동 탭이 판별.
              const isResultCard =
                schedule.kind === "assessment" &&
                schedule.status === "completed";
              const target = isResultCard
                ? "/(main)/(tabs)/activity"
                : "/(main)/(tabs)/schedule";
              const dday = ddayLabel(schedule.start_time);
              // 오늘 것만 테두리로 앞세운다 — 시안 1286:9984
              const highlight = !isResultCard && dday === "오늘";
              return (
                <Pressable
                  key={`${schedule.schedule_id}-${schedule.profile_id}`}
                  accessibilityRole="button"
                  onPress={() => router.push(target)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <View
                    className="flex-1 rounded-2xl bg-surface p-4"
                    style={[
                      { width: s(160) },
                      SHADOWS.card,
                      highlight
                        ? { borderWidth: 1, borderColor: TODAY_CARD_BORDER }
                        : null,
                    ]}
                  >
                    <View className="flex-row">
                      <Badge
                        shape="rect"
                        label={isResultCard ? "완료" : dday}
                        color={
                          schedule.kind === "counseling" ? "green" : "teal"
                        }
                      />
                    </View>
                    <Typography
                      variant="body-01"
                      weight="semibold"
                      className="mt-1.5"
                      numberOfLines={1}
                      style={{ color: COLORS.gray[900] }}
                    >
                      {schedule.title}
                    </Typography>
                    {isResultCard ? (
                      <>
                        <Typography
                          variant="body-03"
                          className="mt-2"
                          style={{ color: COLORS.gray[700] }}
                        >
                          {format(start, "yyyy. MM. dd (EEE)", { locale: ko })}
                        </Typography>
                        <View className="flex-1" />
                        <Button
                          label="결과 보기"
                          variant="secondary"
                          size="md"
                          className="mt-4"
                          style={{ alignSelf: "stretch" }}
                          onPress={() => router.push(target)}
                        />
                      </>
                    ) : (
                      <>
                        <Typography
                          variant="body-02"
                          weight="medium"
                          className="mt-2"
                          style={{ color: COLORS.gray[700] }}
                        >
                          {format(start, "yyyy. MM. dd (EEE)", { locale: ko })}
                        </Typography>
                        <Typography
                          variant="body-03"
                          style={{ color: COLORS.gray[700] }}
                        >
                          {`${format(start, "HH:mm")} - ${format(end, "HH:mm")}`}
                        </Typography>
                        <View className="mt-4" style={{ rowGap: s(8) }}>
                          <View
                            className="flex-row items-center"
                            style={{ columnGap: 2 }}
                          >
                            <SpotIcon16 width={16} height={16} />
                            <Typography
                              variant="body-03"
                              numberOfLines={1}
                              className="flex-1"
                              style={{ color: COLORS.gray[600] }}
                            >
                              {schedule.center_name}
                            </Typography>
                          </View>
                          {/* 시안은 자녀가 아니라 담당 상담사를 보여준다 — 없으면 줄을 비운다 */}
                          {schedule.counselor_name ? (
                            <View
                              className="flex-row items-center"
                              style={{ columnGap: 2 }}
                            >
                              <PersonIcon16 width={12} height={14} />
                              <Typography
                                variant="body-03"
                                numberOfLines={1}
                                className="flex-1"
                                style={{ color: COLORS.gray[600] }}
                              >
                                {`${schedule.counselor_name} 상담사`}
                              </Typography>
                            </View>
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 오늘 하루 기록 — 기록 탭으로 연결. 시안 1286:10074 (메모지처럼 집게로 물린 카드) */}
      <View className="mx-4 mt-6">
        <View
          className="rounded-2xl bg-surface"
          style={[
            {
              marginTop: s(6),
              paddingTop: s(32),
              paddingBottom: s(20),
              paddingHorizontal: s(20),
            },
            SHADOWS.card,
          ]}
        >
          <View className="flex-row items-center" style={{ columnGap: s(12) }}>
            <View className="flex-1" style={{ rowGap: s(8) }}>
              <Typography
                variant="title-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                오늘 하루는 어땠나요?
              </Typography>
              <Typography
                variant="body-02-reading"
                style={{ color: COLORS.text.body.default }}
              >
                남겨주신 내용을 바탕으로{"\n"}다음 상담이 진행돼요.
              </Typography>
            </View>
            <Image
              source={require("@assets/images/home/diary-note.png")}
              style={{
                width: s(48),
                height: s(48),
                transform: [{ scaleX: -1 }],
              }}
              resizeMode="contain"
            />
          </View>
          <Button
            label="기록하기"
            size="lg"
            className="mt-4"
            onPress={() => router.push("/(main)/(tabs)/records")}
          />
        </View>
        {/* 카드 윗변에 걸치는 집게 — 카드보다 먼저 그리면 가려지므로 뒤에 얹는다 */}
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0 flex-row justify-between"
          style={{ paddingHorizontal: s(28) }}
        >
          <NoteClip width={s(CLIP_W)} height={s(CLIP_H)} />
          <NoteClip width={s(CLIP_W)} height={s(CLIP_H)} />
        </View>
      </View>

      {/* 바우처 배너 */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(main)/vouchers")}
        className="mx-4 mt-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <View
          style={{
            borderRadius: s(16),
            padding: s(16),
            rowGap: s(8),
            overflow: "hidden",
            backgroundColor: VOUCHER_BANNER_BG,
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            받을 수 있는 지원, 놓치지 마세요
          </Typography>
          <Typography
            variant="body-02"
            style={{ color: COLORS.text.body.default }}
          >
            나에게 알맞는 바우처는?
          </Typography>
          <Image
            source={require("@assets/images/home/voucher-wallet.png")}
            style={{
              position: "absolute",
              right: s(10),
              top: 0,
              width: s(94),
              height: s(94),
            }}
            resizeMode="contain"
          />
        </View>
      </Pressable>

      {/* 탭바가 절대 오버레이라 마지막 요소 아래에 그만큼 여백을 둔다 */}
      <View style={{ height: tabClearance }} />
    </View>
  );
}
