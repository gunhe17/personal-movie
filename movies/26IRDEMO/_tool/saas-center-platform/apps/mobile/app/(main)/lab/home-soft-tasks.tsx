import { useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, Dimensions, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { buildHomeMock, formatHHmm, getAgeFromBirth } from "./_mocks/home-mock";

/**
 * 홈 시안 — 부드러운 그라데이션 + 태스크 카드
 *
 * 시안 비교
 *  A · 캐러셀  : 그라데이션 배경 + 다음 상담 카드 가로 캐러셀(피크 노출) + 태스크 리스트
 *  B · 스택    : 그라데이션 배경 + 단일 다음 상담 카드 + 태스크 리스트 (캐러셀 없음)
 *
 * 디자인 핵심
 *  - 부드러운 mint→primary→cream 그라데이션 페이지(공기감 있는 시작 톤)
 *  - 상단 hero: 날짜 + 2줄 인사 + 카테고리 dot 통계
 *  - 다음 상담 카드 위 floating tooltip pill — "1시간 10분 뒤에 상담이 시작돼요!"
 *  - 카드 하단 "지난 일지 검토" gray pill 버튼으로 액션 명확화
 *  - 하단 태스크 리스트: 노란 노트 아이콘 + 한 줄 카피 + chevron, 카드마다 분리
 *
 * 디자인 시스템 매핑
 *  - 통계 dot: counseling(#05B17A), assessment(#3495F5)
 *  - 카테고리 dot(타이틀 앞): counseling
 *  - 태스크 아이콘 배경/아이콘: palette.yellow + paletteBg.yellow (§Extended Palette)
 *  - tooltip pill: primary500 / 카드 본체: surface/card 흰색 (페이지 배경 그라데이션 대비)
 */
type Variant = "carousel" | "stack";

export default function HomeSoftTasksLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("carousel");
  const mock = useMemo(() => buildHomeMock({ minutesUntilNext: 70 }), []);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <LabTopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />
        <Intro variant={variant} />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: s(20) }}
          showsVerticalScrollIndicator={false}
        >
          <VariantFrame variant={variant} mock={mock} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ───────────────────────── Lab Chrome ───────────────────────── */

function LabTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(16),
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Pressable onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </Pressable>
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default, marginLeft: s(8) }}
      >
        홈 시안 · 부드러운 톤 + 태스크
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
  const tabs: { key: Variant; label: string }[] = [
    { key: "carousel", label: "A · 캐러셀" },
    { key: "stack", label: "B · 스택" },
  ];
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginBottom: s(8),
        flexDirection: "row",
        backgroundColor: COLORS.gray[100],
        borderRadius: s(10),
        padding: s(3),
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: s(8),
              borderRadius: s(8),
              backgroundColor: isActive ? COLORS.white : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{
                color: isActive ? COLORS.text.title.default : COLORS.gray[500],
              }}
            >
              {t.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function Intro({ variant }: { variant: Variant }) {
  const txt =
    variant === "carousel"
      ? "부드러운 그라데이션 페이지에 다음 상담 카드를 가로 캐러셀로. 다음 카드 살짝 피크."
      : "동일 톤에서 다음 상담 카드를 단일로 고정. 캐러셀 인터랙션 없이 더 정적인 안내.";
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginBottom: s(8),
        padding: s(12),
        borderRadius: s(12),
        backgroundColor: COLORS.bg.selected,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(6),
      }}
    >
      <Ionicons
        name="sparkles"
        size={14}
        color={COLORS.primary700}
        style={{ marginTop: 2 }}
      />
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, flex: 1 }}
      >
        {txt}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Variant Frame ───────────────────────── */

interface FrameProps {
  variant: Variant;
  mock: ReturnType<typeof buildHomeMock>;
}

