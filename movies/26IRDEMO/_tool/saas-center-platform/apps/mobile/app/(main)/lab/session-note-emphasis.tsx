import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT, GAP, RADIUS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 회기 상세 — 일지 작성 강조 변주 lab.
 *
 * 회기의 핵심 액션인 "내담자 일지 작성"이 현재 디자인에서 부속 메타라인으로
 * 들어가 시각 비중이 부족하다는 문제를 검토하기 위한 비교 시안 모음.
 *
 *   현재         — ParticipantCard 두번째 라인의 텍스트 메타 (대조군)
 *   A · 상태     — 미작성/작성됨 카드 룩을 상태별로 차별화
 *   B · 분리     — 일지 액션을 카드 하단 독립 행으로 분리
 *   C · 풀 컬러  — 미작성 카드를 primary-500 풀 컬러로 강한 명도 대비
 *   D · 그룹     — 섹션을 "작성할 일지 / 작성됨" 두 그룹으로 To-Do화
 *   E · 일지 우선 — 일지 액션을 카드의 메인 메시지로, 출결을 보조로
 *
 * 비교 단위는 SessionDetailSheet 의 "내담자" 섹션 카드 묶음이며,
 * 시안 비교가 의미 있도록 헤더/일정 정보/푸터 CTA 까지 함께 렌더한다.
 */

type Variant =
  | "current"
  | "state"
  | "split"
  | "color"
  | "group"
  | "note-first"
  | "state-strong"
  | "state-line"
  | "state-final";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "state", label: "A · 상태" },
  { key: "split", label: "B · 분리" },
  { key: "color", label: "C · 풀 컬러" },
  { key: "group", label: "D · 그룹" },
  { key: "note-first", label: "E · 일지 우선" },
  { key: "state-strong", label: "A-1 · 진한 점선" },
  { key: "state-line", label: "A-2 · 좌측 라인" },
  { key: "state-final", label: "A · 통합" },
];

const VARIANT_NOTE: Record<Variant, string> = {
  current:
    "현재 — 일지 작성/보기가 카드 두번째 라인의 부속 메타로 들어가 있어, 우측 출결 칩의 컬러 강조에 시각 비중이 밀린다.",
  state:
    "A · 상태 차별 — 미작성 카드는 primary-50 배경 + 점선 보더 + primary 텍스트로 어포던스 강화. 작성됨 카드는 차분한 흰 배경 + gray 톤. '할 일이 있다'가 한눈에 인지된다.",
  split:
    "B · 액션 분리 — 카드 하단을 독립 영역으로 분리해 일지 액션을 풀폭 행으로 격상. 출결 칩과 시각적 경쟁 없이 두 액션이 명확히 구분된다.",
  color:
    "C · 풀 컬러 강조 — 미작성 카드를 primary-500 풀 컬러로 칠해 흰 시트 위에서 강한 명도 대비를 만든다. 작성됨은 차분 화이트. 가장 즉각적이지만 채도가 강해 화면 무게중심이 일지로 완전히 쏠린다.",
  group:
    "D · To-Do 그룹 — 내담자 섹션을 '작성할 일지(n)' / '작성됨(m)' 두 그룹으로 분리. 미작성을 별도 묶음으로 To-Do화해 '남은 일'이 명확해진다. 출결 변경 빈도가 낮은 회기에 적합.",
  "note-first":
    "E · 일지 우선 카드 — 카드 타이틀이 'OOO님의 일지' 자체. 내담자명+일지 액션을 한 문장으로 묶고 출결은 보조 위치로 빼서 위계를 뒤집는다. 가장 명시적이지만 출결 변경 동선이 약간 길어진다.",
  "state-strong":
    "A-1 · 진한 점선 — A 골격 유지하되, 점선 색을 primary-500로 진하게 + 굵기 1.5px + 일지 라인을 body-03/semibold로 한 단계 키워 어포던스 가독성 확보. dashed의 'broken' 느낌이 더 강해지는 트레이드오프.",
  "state-line":
    "A-2 · 좌측 라인 — 점선 제거, 카드 좌측에 4px 컬러 라인으로 상태 표현 (schedule accent 메타포 일관성). 미작성 = primary-500 line + primary-50 tint, 작성됨 = gray-300 line + white. dashed의 시각 노이즈가 없어 깔끔하다.",
  "state-final":
    "A · 통합 — 좌측 4px 라인 + 좌측 40×40 액션 아이콘 박스(primary-100/gray-100) + 일지 라인 가독성 강화. dashed 제거로 정돈됨 + 아이콘 박스로 어포던스 ↑ + 상태별 위계가 자연스럽게 형성된다. A의 최종안 후보.",
};

type AttendanceStatus = "scheduled" | "attended" | "absent";

