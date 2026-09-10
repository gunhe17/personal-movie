import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Segment } from '@/shared/components/ui/Segment';
import { s } from '@/shared/utils/scale';

/**
 * [상담일지 리스트] 내담자 탭/상세 톤 입히기 — 탭 비교 lab.
 *
 * 상담일지 리스트(counseling/notes.tsx)에 내담자 목록(clients.tsx)·내담자 상세
 * (client/[id]/index.tsx)가 만족하는 "재미·직관·필요" 3박자를 옮긴 케이스 비교.
 *
 * 내담자 상세에서 추출한 3박자 DNA:
 *   · 재미 — AttentionHero spring drop-in, "확인하기" pill pulse ring
 *   · 직관 — 좌측 컬러 strip, signal별 색, D-day 배지, "다음 회기" 미리보기
 *   · 필요 — 신호=즉시 액션(이동 아님), 우선순위 그룹핑(지금 챙길 일→기록→정보)
 *
 * 탭(가로 스크롤):
 *   현재       — production 그대로(대조군)
 *   내담자 톤   — 상태 칩(작성=success/미작성=notice) + SectionLabel 톤  [직관]
 *   미작성 Hero — 최상단 AttentionHero(미작성 N건·orange strip·spring·pulse)  [필요·직관·재미]
 *   카드 신호   — 카드 좌측 strip(완료=green/부분=orange)+그룹 작성률+요약 미리보기+시급도 [직관·필요]
 *
 * 명시적 제외: 컬러 아바타, 검색바 focus 인터랙션(촌스러움 피드백). 전부 mock.
 */

type Variant = 'current' | 'toned' | 'hero' | 'cards' | 'combo';
type FilterKey = 'all' | 'written' | 'missing';

const VARIANTS: { key: Variant; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'toned', label: '내담자 톤' },
  { key: 'hero', label: '미작성 Hero' },
  { key: 'cards', label: '카드 신호' },
  { key: 'combo', label: '결합 (Hero+카드)' },
];

const FILTER_TITLE: Record<FilterKey, string> = {
  all: '전체 일지',
  written: '작성한 일지',
  missing: '미작성 일지',
};

/* ───────── mock: 같은 회기 묶음(SessionGroup) ───────── */
interface MockNote {
  clientId: string;
  clientName: string;
  gender: '남' | '여';
  age: number;
  isWritten: boolean;
  summary?: string; // 작성된 일지 요약 1줄
}
interface MockGroup {
  sessionId: string;
  dateLabel: string; // "6월 5일 (목)"
  agoDays: number; // 회기 ~ 지금 경과일 (시급도 계산용)
  timeRange: string;
  roomName: string;
  programName: string;
  notes: MockNote[];
}

const MOCK_GROUPS: MockGroup[] = [
  {
    sessionId: 's1',
    dateLabel: '6월 5일 (목)',
    agoDays: 0,
    timeRange: '14:00 ~ 15:00',
    roomName: '2상담실',
    programName: '놀이치료-개인',
    notes: [{ clientId: 'c1', clientName: '김은지', gender: '여', age: 9, isWritten: false }],
  },
  {
    sessionId: 's2',
    dateLabel: '6월 4일 (수)',
    agoDays: 1,
    timeRange: '10:00 ~ 11:30',
    roomName: '집단상담실',
    programName: '사회성집단-그룹',
    notes: [
      {
        clientId: 'c2',
        clientName: '박서준',
        gender: '남',
        age: 11,
        isWritten: true,
        summary: '또래 갈등 상황에서 자기표현이 늘고 규칙 수용도 안정적.',
      },
      { clientId: 'c3', clientName: '이하준', gender: '남', age: 10, isWritten: false },
      {
        clientId: 'c4',
        clientName: '최유나',
        gender: '여',
        age: 11,
        isWritten: true,
        summary: '발표 불안이 줄어 자발적 참여가 관찰됨. 다음 역할놀이 예정.',
      },
    ],
  },
  {
    sessionId: 's3',
    dateLabel: '6월 2일 (월)',
    agoDays: 3,
    timeRange: '16:00 ~ 17:00',
    roomName: '1상담실',
    programName: '미술치료-개인',
    notes: [
      {
        clientId: 'c5',
        clientName: '정도윤',
        gender: '남',
        age: 8,
        isWritten: true,
        summary: '분리불안 주제 탐색. 모와의 애착 안정화 흐름, 미술 표현 긍정 신호.',
      },
    ],
  },
  {
    sessionId: 's4',
    dateLabel: '5월 31일 (토)',
    agoDays: 5,
    timeRange: '11:00 ~ 12:00',
    roomName: '2상담실',
    programName: '놀이치료-개인',
    notes: [{ clientId: 'c6', clientName: '한지우', gender: '여', age: 7, isWritten: false }],
  },
];

