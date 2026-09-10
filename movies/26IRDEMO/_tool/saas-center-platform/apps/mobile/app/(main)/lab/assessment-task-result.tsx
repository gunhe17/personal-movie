import { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS, GAP, RADIUS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 검사 결과 시안 — 데이터 연동 + 결과지 업로드
 *
 * 검사 상세(풀배터리) → 개별 검사(K-WISC, BGT 등) 진입 시 보여줄
 * 결과 화면. 운영상 두 케이스가 공존:
 *   A 데이터 연동  — 자체 검사 시스템에서 점수·해석이 자동으로 들어옴
 *   B 결과지 업로드 — 외부에서 받은 결과지(PDF/이미지)를 첨부
 * 한 검사에서 둘 다 들어오는 혼합 케이스도 가능 (각 시안에 노트로 표기).
 *
 * 공통 구조
 *   [헤더 카드] 검사명·일정·상태·담당자
 *   [결과 영역] 탭별로 다름
 *   [소견 영역] 상담사가 입력 (기존 AssessmentOpinionSheet 재활용 컨셉)
 *   [액션 영역] 보고서 작성·다음 검사 등
 *
 * 색 사용: 페이지 white / 카드 gray-50 + shadow / palette 강조 1~2색
 *
 * Lab — display-only. 라우팅/저장/업로드 로직은 production에서 연결.
 */

type Variant = "current" | "data" | "upload";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "data", label: "A · 데이터 연동" },
  { key: "upload", label: "B · 결과지 업로드" },
];

const VARIANT_NOTE: Record<Variant, string> = {
  current:
    "현재 — 검사 상세 페이지에 풀배터리 메타 정보만 표시되고, 개별 검사(K-WISC, BGT 등) 진입 동선이 없음. detail.tasks[] 데이터는 들어오지만 UI에 렌더링되지 않음.",
  data:
    "A · 데이터 연동 — 자체 검사 시스템에서 점수가 자동 연동되는 케이스. 종합 점수 hero + 지표별 점수 카드 + 영역별 막대로 시각화 + AI 해석. 혼합 운영 시 하단에 첨부 영역이 추가될 수 있음.",
  upload:
    "B · 결과지 업로드 — 외부 검사지(예: 종이 검사·외부 기관 검사)를 PDF/이미지로 첨부. 첨부 카드 + 미첨부 시 점선 업로드 영역. 혼합 운영 시 상단에 데이터 영역이 추가될 수 있음.",
};

/* ─────────── Mock data ─────────── */

const ASSESSMENT_META = {
  name: "K-WISC-V (한국 웩슬러 아동지능검사)",
  shortName: "K-WISC-V",
  scheduledAt: "2026년 5월 19일 (월) · 14:00",
  status: "completed" as const,
  examiner: "김민지 상담사",
  client: { name: "박지민", meta: "남 · 만 8세" },
};

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> =
  {
    scheduled: {
      label: "예정",
      bg: COLORS.gray[100],
      fg: COLORS.gray[700],
    },
    inProgress: {
      label: "진행중",
      bg: COLORS.statusBadge.inProgress.bg,
      fg: COLORS.statusBadge.inProgress.text,
    },
    completed: {
      label: "완료",
      bg: COLORS.paletteBg.green,
      fg: COLORS.palette.green,
    },
  };

/** 영역별 점수 (mock) */
const SCORE_DOMAINS = [
  { label: "언어이해", score: 112, percentile: 79, level: "평균 상" },
  { label: "시공간", score: 105, percentile: 63, level: "평균" },
  { label: "유동추론", score: 118, percentile: 88, level: "평균 상" },
  { label: "작업기억", score: 95, percentile: 37, level: "평균" },
  { label: "처리속도", score: 88, percentile: 21, level: "평균 하" },
];
const SCORE_TOTAL = { label: "전체 IQ (FSIQ)", score: 108, level: "평균" };

/* ─────────── Screen ─────────── */

