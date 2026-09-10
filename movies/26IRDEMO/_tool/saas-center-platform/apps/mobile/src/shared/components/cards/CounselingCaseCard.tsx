import { memo } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';

/**
 * 상담 케이스 카드 (좌 아바타 + 우 정보 + 하단 진행도).
 *
 * 상담 현황 리스트(`/(main)/counseling`)와 내담자 상세 케이스 목록(`client/[id]/cases`)이
 * 동일한 톤앤매너를 공유하기 위한 공용 컴포넌트.
 * 두 화면의 데이터 타입이 조금 달라(상담실명·종료시각·프로필 등 일부 부재) 필드를 optional로 둔다.
 */

export type CounselingStatusKey =
  | 'in_progress'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

export interface CounselingCaseCardItem {
  case_id: string;
  case_code: string;
  status: string;
  program_name: string | null;
  completed_sessions: number;
  total_sessions: number;
  next_session_start: string | null;
  next_session_end?: string | null;
  next_session_room_name?: string | null;
  clients: Array<{
    name: string | null;
    gender?: string | null;
    age?: number | null;
    profile_image_url?: string | null;
  }>;
}

const GENDER_LABELS: Record<string, string> = { male: '남', female: '여' };
const CARD_HEIGHT = 176;
/** 진행도 바·그룹 +N 텍스트 색 — 디자인 시스템 외 지정값 */
const ACCENT_BLUE = '#4486FF';

export function deriveCounselingStatus(
  item: Pick<CounselingCaseCardItem, 'status' | 'completed_sessions'>,
): CounselingStatusKey {
  if (item.status === 'cancelled') return 'cancelled';
  if (item.status === 'completed') return 'completed';
  if (item.completed_sessions === 0) return 'scheduled';
  return 'in_progress';
}

/** 진행중 케이스 중 예정 회기 수만큼 모두 소화돼 연장 결정이 필요한 상태 */
function needsExtension(
  item: CounselingCaseCardItem,
  status: CounselingStatusKey,
): boolean {
  if (status !== 'in_progress') return false;
  return item.total_sessions > 0 && item.completed_sessions >= item.total_sessions;
}

/** 다음 상담일 + 시각 — 예: "6. 18 (수) 18:00" */
function formatNextDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return format(parseDate(value), 'M. d (E) HH:mm', { locale: ko });
  } catch {
    return null;
  }
}

/** 시각만 — 예: "16:00" */
function formatTimeOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return format(parseDate(value), 'HH:mm');
  } catch {
    return null;
  }
}