interface MockParticipant {
  id: string;
  name: string;
  gender: "남" | "여";
  age: number;
  status: AttendanceStatus;
  hasNote: boolean;
  notePreview?: string;
}

const PARTICIPANTS: MockParticipant[] = [
  { id: "1", name: "김민준", gender: "남", age: 8, status: "scheduled", hasNote: false },
  {
    id: "2",
    name: "이서연",
    gender: "여",
    age: 11,
    status: "attended",
    hasNote: true,
    notePreview: "학교 친구 관계 개선 — 자기표현 연습",
  },
  { id: "3", name: "박지호", gender: "남", age: 9, status: "scheduled", hasNote: false },
  { id: "4", name: "최예린", gender: "여", age: 13, status: "attended", hasNote: false },
];

const ATTENDANCE_PALETTE: Record<AttendanceStatus, { color: string; bg: string; label: string }> = {
  scheduled: { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray, label: "미확인" },
  attended: { color: COLORS.palette.green, bg: COLORS.paletteBg.green, label: "참석" },
  absent: { color: COLORS.palette.red, bg: COLORS.paletteBg.red, label: "불참" },
};

// AI 요약 뱃지 전용 색 (디자인 시스템 외 원샷 컬러 — schedule/[id].tsx와 동일)
const AI_PURPLE = "#7B5BFF";
const AI_PURPLE_BG = "#F3EEFF";

const FIELDNOTE_MOCK = {
  date: "2026. 05. 15 (금) 14:32",
  title: "놀이치료 — 그룹 회기",
  preview:
    "오늘 그룹 활동 중 김민준 학생의 자기표현이 평소보다 적극적이었다. 감정 카드를 활용한 게임에서 '화남'과 '서운함'을 명확히 구분해 표현했고, 또래의 반응을 살피는 모습이 관찰됨.",
  hasAiSummary: true,
};

export default function SessionNoteEmphasisLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              회기 상세 · 일지 강조
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 — 6개 → 가로 스크롤 */}
        <View style={{ paddingBottom: s(12) }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              gap: s(6),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    paddingHorizontal: s(14),
                    paddingVertical: s(8),
                    borderRadius: s(RADIUS.full),
                    backgroundColor: active ? COLORS.text.title.default : COLORS.gray[50],
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? "semibold" : "medium"}
                    style={{ color: active ? COLORS.white : COLORS.gray[600] }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* 본문 — 바텀시트 모사 시트 안에 콘텐츠 배치 */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: COLORS.white,
            marginTop: s(8),
            marginHorizontal: s(LAYOUT.screenPaddingX),
            borderRadius: s(RADIUS.xl),
            padding: s(LAYOUT.screenPaddingX),
          }}
        >
          {/* 드래그 핸들 + 날짜 타이틀 */}
          <View style={{ alignItems: "center", marginBottom: s(8) }}>
            <View
              style={{
                width: s(36),
                height: 4,
                borderRadius: 2,
                backgroundColor: COLORS.gray[200],
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: s(20),
            }}
          >
            <View style={{ width: 24 }} />
            <Typography variant="title-01" weight="bold" className="text-gray-900">
              2026-05-15 (금)
            </Typography>
            <Ionicons name="close" size={24} color={COLORS.gray[700]} />
          </View>

          {/* 일정 정보 카드 */}
          <View
            style={{
              backgroundColor: COLORS.gray[50],
              borderRadius: s(RADIUS.lg),
              paddingHorizontal: s(16),
              paddingVertical: s(12),
              marginBottom: s(GAP.related),
            }}
          >
            <InfoRow label="일정" value="2026-05-15 (금) 14:00 ~ 16:00" secondary="상담실 A" />
            <InfoRow label="프로그램" value="놀이치료 — 그룹" />
            <InfoRow label="담당자" value="김민지" />
          </View>

          {/* 내담자 섹션 — variant 별 렌더 분기 */}
          {variant === "group" ? (
            <GroupedSection participants={PARTICIPANTS} />
          ) : (
            <>
              <Typography
                variant="body-02"
                weight="bold"
                className="text-gray-900"
                style={{ marginBottom: s(8) }}
              >
                내담자
              </Typography>
              <View style={{ gap: s(GAP.card) }}>
                {PARTICIPANTS.map((p) => renderCard(variant, p))}
              </View>
            </>
          )}

          {/* 필드노트 섹션 — 데이터 상태별 2개 카드를 lab 비교용으로 동시 노출 */}
          <View style={{ marginTop: s(GAP.section) }}>
            <Typography
              variant="body-02"
              weight="bold"
              className="text-gray-900"
              style={{ marginBottom: s(8) }}
            >
              필드노트
            </Typography>

            <View style={{ gap: s(GAP.card) }}>
              {/* ① 연결 전 */}
              <View>
                <Typography
                  variant="label-02"
                  className="text-gray-400"
                  style={{ marginBottom: 4 }}
                >
                  ① 연결 전
                </Typography>
                <FieldNoteUnlinkedCard />
              </View>

              {/* ② 연결됨 */}
              <View>
                <Typography
                  variant="label-02"
                  className="text-gray-400"
                  style={{ marginBottom: 4 }}
                >
                  ② 연결됨
                </Typography>
                <FieldNoteLinkedCard />
              </View>
            </View>
          </View>

          {/* 푸터 CTA — 회기 완료/취소 */}
          <View style={{ flexDirection: "row", gap: s(8), marginTop: s(20) }}>
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: s(RADIUS.md),
                borderWidth: 1,
                borderColor: "rgba(255,66,66,0.2)",
                paddingVertical: s(14),
              }}
            >
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: COLORS.error }}
              >
                회기 취소
              </Typography>
            </View>
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: s(RADIUS.md),
                backgroundColor: COLORS.primary500,
                paddingVertical: s(14),
              }}
            >
              <Typography variant="body-02" weight="semibold" className="text-white">
                회기 완료
              </Typography>
            </View>
          </View>
        </View>

        {/* 시안 설명 */}
        <View
          style={{
            marginTop: s(16),
            marginHorizontal: s(LAYOUT.screenPaddingX),
            padding: s(12),
            backgroundColor: COLORS.gray[100],
            borderRadius: s(RADIUS.md),
          }}
        >
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            {VARIANT_NOTE[variant]}
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────── 필드노트 — 미연결 ───────── */
/**
 * 회기에 연결된 필드노트가 없는 상태.
 * schedule/[id].tsx 의 FieldNoteCard "!fieldNote" 분기 패턴 차용.
 * 시트가 white 컨텍스트이므로 gray-100 으로 한 톤 진하게 분리.
 */
