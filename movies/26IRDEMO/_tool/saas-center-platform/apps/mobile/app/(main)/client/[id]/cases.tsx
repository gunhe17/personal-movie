import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCenterStore } from "@/features/center";
import {
  useClientDetail,
  useClientCases,
  useCounselingCases,
  type AssessmentCaseSummary,
  type CounselingCaseListItem,
} from "@/features/client";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Segment } from "@/shared/components/ui/Segment";
import { s } from "@/shared/utils/scale";
import { CounselingCaseCard } from "@/shared/components/cards/CounselingCaseCard";
import {
  AssessmentCaseCard,
  type AssessmentCaseCardItem,
} from "@/shared/components/cards/AssessmentCaseCard";

type CategoryKind = "counseling" | "assessment";
type StatusFilter = "all" | "active" | "ended";

function isCounselingActive(item: CounselingCaseListItem): boolean {
  return item.status === "active";
}
function isCounselingEnded(item: CounselingCaseListItem): boolean {
  return item.status === "completed" || item.status === "cancelled";
}
function isAssessmentActive(item: AssessmentCaseSummary): boolean {
  return item.status === "pending" || item.status === "processing";
}
function isAssessmentEnded(item: AssessmentCaseSummary): boolean {
  return item.status === "completed" || item.status === "cancelled";
}

function calculateAge(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export default function ClientCasesScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const centerId = useCenterStore((store) => store.centerId);
  const kind: CategoryKind =
    type === "assessment" ? "assessment" : "counseling";

  const { data: client } = useClientDetail(centerId, id!);
  const { data: counselingCases, isLoading: counselingLoading } =
    useCounselingCases(centerId, id!, client?.name ?? null);
  const { data: assessmentCases, isLoading: assessmentLoading } =
    useClientCases(centerId, id!);

  const isLoading =
    kind === "counseling" ? counselingLoading : assessmentLoading;

  const counselingList = counselingCases ?? [];
  const assessmentList = assessmentCases ?? [];
  const clientAge = useMemo(
    () => calculateAge(client?.birth_date ?? null),
    [client?.birth_date],
  );

  const [filter, setFilter] = useState<StatusFilter>("all");

  const title = useMemo(() => {
    const base = kind === "counseling" ? "상담" : "검사";
    if (client?.name) return `${client.name}의 ${base}`;
    return base;
  }, [kind, client?.name]);

  // 필터별 카운트 — Segment count 노출용
  const counts = useMemo(() => {
    if (kind === "counseling") {
      return {
        all: counselingList.length,
        active: counselingList.filter(isCounselingActive).length,
        ended: counselingList.filter(isCounselingEnded).length,
      };
    }
    return {
      all: assessmentList.length,
      active: assessmentList.filter(isAssessmentActive).length,
      ended: assessmentList.filter(isAssessmentEnded).length,
    };
  }, [kind, counselingList, assessmentList]);

  const filteredCounseling = useMemo(() => {
    if (filter === "all") return counselingList;
    return counselingList.filter(
      filter === "active" ? isCounselingActive : isCounselingEnded,
    );
  }, [counselingList, filter]);
  const filteredAssessment = useMemo(() => {
    if (filter === "all") return assessmentList;
    return assessmentList.filter(
      filter === "active" ? isAssessmentActive : isAssessmentEnded,
    );
  }, [assessmentList, filter]);

  // 검사 케이스 카드 — 세트명·검사명·일정은 응답 그대로,
  // 내담자(아바타/이름)는 현재 보고 있는 client 컨텍스트를 주입한다.
  const assessmentCardItems = useMemo<AssessmentCaseCardItem[]>(
    () =>
      filteredAssessment.map((a) => ({
        case_id: a.case_id,
        status: a.status,
        set_name: a.set_name ?? null,
        assessment_names: a.assessment_names ?? [],
        scheduled_start: a.scheduled_start ?? null,
        scheduled_end: a.scheduled_end ?? null,
        room_name: a.room_name ?? null,
        clients: [
          {
            client_id: client?.id ?? id,
            name: client?.name ?? null,
            gender: client?.gender ?? null,
            age: clientAge,
            profile_image_url: client?.profile_image_url ?? null,
          },
        ],
      })),
    [filteredAssessment, client, clientAge, id],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 헤더 */}
      <View
        style={{ height: s(52), paddingHorizontal: s(20) }}
        className="flex-row items-center"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography
          variant="title-01"
          weight="semibold"
          className="flex-1 text-gray-900"
          style={{ marginLeft: s(6) }}
          numberOfLines={1}
        >
          {title}
        </Typography>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: s(16),
          paddingBottom: s(40),
          paddingHorizontal: s(20),
          gap: s(16),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상태 필터 — 전체 / 진행중 / 종결 */}
        <Segment<StatusFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "전체", count: counts.all },
            { value: "active", label: "진행중", count: counts.active },
            { value: "ended", label: "종결", count: counts.ended },
          ]}
        />

        {/* 리스트 — 현황 리스트와 동일한 공용 카드 */}
        {isLoading ? (
          <View style={{ paddingVertical: s(64) }} className="items-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : kind === "counseling" && filteredCounseling.length > 0 ? (
          <View style={{ gap: s(12) }}>
            {filteredCounseling.map((item) => (
              <CounselingCaseCard
                key={item.case_id}
                item={item}
                onPress={(caseId) =>
                  router.push(`/(main)/counseling/${caseId}`)
                }
              />
            ))}
          </View>
        ) : kind === "assessment" && assessmentCardItems.length > 0 ? (
          <View style={{ gap: s(12) }}>
            {assessmentCardItems.map((item) => (
              <AssessmentCaseCard
                key={item.case_id}
                item={item}
                onPress={(caseId) =>
                  router.push(`/(main)/assessment/${caseId}`)
                }
              />
            ))}
          </View>
        ) : (
          <EmptyState kind={kind} filter={filter} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 빈 상태 — 전체 / 필터별 메시지 분리 ───
function EmptyState({
  kind,
  filter,
}: {
  kind: CategoryKind;
  filter: StatusFilter;
}) {
  const base = kind === "counseling" ? "상담" : "검사";
  const particle = kind === "counseling" ? "이" : "가";
  const message =
    filter === "all"
      ? `접수된 ${base}${particle} 없습니다`
      : filter === "active"
        ? `진행중인 ${base}${particle} 없습니다`
        : `종결된 ${base}${particle} 없습니다`;
  return (
    <View
      style={{ paddingVertical: s(48), gap: s(8) }}
      className="items-center"
    >
      <Ionicons
        name={
          kind === "counseling" ? "chatbubbles-outline" : "clipboard-outline"
        }
        size={s(40)}
        color={COLORS.gray[300]}
      />
      <Typography variant="body-03" className="text-gray-400">
        {message}
      </Typography>
    </View>
  );
}