function VariantFrame({ variant, mock }: FrameProps) {
  return (
    <View style={{ position: "relative" }}>
      {/* 페이지 그라데이션 배경 — 상단에만 mint/primary/cream 컬러, 하단은 흰색으로 페이드 */}
      <LinearGradient
        colors={["#DFF6F2", "#E6F0FF", "#FFF8EE", "#FFFFFF"]}
        locations={[0, 0.18, 0.4, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      <View style={{ paddingBottom: s(12) }}>
        <HomeHeader />

        <HeroBlock
          personName={mock.personName}
          counselingCount={4}
          assessmentCount={2}
        />

        <View style={{ marginTop: s(12) }}>
          {variant === "carousel" ? (
            <NextSessionCarousel
              schedules={mock.todaySchedules}
              minutesLeft={70}
            />
          ) : (
            <View style={{ paddingHorizontal: s(20), paddingTop: s(44) }}>
              <NextSessionCard
                schedule={mock.nextSession}
                minutesLeft={70}
                withTooltip
              />
            </View>
          )}
        </View>

        <View
          style={{
            paddingHorizontal: s(20),
            marginTop: s(28),
            gap: s(10),
          }}
        >
          <TaskCard
            label={`상담 전 ${mock.nextSession.clients[0]?.name ?? "내담자"}님 일지 검토하기`}
          />
          <TaskCard label="박지훈님 일지 작성하기" />
          <TaskCard label="필드노트 연결하기" />
        </View>

        <View style={{ height: s(20) }} />

        <MockTabBar />
      </View>
    </View>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function HomeHeader() {
  return (
    <View
      style={{
        height: s(48),
        paddingHorizontal: s(20),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <Pressable hitSlop={6} style={{ padding: s(4) }}>
        <View>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.gray[800]}
          />
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: COLORS.negative,
              borderWidth: 1.5,
              borderColor: "#E6F0FF",
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function HeroBlock({
  personName,
  counselingCount,
  assessmentCount,
}: {
  personName: string;
  counselingCount: number;
  assessmentCount: number;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(8),
        paddingBottom: s(4),
        gap: s(8),
      }}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        2026년 3월 30일 월요일
      </Typography>
      <Typography
        weight="bold"
        style={{
          color: COLORS.text.title.default,
          fontSize: s(28),
          lineHeight: s(38),
          letterSpacing: -0.8,
        }}
      >
        {personName}님, 좋은 아침이에요
      </Typography>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(14),
          marginTop: s(4),
        }}
      >
        <StatDot color={COLORS.counseling} label={`상담 ${counselingCount}건`} />
        <StatDot
          color={COLORS.assessment}
          label={`검사 ${assessmentCount}건`}
        />
      </View>
    </View>
  );
}

function StatDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
      <View
        style={{
          width: s(7),
          height: s(7),
          borderRadius: s(4),
          backgroundColor: color,
        }}
      />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[700] }}
      >
        {label}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Next Session Carousel ───────────────────────── */

const SCREEN_WIDTH = Dimensions.get("window").width;

function NextSessionCarousel({
  schedules,
  minutesLeft,
}: {
  schedules: ReturnType<typeof buildHomeMock>["todaySchedules"];
  minutesLeft: number;
}) {
  const cardWidth = Math.round(SCREEN_WIDTH * 0.78);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + s(12)}
      snapToAlignment="start"
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(44),
      }}
    >
      {schedules.map((sch, i) => (
        <View
          key={sch.id}
          style={{
            width: cardWidth,
            marginRight: i < schedules.length - 1 ? s(12) : 0,
          }}
        >
          <NextSessionCard
            schedule={sch}
            minutesLeft={i === 0 ? minutesLeft : undefined}
            withTooltip={i === 0}
          />
        </View>
      ))}
    </ScrollView>
  );
}

/* ───────────────────────── Next Session Card ───────────────────────── */

