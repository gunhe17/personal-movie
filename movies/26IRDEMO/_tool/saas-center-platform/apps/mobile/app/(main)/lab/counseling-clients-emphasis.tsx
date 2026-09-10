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
 * 상담 상세 · 내담자 리스트 강조 비교 lab.
 *
 * 대상: app/(main)/counseling/[id].tsx 의 "내담자" 섹션 ClientCard.
 *   - 현재는 회색 원 + person 아이콘만 있어 시각 자극이 거의 없음
 *   - 한 케이스에 보통 1~4명의 내담자가 있으며, 진행 상황 차이를 한 눈에 보고 싶음
 *
 * 시안 4개 (탭 전환):
 *   A — 현재 (대조군): gray 원 + person 아이콘 + 우측 회기 카운트
 *   B — 이니셜 아바타 + 진행도 링: 이름 첫글자 + Extended Palette + 원형 progress ring
 *   C — 성별 액센트 + 가로 바: 좌측 컬러 액센트 + progress bar로 진행도 강조
 *   D — 2단 카드: 상단 인적, 하단 큰 progress bar로 회기 진행을 카드의 주인공으로
 */

type Variant =
  | "current"
  | "initial-ring"
  | "accent-bar"
  | "two-row"
  | "grid-2col"
  | "dot-vertical";

/** 가로형(row) — 한 줄로 정보를 펼치는 시안 */
const VARIANTS_ROW: { key: Variant; label: string }[] = [
  { key: "current", label: "A 현재" },
  { key: "initial-ring", label: "B 링" },
  { key: "accent-bar", label: "C 바" },
  { key: "two-row", label: "D 2단" },
];

/** 세로형(column) — 정보를 위→아래로 쌓는 시안 */
const VARIANTS_COL: { key: Variant; label: string }[] = [
  { key: "grid-2col", label: "E 그리드" },
  { key: "dot-vertical", label: "F 회기 dot" },
];

type Gender = "male" | "female" | "unknown";

interface MockClient {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  completed: number;
  total: number;
}

const MOCK_CLIENTS: MockClient[] = [
  { id: "1", name: "김민준", gender: "male", age: 8, completed: 8, total: 12 },
  { id: "2", name: "박서연", gender: "female", age: 10, completed: 12, total: 12 },
  { id: "3", name: "이도현", gender: "male", age: 9, completed: 3, total: 12 },
  { id: "4", name: "최지우", gender: "female", age: 7, completed: 0, total: 12 },
];

const GENDER_LABEL: Record<Gender, string> = {
  male: "남",
  female: "여",
  unknown: "",
};

