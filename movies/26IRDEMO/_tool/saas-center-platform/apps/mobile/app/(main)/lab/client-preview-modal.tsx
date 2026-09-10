import { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 내담자 요약 모달 시안.
 * 진입: 홈의 "상담 전 박지훈님 알아보기" chip 탭.
 *
 * 정책:
 *  - 모달(중앙 floating + dim) 패턴 — BottomSheet 아님
 *  - 그룹 회기일 때 좌/우 화살표로 내담자 전환, 1:1 이면 화살표 숨김
 *  - 정보 = §3-3 내담자 상세 스펙(이름·성별·나이·생년월일·연락처·출석 패턴)
 *  - 자세히 보기 → 내담자 상세 페이지 push (lab 단계는 mock 동작)
 */

type Client = {
  name: string;
  gender: "남" | "여";
  age: number;
  birthDate: string;
  phone: string;
  attendance: boolean[]; // 최근 N회기, true=참석
  aiSummary: string; // AI 요약 — §3-3 ❓ 추가 예정 항목, 시안 검증 단계
};

const MOCK_CLIENTS: Client[] = [
  {
    name: "박지훈",
    gender: "남",
    age: 7,
    birthDate: "2018. 03. 15",
    phone: "010-1234-5678",
    attendance: [true, true, false, true, true],
    aiSummary:
      "최근 회기에서 가족 관계, 특히 동생과의 갈등을 자주 이야기했어요. 표현이 점점 풍부해지고 있어요.",
  },
  {
    name: "이수연",
    gender: "여",
    age: 6,
    birthDate: "2019. 07. 22",
    phone: "010-2345-6789",
    attendance: [true, true, true, true, false],
    aiSummary:
      "이번 달 들어 활동 참여도가 높아졌어요. 또래와의 협동 놀이에 관심이 많아요.",
  },
  {
    name: "최도윤",
    gender: "남",
    age: 7,
    birthDate: "2018. 11. 08",
    phone: "010-3456-7890",
    attendance: [true, false, true, true, true],
    aiSummary:
      "최근 정서 표현에 어려움을 보였어요. 다음 회기엔 비언어 활동을 함께 해보면 좋겠어요.",
  },
];

export default function ClientPreviewModalLab() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const client = MOCK_CLIENTS[currentIdx]!;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === MOCK_CLIENTS.length - 1;
  const isGroup = MOCK_CLIENTS.length > 1;

  const handleOpen = () => {
    setCurrentIdx(0);
    setModalOpen(true);
  };
  const handleClose = () => setModalOpen(false);
  const handlePrev = () => {
    if (!isFirst) setCurrentIdx(currentIdx - 1);
  };
  const handleNext = () => {
    if (!isLast) setCurrentIdx(currentIdx + 1);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.gray[50] }}
      edges={["top"]}
    >
      {/* lab 헤더 */}
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
            내담자 요약 모달
          </Typography>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: s(16),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingBottom: s(40),
        }}
      >
        <Typography
          variant="body-02"
          className="text-gray-600"
          style={{ marginBottom: s(24), lineHeight: 22 }}
        >
          홈의 "상담 전 박지훈님 알아보기" chip 탭 시 보여줄 내담자 요약
          모달. 그룹 회기는 좌/우 화살표로 다른 내담자 전환. 1:1 이면 화살표 숨김.
        </Typography>

        {/* 트리거 chip — 홈의 chip 시각 모방 */}
        <View style={{ alignItems: "center", marginTop: s(40) }}>
          <Pressable
            onPress={handleOpen}
            style={{
              paddingVertical: s(12),
              paddingHorizontal: s(16),
              backgroundColor: COLORS.white,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.white,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowOffset: { width: 0, height: 3 },
              shadowRadius: 10,
              elevation: 2,
            }}
            accessibilityRole="button"
            accessibilityLabel="상담 전 박지훈님 알아보기"
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color="#0E91ED"
              style={{ marginRight: s(8) }}
            />
            <Typography
              variant="body-02"
              weight="medium"
              className="text-gray-800"
            >
              상담 전 박지훈님 알아보기
            </Typography>
          </Pressable>

          <Typography
            variant="body-03"
            className="text-gray-500"
            style={{ marginTop: s(16), textAlign: "center" }}
          >
            ↑ 탭해서 모달 열기
          </Typography>
        </View>
      </ScrollView>

      {/* Modal Overlay */}
      {modalOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: s(LAYOUT.screenPaddingX),
          }}
        >
          {/* Dim — 탭하면 닫힘 */}
          <Pressable
            onPress={handleClose}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          />

          {/* Modal Card */}
          <View
            style={{
              width: "100%",
              maxWidth: s(360),
              backgroundColor: COLORS.white,
              borderRadius: s(20),
              padding: s(24),
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            {/* 헤더 — 화살표 + 이름 (그룹일 때만 화살표) */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: s(20),
              }}
            >
              {isGroup ? (
                <Pressable
                  onPress={handlePrev}
                  hitSlop={12}
                  disabled={isFirst}
                  style={{ opacity: isFirst ? 0.3 : 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="이전 내담자"
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={COLORS.gray[800]}
                  />
                </Pressable>
              ) : (
                <View style={{ width: 22 }} />
              )}

              <View style={{ flex: 1, alignItems: "center" }}>
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  className="text-gray-900"
                >
                  {client.name}님
                </Typography>
                {isGroup && (
                  <Typography
                    variant="label-02"
                    weight="medium"
                    style={{ color: COLORS.gray[500], marginTop: s(2) }}
                  >
                    {currentIdx + 1} / {MOCK_CLIENTS.length}
                  </Typography>
                )}
              </View>

              {isGroup ? (
                <Pressable
                  onPress={handleNext}
                  hitSlop={12}
                  disabled={isLast}
                  style={{ opacity: isLast ? 0.3 : 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="다음 내담자"
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={COLORS.gray[800]}
                  />
                </Pressable>
              ) : (
                <View style={{ width: 22 }} />
              )}
            </View>

            {/* 정보 영역 — §3-3 스펙 */}
            <View>
              <InfoRow
                label="성별·나이"
                value={`${client.gender} · 만 ${client.age}세`}
              />
              <InfoRow label="생년월일" value={client.birthDate} />
              <InfoRow label="연락처" value={client.phone} />

              {/* 출석 패턴 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: s(12),
                }}
              >
                <Typography
                  variant="body-02"
                  weight="regular"
                  style={{ color: COLORS.gray[600], width: s(80) }}
                >
                  출석 패턴
                </Typography>
                <View
                  style={{
                    flexDirection: "row",
                    flex: 1,
                  }}
                >
                  {client.attendance.map((attended, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: attended
                          ? COLORS.gray[800]
                          : "transparent",
                        borderWidth: attended ? 0 : 1.5,
                        borderColor: COLORS.gray[300],
                        marginRight: idx === client.attendance.length - 1 ? 0 : s(6),
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* AI 요약 — gray-50 카드, sparkles 아이콘 + 본문 (§3-3 ❓ 추가 예정) */}
            <View
              style={{
                marginTop: s(20),
                paddingVertical: s(12),
                paddingHorizontal: s(14),
                backgroundColor: COLORS.gray[50],
                borderRadius: s(12),
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: s(6),
                }}
              >
                <Ionicons
                  name="sparkles"
                  size={14}
                  color="#7B4FFF"
                  style={{ marginRight: s(6) }}
                />
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.gray[700] }}
                >
                  AI 요약
                </Typography>
              </View>
              <Typography
                variant="body-02"
                weight="regular"
                style={{ color: COLORS.gray[700], lineHeight: 22 }}
              >
                {client.aiSummary}
              </Typography>
            </View>

            {/* 자세히 보기 — Primary 버튼 */}
            <Pressable
              onPress={() => {
                handleClose();
                // lab 단계 — 실제 navigation 생략. production 에선 router.push(`/(main)/client/${clientId}`)
              }}
              style={{
                marginTop: s(20),
                paddingVertical: s(14),
                backgroundColor: COLORS.primary500,
                borderRadius: s(12),
                alignItems: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="자세히 보기"
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                자세히 보기
              </Typography>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: s(12),
      }}
    >
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.gray[600], width: s(80) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.gray[800], flex: 1 }}
      >
        {value}
      </Typography>
    </View>
  );
}