function agoText(agoDays: number): string {
  if (agoDays <= 0) return '오늘';
  if (agoDays === 1) return '어제';
  return `${agoDays}일 전`;
}

export default function CounselingNotesClientToneLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('current');
  const [filter, setFilter] = useState<FilterKey>('all');

  const all = MOCK_GROUPS.reduce((acc, g) => acc + g.notes.length, 0);
  const writtenCount = MOCK_GROUPS.reduce(
    (acc, g) => acc + g.notes.filter((n) => n.isWritten).length,
    0,
  );
  const missingCount = all - writtenCount;

  const groups = MOCK_GROUPS.map((g) => ({
    ...g,
    notes:
      filter === 'all'
        ? g.notes
        : g.notes.filter((n) => (filter === 'written' ? n.isWritten : !n.isWritten)),
  })).filter((g) => g.notes.length > 0);

  const visibleCount = groups.reduce((acc, g) => acc + g.notes.length, 0);

  const showHero =
    (variant === 'hero' || variant === 'combo') && filter === 'all' && missingCount > 0;
  const useSectionTone = variant !== 'current';

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              상담일지 · 3박자 케이스
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 — 가로 스크롤 primary 톤 pill (아래 칩 필터와 시각 분리) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
            gap: s(8),
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
                  borderRadius: s(999),
                  backgroundColor: active ? COLORS.primary50 : COLORS.gray[100],
                  opacity: pressed ? 0.85 : 1,
                })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'bold' : 'medium'}
                  style={{ color: active ? COLORS.primary700 : COLORS.gray[600] }}
                >
                  {v.label}
                </Typography>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* 검색바 — 정적 (포커스 전환 없음) */}
      <View
        style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(20) }}
        className="border-b border-gray-100 bg-surface"
      >
        <View
          style={{ height: s(44), paddingHorizontal: s(16), gap: s(8) }}
          className="flex-row items-center rounded-[12px] bg-gray-50"
        >
          <Typography variant="body-02" style={{ flex: 1, color: COLORS.gray[400] }}>
            내담자 이름으로 검색해주세요
          </Typography>
          <Ionicons name="search-outline" size={s(18)} color={COLORS.gray[400]} />
        </View>
      </View>

      {/* 회색 영역: 필터 + Hero + 섹션 라벨 + 리스트 */}
      <View className="flex-1 bg-background">
        {/* 필터 — production 동일 Segment 칩 필터 */}
        <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(8) }}>
          <Segment<FilterKey>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '전체', count: all },
              { value: 'written', label: '작성', count: writtenCount },
              { value: 'missing', label: '미작성', count: missingCount },
            ]}
          />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: s(20),
            paddingTop: s(8),
            paddingBottom: s(40),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* 미작성 Hero — AttentionHero 차용 */}
          {showHero && <MissingHero count={missingCount} />}

          {/* 섹션 라벨 */}
          {useSectionTone ? (
            <View style={{ paddingTop: s(4), paddingBottom: s(8) }}>
              <View className="flex-row items-baseline" style={{ gap: s(6) }}>
                <Typography
                  variant="label-01"
                  weight="bold"
                  style={{ color: COLORS.gray[700], letterSpacing: 0.2 }}
                >
                  {FILTER_TITLE[filter]}
                </Typography>
                <Typography variant="label-01" style={{ color: COLORS.gray[400] }}>
                  {visibleCount}
                </Typography>
              </View>
              {!showHero && filter !== 'missing' && missingCount > 0 && (
                <Typography
                  variant="caption-01"
                  style={{ color: COLORS.gray[500], marginTop: s(2) }}
                >
                  아직 작성하지 않은 일지가 {missingCount}건 있어요
                </Typography>
              )}
            </View>
          ) : (
            <View style={{ paddingBottom: s(8), paddingTop: s(1) }}>
              <Typography variant="label-01" className="text-gray-500">
                총 {visibleCount}개
              </Typography>
            </View>
          )}

          {/* 리스트 */}
          {groups.map((g) => (
            <View key={g.sessionId} style={{ marginBottom: s(16) }}>
              {/* 날짜 헤더 */}
              <View
                className="flex-row items-center"
                style={{ marginBottom: s(12), paddingHorizontal: s(4), gap: s(8) }}
              >
                <Typography variant="label-01" weight="semibold" style={{ color: COLORS.gray[700] }}>
                  {g.dateLabel}
                </Typography>
                <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[300] }} />
                <Typography variant="label-01" weight="regular" style={{ color: COLORS.gray[500] }}>
                  {agoText(g.agoDays)}
                </Typography>
              </View>

              <SessionCard variant={variant} group={g} />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/* ───────── 회기 카드 ───────── */
function SessionCard({ variant, group }: { variant: Variant; group: MockGroup }) {
  const isCards = variant === 'cards' || variant === 'combo';
  const writtenInGroup = group.notes.filter((n) => n.isWritten).length;
  const allWritten = writtenInGroup === group.notes.length;
  // 카드 신호: 좌측 strip 색 — 전부 작성=green / 일부 미작성=orange
  const stripColor = allWritten ? COLORS.palette.green : COLORS.palette.orange;
  const isGroup = group.notes.length > 1;

  const body = (
    <View style={{ flex: 1, paddingVertical: s(16), paddingHorizontal: s(16) }}>
      {/* 1행: 시간 | 장소 */}
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <Typography variant="body-01" weight="bold" className="text-gray-900">
          {group.timeRange}
        </Typography>
        <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300] }} />
        <Typography variant="body-02" weight="regular" style={{ color: COLORS.gray[600] }}>
          {group.roomName}
        </Typography>
      </View>
      {/* 2행: 프로그램 */}
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.gray[600], marginTop: s(6) }}
        numberOfLines={1}
      >
        {group.programName}
      </Typography>

      {/* 카드 신호: 그룹 회기 작성률 progress */}
      {isCards && isGroup && (
        <GroupProgress written={writtenInGroup} total={group.notes.length} />
      )}

      <View style={{ height: 1, backgroundColor: COLORS.gray[100], marginVertical: s(14) }} />

      {/* 내담자 row stack */}
      {group.notes.map((note, nIdx) => (
        <NoteRow
          key={note.clientId}
          variant={variant}
          note={note}
          agoDays={group.agoDays}
          showDivider={nIdx !== group.notes.length - 1}
        />
      ))}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* 카드 신호: 좌측 4px 컬러 strip (카드 단위 작성 상태) */}
      {isCards && <View style={{ width: s(4), alignSelf: 'stretch', backgroundColor: stripColor }} />}
      {body}
    </View>
  );
}