function FieldNoteUnlinkedCard() {
  return (
    <View
      style={{
        padding: s(20),
        gap: s(16),
        backgroundColor: COLORS.gray[100],
        borderRadius: s(RADIUS.lg),
      }}
    >
      <View style={{ gap: 4, alignItems: "center" }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.gray[700] }}
        >
          이 회기에 연결된 필드노트가 없어요
        </Typography>
        <Typography variant="body-03" style={{ color: COLORS.gray[500] }}>
          지금 녹음하거나 기존 노트를 연결하세요
        </Typography>
      </View>

      <View style={{ flexDirection: "row", gap: s(8) }}>
        <View
          style={{
            flex: 1,
            height: s(40),
            alignItems: "center",
            justifyContent: "center",
            borderRadius: s(RADIUS.md),
            borderWidth: 1,
            borderColor: COLORS.gray[200],
            backgroundColor: COLORS.white,
          }}
        >
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.gray[700] }}
          >
            녹음하기
          </Typography>
        </View>
        <View
          style={{
            flex: 1,
            height: s(40),
            alignItems: "center",
            justifyContent: "center",
            borderRadius: s(RADIUS.md),
            borderWidth: 1,
            borderColor: COLORS.gray[200],
            backgroundColor: COLORS.white,
          }}
        >
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.gray[700] }}
          >
            연결하기
          </Typography>
        </View>
      </View>
    </View>
  );
}

/* ───────── 필드노트 — 연결됨 ───────── */
/**
 * 회기에 필드노트가 연결된 상태.
 * 좌측 40×40 fieldnote-purple 아이콘 박스로 식별성 + 우측 상단 AI 요약 뱃지.
 * 시트(white) 위에서 gray-50 으로 한 톤 inversion (보더 없음 — §Card 보더 원칙).
 */
function FieldNoteLinkedCard() {
  return (
    <View
      style={{
        padding: s(14),
        flexDirection: "row",
        gap: s(12),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
      }}
    >
      {/* 좌측 fieldnote 아이콘 박스 */}
      <View
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(10),
          backgroundColor: AI_PURPLE_BG,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="counseling-note-16" size={20} color={COLORS.fieldnote} />
      </View>

      {/* 본문 */}
      <View style={{ flex: 1, gap: 4 }}>
        {/* 상단 row — 날짜 + AI 요약 뱃지 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="label-01" className="text-gray-500">
            {FIELDNOTE_MOCK.date}
          </Typography>
          {FIELDNOTE_MOCK.hasAiSummary && (
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: 3,
                gap: 4,
                backgroundColor: AI_PURPLE_BG,
                borderRadius: s(RADIUS.full),
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="sparkles" size={s(12)} color={AI_PURPLE} />
              <Typography
                variant="caption-01"
                weight="semibold"
                style={{ color: AI_PURPLE }}
              >
                AI 요약
              </Typography>
            </View>
          )}
        </View>

        {/* 제목 */}
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {FIELDNOTE_MOCK.title}
        </Typography>

        {/* 미리보기 */}
        <Typography
          variant="body-03"
          className="text-gray-600"
          numberOfLines={3}
        >
          {FIELDNOTE_MOCK.preview}
        </Typography>
      </View>

      {/* 우측 chevron */}
      <Ionicons
        name="chevron-forward"
        size={s(16)}
        color={COLORS.gray[300]}
        style={{ alignSelf: "center" }}
      />
    </View>
  );
}