export default function AssessmentTaskResultLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("data");

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} title={ASSESSMENT_META.shortName} />
        <VariantTabs value={variant} onChange={setVariant} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: s(GAP.related),
            paddingBottom: s(120),
          }}
        >
          <VariantNote text={VARIANT_NOTE[variant]} />
          {variant === "current" && <CurrentVariant />}
          {variant === "data" && <DataVariant />}
          {variant === "upload" && <UploadVariant />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────── Top / Tabs ─────────── */

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View
      style={{ height: s(52), paddingHorizontal: s(LAYOUT.screenPaddingX) }}
      className="flex-row items-center"
    >
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </TouchableOpacity>
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-title-default"
        style={{ marginLeft: s(8) }}
      >
        {title}
      </Typography>
    </View>
  );
}

function VariantTabs({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        gap: s(6),
      }}
    >
      {VARIANTS.map((v) => {
        const active = v.key === value;
        return (
          <Pressable
            key={v.key}
            onPress={() => onChange(v.key)}
            style={({ pressed }) => ({
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(RADIUS.full),
              backgroundColor: active ? COLORS.gray[900] : COLORS.gray[50],
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Typography
              variant="label-01"
              weight={active ? "semibold" : "medium"}
              style={{
                color: active ? COLORS.white : COLORS.text.body.subtle,
              }}
            >
              {v.label}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function VariantNote({ text }: { text: string }) {
  return (
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        marginTop: s(GAP.related),
        marginBottom: s(GAP.related),
        padding: s(12),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.md),
      }}
    >
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: COLORS.text.label.default, lineHeight: s(18) }}
      >
        {text}
      </Typography>
    </View>
  );
}

/* ─────────── Variant: 현재 (대조군) ─────────── */

function CurrentVariant() {
  return (
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(20),
        gap: s(GAP.related),
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        className="text-title-default"
      >
        개별 검사 진입 동선이 없어요
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.subtle, lineHeight: s(22) }}
      >
        검사 상세 페이지에는 풀배터리 메타 정보만 표시되고,{"\n"}
        K-WISC·BGT 같은 개별 검사로 들어가서 결과를 보는 동선이 아직
        없어요. 데이터(detail.tasks[])는 이미 들어와 있어요.
      </Typography>
      <View
        style={{
          height: s(1),
          backgroundColor: COLORS.gray[200],
          marginVertical: s(4),
        }}
      />
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.label.default }}
      >
        탭을 전환해 두 가지 결과 케이스를 비교해보세요
      </Typography>
    </View>
  );
}

/* ─────────── Common Header Card ─────────── */

function HeaderCard() {
  const status = STATUS_LABEL[ASSESSMENT_META.status];
  return (
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(GAP.related),
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View style={{ flex: 1, paddingRight: s(8) }}>
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-title-default"
            numberOfLines={2}
          >
            {ASSESSMENT_META.name}
          </Typography>
        </View>
        <View
          style={{
            paddingHorizontal: s(10),
            paddingVertical: s(4),
            borderRadius: s(RADIUS.sm),
            backgroundColor: status.bg,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: status.fg }}
          >
            {status.label}
          </Typography>
        </View>
      </View>

      <View
        style={{
          height: s(1),
          backgroundColor: COLORS.gray[200],
          marginVertical: s(GAP.card),
        }}
      />

      <MetaRow label="내담자" value={`${ASSESSMENT_META.client.name} (${ASSESSMENT_META.client.meta})`} />
      <MetaRow label="일정" value={ASSESSMENT_META.scheduledAt} />
      <MetaRow label="담당" value={ASSESSMENT_META.examiner} />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row" style={{ marginTop: s(GAP.intra + 2) }}>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, width: s(56) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.body.strong, flex: 1 }}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ─────────── Section Title ─────────── */

function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View
      className="flex-row items-baseline justify-between"
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        marginBottom: s(GAP.related),
      }}
    >
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-title-default"
      >
        {children}
      </Typography>
      {hint && (
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {hint}
        </Typography>
      )}
    </View>
  );
}

/* ─────────── Common Opinion + Actions ─────────── */