/* ───────── 그룹 작성률 progress ───────── */
function GroupProgress({ written, total }: { written: number; total: number }) {
  const ratio = total > 0 ? written / total : 0;
  const done = written === total;
  return (
    <View className="flex-row items-center" style={{ gap: s(8), marginTop: s(10) }}>
      <View
        style={{
          flex: 1,
          height: s(4),
          borderRadius: s(2),
          backgroundColor: COLORS.gray[100],
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: s(2),
            backgroundColor: done ? COLORS.success : COLORS.warning,
          }}
        />
      </View>
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: done ? COLORS.success : COLORS.gray[500] }}
      >
        {written}/{total} 작성
      </Typography>
    </View>
  );
}

/* ───────── 내담자 row ───────── */
function NoteRow({
  variant,
  note,
  agoDays,
  showDivider,
}: {
  variant: Variant;
  note: MockNote;
  agoDays: number;
  showDivider: boolean;
}) {
  const meta = `${note.gender} · 만 ${note.age}세`;
  const isToned = variant !== 'current';
  const isCards = variant === 'cards' || variant === 'combo';
  const showUrgency = isCards && !note.isWritten && agoDays >= 3;

  return (
    <View>
      <Pressable accessibilityRole="button" style={{ paddingVertical: s(10) }}>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {`${note.clientName}님`}
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            className="flex-1 text-gray-500"
            numberOfLines={1}
          >
            {meta}
          </Typography>

          {showUrgency && <UrgencyBadge agoDays={agoDays} />}

          {isToned ? (
            <StatusChip isWritten={note.isWritten} />
          ) : (
            <Ionicons name="chevron-forward" size={s(16)} color={COLORS.gray[400]} />
          )}
        </View>

        {/* 카드 신호: 작성 행은 요약 미리보기 / 미작성 행은 작성 유도 */}
        {isCards && (
          <Typography
            variant="body-03"
            weight="regular"
            numberOfLines={1}
            style={{
              marginTop: s(4),
              color: note.isWritten ? COLORS.gray[600] : COLORS.gray[400],
            }}
          >
            {note.isWritten
              ? (note.summary ?? '요약이 아직 없어요')
              : '탭하면 일지를 바로 작성할 수 있어요'}
          </Typography>
        )}
      </Pressable>

      {showDivider && <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />}
    </View>
  );
}