/* ───────── 공통 InfoRow ───────── */

function InfoRow({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: s(4) }}>
      <Typography variant="label-01" className="text-gray-500" style={{ width: s(64) }}>
        {label}
      </Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="label-01" weight="medium" className="text-gray-900">
          {value}
        </Typography>
        {secondary && (
          <Typography variant="label-01" weight="medium" className="text-gray-900">
            {secondary}
          </Typography>
        )}
      </View>
    </View>
  );
}

/* ───────── ParticipantInfo (좌측 아바타 + 이름/메타) ───────── */

function ParticipantInfo({ participant }: { participant: MockParticipant }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <View
        style={{
          width: s(28),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          justifyContent: "center",
          marginRight: s(8),
        }}
      >
        <Ionicons name="person" size={14} color={COLORS.gray[400]} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          {participant.name}
        </Typography>
        <Typography variant="label-01" className="text-gray-500" style={{ marginLeft: s(6) }}>
          {participant.gender}
        </Typography>
        <View
          style={{
            width: 1,
            height: 10,
            backgroundColor: COLORS.gray[300],
            marginHorizontal: s(6),
          }}
        />
        <Typography variant="label-01" className="text-gray-500">
          만 {participant.age}세
        </Typography>
      </View>
    </View>
  );
}

/* ───────── AttendanceChip ───────── */

function AttendanceChip({ status }: { status: AttendanceStatus }) {
  const palette = ATTENDANCE_PALETTE[status];
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: s(RADIUS.full),
        paddingHorizontal: s(12),
        paddingVertical: s(6),
      }}
    >
      <Typography variant="label-01" weight="semibold" style={{ color: palette.color }}>
        {palette.label}
      </Typography>
      <Ionicons
        name="chevron-down"
        size={14}
        color={palette.color}
        style={{ marginLeft: 2 }}
      />
    </View>
  );
}

/* ───────── 현재 (대조군) ───────── */