/** 진행률 → palette 색상 (정해진 매핑) */
function getProgressPalette(ratio: number) {
  if (ratio >= 1) return { solid: COLORS.palette.green, bg: COLORS.paletteBg.green };
  if (ratio >= 0.67)
    return { solid: COLORS.palette.greenYellow, bg: COLORS.paletteBg.greenYellow };
  if (ratio > 0)
    return { solid: COLORS.palette.orange, bg: COLORS.paletteBg.orange };
  return { solid: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

/** 성별 → palette 액센트 색상 */
function getGenderPalette(gender: Gender) {
  if (gender === "male") return { solid: COLORS.palette.blue, bg: COLORS.paletteBg.blue };
  if (gender === "female")
    return { solid: COLORS.palette.coral, bg: COLORS.paletteBg.coral };
  return { solid: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

export default function CounselingClientsEmphasisLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");

  return (
    <View className="flex-1 bg-base">
      {/* 헤더 + 탭 */}
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
              상담 상세 · 내담자 리스트
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 — 가로형/세로형 그룹 두 줄 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
            gap: s(6),
          }}
        >
          <VariantTabRow
            label="가로형"
            items={VARIANTS_ROW}
            value={variant}
            onChange={setVariant}
          />
          <VariantTabRow
            label="세로형"
            items={VARIANTS_COL}
            value={variant}
            onChange={setVariant}
          />
        </View>
      </SafeAreaView>

      {/* 미리보기 — 상담 상세 화면 일부를 시안별로 다르게 */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 컨텍스트 — 변하지 않는 부분 (실제 상담 상세 페이지처럼) */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(4),
            paddingBottom: s(20),
          }}
        >
          <Typography
            variant="title-01"
            weight="bold"
            className="text-gray-900"
            style={{ marginBottom: s(12) }}
          >
            상담 정보
          </Typography>
          <ContextRow label="프로그램" value="놀이치료-그룹" />
          <ContextRow label="담당자" value="김민지, 박지영" />
          <ContextRow label="시작일" value="2026. 4. 15" />
        </View>

        {/* 시안별 내담자 섹션 */}
        <View style={{ marginTop: s(16), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
          <Typography
            variant="body-02"
            weight="bold"
            className="text-gray-900"
            style={{ marginBottom: s(8) }}
          >
            내담자
          </Typography>

          {variant === "grid-2col" ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                rowGap: s(8),
              }}
            >
              {MOCK_CLIENTS.map((client) => (
                <View key={client.id} style={{ width: "49%" }}>
                  <CardGrid2Col client={client} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: s(8) }}>
              {MOCK_CLIENTS.map((client) => {
                if (variant === "current")
                  return <CardCurrent key={client.id} client={client} />;
                if (variant === "initial-ring")
                  return <CardInitialRing key={client.id} client={client} />;
                if (variant === "accent-bar")
                  return <CardAccentBar key={client.id} client={client} />;
                if (variant === "two-row")
                  return <CardTwoRow key={client.id} client={client} />;
                return <CardDotVertical key={client.id} client={client} />;
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────── 상단 컨텍스트 행 ───────── */

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: s(6) }}>
      <Typography
        variant="label-01"
        className="text-gray-500"
        style={{ width: s(88) }}
      >
        {label}
      </Typography>
      <Typography
        variant="label-01"
        weight="medium"
        className="flex-1 text-gray-900"
      >
        {value}
      </Typography>
    </View>
  );
}

/* ───────── A. 현재 (대조군) ───────── */

function CardCurrent({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(14),
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          justifyContent: "center",
          marginRight: s(12),
        }}
      >
        <Ionicons name="person" size={16} color={COLORS.gray[400]} />
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          {client.name}
        </Typography>
        {meta.length > 0 && (
          <Typography
            variant="label-01"
            className="text-gray-500"
            style={{ marginLeft: s(6) }}
          >
            {meta}
          </Typography>
        )}
      </View>
      <Typography
        variant="label-01"
        className="text-gray-500"
        style={{ marginRight: s(6) }}
      >
        {client.completed}/{client.total}회
      </Typography>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

/* ───────── B. 이니셜 아바타 + 진행도 링 ───────── */

function CardInitialRing({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  const ratio = client.total > 0 ? client.completed / client.total : 0;
  const progressColor = getProgressPalette(ratio);
  const genderColor = getGenderPalette(client.gender);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(14),
      }}
    >
      {/* 이니셜 아바타 — 성별 컬러 OpacityBG + Solid 텍스트 */}
      <View
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: genderColor.bg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: s(12),
        }}
      >
        <Typography
          variant="body-02"
          weight="bold"
          style={{ color: genderColor.solid }}
        >
          {client.name.charAt(0)}
        </Typography>
      </View>

      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          {client.name}
        </Typography>
        {meta.length > 0 && (
          <Typography
            variant="label-01"
            className="text-gray-500"
            style={{ marginTop: s(2) }}
          >
            {meta}
          </Typography>
        )}
      </View>

      {/* 원형 진행도 링 */}
      <ProgressRing
        ratio={ratio}
        color={progressColor.solid}
        bgColor={progressColor.bg}
        completed={client.completed}
        total={client.total}
      />
      <View style={{ marginLeft: s(10) }}>
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>
    </TouchableOpacity>
  );
}