/* ───────── 작성/미작성 상태 칩 ─────────
 * 내담자 탭 NextMeeting(우측 pill) 패턴 차용.
 *   작성:   success 체크 pill / 미작성: notice 칩
 */
function StatusChip({ isWritten }: { isWritten: boolean }) {
  if (isWritten) {
    return (
      <View
        className="flex-row items-center rounded-full"
        style={{
          paddingHorizontal: s(8),
          paddingVertical: s(3),
          gap: s(3),
          backgroundColor: 'rgba(0,191,64,0.12)',
        }}
      >
        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.success }}>
          작성 완료
        </Typography>
      </View>
    );
  }
  return (
    <View
      className="rounded-full"
      style={{
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        backgroundColor: 'rgba(255,146,0,0.12)',
      }}
    >
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.notice }}>
        미작성
      </Typography>
    </View>
  );
}

/* ───────── 시급도 경과 배지 (미작성 · 오래된 회기) ─────────
 * D-day 배지 패턴 차용 — 회기 기억은 시간이 지날수록 휘발 → 오래된 미작성을 강조.
 */
function UrgencyBadge({ agoDays }: { agoDays: number }) {
  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: s(7),
        paddingVertical: s(2),
        gap: s(3),
        backgroundColor: COLORS.paletteBg.orange,
      }}
    >
      <Ionicons name="time-outline" size={11} color={COLORS.palette.orange} />
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>
        {agoDays}일 지남
      </Typography>
    </View>
  );
}

/* ───────── 미작성 Hero — 내담자 상세 AttentionHero 차용 ─────────
 * 흰 카드 + 좌측 orange strip + spring drop-in. 상단 라벨 + 작은 "모아 보기" 칩,
 * 아래로 헤드라인 + 설명(세로 스택). flex 는 inline 명시(본문 0 접힘 회피).
 * 필요(미작성 최우선) · 직관(orange strip) · 재미(spring drop-in).
 */
function MissingHero({ count }: { count: number }) {
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  const accent = COLORS.palette.orange;

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity, marginBottom: s(16) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`미작성 일지 ${count}건 모아 보기`}
        style={({ pressed }) => ({
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          flexDirection: 'row',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <View style={{ width: s(6), alignSelf: 'stretch', backgroundColor: accent }} />
        <View style={{ flex: 1, padding: s(16), gap: s(8) }}>
          {/* 상단: 라벨 + 우측 "모아 보기" 칩 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <Ionicons name="document-text-outline" size={s(15)} color={accent} />
            <Typography variant="label-01" weight="bold" style={{ color: accent, letterSpacing: 0.3 }}>
              미작성 일지
            </Typography>
            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(3),
                backgroundColor: accent,
                paddingHorizontal: s(12),
                paddingVertical: s(6),
                borderRadius: s(999),
              }}
            >
              <Typography variant="label-02" weight="bold" style={{ color: COLORS.white }}>
                모아 보기
              </Typography>
              <Ionicons name="arrow-forward" size={13} color={COLORS.white} />
            </View>
          </View>

          {/* 헤드라인 */}
          <Typography variant="headline-02" weight="semibold" className="text-gray-900">
            아직 {count}건 남았어요
          </Typography>

          {/* 설명 */}
          <Typography variant="body-03" className="text-gray-600" style={{ lineHeight: s(20) }}>
            회기 기억이 생생할 때 정리해 두면 다음 상담이 한결 수월해요
          </Typography>
        </View>
      </Pressable>
    </Animated.View>
  );
}
