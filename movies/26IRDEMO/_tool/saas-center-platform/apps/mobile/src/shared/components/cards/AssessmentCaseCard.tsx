import { memo, useState } from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { GenderAgeMeta } from "@/shared/components/ui/GenderAgeMeta";
import { SetBadge } from "@/shared/components/ui/Badge";
import { BadgeRound } from "@/shared/components/ui/BadgeRound";
import { parseDate } from "@/shared/utils/date";
import { s } from "@/shared/utils/scale";

/**
 * 검사 케이스 카드 (아바타 + 정보 + D-day 뱃지).
 *
 * 검사 현황 리스트(`/(main)/assessment`)와 내담자 상세 케이스 목록(`client/[id]/cases`) 공용.
 * 내담자 상세는 케이스에 내담자 정보가 없어 화면에서 client 정보를 주입한다.
 * 일정·세트명 등 일부 필드가 없을 수 있어 optional 처리하고, 없으면 상태 라벨로 폴백한다.
 */

export type AssessmentStatusKey =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled";

export interface AssessmentCaseCardItem {
  case_id: string;
  /** 검사 코드. 검사 현황 리스트는 제공, 내담자 상세 케이스 탭(summary)은 미제공 → optional */
  case_code?: string | null;
  status: string;
  set_name?: string | null;
  assessment_names?: string[] | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  room_name?: string | null;
  clients: Array<{
    client_id?: string | null;
    name: string | null;
    gender?: string | null;
    age?: number | null;
    profile_image_url?: string | null;
  }>;
}

const STATUS_LABELS: Record<AssessmentStatusKey, string> = {
  pending: "예정",
  processing: "진행중",
  completed: "완료",
  cancelled: "취소",
};

const AVATAR_PALETTE = [
  { bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  { bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
  { bg: COLORS.paletteBg.orange, fg: COLORS.palette.orange },
  { bg: COLORS.paletteBg.violet, fg: COLORS.palette.violet },
  { bg: COLORS.paletteBg.pink, fg: COLORS.palette.pink },
  { bg: COLORS.paletteBg.mint, fg: COLORS.palette.mint },
] as const;

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function formatScheduledShort(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return format(parseDate(value), "M. d (E)", { locale: ko });
  } catch {
    return null;
  }
}

function formatTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  if (!startIso) return null;
  try {
    const startTime = format(parseDate(startIso), "HH:mm");
    if (!endIso) return startTime;
    const endTime = format(parseDate(endIso), "HH:mm");
    return `${startTime}-${endTime}`;
  } catch {
    return null;
  }
}