function OpinionSection() {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        className="flex-row items-baseline justify-between"
        style={{ marginBottom: s(GAP.related) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-title-default"
        >
          검사 소견
        </Typography>
        <Pressable
          hitSlop={6}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.text.state.brand }}
          >
            수정하기
          </Typography>
        </Pressable>
      </View>
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(RADIUS.lg),
          padding: s(GAP.related),
          ...SHADOWS.card,
        }}
      >
        <Typography
          variant="body-02"
          weight="regular"
          style={{
            color: COLORS.text.body.strong,
            lineHeight: s(24),
          }}
        >
          전반적인 지능은 평균 수준이며, 유동추론과 언어이해 영역에서
          상대적 강점이 관찰됨. 처리속도가 낮은 편이므로 학습 시 시간
          여유를 두는 것이 도움이 될 것으로 보임.
        </Typography>
      </View>
    </View>
  );
}

function ActionRow() {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        gap: s(GAP.card),
      }}
    >
      <Pressable
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: s(14),
          borderRadius: s(RADIUS.md),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          공유
        </Typography>
      </Pressable>
      <Pressable
        style={({ pressed }) => ({
          flex: 1.6,
          paddingVertical: s(14),
          borderRadius: s(RADIUS.md),
          backgroundColor: COLORS.primary500,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          종합 보고서 작성
        </Typography>
      </Pressable>
    </View>
  );
}

/* ─────────── Variant A: 데이터 연동 ─────────── */

function DataVariant() {
  return (
    <View style={{ gap: s(GAP.section) }}>
      <HeaderCard />

      <View>
        <SectionTitle hint="자동 연동">검사 결과</SectionTitle>
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            gap: s(GAP.card),
          }}
        >
          <TotalScoreCard />
          <DomainScoreCard />
          <InterpretationCard />
        </View>
      </View>

      <OpinionSection />
      <ActionRow />
    </View>
  );
}

function TotalScoreCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.primary75,
        borderRadius: s(RADIUS.xl),
        padding: s(GAP.related + 4),
        ...SHADOWS.card,
      }}
    >
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        {SCORE_TOTAL.label}
      </Typography>
      <View
        className="flex-row items-baseline"
        style={{ marginTop: s(GAP.intra + 2), gap: s(8) }}
      >
        <Typography
          variant="headline-01"
          weight="bold"
          className="text-title-default"
          style={{ fontSize: s(40), lineHeight: s(48) }}
        >
          {SCORE_TOTAL.score}
        </Typography>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(RADIUS.sm),
            backgroundColor: COLORS.white,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.text.label.default }}
          >
            {SCORE_TOTAL.level}
          </Typography>
        </View>
      </View>
      <Typography
        variant="body-03"
        weight="regular"
        style={{
          color: COLORS.text.body.subtle,
          marginTop: s(GAP.card),
        }}
      >
        백분위 약 70%ile · 동연령 평균 범위
      </Typography>
    </View>
  );
}

function DomainScoreCard() {
  const maxScore = Math.max(...SCORE_DOMAINS.map((d) => d.score));
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(GAP.related),
        ...SHADOWS.card,
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-title-default"
        style={{ marginBottom: s(GAP.related) }}
      >
        지표별 점수
      </Typography>
      <View style={{ gap: s(GAP.card) }}>
        {SCORE_DOMAINS.map((d) => (
          <DomainRow key={d.label} domain={d} maxScore={maxScore} />
        ))}
      </View>
    </View>
  );
}

function DomainRow({
  domain,
  maxScore,
}: {
  domain: (typeof SCORE_DOMAINS)[number];
  maxScore: number;
}) {
  const ratio = domain.score / maxScore;
  // 평균(100) 기준 강·약 색
  const isStrong = domain.score >= 110;
  const isWeak = domain.score < 90;
  const barColor = isStrong
    ? COLORS.palette.mint
    : isWeak
      ? COLORS.palette.coral
      : COLORS.gray[400];
  return (
    <View>
      <View
        className="flex-row items-baseline justify-between"
        style={{ marginBottom: s(GAP.intra + 2) }}
      >
        <View className="flex-row items-baseline" style={{ gap: s(6) }}>
          <Typography
            variant="body-02"
            weight="medium"
            className="text-title-default"
          >
            {domain.label}
          </Typography>
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {domain.level} · {domain.percentile}%ile
          </Typography>
        </View>
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-title-default"
        >
          {domain.score}
        </Typography>
      </View>
      <View
        style={{
          height: s(6),
          borderRadius: s(3),
          backgroundColor: COLORS.gray[200],
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            backgroundColor: barColor,
            borderRadius: s(3),
          }}
        />
      </View>
    </View>
  );
}

function InterpretationCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(GAP.related),
        ...SHADOWS.card,
      }}
    >
      <View
        className="flex-row items-center"
        style={{ gap: s(6), marginBottom: s(GAP.card) }}
      >
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(3),
            borderRadius: s(RADIUS.sm),
            backgroundColor: COLORS.paletteBg.mint,
          }}
          className="flex-row items-center"
        >
          <Ionicons name="sparkles" size={12} color={COLORS.palette.mint} />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.palette.mint, marginLeft: s(4) }}
          >
            AI 해석
          </Typography>
        </View>
      </View>
      <Typography
        variant="body-02"
        weight="regular"
        style={{
          color: COLORS.text.body.strong,
          lineHeight: s(24),
        }}
      >
        유동추론(118)과 언어이해(112)에서 강점을 보이고, 처리속도(88)는
        평균보다 낮음. 빠른 시각적 정보 처리가 요구되는 과제에서 부담을
        느낄 수 있으므로 충분한 시간 제공을 권장.
      </Typography>
    </View>
  );
}

/* ─────────── Variant B: 결과지 업로드 ─────────── */

function UploadVariant() {
  return (
    <View style={{ gap: s(GAP.section) }}>
      <HeaderCard />

      <View>
        <SectionTitle hint="결과지">검사 결과</SectionTitle>
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            gap: s(GAP.card),
          }}
        >
          <UploadedFileCard />
          <UploadEmptyDropzone />
        </View>
      </View>

      <OpinionSection />
      <ActionRow />
    </View>
  );
}

function UploadedFileCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(GAP.related),
        ...SHADOWS.card,
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-title-default"
        style={{ marginBottom: s(GAP.related) }}
      >
        첨부된 결과지
      </Typography>

      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: s(GAP.card),
          backgroundColor: COLORS.white,
          borderRadius: s(RADIUS.md),
          padding: s(GAP.card),
          opacity: pressed ? 0.95 : 1,
        })}
      >
        <View
          style={{
            width: s(44),
            height: s(56),
            borderRadius: s(6),
            backgroundColor: COLORS.paletteBg.red,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="label-02"
            weight="bold"
            style={{ color: COLORS.palette.red }}
          >
            PDF
          </Typography>
        </View>
        <View style={{ flex: 1 }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-title-default"
            numberOfLines={1}
          >
            K-WISC-V_박지민_결과지.pdf
          </Typography>
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
          >
            12 페이지 · 2.4MB · 어제 업로드
          </Typography>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.gray[400]}
        />
      </Pressable>

      {/* 액션 행 */}
      <View
        className="flex-row"
        style={{ gap: s(GAP.card), marginTop: s(GAP.card) }}
      >
        <ChipAction icon="eye-outline" label="결과지 보기" />
        <ChipAction icon="download-outline" label="다운로드" />
        <ChipAction icon="trash-outline" label="삭제" tone="danger" />
      </View>
    </View>
  );
}

function ChipAction({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: "danger";
}) {
  const color = tone === "danger" ? COLORS.status.danger : COLORS.text.label.default;
  return (
    <Pressable
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: s(4),
        paddingVertical: s(8),
        borderRadius: s(RADIUS.md),
        backgroundColor: COLORS.gray[100],
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

function UploadEmptyDropzone() {
  return (
    <View
      style={{
        borderRadius: s(RADIUS.lg),
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: COLORS.gray[300],
        backgroundColor: COLORS.white,
        padding: s(GAP.related + 4),
        alignItems: "center",
        gap: s(GAP.card),
      }}
    >
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="add" size={24} color={COLORS.gray[600]} />
      </View>
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-title-default"
      >
        결과지 추가 첨부
      </Typography>
      <Typography
        variant="label-01"
        weight="regular"
        style={{
          color: COLORS.text.body.subtle,
          textAlign: "center",
          lineHeight: s(18),
        }}
      >
        PDF·이미지(JPG, PNG) 파일을 첨부할 수 있어요{"\n"}한 검사에 여러
        장 첨부 가능
      </Typography>
    </View>
  );
}