/** 오늘 자정 기준 D-day. 음수=지남, 0=오늘, 양수=N일 후 */
export function computeCounselingDDay(target: string | null | undefined): number | null {
  if (!target) return null;
  try {
    const t = parseDate(target);
    const targetMidnight = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const now = new Date();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/** 우상단 상태 뱃지 — 연장필요 > 완료/취소 > 진행중/예정 */
function getTopBadge(
  status: CounselingStatusKey,
  needsExt: boolean,
): { bg: string; text: string; label: string } {
  // 배지 3색 통일: 완료=green, 임박 D-day=red(호출부 처리), 그 외 전부=gray.
  if (status === 'completed')
    return { bg: COLORS.tag.green.bg, text: COLORS.tag.green.fg, label: '완료' };
  const label = needsExt
    ? '연장필요'
    : status === 'in_progress'
      ? '진행중'
      : status === 'scheduled'
        ? '예정'
        : '취소';
  return { bg: COLORS.tag.gray.bg, text: COLORS.tag.gray.fg, label };
}

export const CounselingCaseCard = memo(function CounselingCaseCard({
  item,
  onPress,
}: {
  item: CounselingCaseCardItem;
  onPress: (caseId: string) => void;
}) {
  const status = deriveCounselingStatus(item);

  const mainClient = item.clients[0];
  const clientName = mainClient?.name ?? '-';
  const genderLabel = mainClient?.gender ? GENDER_LABELS[mainClient.gender] : null;
  const age = mainClient?.age;
  const extraCount = Math.max(0, item.clients.length - 1);
  const initial = clientName.trim().charAt(0) || '?';
  const profileImageUrl = mainClient?.profile_image_url ?? null;

  const progress =
    item.total_sessions > 0
      ? Math.min(item.completed_sessions / item.total_sessions, 1)
      : 0;
  const nextTimeText = (() => {
    const start = formatNextDateTime(item.next_session_start);
    if (!start) return null;
    const end = formatTimeOnly(item.next_session_end);
    return `${start}${end ? `-${end}` : ''}`;
  })();
  const nextRoomName = item.next_session_room_name;
  const showExtensionHint = needsExtension(item, status);

  const isDimmed = status === 'cancelled';

  const ddayDiff = computeCounselingDDay(item.next_session_start);
  // 임박 = D-3 ~ D-DAY (이 구간만 red, 그 외 gray)
  const ddayImminent = ddayDiff !== null && ddayDiff <= 3;
  // 진행중·예정 모두 다음 일정이 잡혀 있으면 D-day 배지로 표시 (D-1 식)
  const showDday =
    (status === 'in_progress' || status === 'scheduled') &&
    !showExtensionHint &&
    ddayDiff !== null &&
    ddayDiff >= 0;

  const topBadge = showDday
    ? {
        bg: ddayImminent ? COLORS.tag.red.bg : COLORS.tag.gray.bg,
        text: ddayImminent ? COLORS.tag.red.fg : COLORS.tag.gray.fg,
        label: ddayDiff === 0 ? 'D-DAY' : `D-${ddayDiff}`,
      }
    : getTopBadge(status, showExtensionHint);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item.case_id)}
      accessibilityLabel={`${clientName} 상담 상세 보기`}
      accessibilityRole="button"
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        height: s(CARD_HEIGHT),
        paddingHorizontal: s(16),
        paddingVertical: s(16),
        justifyContent: 'space-between',
        opacity: isDimmed ? 0.6 : 1,
      }}
    >
      {/* 케이스 코드(최상단 caption) + 상단(아바타 + 정보) — 코드↔정보 간격 0 */}
      <View style={{ gap: 0 }}>
        {item.case_code && (
          <Typography
            variant="label-01"
            weight="regular"
            numberOfLines={1}
            style={{ color: COLORS.gray[500] }}
          >
            {item.case_code}
          </Typography>
        )}
        {/* 상단: 아바타 + 정보 */}
        <View style={{ flexDirection: 'row', gap: s(16), alignItems: 'center' }}>
        <View style={{ width: s(44), height: s(44) }}>
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(44) / 2,
                backgroundColor: COLORS.gray[100],
              }}
            />
          ) : (
            <View
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(44) / 2,
                backgroundColor: COLORS.gray[100],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="title-01" weight="semibold" style={{ color: COLORS.gray[500] }}>
                {initial}
              </Typography>
            </View>
          )}
          {extraCount > 0 && (
            <View
              style={{
                position: 'absolute',
                left: s(28),
                top: s(22),
                minWidth: s(24),
                height: s(24),
                paddingHorizontal: s(4),
                borderRadius: s(24) / 2,
                backgroundColor: COLORS.primary50,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: COLORS.primary100,
              }}
            >
              <Typography variant="caption-01" weight="regular" style={{ color: ACCENT_BLUE }}>
                +{extraCount}
              </Typography>
            </View>
          )}
        </View>

        {/* 정보 stack */}
        <View style={{ flex: 1, gap: s(4) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <View className="flex-row items-center" style={{ flex: 1, gap: s(6) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                numberOfLines={1}
                style={{ flexShrink: 1, color: COLORS.gray.black }}
              >
                {clientName}
                {extraCount > 0 ? ` 외 ${extraCount}명` : ''}
              </Typography>
              <GenderAgeMeta genderLabel={genderLabel} age={age} />
            </View>
            <BadgeRound
              bg={topBadge.bg}
              color={topBadge.text}
              // 배지(28)가 이름 텍스트 줄(24)보다 행을 키우지 않도록 위아래 2px씩
              // 흡수 → 이름↔프로그램 세로 간격이 배지 높이에 영향받지 않고
              // 텍스트 기준으로만 잡힌다. 배지는 살짝 넘쳐도 잘리지 않음.
              style={{ marginVertical: s(-2) }}
            >
              {topBadge.label}
            </BadgeRound>
          </View>

          {item.program_name && (
            <Typography
              variant="body-02"
              weight="medium"
              numberOfLines={1}
              style={{ color: COLORS.gray[900] }}
            >
              {item.program_name}
            </Typography>
          )}

          <View className="flex-row items-center">
            {showExtensionHint ? (
              <Typography
                variant="body-03"
                numberOfLines={1}
                style={{ flexShrink: 1, color: COLORS.text.state.brand }}
              >
                회기를 완료하거나 연장해주세요.
              </Typography>
            ) : (
              <>
                <Typography
                  variant="body-03"
                  numberOfLines={1}
                  style={{ flexShrink: 1, color: COLORS.gray[600] }}
                >
                  {nextTimeText ?? '다음 일정 미정'}
                </Typography>
                {nextTimeText && nextRoomName && (
                  <>
                    <View
                      style={{
                        width: 1,
                        height: s(10),
                        backgroundColor: COLORS.gray[200],
                        marginHorizontal: s(8),
                      }}
                    />
                    <Typography
                      variant="body-03"
                      numberOfLines={1}
                      style={{ flexShrink: 1, color: COLORS.gray[600] }}
                    >
                      {nextRoomName}
                    </Typography>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </View>
      </View>

      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

      {/* 하단: 진행도 */}
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[500] }}>
          진행도
        </Typography>
        <View
          style={{
            flex: 1,
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.gray[100],
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              borderRadius: s(3),
              backgroundColor: status === 'cancelled' ? COLORS.gray[400] : ACCENT_BLUE,
            }}
          />
        </View>
        <Typography variant="body-02" weight="regular" style={{ color: COLORS.gray[600] }}>
          {item.completed_sessions}/{item.total_sessions}
        </Typography>
      </View>
    </TouchableOpacity>
  );
});