function computeDDay(target: string | null | undefined): number | null {
  if (!target) return null;
  try {
    const t = parseDate(target);
    const targetMidnight = new Date(
      t.getFullYear(),
      t.getMonth(),
      t.getDate(),
    ).getTime();
    const now = new Date();
    const nowMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function genderToLabel(g: string | null | undefined): string | null {
  if (!g) return null;
  const v = g.toLowerCase();
  if (v === "male" || v === "m" || v === "남" || v === "남자") return "남";
  if (v === "female" || v === "f" || v === "여" || v === "여자") return "여";
  return g;
}

function getAssessmentDisplay(item: AssessmentCaseCardItem): {
  hasSet: boolean;
  name: string;
} {
  if (item.set_name) return { hasSet: true, name: item.set_name };
  const names = item.assessment_names ?? [];
  if (names.length === 0) return { hasSet: false, name: "-" };
  if (names.length === 1) return { hasSet: false, name: names[0] };
  return { hasSet: false, name: `${names[0]} 외 ${names.length - 1}건` };
}

/** 우측 뱃지 — 3색 통일: 완료=green, 임박(D-3~D-DAY)=red, 그 외 전부=gray */
function getDDayBadge(
  status: AssessmentStatusKey,
  dday: number | null,
): { label: string; color: string; bg: string } {
  if (status === "completed") {
    return {
      label: "완료",
      color: COLORS.tag.green.fg,
      bg: COLORS.tag.green.bg,
    };
  }
  if (dday === null) {
    return {
      label: status === "processing" ? "진행중" : STATUS_LABELS[status],
      color: COLORS.tag.gray.fg,
      bg: COLORS.tag.gray.bg,
    };
  }
  const label =
    dday === 0 ? "D-DAY" : dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`;
  const imminent = dday >= 0 && dday <= 3; // D-3 ~ D-DAY
  return {
    label,
    color: imminent ? COLORS.tag.red.fg : COLORS.tag.gray.fg,
    bg: imminent ? COLORS.tag.red.bg : COLORS.tag.gray.bg,
  };
}

/** 메타 구분 세로선 — 10px, gray-200 */
function MetaDivider() {
  return (
    <View
      style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }}
    />
  );
}

export const AssessmentCaseCard = memo(function AssessmentCaseCard({
  item,
  onPress,
}: {
  item: AssessmentCaseCardItem;
  onPress: (caseId: string) => void;
}) {
  const status = item.status as AssessmentStatusKey;
  const mainClient = item.clients[0];
  const clientName = mainClient?.name ?? "-";
  const [avatarError, setAvatarError] = useState(false);
  const showAvatarImage = !!mainClient?.profile_image_url && !avatarError;
  const genderLabel = genderToLabel(mainClient?.gender ?? null);
  const age = mainClient?.age;
  const extraCount = Math.max(0, item.clients.length - 1);

  const { hasSet, name: assessmentName } = getAssessmentDisplay(item);

  const scheduledDate = formatScheduledShort(item.scheduled_start);
  const timeRange = formatTimeRange(item.scheduled_start, item.scheduled_end);
  const dday = computeDDay(item.scheduled_start);
  const badge = getDDayBadge(status, dday);

  const avatar = avatarColor(mainClient?.client_id ?? item.case_id);

  const scheduleLeft =
    [scheduledDate, timeRange].filter(Boolean).join(" ") || "일정 미정";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item.case_id)}
      accessibilityLabel={`${clientName} 검사 상세 보기`}
      accessibilityRole="button"
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: s(16),
        padding: s(16),
        gap: s(4),
      }}
    >
      {/* 케이스 코드 — 최상단 caption */}
      {item.case_code && (
        <Typography
          variant="label-01"
          weight="regular"
          numberOfLines={1}
          // 카드 전체 gap(s4)을 상쇄 → 코드↔내담자 정보 간격 0 (상담 카드와 통일)
          style={{ color: COLORS.gray[500], marginBottom: -s(4) }}
        >
          {item.case_code}
        </Typography>
      )}
      <View
        style={{ flexDirection: "row", gap: s(16), alignItems: "center" }}
      >
        {/* 아바타 */}
      <View
        style={{
          width: s(48),
          height: s(48),
          borderRadius: s(24),
          backgroundColor: avatar.bg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {showAvatarImage ? (
          <Image
            source={{ uri: mainClient!.profile_image_url! }}
            style={{ width: s(48), height: s(48) }}
            onError={() => setAvatarError(true)}
          />
        ) : (
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: avatar.fg }}
          >
            {clientName.trim()?.[0] ?? "?"}
          </Typography>
        )}
      </View>

      {/* 정보 stack */}
      <View style={{ flex: 1, gap: s(4) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <View
            className="flex-row items-center"
            style={{ flex: 1, gap: s(6) }}
          >
            <Typography
              variant="body-01"
              weight="semibold"
              numberOfLines={1}
              style={{ flexShrink: 1, color: COLORS.gray.black }}
            >
              {clientName}
              {extraCount > 0 ? ` 외 ${extraCount}명` : ""}
            </Typography>
            <GenderAgeMeta genderLabel={genderLabel} age={age} />
          </View>
          <BadgeRound bg={badge.bg} color={badge.color}>
            {badge.label}
          </BadgeRound>
        </View>

        {/* 검사명 (세트 뱃지) */}
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          {hasSet && <SetBadge />}
          <Typography
            variant="body-02"
            weight="medium"
            numberOfLines={1}
            style={{ flexShrink: 1, color: COLORS.gray[900] }}
          >
            {assessmentName}
          </Typography>
        </View>

        {/* 일정 메타 — 날짜 | 상담실 (세로선 구분, 상담 카드와 통일) */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography
            variant="body-03"
            numberOfLines={1}
            style={{ flexShrink: 1, color: COLORS.gray[600] }}
          >
            {scheduleLeft}
          </Typography>
          {!!item.room_name && (
            <>
              <MetaDivider />
              <Typography
                variant="body-03"
                numberOfLines={1}
                style={{ color: COLORS.gray[600] }}
              >
                {item.room_name}
              </Typography>
            </>
          )}
        </View>
      </View>
      </View>
    </TouchableOpacity>
  );
});
