import { useMemo } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { ScheduleListItem, ScheduleType } from "@/features/schedule";
import { Icon } from "@/shared/components/icons";
import { Typography } from "@/shared/components/ui/Typography";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { TodayScheduleCard } from "../(tabs)/_components/home-variants/VariantA";

/**
 * 오늘 일정 카드 — 상태별 디자인 미리보기.
 * 실데이터로는 '예정/완료/진행 중'만 자주 만나서 디자이너 검증이 어려움.
 * 여기서 6가지 상태(예정 / 곧 시작 / 진행 중 / 완료 / 취소 / 노쇼)를 한 화면에서 비교한다.
 */
export default function TodayScheduleCardPreview() {
  const router = useRouter();
  const cases = useMemo(() => buildCases(), []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 헤더 */}
      <View className="h-12 flex-row items-center px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            오늘 일정 카드 상태
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: s(20), paddingBottom: s(40) }}>
        <Typography variant="body-03" className="text-gray-500">
          6가지 상태의 오늘 일정 카드 디자인을 비교합니다.
        </Typography>

        <View style={{ marginTop: s(20), gap: s(20) }}>
          {cases.map((c) => (
            <View key={c.label}>
              <View
                className="flex-row items-center"
                style={{ marginBottom: s(8), gap: s(6) }}
              >
                <View
                  style={{
                    width: s(6),
                    height: s(6),
                    borderRadius: s(3),
                    backgroundColor: c.dotColor,
                  }}
                />
                <Typography
                  variant="body-02"
                  weight="bold"
                  className="text-gray-900"
                >
                  {c.label}
                </Typography>
                {c.hint && (
                  <Typography
                    variant="label-01"
                    className="text-gray-500"
                  >
                    · {c.hint}
                  </Typography>
                )}
              </View>
              <TodayScheduleCard
                schedule={c.schedule}
                isNext={c.isNext}
                onPress={() => {}}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- mock builders ---------------- */

interface CaseDef {
  label: string;
  hint?: string;
  dotColor: string;
  schedule: ScheduleListItem;
  isNext?: boolean;
}

function buildCases(): CaseDef[] {
  // 실제 현재 시간 기준 — deriveStatus가 new Date()와 비교해 상태를 판단하므로
  // mock 시작/종료 시각도 현재 시각 오프셋으로 잡아야 정확한 상태 분기.
  const ref = new Date();

  return [
    {
      label: "예정",
      hint: "upcoming",
      dotColor: "#D1D5DB",
      schedule: mock({
        id: "preview-upcoming",
        startMinutesFromRef: 90,
        durationMinutes: 60,
        name: "최서준",
        age: 6,
        gender: "male",
        type: "counseling",
        programName: "놀이치료",
        roomName: "상담실 2",
        sessionStatus: null,
        ref,
      }),
      isNext: false,
    },
    {
      label: "곧 시작",
      hint: "isNext + upcoming",
      dotColor: "#13BDFA",
      schedule: mock({
        id: "preview-next",
        startMinutesFromRef: 15,
        durationMinutes: 60,
        name: "이수영",
        age: 9,
        gender: "female",
        type: "assessment",
        programName: "K-WPPSI",
        roomName: "검사실",
        sessionStatus: null,
        ref,
      }),
      isNext: true,
    },
    {
      label: "진행 중",
      hint: "in_progress (보더 강조)",
      dotColor: "#13BDFA",
      schedule: mock({
        id: "preview-in-progress",
        startMinutesFromRef: -20,
        durationMinutes: 60,
        name: "김민수",
        age: 7,
        gender: "male",
        type: "counseling",
        programName: "인지치료",
        roomName: "상담실 1",
        sessionStatus: null,
        ref,
      }),
      isNext: true,
    },
    {
      label: "완료",
      hint: "completed",
      dotColor: "#7D848F",
      schedule: mock({
        id: "preview-completed",
        startMinutesFromRef: -240,
        durationMinutes: 60,
        name: "박지은",
        age: 8,
        gender: "female",
        type: "counseling",
        programName: "놀이치료",
        roomName: "상담실 1",
        sessionStatus: "completed",
        ref,
      }),
      isNext: false,
    },
    {
      label: "취소",
      hint: "cancelled (disabled)",
      dotColor: "#FF4242",
      schedule: mock({
        id: "preview-cancelled",
        startMinutesFromRef: 180,
        durationMinutes: 60,
        name: "정하늘",
        age: 10,
        gender: "male",
        type: "counseling",
        programName: "놀이치료",
        roomName: "상담실 3",
        sessionStatus: "cancelled",
        ref,
      }),
      isNext: false,
    },
    {
      label: "노쇼",
      hint: "no_show (disabled)",
      dotColor: "#FF4242",
      schedule: mock({
        id: "preview-no-show",
        startMinutesFromRef: -150,
        durationMinutes: 60,
        name: "한지우",
        age: 5,
        gender: "female",
        type: "assessment",
        programName: "K-CARS",
        roomName: "검사실",
        sessionStatus: "no_show",
        ref,
      }),
      isNext: false,
    },
  ];
}

interface MockArgs {
  id: string;
  startMinutesFromRef: number;
  durationMinutes: number;
  name: string;
  age: number;
  gender: "male" | "female";
  type: ScheduleType;
  programName?: string;
  roomName?: string;
  sessionStatus: string | null;
  ref: Date;
}

function mock(args: MockArgs): ScheduleListItem {
  const start = new Date(args.ref.getTime() + args.startMinutesFromRef * 60_000);
  const end = new Date(start.getTime() + args.durationMinutes * 60_000);
  const birthYear = new Date().getFullYear() - args.age;
  return {
    id: args.id,
    start: start.toISOString(),
    end: end.toISOString(),
    schedule_type: args.type,
    room_name: args.roomName ?? null,
    counselor_name: "프리뷰",
    client_names: [args.name],
    clients: [
      {
        id: args.id + "-c",
        name: args.name,
        gender: args.gender,
        birth_date: `${birthYear}-03-15`,
      },
    ],
    title: null,
    program_name: args.programName ?? null,
    session_status: args.sessionStatus,
  };
}
