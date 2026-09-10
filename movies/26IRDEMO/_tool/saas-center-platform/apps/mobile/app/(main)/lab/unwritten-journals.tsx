import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 미작성 일지 페이지 시안.
 *
 * 진입: 홈의 액션 chip "미작성 일지 N건 작성하기" 탭.
 *
 * 단위 결정 (사용자 합의):
 *  - 회기 ⊃ 일지 (1:N — 그룹 회기는 내담자별 일지 N건)
 *  - 카드 = 회기. 카드 안 row = 미작성 일지(=내담자)
 *  - 같은 회기 정보(시간·장소·프로그램)가 반복되지 않음
 *
 * 정렬·그룹화: 시급도 순(오래된 회기 위) + 날짜 헤더로 그룹 분리.
 * 표시 정책: 미작성 일지만 노출(작성된 row 는 숨김 — 페이지 정체성 명확).
 * 탭 동작: 내담자 row 탭 → §3-5 상담일지 바텀시트 (lab 에서는 mock 동작).
 */

type UnwrittenSessionGroup = {
  date: string; // "5월 15일 (목)"
  daysAgo: number;
  session: {
    timeRange: string; // "14:00 ~ 15:00"
    room: string;
    program: string;
    unwrittenClients: {
      name: string;
      gender: "남" | "여";
      age: number;
    }[];
  };
};

const MOCK_GROUPS: UnwrittenSessionGroup[] = [
  {
    date: "5월 15일 (목)",
    daysAgo: 7,
    session: {
      timeRange: "14:00 ~ 15:00",
      room: "1번 상담실",
      program: "놀이치료-그룹",
      unwrittenClients: [
        { name: "박지훈", gender: "남", age: 7 },
        { name: "이수연", gender: "여", age: 6 },
        { name: "최도윤", gender: "남", age: 7 },
      ],
    },
  },
  {
    date: "5월 19일 (월)",
    daysAgo: 3,
    session: {
      timeRange: "11:00 ~ 12:00",
      room: "2번 상담실",
      program: "인지행동치료-개인",
      unwrittenClients: [{ name: "김민준", gender: "여", age: 10 }],
    },
  },
  {
    date: "5월 20일 (화)",
    daysAgo: 2,
    session: {
      timeRange: "10:00 ~ 11:00",
      room: "3번 상담실",
      program: "놀이치료-그룹",
      unwrittenClients: [
        { name: "한지원", gender: "여", age: 8 },
        { name: "강서윤", gender: "남", age: 9 },
      ],
    },
  },
];

export default function UnwrittenJournalsLab() {
  const router = useRouter();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.gray[50] }}
      edges={["top"]}
    >
      {/* 헤더 */}
      <View
        style={{
          height: s(52),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            미작성 일지
          </Typography>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: s(16),
          paddingBottom: s(40),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
        }}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_GROUPS.map((group, idx) => (
          <View
            key={group.date}
            style={{
              marginTop: idx === 0 ? 0 : s(24),
            }}
          >
            {/* 날짜 헤더 + 경과 라벨 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: s(12),
                paddingHorizontal: s(4),
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.gray[700] }}
              >
                {group.date}
              </Typography>
              <View
                style={{
                  width: 1,
                  height: s(10),
                  backgroundColor: COLORS.gray[300],
                  marginHorizontal: s(8),
                }}
              />
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: COLORS.gray[500] }}
              >
                {group.daysAgo}일 전
              </Typography>
            </View>

            {/* 회기 카드 */}
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: s(16),
                paddingVertical: s(16),
                paddingHorizontal: s(16),
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              {/* 타이틀 — 프로그램명 */}
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
              >
                {group.session.program}
              </Typography>

              {/* 서브 — 시간 · 장소 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: s(4),
                }}
              >
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.gray[600] }}
                >
                  {group.session.timeRange}
                </Typography>
                <View
                  style={{
                    width: 1,
                    height: s(10),
                    backgroundColor: COLORS.gray[300],
                    marginHorizontal: s(8),
                  }}
                />
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.gray[600] }}
                >
                  {group.session.room}
                </Typography>
              </View>

              {/* divider — 회기 메타 / 일지 row 분리 */}
              <View
                style={{
                  height: 1,
                  backgroundColor: COLORS.gray[100],
                  marginVertical: s(12),
                }}
              />

              {/* 미작성 일지 row — 내담자별 */}
              {group.session.unwrittenClients.map((client, cIdx) => (
                <Pressable
                  key={client.name}
                  onPress={() => {
                    // mock — 실제는 §3-5 상담일지 바텀시트로 진입
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: s(10),
                    marginTop:
                      cIdx === 0
                        ? 0
                        : 1 /* row 사이 hairline divider 효과는 별도 divider 로 */,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${client.name}님 상담일지 작성`}
                >
                  {/* 이름 */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <Typography
                      variant="body-01"
                      weight="semibold"
                      className="text-gray-900"
                    >
                      {client.name}님
                    </Typography>
                  {/* 성별 · 나이 */}
                    <Typography
                      variant="body-03"
                      weight="regular"
                      style={{
                        color: COLORS.gray[600],
                        marginLeft: s(8),
                      }}
                    >
                    {client.gender} · 만 {client.age}세
                    </Typography>
                  </View>
                  {/* chevron — 우측 */}
                  <Ionicons
                    name="chevron-forward"
                    size={s(18)}
                    color={COLORS.gray[400]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