function NextSessionCard({
  schedule,
  minutesLeft,
  withTooltip,
}: {
  schedule: ReturnType<typeof buildHomeMock>["nextSession"];
  minutesLeft?: number;
  withTooltip?: boolean;
}) {
  // 카드 내부 뷰 전환: 다음 상담 정보(preview) ↔ 지난 회기 일지(journal)
  const [view, setView] = useState<"preview" | "journal">("preview");
  const fade = useRef(new Animated.Value(1)).current;

  const switchTo = (next: "preview" | "journal") => {
    if (next === view) return;
    Animated.timing(fade, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setView(next);
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  // tooltip은 preview 모드에서만 노출
  const showTooltip =
    withTooltip && minutesLeft !== undefined && view === "preview";

  return (
    <View>
      {showTooltip && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -s(36),
            left: 0,
            zIndex: 10,
          }}
        >
          <CountdownTooltip minutes={minutesLeft!} />
        </View>
      )}

      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(24),
          padding: s(20),
          ...SHADOWS.card,
        }}
      >
        <Animated.View style={{ opacity: fade }}>
          {view === "preview" ? (
            <PreviewBody
              schedule={schedule}
              onReviewPrev={() => switchTo("journal")}
            />
          ) : (
            <JournalBody
              schedule={schedule}
              onBack={() => switchTo("preview")}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/* ───── Preview body: 다음 상담 정보 ───── */

function PreviewBody({
  schedule,
  onReviewPrev,
}: {
  schedule: ReturnType<typeof buildHomeMock>["nextSession"];
  onReviewPrev: () => void;
}) {
  const primary = schedule.clients[0];
  const age = primary?.birth_date ? getAgeFromBirth(primary.birth_date) : null;
  const isCounseling = schedule.schedule_type === "counseling";
  const typeLabel = isCounseling ? "상담" : "검사";
  const dotColor = isCounseling ? COLORS.counseling : COLORS.assessment;

  return (
    <View style={{ gap: s(14) }}>
      {/* 타이틀 행: 카테고리 dot + 내담자명 + 유형 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
        <View
          style={{
            width: s(8),
            height: s(8),
            borderRadius: s(4),
            backgroundColor: dotColor,
          }}
        />
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: COLORS.text.title.default, flex: 1 }}
          numberOfLines={1}
        >
          {primary?.name ?? "내담자"}님의 {typeLabel}
        </Typography>
      </View>

      {primary && age !== null && (
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {primary.gender === "female" ? "여" : "남"}
          {"  |  "}만 {age}세
        </Typography>
      )}

      <MetaRow
        icon="location-20"
        text={schedule.room_name ?? "상담실 미지정"}
      />

      <MetaRow
        icon="document-20"
        text={
          schedule.program_name
            ? `${schedule.program_name} - 개인`
            : "프로그램 미지정"
        }
      />

      {/* 지난 일지 검토 — 높이 44, sunken gray 컨테이너 */}
      <View
        style={{
          marginTop: s(4),
          height: s(44),
          width: "100%",
          borderRadius: s(12),
          backgroundColor: COLORS.gray[100],
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={onReviewPrev}
          android_ripple={{ color: COLORS.gray[200] }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{
              color: COLORS.text.body.strong,
              fontSize: s(14),
              lineHeight: s(20),
            }}
          >
            지난 일지 검토
          </Typography>
        </Pressable>
      </View>
    </View>
  );
}

/* ───── Journal body: 같은 카드 자리에 이전 회기 일지 전환 ───── */

interface PrevJournal {
  sessionNumber: number;
  date: string;
  goal: string;
  content: string;
  keywords: string[];
}

const PREV_JOURNAL_MOCK: PrevJournal = {
  sessionNumber: 5,
  date: "2026.3.23",
  goal: "분노 감정을 신체 신호로 알아차리기",
  content:
    "지난 회기에서 가족 갈등 상황을 그림으로 표현하며 감정을 외재화함. 학교에서 친구와의 마찰을 다룰 때 자기 표현 톤이 부드러워진 변화 관찰됨.",
  keywords: ["분노", "가족", "자기표현"],
};

function JournalBody({
  schedule,
  onBack,
}: {
  schedule: ReturnType<typeof buildHomeMock>["nextSession"];
  onBack: () => void;
}) {
  const primary = schedule.clients[0];
  const journal = PREV_JOURNAL_MOCK;

  return (
    <View style={{ gap: s(14) }}>
      {/* 헤더: 뒤로 화살표 + 회기명 + 날짜 */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.gray[100],
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.text.title.default} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Typography
            variant="body-01"
            weight="bold"
            style={{ color: COLORS.text.title.default }}
            numberOfLines={1}
          >
            {primary?.name ?? "내담자"}님 · {journal.sessionNumber}회기 일지
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
          >
            {journal.date}
          </Typography>
        </View>
      </View>

      {/* divider */}
      <View
        style={{
          height: 1,
          backgroundColor: COLORS.gray[100],
          marginVertical: s(2),
        }}
      />

      {/* 목표 */}
      <JournalSection label="목표" body={journal.goal} />

      {/* 내용 */}
      <JournalSection label="회기 내용" body={journal.content} />

      {/* 키워드 칩 */}
      <View style={{ gap: s(6) }}>
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.text.label.default }}
        >
          키워드
        </Typography>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: s(6) }}>
          {journal.keywords.map((kw) => (
            <View
              key={kw}
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(5),
                borderRadius: s(999),
                backgroundColor: COLORS.bg.selected,
              }}
            >
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: COLORS.primary700 }}
              >
                #{kw}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      {/* 전체 일지 보기 — 추후 상세 페이지로 이동 자리 */}
      <View
        style={{
          marginTop: s(4),
          height: s(44),
          width: "100%",
          borderRadius: s(12),
          backgroundColor: COLORS.gray[100],
          overflow: "hidden",
        }}
      >
        <Pressable
          android_ripple={{ color: COLORS.gray[200] }}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(6),
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{
              color: COLORS.text.body.strong,
              fontSize: s(14),
              lineHeight: s(20),
            }}
          >
            전체 일지 보기
          </Typography>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.text.body.strong}
          />
        </Pressable>
      </View>
    </View>
  );
}