/** 원형 진행도 링 — SVG 없이 View 두 겹으로 단순 표현 (테두리 + 카운트 텍스트) */
function ProgressRing({
  ratio,
  color,
  bgColor,
  completed,
  total,
}: {
  ratio: number;
  color: string;
  bgColor: string;
  completed: number;
  total: number;
}) {
  const SIZE = s(44);
  const STROKE = s(3);

  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: bgColor,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* 진행도 보더 (전체) */}
      <View
        style={{
          position: "absolute",
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: STROKE,
          borderColor: color,
          opacity: 0.25,
        }}
      />
      {/* 진행도 보더 (active) — 100% 완료시 풀 컬러로 */}
      {ratio >= 1 && (
        <View
          style={{
            position: "absolute",
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderWidth: STROKE,
            borderColor: color,
          }}
        />
      )}
      <Typography
        variant="label-02"
        weight="bold"
        style={{ color, lineHeight: s(14) }}
      >
        {completed}
      </Typography>
      <Typography
        variant="caption-01"
        style={{ color, opacity: 0.7, lineHeight: s(12) }}
      >
        /{total}
      </Typography>
    </View>
  );
}

/* ───────── C. 성별 액센트 라인 + 가로 progress bar ───────── */

function CardAccentBar({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  const ratio = client.total > 0 ? client.completed / client.total : 0;
  const progressColor = getProgressPalette(ratio);
  const genderColor = getGenderPalette(client.gender);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        overflow: "hidden",
      }}
    >
      {/* 좌측 성별 액센트 라인 */}
      <View
        style={{
          width: s(4),
          backgroundColor: genderColor.solid,
        }}
      />
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingVertical: s(14),
          gap: s(12),
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {client.name}
            </Typography>
            {meta.length > 0 && (
              <Typography
                variant="label-01"
                className="text-gray-500"
                style={{ marginLeft: s(6) }}
              >
                {meta}
              </Typography>
            )}
          </View>

          {/* 가로 progress bar + 분수 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(8),
              marginTop: s(8),
            }}
          >
            <View
              style={{
                flex: 1,
                height: s(6),
                borderRadius: s(3),
                backgroundColor: COLORS.gray[100],
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
                  height: "100%",
                  backgroundColor: progressColor.solid,
                  borderRadius: s(3),
                }}
              />
            </View>
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: progressColor.solid, minWidth: s(40), textAlign: "right" }}
            >
              {client.completed}/{client.total}회
            </Typography>
          </View>
        </View>
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>
    </TouchableOpacity>
  );
}

/* ───────── D. 2단 카드 — 큰 진행도 ───────── */

function CardTwoRow({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  const ratio = client.total > 0 ? client.completed / client.total : 0;
  const progressColor = getProgressPalette(ratio);
  const genderColor = getGenderPalette(client.gender);
  const percent = Math.round(ratio * 100);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(14),
        gap: s(12),
      }}
    >
      {/* 상단: 인적 정보 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: genderColor.bg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(12),
          }}
        >
          <Typography
            variant="body-02"
            weight="bold"
            style={{ color: genderColor.solid }}
          >
            {client.name.charAt(0)}
          </Typography>
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="body-02" weight="bold" className="text-gray-900">
            {client.name}
          </Typography>
          {meta.length > 0 && (
            <Typography
              variant="label-01"
              className="text-gray-500"
              style={{ marginTop: s(2) }}
            >
              {meta}
            </Typography>
          )}
        </View>
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>

      {/* 하단: 진행도 강조 */}
      <View
        style={{
          backgroundColor: progressColor.bg,
          borderRadius: s(10),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          gap: s(6),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: progressColor.solid }}
          >
            회기 진행
          </Typography>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: s(4) }}>
            <Typography
              variant="body-02"
              weight="bold"
              style={{ color: progressColor.solid }}
            >
              {client.completed}
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: progressColor.solid, opacity: 0.7 }}
            >
              / {client.total}회
            </Typography>
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: progressColor.solid, marginLeft: s(4) }}
            >
              {percent}%
            </Typography>
          </View>
        </View>
        <View
          style={{
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.white,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
              height: "100%",
              backgroundColor: progressColor.solid,
              borderRadius: s(3),
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ───────── 탭 그룹 (가로형/세로형 한 줄) ───────── */

function VariantTabRow({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { key: Variant; label: string }[];
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
      <Typography
        variant="caption-01"
        weight="semibold"
        style={{ color: COLORS.gray[500], width: s(36) }}
      >
        {label}
      </Typography>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: COLORS.gray[50],
          borderRadius: s(10),
          padding: s(3),
          gap: s(2),
        }}
      >
        {items.map((v) => {
          const active = value === v.key;
          return (
            <Pressable
              key={v.key}
              onPress={() => onChange(v.key)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: s(7),
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
                variant="label-02"
                weight={active ? "semibold" : "medium"}
                style={{ color: active ? COLORS.text.title.default : COLORS.gray[500] }}
              >
                {v.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── E. 2열 그리드 — 미니 인물 카드 (세로형) ───────── */

function CardGrid2Col({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  const ratio = client.total > 0 ? client.completed / client.total : 0;
  const progressColor = getProgressPalette(ratio);
  const genderColor = getGenderPalette(client.gender);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(12),
        paddingVertical: s(14),
        alignItems: "center",
        gap: s(8),
      }}
    >
      {/* 아바타 */}
      <View
        style={{
          width: s(48),
          height: s(48),
          borderRadius: s(24),
          backgroundColor: genderColor.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: genderColor.solid }}
        >
          {client.name.charAt(0)}
        </Typography>
      </View>

      {/* 이름·메타 */}
      <View style={{ alignItems: "center" }}>
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          {client.name}
        </Typography>
        {meta.length > 0 && (
          <Typography
            variant="label-02"
            className="text-gray-500"
            style={{ marginTop: s(2) }}
          >
            {meta}
          </Typography>
        )}
      </View>

      {/* 진행도 — 가는 바 + 분수 */}
      <View style={{ width: "100%", gap: s(4), marginTop: s(2) }}>
        <View
          style={{
            height: s(4),
            borderRadius: s(2),
            backgroundColor: COLORS.gray[100],
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
              height: "100%",
              backgroundColor: progressColor.solid,
              borderRadius: s(2),
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Typography
            variant="caption-01"
            weight="medium"
            style={{ color: progressColor.solid }}
          >
            {Math.round(ratio * 100)}%
          </Typography>
          <Typography variant="caption-01" className="text-gray-500">
            {client.completed}/{client.total}회
          </Typography>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ───────── F. 회기 dot 시각화 — 1열 세로 카드 ───────── */

function CardDotVertical({ client }: { client: MockClient }) {
  const meta = [GENDER_LABEL[client.gender], `만 ${client.age}세`]
    .filter(Boolean)
    .join(" | ");
  const ratio = client.total > 0 ? client.completed / client.total : 0;
  const progressColor = getProgressPalette(ratio);
  const genderColor = getGenderPalette(client.gender);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(14),
        gap: s(12),
      }}
    >
      {/* 상단: 아바타 + 이름·메타 + 화살표 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: genderColor.bg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(12),
          }}
        >
          <Typography
            variant="body-02"
            weight="bold"
            style={{ color: genderColor.solid }}
          >
            {client.name.charAt(0)}
          </Typography>
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="body-02" weight="bold" className="text-gray-900">
            {client.name}
          </Typography>
          {meta.length > 0 && (
            <Typography
              variant="label-01"
              className="text-gray-500"
              style={{ marginTop: s(2) }}
            >
              {meta}
            </Typography>
          )}
        </View>
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>

      {/* 하단: 회기 dot 시각화 + 분수 */}
      <View style={{ gap: s(8) }}>
        {/* 섹션 라벨 — 단독 row */}
        <Typography variant="label-02" weight="medium" className="text-gray-500">
          회기 진행
        </Typography>
        {/* dot + 분수 한 row — 같은 의미 그룹으로 묶기 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: s(6),
            }}
          >
            {Array.from({ length: client.total }).map((_, i) => {
              const done = i < client.completed;
              return (
                <View
                  key={i}
                  style={{
                    width: s(16),
                    height: s(16),
                    borderRadius: s(8),
                    // 채워진 dot은 alpha 99(60%)로 톤다운 — 색조 유지, 강도만 낮춤
                    backgroundColor: done
                      ? `${progressColor.solid}99`
                      : COLORS.gray[100],
                    borderWidth: done ? 0 : 1,
                    borderColor: COLORS.gray[200],
                  }}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: s(4) }}>
            <Typography
              variant="body-02"
              weight="bold"
              style={{ color: progressColor.solid }}
            >
              {client.completed}
            </Typography>
            <Typography
              variant="label-02"
              style={{ color: COLORS.gray[500] }}
            >
              / {client.total}회
            </Typography>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
