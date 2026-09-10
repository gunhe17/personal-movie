import { useId, useMemo } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { format } from "date-fns";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { parseDate } from "@/shared/utils/date";
import type { HomeVariantProps } from "./types";

/**
 * 홈 변종 — "여백 시작" 시안 (밝은 배경 + 하단 반원 글로우).
 *
 * lab `home-airy-start`의 B 그라디언트 시안을 메인 홈 변종으로 이식.
 * 톤: 흰색 배경 + 화면 하단에 큰 라이트 블루 반원 글로우 (원 위쪽 반원이 화면에
 * 보이고 아래쪽은 화면 밖으로 잘림). 다크 hero 텍스트로 ZERO 페이지 톤 차용.
 * 구성: 상단 status pill / 큰 Hero(다음 상담까지 N분) / 카운트 칩(상담/검사) /
 *       다음 일정 카드 / 메인 홈 공통 FieldnoteCta.
 */
export function AiryStart(props: HomeVariantProps) {
  const {
    personName,
    dateStr,
    nextSession,
    weekStats,
    onPressNotifications,
    onPressNextSession,
    onPressNextSessionRecord,
    onPressFieldNoteList,
  } = props;

  const insets = useSafeAreaInsets();

  // 다음 상담까지 남은 시간 (분). 없으면 null.
  const minutesUntil = useMemo(() => {
    if (!nextSession?.start) return null;
    const diff = Math.round(
      (parseDate(nextSession.start).getTime() - Date.now()) / 60000,
    );
    return Math.max(0, diff);
  }, [nextSession]);

  // 다음 일정 카드용 필드
  const nextClientName = nextSession?.clients?.[0]?.name ?? null;
  const startStr = nextSession?.start
    ? format(parseDate(nextSession.start), "HH:mm")
    : null;
  const endStr = nextSession?.end
    ? format(parseDate(nextSession.end), "HH:mm")
    : null;
  const programStr = nextSession?.program_name ?? nextSession?.title ?? null;
  const roomStr = nextSession?.room_name ?? null;

  // 탭바 위 여백 (실제 탭바는 ~48 + safe area bottom)
  const bottomPad = s(80) + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* 배경 글로우 — 화면 하단 반원 (RadialGradient로 fade-out) */}
      <BackgroundGlow />

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* 상단 row — 알림만 우측 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(12),
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={onPressNotifications}
            accessibilityLabel="알림"
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({
              width: s(36),
              height: s(36),
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={COLORS.gray[700]}
            />
          </Pressable>
        </View>

        {/* Hero — 날짜 pill을 hero 문구 바로 위에 배치 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(32),
          }}
        >
          {/* 날짜 pill */}
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderRadius: 999,
              backgroundColor: COLORS.gray[50],
              marginBottom: s(16),
            }}
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: COLORS.palette.green,
              }}
            />
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.gray[700] }}
            >
              {dateStr}
            </Typography>
          </View>

          <Typography
            weight="semibold"
            style={{
              color: COLORS.gray[900],
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -1,
            }}
          >
            {personName ? `${personName}님,\n` : ""}다음 상담까지
          </Typography>
          {minutesUntil != null ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: s(8),
                marginTop: s(4),
              }}
            >
              <Typography
                weight="semibold"
                style={{
                  color: COLORS.primary,
                  fontSize: s(44),
                  lineHeight: s(52),
                  letterSpacing: -1.4,
                }}
              >
                {minutesUntil}분
              </Typography>
              <Typography
                weight="semibold"
                style={{
                  color: COLORS.gray[900],
                  fontSize: s(28),
                  lineHeight: s(38),
                  letterSpacing: -1,
                }}
              >
                남았어요
              </Typography>
            </View>
          ) : (
            <Typography
              weight="semibold"
              style={{
                color: COLORS.gray[900],
                fontSize: s(28),
                lineHeight: s(38),
                letterSpacing: -1,
                marginTop: s(4),
              }}
            >
              일정이 없어요
            </Typography>
          )}
          <Typography
            variant="body-01"
            weight="regular"
            style={{
              color: COLORS.gray[600],
              marginTop: s(14),
            }}
          >
            잠깐 호흡 한 번 고르고 시작해요
          </Typography>

          {/* 오늘 상담/검사 카운트 칩 */}
          <View
            style={{
              flexDirection: "row",
              gap: s(8),
              marginTop: s(16),
            }}
          >
            <CountChip
              label="상담"
              count={weekStats.counseling}
              bg={COLORS.counselingLight}
              textColor={COLORS.counseling}
            />
            <CountChip
              label="검사"
              count={weekStats.assessment}
              bg={COLORS.assessmentLight}
              textColor={COLORS.assessment}
            />
          </View>
        </View>

        {/* 화면 하단 — 다음 일정 카드 + 필드노트 CTA */}
        <View
          style={{
            flex: 1,
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            justifyContent: "flex-end",
            paddingBottom: bottomPad,
            gap: s(12),
          }}
        >
          {nextSession && (
            <Pressable
              onPress={onPressNextSession}
              accessibilityLabel={`다음 일정 ${nextClientName ?? ""}`}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
            >
              <View
                style={{
                  backgroundColor: COLORS.white,
                  borderRadius: s(20),
                  paddingHorizontal: s(20),
                  paddingVertical: s(18),
                  gap: s(8),
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
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
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.counseling }}
                  >
                    다음 일정
                  </Typography>
                </View>
                {startStr && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: s(8),
                    }}
                  >
                    <Typography
                      weight="bold"
                      style={{
                        color: COLORS.gray[900],
                        fontSize: s(22),
                        lineHeight: s(28),
                        letterSpacing: -0.5,
                      }}
                    >
                      {startStr}
                    </Typography>
                    {endStr && (
                      <Typography
                        variant="body-02"
                        weight="regular"
                        style={{ color: COLORS.gray[500] }}
                      >
                        ~ {endStr}
                      </Typography>
                    )}
                  </View>
                )}
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: COLORS.gray[900] }}
                >
                  {nextClientName ? `${nextClientName}님` : "-"}
                  {programStr ? ` · ${programStr}` : ""}
                </Typography>
                {roomStr && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: s(6),
                      marginTop: s(2),
                    }}
                  >
                    <Icon
                      name="location"
                      size={s(14)}
                      color={COLORS.gray[400]}
                    />
                    <Typography
                      variant="body-03"
                      style={{ color: COLORS.gray[500] }}
                    >
                      {roomStr}
                    </Typography>
                  </View>
                )}
              </View>
            </Pressable>
          )}

          {/* 메인 홈 공통 필드노트 CTA */}
          <FieldnoteCta
            clientName={nextClientName}
            onPress={
              nextSession ? onPressNextSessionRecord : onPressFieldNoteList
            }
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ───────── 배경 글로우 (화면 하단 반원) ─────────
 * 원 사이즈 s(800), 중심을 화면 하단(bottom: -s(400))에 두어 위쪽 반원만
 * 화면에 보이고 아래쪽은 잘림. RadialGradient로 가장자리로 갈수록 fade-out.
 */
