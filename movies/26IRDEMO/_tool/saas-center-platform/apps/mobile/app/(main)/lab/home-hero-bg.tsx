import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 히어로 배경 변주 — 탭 비교 lab.
 *
 * 네 시안을 한 화면에서 탭으로 전환해 직접 비교한다.
 *   A — Primary 500 (현재): 풀톤 브랜드 블루 + 화이트 텍스트
 *   B — Primary 50 (신규): 가장 옅은 톤 + 다크 텍스트
 *   C — Primary 75 (신규): P50/P100 중간 톤 — 토큰 외 1회성 컬러
 *   D — Primary 100 (신규): 한 톤 진한 옅은 톤 + 다크 텍스트
 *
 * 이 파일이 "lab 안에서 탭으로 시안 비교" 패턴의 기준이며,
 * 앞으로 신규 시안은 이 구조를 따라 추가한다 (별도 lab 파일 양산 X).
 */

// P50(#f4f8ff)과 P100(#d7e5fd) RGB 중간값. 토큰에 없는 1회성 색.
// (244,248,255) ↔ (215,229,253) → (230,239,254) = #E6EFFE
const PRIMARY_75 = "#E6EFFE";

type Variant = "current" | "soft" | "between" | "medium";

const VARIANTS: { key: Variant; label: string; hint: string }[] = [
  { key: "current", label: "P500 (현재)", hint: "풀톤" },
  { key: "soft", label: "P50 (신규)", hint: "옅음" },
  { key: "between", label: "P75 (신규)", hint: "중간" },
  { key: "medium", label: "P100 (신규)", hint: "옅음+" },
];

export default function HomeHeroBgLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");

  return (
    <View className="flex-1 bg-base">
      {/* 헤더 + 탭은 SafeAreaView 안에 (top edge 처리) */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              홈 히어로 배경 변주
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? "semibold" : "medium"}
                    style={{
                      color: active ? COLORS.text.title.default : COLORS.gray[500],
                    }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* 프리뷰 — 선택된 시안의 히어로 + 더미 콘텐츠 */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        <HeroPreview variant={variant} />

        {/* 비교용 더미 본문 — 흰 시트에 카운트 + 카드 1개 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            marginTop: s(-16),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(20),
            minHeight: s(220),
          }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            일정
          </Typography>
          <Typography
            variant="body-03"
            className="text-gray-500"
            style={{ marginTop: s(4) }}
          >
            3개의 일정
          </Typography>

          {/* 더미 카드 — 시트 톤만 확인 */}
          <View
            style={{
              marginTop: s(8),
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: s(56),
                paddingVertical: s(12),
                alignItems: "center",
                marginRight: s(12),
              }}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
              >
                14:00
              </Typography>
              <View
                style={{
                  width: 1,
                  height: s(12),
                  backgroundColor: COLORS.gray[300],
                  marginVertical: s(4),
                }}
              />
              <Typography
                variant="body-01"
                weight="regular"
                className="text-gray-500"
              >
                16:00
              </Typography>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: COLORS.gray[50],
                borderRadius: s(16),
                paddingVertical: s(12),
                paddingHorizontal: s(LAYOUT.screenPaddingX),
                gap: s(8),
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(8),
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: COLORS.counseling,
                  }}
                />
                <Typography
                  variant="body-01"
                  weight="semibold"
                  className="text-gray-900"
                >
                  김은서님의 상담
                </Typography>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(6),
                }}
              >
                <Icon name="location" size={s(16)} color={COLORS.gray[400]} />
                <Typography variant="body-03" className="text-gray-600">
                  상담실 A
                </Typography>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(6),
                }}
              >
                <Icon name="document" size={s(16)} color={COLORS.gray[400]} />
                <Typography variant="body-03" className="text-gray-600">
                  놀이치료
                </Typography>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────── Hero Preview (variant별) ───────── */