function CurrentCard({ participant }: { participant: MockParticipant }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.gray[200],
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(8),
          }}
        >
          <Ionicons name="person" size={14} color={COLORS.gray[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {participant.name}
            </Typography>
            <Typography variant="label-01" className="text-gray-500" style={{ marginLeft: s(6) }}>
              {participant.gender}
            </Typography>
            <View
              style={{
                width: 1,
                height: 10,
                backgroundColor: COLORS.gray[300],
                marginHorizontal: s(6),
              }}
            />
            <Typography variant="label-01" className="text-gray-500">
              만 {participant.age}세
            </Typography>
          </View>
          {/* 일지 작성/보기 — 부속 메타라인 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            {participant.hasNote && (
              <Icon name="counseling-note-16" size={16} color={COLORS.fieldnote} />
            )}
            <Typography
              variant="label-01"
              weight="medium"
              className="text-gray-700"
              style={{ marginLeft: participant.hasNote ? 4 : 0 }}
            >
              {participant.hasNote ? "일지 보기" : "일지 작성"}
            </Typography>
            {!participant.hasNote && (
              <Icon name="arrow-right" size={12} color={COLORS.gray[400]} />
            )}
          </View>
        </View>
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

/* ───────── 방향 A · 상태 차별 ───────── */

function StateCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.white,
        borderWidth: isUnwritten ? 1 : 0,
        borderStyle: isUnwritten ? "dashed" : "solid",
        borderColor: isUnwritten ? COLORS.primary300 : "transparent",
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
        // 작성됨 카드는 흰 배경이 페이지(흰 시트) 위에 묻히지 않도록 미세한 보더 유지
        ...(isUnwritten
          ? {}
          : { borderWidth: 1, borderColor: COLORS.gray[100], borderStyle: "solid" as const }),
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: isUnwritten ? COLORS.white : COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(8),
          }}
        >
          <Ionicons name="person" size={14} color={COLORS.gray[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {participant.name}
            </Typography>
            <Typography variant="label-01" className="text-gray-500" style={{ marginLeft: s(6) }}>
              {participant.gender}
            </Typography>
            <View
              style={{
                width: 1,
                height: 10,
                backgroundColor: COLORS.gray[300],
                marginHorizontal: s(6),
              }}
            />
            <Typography variant="label-01" className="text-gray-500">
              만 {participant.age}세
            </Typography>
          </View>
          {/* 격상된 일지 액션 라인 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {isUnwritten ? (
              <>
                <Ionicons name="create-outline" size={14} color={COLORS.primary700} />
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.primary700, marginLeft: 4 }}
                >
                  일지 작성하기
                </Typography>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={COLORS.primary700}
                  style={{ marginLeft: 2 }}
                />
              </>
            ) : (
              <>
                <Icon name="counseling-note-16" size={14} color={COLORS.gray[500]} />
                <Typography
                  variant="label-01"
                  weight="medium"
                  className="text-gray-600"
                  style={{ marginLeft: 4 }}
                  numberOfLines={1}
                >
                  {participant.notePreview ?? "일지 보기"}
                </Typography>
              </>
            )}
          </View>
        </View>
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

/* ───────── 카드 렌더 디스패처 ───────── */

function renderCard(variant: Variant, p: MockParticipant) {
  switch (variant) {
    case "current":
      return <CurrentCard key={p.id} participant={p} />;
    case "state":
      return <StateCard key={p.id} participant={p} />;
    case "split":
      return <SplitCard key={p.id} participant={p} />;
    case "color":
      return <ColorCard key={p.id} participant={p} />;
    case "note-first":
      return <NoteFirstCard key={p.id} participant={p} />;
    case "state-strong":
      return <StateStrongCard key={p.id} participant={p} />;
    case "state-line":
      return <StateLineCard key={p.id} participant={p} />;
    case "state-final":
      return <StateFinalCard key={p.id} participant={p} />;
    default:
      return null;
  }
}

/* ───────── 방향 B · 액션 분리 ───────── */

function SplitCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.gray[200],
        borderRadius: s(RADIUS.lg),
        overflow: "hidden",
      }}
    >
      {/* 상단 row — 이름 정보 + 출결 칩 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: s(12),
          paddingVertical: s(12),
        }}
      >
        <ParticipantInfo participant={participant} />
        <AttendanceChip status={participant.status} />
      </View>

      {/* 하단 row — 일지 액션 (독립 영역) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.gray[50],
          borderTopWidth: 1,
          borderTopColor: isUnwritten ? COLORS.primary100 : COLORS.gray[100],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {isUnwritten ? (
            <Ionicons name="create-outline" size={16} color={COLORS.primary700} />
          ) : (
            <Icon name="counseling-note-16" size={16} color={COLORS.gray[600]} />
          )}
          <Typography
            variant="label-01"
            weight="semibold"
            style={{
              color: isUnwritten ? COLORS.primary700 : COLORS.gray[700],
              marginLeft: 6,
            }}
            numberOfLines={1}
          >
            {isUnwritten ? "일지 작성하기" : participant.notePreview ?? "일지 보기"}
          </Typography>
        </View>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={isUnwritten ? COLORS.primary700 : COLORS.gray[500]}
        />
      </View>
    </View>
  );
}

/* ───────── 방향 C · 풀 컬러 강조 ───────── */

function ColorCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;

  // 미작성: primary-500 풀 컬러 카드, 흰 텍스트
  // 작성됨: 흰 카드, 일반 텍스트
  const palette = ATTENDANCE_PALETTE[participant.status];

  if (isUnwritten) {
    return (
      <View
        style={{
          backgroundColor: COLORS.primary500,
          borderRadius: s(RADIUS.lg),
          paddingHorizontal: s(12),
          paddingVertical: s(12),
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: s(28),
              height: s(28),
              borderRadius: s(14),
              backgroundColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: s(8),
            }}
          >
            <Ionicons name="person" size={14} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Typography variant="body-02" weight="bold" style={{ color: COLORS.white }}>
                {participant.name}
              </Typography>
              <Typography
                variant="label-01"
                style={{ color: "rgba(255,255,255,0.78)", marginLeft: s(6) }}
              >
                {participant.gender}
              </Typography>
              <View
                style={{
                  width: 1,
                  height: 10,
                  backgroundColor: "rgba(255,255,255,0.4)",
                  marginHorizontal: s(6),
                }}
              />
              <Typography
                variant="label-01"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                만 {participant.age}세
              </Typography>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <Ionicons name="create-outline" size={14} color={COLORS.white} />
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.white, marginLeft: 4 }}
              >
                일지 작성하기
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={COLORS.white}
                style={{ marginLeft: 2 }}
              />
            </View>
          </View>
        </View>
        {/* 출결 칩 — 풀 컬러 위 가독성을 위해 white 배경 + primary 텍스트 */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            flexDirection: "row",
            alignItems: "center",
            borderRadius: s(RADIUS.full),
            paddingHorizontal: s(12),
            paddingVertical: s(6),
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary700 }}
          >
            {palette.label}
          </Typography>
          <Ionicons
            name="chevron-down"
            size={14}
            color={COLORS.primary700}
            style={{ marginLeft: 2 }}
          />
        </View>
      </View>
    );
  }

  // 작성됨 — 차분한 화이트
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.gray[100],
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(8),
          }}
        >
          <Ionicons name="person" size={14} color={COLORS.gray[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {participant.name}
            </Typography>
            <Typography variant="label-01" className="text-gray-500" style={{ marginLeft: s(6) }}>
              {participant.gender}
            </Typography>
            <View
              style={{
                width: 1,
                height: 10,
                backgroundColor: COLORS.gray[300],
                marginHorizontal: s(6),
              }}
            />
            <Typography variant="label-01" className="text-gray-500">
              만 {participant.age}세
            </Typography>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Icon name="counseling-note-16" size={14} color={COLORS.gray[500]} />
            <Typography
              variant="label-01"
              weight="medium"
              className="text-gray-600"
              style={{ marginLeft: 4 }}
              numberOfLines={1}
            >
              {participant.notePreview ?? "일지 보기"}
            </Typography>
          </View>
        </View>
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

/* ───────── 방향 E · 일지 우선 카드 ───────── */

function NoteFirstCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;
  const palette = ATTENDANCE_PALETTE[participant.status];

  return (
    <View
      style={{
        backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.white,
        borderWidth: 1,
        borderColor: isUnwritten ? COLORS.primary100 : COLORS.gray[100],
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(14),
        paddingVertical: s(14),
      }}
    >
      {/* 메인 메시지 — 카드 타이틀이 곧 일지 액션 */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons
          name={isUnwritten ? "create-outline" : "document-text-outline"}
          size={18}
          color={isUnwritten ? COLORS.primary700 : COLORS.gray[700]}
        />
        <Typography
          variant="body-01"
          weight="semibold"
          style={{
            color: isUnwritten ? COLORS.primary700 : COLORS.gray[900],
            marginLeft: 8,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {isUnwritten
            ? `${participant.name}님의 일지를 작성해 주세요`
            : `${participant.name}님의 일지 보기`}
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={isUnwritten ? COLORS.primary700 : COLORS.gray[500]}
        />
      </View>

      {/* 보조 정보 행 — 메타 + 출결 칩 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: s(10),
          paddingLeft: 26, // 아이콘+gap 만큼 들여쓰기 (메시지와 정렬)
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Typography variant="label-01" className="text-gray-500">
            {participant.gender}
          </Typography>
          <View
            style={{
              width: 1,
              height: 10,
              backgroundColor: COLORS.gray[300],
              marginHorizontal: s(6),
            }}
          />
          <Typography variant="label-01" className="text-gray-500">
            만 {participant.age}세
          </Typography>
        </View>
        {/* 작은 출결 칩 */}
        <View
          style={{
            backgroundColor: palette.bg,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: s(RADIUS.full),
            paddingHorizontal: s(10),
            paddingVertical: s(4),
          }}
        >
          <Typography variant="label-02" weight="semibold" style={{ color: palette.color }}>
            {palette.label}
          </Typography>
          <Ionicons
            name="chevron-down"
            size={12}
            color={palette.color}
            style={{ marginLeft: 2 }}
          />
        </View>
      </View>
    </View>
  );
}

/* ───────── 방향 D · To-Do 그룹 ───────── */

function GroupedSection({ participants }: { participants: MockParticipant[] }) {
  const unwritten = participants.filter((p) => !p.hasNote);
  const written = participants.filter((p) => p.hasNote);

  return (
    <>
      {/* 작성할 일지 — 미작성 그룹 (위로 격상) */}
      {unwritten.length > 0 && (
        <View style={{ marginBottom: s(GAP.section) }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: s(10),
            }}
          >
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              작성할 일지
            </Typography>
            <View
              style={{
                backgroundColor: COLORS.primary50,
                borderRadius: s(RADIUS.full),
                paddingHorizontal: s(8),
                paddingVertical: 2,
                marginLeft: s(6),
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.primary700 }}
              >
                {unwritten.length}
              </Typography>
            </View>
          </View>
          <View style={{ gap: s(GAP.card) }}>
            {unwritten.map((p) => (
              <GroupTodoCard key={p.id} participant={p} />
            ))}
          </View>
        </View>
      )}

      {/* 작성됨 — 완료 그룹 (아래로 차분하게) */}
      {written.length > 0 && (
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: s(10),
            }}
          >
            <Typography variant="body-02" weight="bold" className="text-gray-600">
              작성됨
            </Typography>
            <View
              style={{
                backgroundColor: COLORS.gray[100],
                borderRadius: s(RADIUS.full),
                paddingHorizontal: s(8),
                paddingVertical: 2,
                marginLeft: s(6),
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                className="text-gray-600"
              >
                {written.length}
              </Typography>
            </View>
          </View>
          <View style={{ gap: s(GAP.card) }}>
            {written.map((p) => (
              <GroupDoneCard key={p.id} participant={p} />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function GroupTodoCard({ participant }: { participant: MockParticipant }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.primary100,
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
      }}
    >
      {/* 체크박스 형태의 좌측 인디케이터 — To-Do 메타포 */}
      <View
        style={{
          width: s(20),
          height: s(20),
          borderRadius: s(6),
          borderWidth: 1.5,
          borderColor: COLORS.primary500,
          backgroundColor: COLORS.white,
          marginRight: s(10),
        }}
      />
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {participant.name}
        </Typography>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Typography variant="label-01" className="text-gray-500">
            {participant.gender}
          </Typography>
          <View
            style={{
              width: 1,
              height: 10,
              backgroundColor: COLORS.gray[300],
              marginHorizontal: s(6),
            }}
          />
          <Typography variant="label-01" className="text-gray-500">
            만 {participant.age}세
          </Typography>
        </View>
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

function GroupDoneCard({ participant }: { participant: MockParticipant }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
      }}
    >
      {/* 체크된 박스 — 완료 표시 */}
      <View
        style={{
          width: s(20),
          height: s(20),
          borderRadius: s(6),
          backgroundColor: COLORS.success,
          alignItems: "center",
          justifyContent: "center",
          marginRight: s(10),
        }}
      >
        <Ionicons name="checkmark" size={14} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-700">
          {participant.name}
        </Typography>
        {participant.notePreview && (
          <Typography
            variant="label-01"
            className="text-gray-500"
            style={{ marginTop: 2 }}
            numberOfLines={1}
          >
            {participant.notePreview}
          </Typography>
        )}
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

/* ───────── A-1 · 진한 점선 ───────── */
/**
 * StateCard 골격 유지 + 점선 색을 primary-500로 진하게 + 굵기 1.5px.
 * 일지 라인 사이즈도 body-03/semibold로 한 단계 키워 어포던스 가독성을 확보.
 * dashed 자체의 'broken' 느낌이 더 강해지는 트레이드오프.
 */
function StateStrongCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.white,
        borderWidth: 1.5,
        borderStyle: isUnwritten ? "dashed" : "solid",
        borderColor: isUnwritten ? COLORS.primary500 : COLORS.gray[100],
        borderRadius: s(RADIUS.lg),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: isUnwritten ? COLORS.white : COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(8),
          }}
        >
          <Ionicons name="person" size={14} color={COLORS.gray[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {participant.name}
            </Typography>
            <Typography variant="label-01" className="text-gray-500" style={{ marginLeft: s(6) }}>
              {participant.gender}
            </Typography>
            <View
              style={{
                width: 1,
                height: 10,
                backgroundColor: COLORS.gray[300],
                marginHorizontal: s(6),
              }}
            />
            <Typography variant="label-01" className="text-gray-500">
              만 {participant.age}세
            </Typography>
          </View>
          {/* 일지 라인 — body-03/semibold 로 사이즈 업 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {isUnwritten ? (
              <>
                <Ionicons name="create-outline" size={16} color={COLORS.primary700} />
                <Typography
                  variant="body-03"
                  weight="semibold"
                  style={{ color: COLORS.primary700, marginLeft: 6 }}
                >
                  일지 작성하기
                </Typography>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={COLORS.primary700}
                  style={{ marginLeft: 2 }}
                />
              </>
            ) : (
              <>
                <Icon name="counseling-note-16" size={16} color={COLORS.gray[500]} />
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="text-gray-600"
                  style={{ marginLeft: 6, flex: 1 }}
                  numberOfLines={1}
                >
                  {participant.notePreview ?? "일지 보기"}
                </Typography>
              </>
            )}
          </View>
        </View>
      </View>
      <AttendanceChip status={participant.status} />
    </View>
  );
}

/* ───────── A-2 · 좌측 라인 ───────── */
/**
 * 점선 제거, 카드 좌측에 4px 컬러 라인으로 상태 표현 (schedule accent 메타포 일관성).
 * dashed의 시각 노이즈가 없어 깔끔하며, 일정 카드와 같은 언어를 사용한다.
 */
function StateLineCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;
  const lineColor = isUnwritten ? COLORS.primary500 : COLORS.gray[300];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.white,
        borderRadius: s(RADIUS.lg),
        overflow: "hidden",
        // 작성됨은 white 위 white라 미세한 보더로 분리
        ...(isUnwritten
          ? {}
          : { borderWidth: 1, borderColor: COLORS.gray[100] }),
      }}
    >
      {/* 좌측 4px 컬러 라인 */}
      <View style={{ width: 4, backgroundColor: lineColor }} />

      {/* 내용 영역 */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: s(12),
          paddingVertical: s(12),
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: s(28),
              height: s(28),
              borderRadius: s(14),
              backgroundColor: isUnwritten ? COLORS.white : COLORS.gray[100],
              alignItems: "center",
              justifyContent: "center",
              marginRight: s(8),
            }}
          >
            <Ionicons name="person" size={14} color={COLORS.gray[400]} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Typography variant="body-02" weight="bold" className="text-gray-900">
                {participant.name}
              </Typography>
              <Typography
                variant="label-01"
                className="text-gray-500"
                style={{ marginLeft: s(6) }}
              >
                {participant.gender}
              </Typography>
              <View
                style={{
                  width: 1,
                  height: 10,
                  backgroundColor: COLORS.gray[300],
                  marginHorizontal: s(6),
                }}
              />
              <Typography variant="label-01" className="text-gray-500">
                만 {participant.age}세
              </Typography>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              {isUnwritten ? (
                <>
                  <Ionicons name="create-outline" size={14} color={COLORS.primary700} />
                  <Typography
                    variant="label-01"
                    weight="semibold"
                    style={{ color: COLORS.primary700, marginLeft: 4 }}
                  >
                    일지 작성하기
                  </Typography>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={COLORS.primary700}
                    style={{ marginLeft: 2 }}
                  />
                </>
              ) : (
                <>
                  <Icon name="counseling-note-16" size={14} color={COLORS.gray[500]} />
                  <Typography
                    variant="label-01"
                    weight="medium"
                    className="text-gray-600"
                    style={{ marginLeft: 4, flex: 1 }}
                    numberOfLines={1}
                  >
                    {participant.notePreview ?? "일지 보기"}
                  </Typography>
                </>
              )}
            </View>
          </View>
        </View>
        <AttendanceChip status={participant.status} />
      </View>
    </View>
  );
}

/* ───────── A · 통합 ───────── */
/**
 * 좌측 4px 라인 (A-2) + 좌측 40×40 액션 아이콘 박스 + 일지 라인 가독성 (A-1).
 * dashed 제거로 정돈됨 + 아이콘 박스로 어포던스 ↑ + 상태별 시각 위계가 자연스럽게.
 */
function StateFinalCard({ participant }: { participant: MockParticipant }) {
  const isUnwritten = !participant.hasNote;
  const lineColor = isUnwritten ? COLORS.primary500 : COLORS.gray[200];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: isUnwritten ? COLORS.primary50 : COLORS.white,
        borderRadius: s(RADIUS.lg),
        overflow: "hidden",
        ...(isUnwritten
          ? {}
          : { borderWidth: 1, borderColor: COLORS.gray[100] }),
      }}
    >
      {/* 좌측 4px 컬러 라인 */}
      <View style={{ width: 4, backgroundColor: lineColor }} />

      {/* 내용 영역 */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: s(12),
          paddingVertical: s(14),
        }}
      >
        {/* 40×40 액션 아이콘 박스 — 어포던스의 시각 앵커 */}
        <View
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(10),
            backgroundColor: isUnwritten ? COLORS.primary100 : COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            marginRight: s(12),
          }}
        >
          {isUnwritten ? (
            <Ionicons name="create-outline" size={20} color={COLORS.primary700} />
          ) : (
            <Icon name="counseling-note-16" size={20} color={COLORS.fieldnote} />
          )}
        </View>

        {/* 본문 — 이름 라인 + 일지 라인 */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              {participant.name}
            </Typography>
            <Typography
              variant="label-01"
              className="text-gray-500"
              style={{ marginLeft: s(6) }}
            >
              {participant.gender}
            </Typography>
            <View
              style={{
                width: 1,
                height: 10,
                backgroundColor: COLORS.gray[300],
                marginHorizontal: s(6),
              }}
            />
            <Typography variant="label-01" className="text-gray-500">
              만 {participant.age}세
            </Typography>
          </View>
          {/* 일지 라인 — body-03 사이즈 + 색상 위계 */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Typography
              variant="body-03"
              weight={isUnwritten ? "semibold" : "medium"}
              style={{
                color: isUnwritten ? COLORS.primary700 : COLORS.gray[600],
                flex: 1,
              }}
              numberOfLines={1}
            >
              {isUnwritten
                ? "일지 작성하기"
                : participant.notePreview ?? "일지 보기"}
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={isUnwritten ? COLORS.primary700 : COLORS.gray[400]}
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>

        <View style={{ marginLeft: s(8) }}>
          <AttendanceChip status={participant.status} />
        </View>
      </View>
    </View>
  );
}