function BackgroundGlow() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -s(400),
          alignItems: "center",
        }}
      >
        <BlobSVG size={s(800)} color={COLORS.primary300} opacity={0.55} />
      </View>
    </View>
  );
}

/** RadialGradient로 부드럽게 fade-out 되는 원 — 가장자리가 배경과 머지 */
function BlobSVG({
  size,
  color,
  opacity,
}: {
  size: number;
  color: string;
  opacity: number;
}) {
  const id = useId();
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="60%" stopColor={color} stopOpacity={opacity * 0.4} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2}
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

/* ───────── 카운트 칩 ───────── */
function CountChip({
  label,
  count,
  bg,
  textColor,
}: {
  label: string;
  count: number;
  bg: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(12),
        paddingVertical: s(7),
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: textColor }}
      >
        {label} {count}건
      </Typography>
    </View>
  );
}

/* ───────── Fieldnote CTA (메인 홈 변종들과 동일) ───────── */
function FieldnoteCta({
  clientName,
  onPress,
}: {
  clientName: string | null;
  onPress: () => void;
}) {
  const title = clientName
    ? `${clientName}님의 상담을 기록해보세요`
    : "필드노트로 기록해보세요";

  return (
    <View
      style={{
        borderRadius: s(20),
        shadowColor: "#7B79FF",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="필드노트 녹음 시작"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      >
        <LinearGradient
          colors={["#A56EFF", "#7B79FF", "#219EFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: s(20),
            paddingVertical: s(16),
            paddingHorizontal: s(20),
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
          }}
        >
          <View style={{ flex: 1, gap: s(2) }}>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.white }}
              numberOfLines={1}
            >
              {title}
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: "rgba(255,255,255,0.85)" }}
              numberOfLines={1}
            >
              필드노트가 대화를 정리해드려요
            </Typography>
          </View>
          <RecordPill />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function RecordPill() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        backgroundColor: COLORS.white,
        paddingHorizontal: s(14),
        paddingVertical: s(10),
        borderRadius: s(999),
      }}
    >
      <View
        style={{
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: COLORS.negative,
        }}
      />
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

