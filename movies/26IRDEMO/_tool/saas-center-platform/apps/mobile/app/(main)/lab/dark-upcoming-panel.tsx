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
 * 다크 홈 · 오늘 만날 내담자 배치 비교 lab.
 *
 * 현재 production(DarkClipboardGreeting)의 패널 디자인을 두 안으로 비교한다.
 *
 *   A — 컨테이너 정리(현재): 단일 다크 컨테이너에 첫 번째 풀폭 강조 + 나머지 압축 행
 *   B — 세로 카드 캐러셀:    카드는 세로 정보 배치, 가로로 나열하여 스와이프. 첫 카드는 폭·라벨·보더로 강조
 */

type Variant = "panel" | "carousel";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "panel", label: "A 정리(현재)" },
  { key: "carousel", label: "B 세로카드 캐러셀" },
];

/* ─── Mock data ─── */

interface MockEntry {
  id: string;
  name: string;
  startText: string;
}

const ENTRIES: MockEntry[] = [
  { id: "1", name: "김은서", startText: "10:00" },
  { id: "2", name: "이도윤", startText: "11:00" },
  { id: "3", name: "최서연", startText: "15:00" },
  { id: "4", name: "박지민", startText: "17:00" },
];

const AVATAR_COLORS = [
  COLORS.palette.violet,
  COLORS.palette.coral,
  COLORS.palette.mint,
  COLORS.palette.blue,
  COLORS.palette.orange,
];

const PERSON_NAME = "민준";
const COUNT = ENTRIES.length;

/* ═══════════════════════════════════════════════════════════
 *  Root
 * ═══════════════════════════════════════════════════════════ */

export default function DarkUpcomingPanelLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("panel");
  const pageBg = COLORS.gray[900];

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
      {/* Lab 헤더 (라이트) + 시안 탭 */}
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
              다크 홈 · 내담자 패널 배치
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

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

      {/* 프리뷰 — 다크 페이지 */}
      <ScrollView
        contentContainerStyle={{ paddingTop: s(20), paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤드라인 (두 시안 공통) */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(20),
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -0.8,
            }}
          >
            {PERSON_NAME}님,{"\n"}오늘 만날{" "}
            <Typography
              weight="bold"
              style={{
                color: COLORS.primary300,
                fontSize: s(28),
                lineHeight: s(38),
                letterSpacing: -0.8,
              }}
            >
              {COUNT}명
            </Typography>
            이에요
          </Typography>
        </View>

        {variant === "panel" ? <PanelVariant /> : <CarouselVariant />}

        <VariantMemo variant={variant} />
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  A — 컨테이너 정리(현재 production과 동일)
 * ═══════════════════════════════════════════════════════════ */

function PanelVariant() {
  const [primary, ...rest] = ENTRIES;

  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        style={{
          backgroundColor: COLORS.gray[800],
          borderRadius: s(20),
          paddingTop: s(16),
          paddingBottom: rest.length > 0 ? s(8) : s(16),
          paddingHorizontal: s(16),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <PrimaryClientCard entry={primary} />
        {rest.length > 0 && (
          <>
            <View
              style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.08)",
                marginVertical: s(12),
              }}
            />
            <View style={{ gap: s(2) }}>
              {rest.map((entry, i) => (
                <SecondaryClientRow
                  key={entry.id}
                  entry={entry}
                  colorIndex={i + 1}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function PrimaryClientCard({ entry }: { entry: MockEntry }) {
  const avatarColor = AVATAR_COLORS[0];
  const initial = entry.name.charAt(0);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({ gap: s(14), opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: COLORS.primary300,
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary300, letterSpacing: 0.3 }}
          >
            다음 만남
          </Typography>
        </View>
        <Typography
          variant="label-01"
          weight="semibold"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontVariant: ["tabular-nums"],
          }}
        >
          오늘 {entry.startText}
        </Typography>
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(14) }}
      >
        <View
          style={{
            width: s(60),
            height: s(60),
            borderRadius: s(30),
            backgroundColor: avatarColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: avatarColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(24),
              lineHeight: s(28),
              letterSpacing: -0.5,
            }}
          >
            {initial}
          </Typography>
        </View>

        <View style={{ flex: 1, gap: s(6) }}>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.white }}
            numberOfLines={1}
          >
            {entry.name}
          </Typography>
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              paddingVertical: s(6),
              paddingHorizontal: s(10),
              borderRadius: s(999),
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Ionicons
              name="document-text"
              size={12}
              color="rgba(255,255,255,0.9)"
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              이전 일지 보기
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={12}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SecondaryClientRow({
  entry,
  colorIndex,
}: {
  entry: MockEntry;
  colorIndex: number;
}) {
  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = entry.name.charAt(0);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
        paddingVertical: s(8),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: avatarColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          weight="semibold"
          style={{
            color: COLORS.white,
            fontSize: s(13),
            lineHeight: s(16),
          }}
        >
          {initial}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.white, flex: 1 }}
        numberOfLines={1}
      >
        {entry.name}
      </Typography>
      <Typography
        variant="label-01"
        weight="medium"
        style={{
          color: "rgba(255,255,255,0.6)",
          fontVariant: ["tabular-nums"],
        }}
      >
        {entry.startText}
      </Typography>
      <Ionicons
        name="chevron-forward"
        size={14}
        color="rgba(255,255,255,0.4)"
      />
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  B — 세로 카드 캐러셀 (가로 스와이프)
 *  각 카드는 정보를 세로로 배치. 첫 카드만 폭·라벨·보더로 강조.
 * ═══════════════════════════════════════════════════════════ */

const PRIMARY_CARD_WIDTH = s(220);
const SECONDARY_CARD_WIDTH = s(156);
const CARD_GAP = s(12);