function JournalSection({ label, body }: { label: string; body: string }) {
  return (
    <View style={{ gap: s(4) }}>
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.text.label.default }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.strong, lineHeight: s(22) }}
      >
        {body}
      </Typography>
    </View>
  );
}

function CountdownTooltip({ minutes }: { minutes: number }) {
  const label = formatTooltip(minutes);
  return (
    <View style={{ alignSelf: "flex-start", marginLeft: s(20) }}>
      <View
        style={{
          backgroundColor: COLORS.primary500,
          paddingHorizontal: s(12),
          paddingVertical: s(7),
          borderRadius: s(8),
          shadowColor: COLORS.primary500,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          {label}
        </Typography>
      </View>
      {/* caret — 아래쪽 삼각 (회전된 사각형) */}
      <View
        style={{
          position: "absolute",
          bottom: -s(4),
          left: s(20),
          width: s(10),
          height: s(10),
          backgroundColor: COLORS.primary500,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function formatTooltip(minutes: number): string {
  if (minutes <= 0) return "지금 상담이 시작됐어요!";
  if (minutes < 60) return `${minutes}분 뒤에 상담이 시작돼요!`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 뒤에 상담이 시작돼요!`;
  return `${h}시간 ${m}분 뒤에 상담이 시작돼요!`;
}

function MetaRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
      <Icon name={icon} size={s(16)} color={COLORS.gray[500]} />
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.strong, flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Task Card ───────────────────────── */

function TaskCard({ label }: { label: string }) {
  return (
    <View
      style={{
        height: s(56),
        width: "100%",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        // 그라데이션 페이지 위에서 분리되도록 카드보다 한 단계 강한 그림자
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <Pressable
        style={{
          flex: 1,
          paddingHorizontal: s(16),
          flexDirection: "row",
          alignItems: "center",
          gap: s(12),
          borderRadius: s(16),
        }}
        android_ripple={{ color: COLORS.gray[100] }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.paletteBg.yellow,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="document-text"
            size={16}
            color={COLORS.palette.yellow}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default, flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Typography>
        <Ionicons
          name="arrow-forward"
          size={20}
          color={COLORS.gray[400]}
        />
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Mock Tab Bar ───────────────────────── */

function MockTabBar() {
  const items: {
    key: string;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }[] = [
    { key: "home", label: "홈", icon: "home" },
    { key: "schedule", label: "일정", icon: "calendar-outline" },
    { key: "client", label: "내담자", icon: "people-outline" },
    { key: "field", label: "필드노트", icon: "mic-outline" },
    { key: "me", label: "내정보", icon: "person-circle" },
  ];

  return (
    <View
      style={{
        marginTop: s(8),
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.default,
        paddingTop: s(8),
        paddingBottom: s(20),
        paddingHorizontal: s(8),
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      {items.map((it) => {
        const isActive = it.key === "me";
        const color = isActive ? COLORS.primary500 : COLORS.gray[400];
        return (
          <View
            key={it.key}
            style={{
              flex: 1,
              alignItems: "center",
              gap: s(4),
              paddingVertical: s(4),
            }}
          >
            <Ionicons name={it.icon} size={22} color={color} />
            <Typography
              variant="label-02"
              weight={isActive ? "semibold" : "regular"}
              style={{ color }}
            >
              {it.label}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}
