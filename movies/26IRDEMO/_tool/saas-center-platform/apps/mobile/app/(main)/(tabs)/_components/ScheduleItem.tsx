import { View, Pressable } from 'react-native';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import { COLORS, GAP, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import { deriveStatus, getAge, type ScheduleStatus } from './utils';

interface ScheduleItemProps {
  item: ScheduleListItem;
  onPress: () => void;
  /** 카드 좌측 도트(타이틀 앞) 컬러 — 호출부에서 일정마다 다른 색을 부여 */
  barColor?: string;
  /** "지금 집중할 일정" — in_progress 우선, 없으면 가장 가까운 예정. 활성 시 옅은 primary 보더 */
  isActive?: boolean;
}

interface StatusBadgeConfig {
  bg: string;
  text: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'] | null;
}

const STATUS_CONFIG: Record<ScheduleStatus, StatusBadgeConfig> = {
  upcoming: {
    bg: COLORS.statusBadge.scheduled.bg,
    text: COLORS.statusBadge.scheduled.text,
    label: '예정',
    icon: null,
  },
  in_progress: {
    bg: COLORS.statusBadge.inProgress.bg,
    text: COLORS.statusBadge.inProgress.text,
    label: '진행 중',
    icon: 'ellipse',
  },
  completed: {
    bg: '#84B5221A',
    text: '#84B522',
    label: '완료',
    icon: 'checkmark',
  },
  cancelled: {
    bg: '#FFE8E8',
    text: COLORS.negative,
    label: '취소',
    icon: 'close',
  },
  no_show: {
    bg: 'rgba(244,117,0,0.08)',
    text: '#F47500',
    label: '노쇼',
    icon: null,
  },
};

export function ScheduleItem({
  item,
  onPress,
  barColor,
  isActive = false,
}: ScheduleItemProps) {
  const accent = barColor ?? COLORS.gray[400];
  const primary = item.clients?.[0];
  const state = deriveStatus(item);
  const typeLabel =
    SCHEDULE_TYPE_LABELS[item.schedule_type] ?? item.schedule_type;

  const isCancelled = state === 'cancelled';
  const isInProgress = state === 'in_progress';

  // 상태별 카드 배경 — 흰 페이지 위에서 gray-50 카드가 떠 보임, 진행중만 brand 톤
  const cardBg = isInProgress ? COLORS.blue[50] : COLORS.gray[50];

  // 콘텐츠 투명도 — 취소만 가라앉히기 (노쇼는 정상 가시성 유지)
  const contentOpacity = isCancelled ? 0.5 : 1;

  // 시간 컬럼 색 — in_progress만 brand, 취소만 tertiary, 그 외 일반
  const timeStartColor = isInProgress
    ? COLORS.primary700
    : isCancelled
      ? COLORS.text.body.subtle
      : COLORS.text.title.default;
  const timeEndColor = isInProgress
    ? COLORS.primary500
    : isCancelled
      ? COLORS.gray[400]
      : COLORS.text.body.subtle;
  const timeLineColor = isInProgress ? COLORS.primary300 : COLORS.gray[300];

  const start = parseDate(item.start);
  const end = parseDate(item.end);
  const startText = format(start, 'HH:mm');
  const endText = format(end, 'HH:mm');

  const genderText =
    primary?.gender === 'female' ? '여' : primary?.gender === 'male' ? '남' : null;
  const ageText =
    primary?.birth_date != null ? `만 ${getAge(primary.birth_date)}세` : null;

  // 백엔드 ScheduleListItem 타입엔 아직 cancel_reason 미노출 — 안전 캐스트로 읽음.
  // counseling_session / assessment_session에는 존재하므로 list 응답에 필드 노출되면 자동 반영.
  const cancelReason = isCancelled
    ? (item as unknown as { cancel_reason?: string | null }).cancel_reason ?? null
    : null;
  const showCancelReason = isCancelled && !!cancelReason;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      accessibilityRole="button"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        {/* 시간 컬럼 — 카드 좌측, 시작/종료 세로 배치 + 상태별 컬러 */}
        <View
          style={{
            width: s(56),
            marginRight: s(GAP.card),
            paddingVertical: s(12),
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: timeStartColor }}
          >
            {startText}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(12),
              backgroundColor: timeLineColor,
              marginVertical: s(4),
            }}
          />
          <Typography
            variant="body-01"
            weight="regular"
            style={{ color: timeEndColor }}
          >
            {endText}
          </Typography>
        </View>

        {/* 카드 본문 — active(지금 집중할 일정)에만 옅은 primary 보더 */}
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: s(16),
            paddingVertical: s(12),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            borderWidth: isActive ? 1.5 : 0,
            borderColor: isActive ? COLORS.primary300 : 'transparent',
          }}
        >
          {/* Title + meta — 2줄 고정
              1행: dot + 타이틀 + 뱃지
              2행: 성별 · 나이 (타이틀 시작 위치 정렬) */}
          <View style={{ opacity: contentOpacity }}>
            {/* 1행: 타이틀 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(8),
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: accent,
                }}
              />
              <Typography
                variant="body-01"
                weight="semibold"
                style={{
                  flex: 1,
                  color: COLORS.text.title.default,
                  textDecorationLine: isCancelled ? 'line-through' : 'none',
                  textDecorationColor: COLORS.text.title.default,
                }}
                numberOfLines={1}
              >
                {primary ? `${primary.name}님의 ${typeLabel}` : item.title ?? typeLabel}
              </Typography>
              <StatusBadge state={state} />
            </View>

            {/* 케이스 식별자 — "{case_code}의 N회기" 서브타이틀 (백엔드에서 case_code/session_number 노출 시 표시) */}
            {item.case_code && item.session_number != null && (
              <Typography
                variant="label-01"
                weight="regular"
                style={{
                  color: COLORS.gray[500],
                  marginTop: s(2),
                  marginLeft: 6 + s(8),
                }}
                numberOfLines={1}
              >
                {item.case_code}의 {item.session_number}회기
              </Typography>
            )}

            {/* 2행: 성별만 (나이 제외) — dot(6) + gap(8)만큼 들여서 타이틀과 정렬 */}
            {genderText && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: s(2),
                  marginLeft: 6 + s(8),
                }}
              >
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.gray[600] }}
                >
                  {genderText}
                </Typography>
              </View>
            )}
          </View>

          {/* 취소 사유 — 가독성을 위해 dim 적용하지 않음. 타이틀 텍스트와 동일 들여쓰기 */}
          {showCancelReason && (
            <Typography
              variant="label-01"
              weight="regular"
              style={{
                color: COLORS.text.body.subtle,
                marginTop: s(GAP.intra),
                marginLeft: 6 + s(8),
              }}
              numberOfLines={2}
            >
              취소 · {cancelReason}
            </Typography>
          )}

          {/* 일정 메타데이터 그룹 — 내담자 정보와 시각적으로 분리 */}
          {(item.room_name || item.program_name) && (
            <View
              style={{
                marginTop: s(GAP.card),
                gap: s(GAP.intra),
              }}
            >
              {item.room_name && (
                <MetaRow
                  iconName="location-20"
                  text={item.room_name}
                  inactive={isCancelled}
                />
              )}
              {item.program_name && (
                <MetaRow
                  iconName="document-20"
                  text={item.program_name}
                  inactive={isCancelled}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function MetaRow({
  iconName,
  text,
  inactive,
}: {
  iconName: React.ComponentProps<typeof Icon>['name'];
  text: string;
  inactive: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        opacity: inactive ? 0.55 : 1,
      }}
    >
      <Icon name={iconName} size={s(20)} color={COLORS.gray[400]} />
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.gray[800], flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

function StatusBadge({ state }: { state: ScheduleStatus }) {
  const config = STATUS_CONFIG[state];

  // 아이콘 없는 상태 — 공용 BadgeRound 사용
  if (!config.icon) {
    return (
      <BadgeRound bg={config.bg} color={config.text}>
        {config.label}
      </BadgeRound>
    );
  }

  // 아이콘 포함 상태 — 공용 컴포넌트로 못 바꿔, 인라인 컨테이너만 BadgeRound 규격(높이28/최소폭50/좌우패딩10/pill/label-01 medium)에 맞춤
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: config.bg,
        height: s(28),
        minWidth: s(50),
        paddingHorizontal: s(10),
        borderRadius: 9999,
        gap: s(4),
      }}
    >
      <Ionicons
        name={config.icon}
        size={state === 'in_progress' ? 8 : 12}
        color={config.text}
      />
      <Typography variant="label-01" weight="medium" style={{ color: config.text }}>
        {config.label}
      </Typography>
    </View>
  );
}