function HeroPreview({ variant }: { variant: Variant }) {
  const isLight = variant !== "current";

  // 배경: 풀톤 / 가장 옅은 / 중간 / 한 톤 진한 옅음
  const bg =
    variant === "current"
      ? COLORS.primary500
      : variant === "soft"
        ? COLORS.primary50
        : variant === "between"
          ? PRIMARY_75
          : COLORS.primary100;

  // 텍스트: 옅은 배경이면 다크 텍스트, 풀톤 배경이면 화이트
  const titleColor = isLight ? COLORS.gray[900] : COLORS.white;
  const iconColor = isLight ? COLORS.gray[700] : COLORS.white;
  // 센터 칩 배경 — 한 단계 진한 톤으로 분리
  const chipBg =
    variant === "current"
      ? "rgba(255,255,255,0.22)"
      : variant === "soft"
        ? COLORS.primary100
        : variant === "between"
          ? COLORS.primary100
          : COLORS.primary200;

  return (
    <View style={{ backgroundColor: bg }}>
      {/* 상단 바 */}
      <View
        style={{
          height: s(52),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
          <View
            style={{
              width: s(28),
              height: s(28),
              borderRadius: s(8),
              backgroundColor: chipBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="business" size={14} color={iconColor} />
          </View>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: titleColor }}
          >
            서울어린이미래활짝센터
          </Typography>
          <Icon name="arrow-down" size={20} color={iconColor} />
        </View>

        <View
          style={{
            width: s(36),
            height: s(36),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={iconColor} />
          <View
            style={{
              position: "absolute",
              right: s(6),
              top: s(6),
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: "#FDCA01",
              borderWidth: 1.5,
              borderColor: bg,
            }}
          />
        </View>
      </View>

      {/* 인사 + 일러스트 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(8),
          paddingBottom: s(36),
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", paddingTop: s(8) }}>
          <Typography
            weight="bold"
            style={{
              color: titleColor,
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -1,
            }}
          >
            김민준님,{"\n"}활기찬 오후예요
          </Typography>
        </View>

        <GoodDayIllustration variant={variant} />
      </View>
    </View>
  );
}

/* ───────── Good Day Illustration (variant별 컬러 보정) ───────── */

function GoodDayIllustration({ variant }: { variant: Variant }) {
  const isLight = variant !== "current";
  const SIZE = s(108);

  // 옅은 배경에선 화이트 구름이 안 보이므로 gray-100으로 보정
  const cloudColor = isLight ? COLORS.gray[100] : "#FFFFFF";
  const cloudOpacity = isLight ? 1 : 0.96;
  const sparkleColor = isLight
    ? "rgba(37,110,244,0.35)" // 옅은 배경 위에선 brand tint
    : "rgba(255,255,255,0.85)";
  const rayColor = isLight
    ? "rgba(37,110,244,0.35)"
    : "rgba(255,255,255,0.55)";

  return (
    <View style={{ width: SIZE, height: SIZE, position: "relative" }}>
      {/* Sun rays */}
      {[
        { top: 2, left: SIZE / 2 - 1, w: 2, h: 8, deg: 0 },
        { top: 10, left: SIZE - 18, w: 2, h: 7, deg: 45 },
        { top: SIZE / 2 - 16, left: SIZE - 6, w: 8, h: 2, deg: 0 },
        { top: 10, left: 10, w: 2, h: 7, deg: -45 },
        { top: SIZE / 2 - 16, left: -2, w: 8, h: 2, deg: 0 },
      ].map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.top,
            left: r.left,
            width: r.w,
            height: r.h,
            borderRadius: 2,
            backgroundColor: rayColor,
            transform: [{ rotate: `${r.deg}deg` }],
          }}
        />
      ))}

      {/* Sun outer halo */}
      <View
        style={{
          position: "absolute",
          top: s(14),
          left: SIZE / 2 - s(34),
          width: s(68),
          height: s(68),
          borderRadius: s(34),
          backgroundColor: "rgba(255,216,107,0.35)",
        }}
      />
      {/* Sun body */}
      <View
        style={{
          position: "absolute",
          top: s(22),
          left: SIZE / 2 - s(26),
          width: s(52),
          height: s(52),
          borderRadius: s(26),
          backgroundColor: "#FFD86B",
        }}
      />
      {/* Sun highlight */}
      <View
        style={{
          position: "absolute",
          top: s(28),
          left: SIZE / 2 - s(20),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "#FFE699",
          opacity: 0.9,
        }}
      />

      {/* Cloud — 3 puffs + base */}
      <View
        style={{
          position: "absolute",
          bottom: s(10),
          left: s(6),
          width: s(38),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: cloudColor,
          opacity: cloudOpacity,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(18),
          left: s(20),
          width: s(34),
          height: s(34),
          borderRadius: s(17),
          backgroundColor: cloudColor,
          opacity: cloudOpacity,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(14),
          left: s(46),
          width: s(40),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: cloudColor,
          opacity: cloudOpacity,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(10),
          left: s(12),
          width: s(74),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: cloudColor,
          opacity: cloudOpacity,
        }}
      />

      {/* Sparkle */}
      <View
        style={{
          position: "absolute",
          top: s(4),
          left: s(14),
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: sparkleColor,
        }}
      />
    </View>
  );
}