function CarouselVariant() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingLeft: s(LAYOUT.screenPaddingX),
        paddingRight: s(LAYOUT.screenPaddingX),
        gap: CARD_GAP,
      }}
      decelerationRate="fast"
      snapToInterval={SECONDARY_CARD_WIDTH + CARD_GAP}
      snapToAlignment="start"
    >
      {ENTRIES.map((entry, i) =>
        i === 0 ? (
          <PrimaryVerticalCard key={entry.id} entry={entry} colorIndex={i} />
        ) : (
          <SecondaryVerticalCard key={entry.id} entry={entry} colorIndex={i} />
        ),
      )}
    </ScrollView>
  );
}

/** 첫 카드 — 폭이 더 크고, "다음 만남" 라벨 + 큰 아바타 + 명시 CTA pill로 강조 */
function PrimaryVerticalCard({
  entry,
  colorIndex,
}: {
  entry: MockEntry;
  colorIndex: number;
}) {
  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = entry.name.charAt(0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}님의 이전 회기 일지 보기`}
      style={({ pressed }) => ({
        width: PRIMARY_CARD_WIDTH,
        paddingTop: s(16),
        paddingBottom: s(16),
        paddingHorizontal: s(16),
        borderRadius: s(20),
        backgroundColor: COLORS.gray[800],
        borderWidth: 1.5,
        borderColor: COLORS.primary300,
        gap: s(14),
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {/* 상단 라벨 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: COLORS.primary300,
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary300, letterSpacing: 0.3 }}
          >
            다음 만남
          </Typography>
        </View>
        <Typography
          variant="label-01"
          weight="semibold"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontVariant: ["tabular-nums"],
          }}
        >
          {entry.startText}
        </Typography>
      </View>

      {/* 중앙: 큰 아바타 + 이름 */}
      <View style={{ alignItems: "center", gap: s(12), paddingVertical: s(4) }}>
        <View
          style={{
            width: s(72),
            height: s(72),
            borderRadius: s(36),
            backgroundColor: avatarColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: avatarColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.5,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(28),
              lineHeight: s(32),
              letterSpacing: -0.5,
            }}
          >
            {initial}
          </Typography>
        </View>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {entry.name}
        </Typography>
      </View>

      {/* CTA pill — 풀폭 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: s(6),
          paddingVertical: s(10),
          borderRadius: s(12),
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      >
        <Ionicons name="document-text" size={14} color={COLORS.white} />
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          이전 일지 보기
        </Typography>
        <Ionicons name="chevron-forward" size={14} color={COLORS.white} />
      </View>
    </Pressable>
  );
}

/** 나머지 카드 — 폭 좁고 보더 옅음, 같은 세로 구조지만 시각 무게 감소 */
function SecondaryVerticalCard({
  entry,
  colorIndex,
}: {
  entry: MockEntry;
  colorIndex: number;
}) {
  const avatarColor = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = entry.name.charAt(0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}님의 이전 회기 일지 보기`}
      style={({ pressed }) => ({
        width: SECONDARY_CARD_WIDTH,
        paddingTop: s(16),
        paddingBottom: s(14),
        paddingHorizontal: s(14),
        borderRadius: s(20),
        backgroundColor: COLORS.gray[800],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        gap: s(12),
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {/* 시간 라벨 */}
      <Typography
        variant="label-01"
        weight="semibold"
        style={{
          color: "rgba(255,255,255,0.55)",
          fontVariant: ["tabular-nums"],
        }}
      >
        {entry.startText}
      </Typography>

      {/* 중앙: 아바타 + 이름 */}
      <View style={{ alignItems: "center", gap: s(8), paddingVertical: s(2) }}>
        <View
          style={{
            width: s(52),
            height: s(52),
            borderRadius: s(26),
            backgroundColor: avatarColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(20),
              lineHeight: s(24),
              letterSpacing: -0.3,
            }}
          >
            {initial}
          </Typography>
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {entry.name}
        </Typography>
      </View>

      {/* 하단 보조 CTA — 톤 약하게 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: s(4),
          paddingVertical: s(6),
        }}
      >
        <Typography
          variant="caption-01"
          weight="medium"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          이전 일지
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={12}
          color="rgba(255,255,255,0.55)"
        />
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  시안 메모
 * ═══════════════════════════════════════════════════════════ */

function VariantMemo({ variant }: { variant: Variant }) {
  const memo: Record<Variant, { title: string; desc: string }> = {
    panel: {
      title: "A — 단일 컨테이너 정리 (현재 production)",
      desc: '첫 번째 = 풀폭 가로 강조 카드, 나머지 = 압축 행. 모든 정보가 한 화면에 노출되고 스크롤·스와이프 없이 즉시 비교 가능. 단, 정보 단위가 "다음 1명"과 "나머지"로 명확히 이분됨.',
    },
    carousel: {
      title: "B — 세로 카드 + 가로 스와이프",
      desc: "내담자 카드들이 동일한 세로 구조 안에서 카드별로 캡슐화. 첫 카드는 폭(220) + primary300 보더 + CTA pill로 강조, 나머지는 좁은 폭(156) + 옅은 보더. 정보가 카드 단위로 평등하지만 스와이프 동작 필요.",
    },
  };
  const { title, desc } = memo[variant];

  return (
    <View
      style={{
        marginTop: s(32),
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: s(16),
        padding: s(16),
        gap: s(8),
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {title}
      </Typography>
      <Typography
        variant="body-03"
        style={{
          color: "rgba(255,255,255,0.7)",
          lineHeight: s(20),
        }}
      >
        {desc}
      </Typography>
    </View>
  );
}
