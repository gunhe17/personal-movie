import { useState } from "react";
import { View, Pressable, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeOutRight,
  LinearTransition,
} from "react-native-reanimated";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { ConfirmModal } from "@/shared/components/ui/ConfirmModal";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 액션 완료 시 chip 이 사라지는 인터랙션 시연 (종결 chip 기준).
 *
 * 패턴: react-native-reanimated 의 declarative animation
 *  - exiting={FadeOut.duration(300)} — chip unmount 시 자동 opacity fade-out
 *  - layout={Layout.duration(300)} — 남은 chips 가 자연스럽게 위로 흘러옴
 *  RN LayoutAnimation 보다 RN 0.81 + Fabric 에서 안정적.
 *
 * 정책: 액션이 의사결정으로 완료되면 chip 이 메인에서 사라진다.
 *  - 종결/연장 결정 (예시 — "종결" 확정 시)
 *  - 미작성 일지 — 전체 N건 모두 작성 완료 시
 *  - 박지훈 — 시간 기반 해소(만남 후) — 별도 정책
 *
 * 시연: 이수연 종결 chip 탭 → ConfirmModal "종결" → chip 사라짐.
 *       Reset 버튼으로 시연 반복.
 */

const CHIPS = [
  {
    label: "상담 전 박지훈님 알아보기",
    icon: "document-text-outline" as const,
    color: "#0E91ED",
  },
  {
    label: "미작성 일지 3건 작성하기",
    icon: "create-outline" as const,
    color: "#7B4FFF",
  },
  {
    label: "이수연님 종결 여부 정하기",
    icon: "flag-outline" as const,
    color: "#009BA9",
  },
];

export default function ChipCompleteFadeLab() {
  const router = useRouter();
  const [completedChips, setCompletedChips] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 시연용 — 어떤 chip 을 탭했는지 추적 (중간 chip 사라질 때 위 chips 의 layout 흘러옴 확인용)
  const [tappedChipLabel, setTappedChipLabel] = useState<string | null>(null);

  const visibleChips = CHIPS.filter((c) => !completedChips.has(c.label));

  const handleChipTap = (label: string) => {
    setTappedChipLabel(label);
    setConfirmOpen(true);
  };

  const handleConfirmEnd = () => {
    setConfirmOpen(false);
    if (!tappedChipLabel) return;
    // reanimated 가 자동 fade-out + layout shift 처리 — 단순 state set 만
    setCompletedChips((prev) => {
      const next = new Set(prev);
      next.add(tappedChipLabel);
      return next;
    });
    setTappedChipLabel(null);
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
    setTappedChipLabel(null);
  };

  const handleReset = () => {
    setCompletedChips(new Set());
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.gray[50] }}
      edges={["top"]}
    >
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
            chip 완료 fade-out
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
          액션이 의사결정으로 완료되면 chip 이 사라진다. 시연 — 이수연 chip 탭 →
          "종결" 확인 → chip fade-out + 다른 chips 위로 흘러옴 (300ms
          easeInEaseOut).
        </Typography>

        {/* chip stack */}
        <View
          style={{
            alignItems: "center",
            marginTop: s(40),
            marginBottom: s(40),
          }}
        >
          {visibleChips.length === 0 ? (
            <View style={{ paddingVertical: s(40), alignItems: "center" }}>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.gray[500] }}
              >
                오늘 챙길 일이 모두 정리됐어요.
              </Typography>
            </View>
          ) : (
            visibleChips.map((item, idx) => (
              <Animated.View
                key={item.label}
                exiting={FadeOutRight.duration(380)}
                layout={LinearTransition.springify().damping(33).stiffness(280)}
                style={{ marginTop: idx === 0 ? 0 : s(12) }}
              >
                <Pressable
                  onPress={() => handleChipTap(item.label)}
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
                  accessibilityLabel={item.label}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.color}
                    style={{ marginRight: s(8) }}
                  />
                  <Typography
                    variant="body-02"
                    weight="medium"
                    className="text-gray-800"
                  >
                    {item.label}
                  </Typography>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>

        {/* Reset 버튼 — chip 이 하나 이상 사라진 경우만 노출 */}
        {completedChips.size > 0 && (
          <View style={{ alignItems: "center", marginTop: s(20) }}>
            <Pressable
              onPress={handleReset}
              style={{
                paddingVertical: s(10),
                paddingHorizontal: s(20),
                backgroundColor: COLORS.gray[200],
                borderRadius: s(10),
              }}
              accessibilityRole="button"
              accessibilityLabel="리셋"
            >
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.gray[800] }}
              >
                Reset
              </Typography>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={confirmOpen}
        title="처리 완료로 표시할까요?"
        message={
          tappedChipLabel
            ? `'${tappedChipLabel}' 칩이 메인에서 사라집니다.`
            : ""
        }
        confirmLabel="완료"
        cancelLabel="취소"
        onConfirm={handleConfirmEnd}
        onCancel={handleCancelConfirm}
      />
    </SafeAreaView>
  );
}
