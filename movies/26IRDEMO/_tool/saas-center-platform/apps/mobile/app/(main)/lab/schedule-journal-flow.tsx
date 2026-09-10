import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 일정 상세 — 회기 일지 흐름 접근 방식 비교 lab
 *
 * 상단 모드 토글 [1:1] [그룹]
 *
 * 1:1 변종 (A/B/C/D)
 *   A 현재 — hero에 직전 1줄만 (spec 그대로)
 *   B 하단 timeline — hero는 그대로, 하단 접힌 섹션에 회기 stack
 *   C hero 펼침 — hero 안 토글로 1줄 stack
 *   D CTA 직행 — hero + 강조 CTA로 상담 상세 일지 timeline 직행
 *
 * 그룹 변종 (E/F/G)
 *   E 카드 stack — hero에 내담자별 카드 N개 (각 직전 + 흐름 펼침)
 *   F 내담자 탭 (추천) — hero 안 chip 탭으로 선택, 선택된 내담자의 hero
 *   G CTA 위임 — 그룹은 hero 간결 + 강조 CTA → 상담 상세 (도메인 경계 깔끔)
 */

type Mode = 'solo' | 'group';
type SoloVariant = 'current' | 'option-4' | 'option-1' | 'option-2';
type GroupVariant = 'group-stack' | 'group-tabs' | 'group-cta';

const SOLO_VARIANTS: { key: SoloVariant; label: string; hint: string }[] = [
  { key: 'current', label: 'A 현재', hint: '직전만' },
  { key: 'option-4', label: 'B 하단', hint: '접힌 섹션' },
  { key: 'option-1', label: 'C hero 펼침', hint: '확장' },
  { key: 'option-2', label: 'D CTA', hint: '상담 상세' },
];

const GROUP_VARIANTS: { key: GroupVariant; label: string; hint: string }[] = [
  { key: 'group-stack', label: 'E 카드 stack', hint: '내담자별' },
  { key: 'group-tabs', label: 'F 내담자 탭 ⭐', hint: 'chip' },
  { key: 'group-cta', label: 'G CTA 위임', hint: '상담 상세' },
];

interface PastSession {
  date: string;
  status: '완료' | '노쇼' | '취소';
  summary: string;
}

interface ParticipantJournal {
  name: string;
  gender: '남' | '여';
  age: number;
  prevSession: PastSession;
  olderSessions: PastSession[];
}

const SOLO_SCHEDULE = {
  program: '놀이치료-개인',
  date: '5월 22일 목요일',
  time: '14:00 ~ 14:50 (50분)',
  room: '상담실 A',
};

const SOLO_PARTICIPANT: ParticipantJournal = {
  name: '김민준',
  gender: '남',
  age: 8,
  prevSession: {
    date: '5/15 (수)',
    status: '완료',
    summary: '학교 친구 관계 어려움 토로, 다음 회기에 역할극 시도 예정',
  },
  olderSessions: [
    {
      date: '5/8 (목)',
      status: '완료',
      summary: '감정 카드 활용, 집에서 화내는 빈도 감소',
    },
    {
      date: '5/1 (목)',
      status: '완료',
      summary: '어머니와 갈등 표현, 안전감 형성 진행 중',
    },
    {
      date: '4/24 (목)',
      status: '완료',
      summary: '첫 회기, 라포 형성 단계',
    },
  ],
};

const GROUP_SCHEDULE = {
  program: '놀이치료-그룹',
  date: '5월 22일 목요일',
  time: '14:00 ~ 15:00 (60분)',
  room: '상담실 B',
};

const GROUP_PARTICIPANTS: ParticipantJournal[] = [
  {
    name: '김민준',
    gender: '남',
    age: 8,
    prevSession: {
      date: '5/15 (수)',
      status: '완료',
      summary: '학교 친구 관계 어려움 토로, 역할극 시도 예정',
    },
    olderSessions: [
      {
        date: '5/8 (목)',
        status: '완료',
        summary: '감정 카드 활용, 화내는 빈도 감소',
      },
      {
        date: '5/1 (목)',
        status: '완료',
        summary: '어머니와 갈등 표현, 안전감 형성',
      },
    ],
  },
  {
    name: '이지호',
    gender: '여',
    age: 10,
    prevSession: {
      date: '5/15 (수)',
      status: '완료',
      summary: '동생과의 다툼 이야기, 양보 패턴 관찰됨',
    },
    olderSessions: [
      {
        date: '5/8 (목)',
        status: '노쇼',
        summary: '결석',
      },
      {
        date: '5/1 (목)',
        status: '완료',
        summary: '가족 모빌 만들기, 어머니와의 관계 강조',
      },
    ],
  },
  {
    name: '박서연',
    gender: '여',
    age: 9,
    prevSession: {
      date: '5/15 (수)',
      status: '완료',
      summary: '학교 발표 불안 호소, 호흡 기법 연습',
    },
    olderSessions: [
      {
        date: '5/8 (목)',
        status: '완료',
        summary: '친구 관계 갈등, 거절 표현 연습',
      },
      {
        date: '5/1 (목)',
        status: '완료',
        summary: '첫 회기, 학교 부적응 주호소',
      },
    ],
  },
];

const NEXT_DATE = '5월 29일 목요일 14:00';

export default function ScheduleJournalFlowLab() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('solo');
  const [soloVariant, setSoloVariant] = useState<SoloVariant>('option-1');
  const [groupVariant, setGroupVariant] = useState<GroupVariant>('group-tabs');

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
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
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              일정 상세 · 일지 흐름
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 모드 토글: 1:1 ↔ 그룹 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(8),
            flexDirection: 'row',
            gap: s(6),
          }}
        >
          {(['solo', 'group'] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={({ pressed }) => ({
                  paddingHorizontal: s(14),
                  paddingVertical: s(6),
                  borderRadius: s(999),
                  backgroundColor: active
                    ? COLORS.gray[900]
                    : COLORS.gray[100],
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{
                    color: active ? COLORS.white : COLORS.gray[600],
                  }}
                >
                  {m === 'solo' ? '1:1' : '그룹 (3명)'}
                </Typography>
              </Pressable>
            );
          })}
        </View>

        {/* 변종 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {mode === 'solo'
              ? SOLO_VARIANTS.map((v) => (
                  <VariantChip
                    key={v.key}
                    label={v.label}
                    active={soloVariant === v.key}
                    onPress={() => setSoloVariant(v.key)}
                  />
                ))
              : GROUP_VARIANTS.map((v) => (
                  <VariantChip
                    key={v.key}
                    label={v.label}
                    active={groupVariant === v.key}
                    onPress={() => setGroupVariant(v.key)}
                  />
                ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {mode === 'solo' ? (
          <SoloView variant={soloVariant} />
        ) : (
          <GroupView variant={groupVariant} />
        )}
      </ScrollView>
    </View>
  );
}

/* ───────── Variant Chip ───────── */

function VariantChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: s(8),
        paddingHorizontal: s(4),
        borderRadius: s(8),
        backgroundColor: active ? COLORS.white : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Typography
        variant="label-02"
        weight={active ? 'semibold' : 'medium'}
        style={{
          color: active ? COLORS.gray[900] : COLORS.gray[500],
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────── */
/* SOLO VIEW (1:1)                                          */
/* ─────────────────────────────────────────────────────── */

function SoloView({ variant }: { variant: SoloVariant }) {
  const [option1Expanded, setOption1Expanded] = useState(false);
  const [option4Expanded, setOption4Expanded] = useState(true);

  return (
    <>
      <ScheduleInfoCard schedule={SOLO_SCHEDULE} />

      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(20),
          backgroundColor: COLORS.white,
        }}
      >
        <SoloHero
          variant={variant}
          participant={SOLO_PARTICIPANT}
          expanded={option1Expanded}
          onToggle={() => setOption1Expanded((p) => !p)}
        />

        {variant === 'option-2' && (
          <BigCTA
            label="회기 일지 흐름 보기"
            hint={`이전 회기 ${SOLO_PARTICIPANT.olderSessions.length + 1}건의 일지를 모두 확인할 수 있어요`}
          />
        )}
      </View>

      <ParticipantsBlock
        participants={[
          {
            name: SOLO_PARTICIPANT.name,
            gender: SOLO_PARTICIPANT.gender,
            age: SOLO_PARTICIPANT.age,
          },
        ]}
      />

      {variant === 'option-4' && (
        <SessionTimelineSection
          sessions={[SOLO_PARTICIPANT.prevSession, ...SOLO_PARTICIPANT.olderSessions]}
          expanded={option4Expanded}
          onToggle={() => setOption4Expanded((p) => !p)}
        />
      )}

      <MemoPlaceholder />
    </>
  );
}

function SoloHero({
  variant,
  participant,
  expanded,
  onToggle,
}: {
  variant: SoloVariant;
  participant: ParticipantJournal;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.white,
        gap: s(10),
        borderWidth: 1,
        borderColor: COLORS.gray[100],
      }}
    >
      <PrevSessionBlock session={participant.prevSession} />

      {variant === 'option-1' && (
        <OlderSessionsToggle
          sessions={participant.olderSessions}
          expanded={expanded}
          onToggle={onToggle}
        />
      )}

      <NextSessionLine />
    </View>
  );
}

/* ─────────────────────────────────────────────────────── */
/* GROUP VIEW                                               */
/* ─────────────────────────────────────────────────────── */

function GroupView({ variant }: { variant: GroupVariant }) {
  return (
    <>
      <ScheduleInfoCard schedule={GROUP_SCHEDULE} />

      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(20),
          backgroundColor: COLORS.white,
        }}
      >
        {variant === 'group-stack' && (
          <GroupHeroStack participants={GROUP_PARTICIPANTS} />
        )}
        {variant === 'group-tabs' && (
          <GroupHeroTabs participants={GROUP_PARTICIPANTS} />
        )}
        {variant === 'group-cta' && (
          <>
            <GroupHeroCompact
              participantCount={GROUP_PARTICIPANTS.length}
              nextDate={NEXT_DATE}
            />
            <BigCTA
              label="회기 일지 흐름 보기"
              hint={`내담자 ${GROUP_PARTICIPANTS.length}명의 일지를 상담 상세에서 모두 확인할 수 있어요`}
            />
          </>
        )}
      </View>

      <ParticipantsBlock
        participants={GROUP_PARTICIPANTS.map((p) => ({
          name: p.name,
          gender: p.gender,
          age: p.age,
        }))}
      />

      <MemoPlaceholder />
    </>
  );
}

/* E. 카드 stack — 내담자별 카드 N개 */
function GroupHeroStack({
  participants,
}: {
  participants: ParticipantJournal[];
}) {
  return (
    <View style={{ gap: s(10) }}>
      {participants.map((p) => (
        <ParticipantJournalCard key={p.name} participant={p} />
      ))}
      <NextSessionCard nextDate={NEXT_DATE} />
    </View>
  );
}

function ParticipantJournalCard({
  participant,
}: {
  participant: ParticipantJournal;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View
      style={{
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.white,
        gap: s(8),
        borderWidth: 1,
        borderColor: COLORS.gray[100],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {participant.name}
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[500] }}
        >
          {participant.gender} · 만 {participant.age}세
        </Typography>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.gray[500] }}
        >
          직전
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[500] }}
        >
          {participant.prevSession.date} · {participant.prevSession.status}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[800], lineHeight: s(20) }}
      >
        {participant.prevSession.summary}
      </Typography>
      <OlderSessionsToggle
        sessions={participant.olderSessions}
        expanded={expanded}
        onToggle={() => setExpanded((p) => !p)}
      />
    </View>
  );
}

/* F. 내담자 탭 — chip 탭으로 전환 */
function GroupHeroTabs({
  participants,
}: {
  participants: ParticipantJournal[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const selected = participants[activeIdx];

  return (
    <View
      style={{
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.white,
        gap: s(12),
        borderWidth: 1,
        borderColor: COLORS.gray[100],
      }}
    >
      {/* 내담자 chip 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: s(6) }}
      >
        {participants.map((p, i) => {
          const active = i === activeIdx;
          return (
            <Pressable
              key={p.name}
              onPress={() => {
                setActiveIdx(i);
                setExpanded(false);
              }}
              style={({ pressed }) => ({
                paddingHorizontal: s(12),
                paddingVertical: s(6),
                borderRadius: s(999),
                backgroundColor: active
                  ? COLORS.primary50
                  : COLORS.gray[50],
                borderWidth: 1,
                borderColor: active ? COLORS.primary300 : COLORS.gray[100],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Typography
                variant="label-01"
                weight={active ? 'semibold' : 'medium'}
                style={{
                  color: active ? COLORS.primary700 : COLORS.gray[700],
                }}
              >
                {p.name}
              </Typography>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 선택된 내담자의 직전 + 이전 흐름 */}
      <PrevSessionBlock session={selected.prevSession} />
      <OlderSessionsToggle
        sessions={selected.olderSessions}
        expanded={expanded}
        onToggle={() => setExpanded((p) => !p)}
      />
      <NextSessionLine />
    </View>
  );
}

/* G. 간결 hero + CTA 위임 */
function GroupHeroCompact({
  participantCount,
  nextDate,
}: {
  participantCount: number;
  nextDate: string;
}) {
  return (
    <View
      style={{
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.white,
        gap: s(8),
        borderWidth: 1,
        borderColor: COLORS.gray[100],
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.gray[500] }}
        >
          그룹 회기
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[500] }}
        >
          내담자 {participantCount}명
        </Typography>
      </View>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[600], lineHeight: s(20) }}
      >
        그룹 회기는 내담자별 일지가 별도 작성돼요. 회기 일지 흐름은 상담
        상세에서 확인하세요.
      </Typography>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          paddingTop: s(8),
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[100],
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.gray[500] }}
        >
          다음 회기
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[700] }}
        >
          {nextDate}
        </Typography>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────── */
/* SHARED COMPONENTS                                        */
/* ─────────────────────────────────────────────────────── */

function ScheduleInfoCard({
  schedule,
}: {
  schedule: { program: string; date: string; time: string; room: string };
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(16),
        backgroundColor: COLORS.white,
      }}
    >
      <View
        style={{
          padding: s(16),
          borderRadius: s(12),
          backgroundColor: COLORS.gray[50],
          gap: s(7),
        }}
      >
        <InfoRow label="프로그램" value={schedule.program} />
        <InfoRow label="날짜" value={schedule.date} />
        <InfoRow label="시간" value={schedule.time} />
        <InfoRow label="장소" value={schedule.room} />
      </View>
    </View>
  );
}

function PrevSessionBlock({ session }: { session: PastSession }) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          marginBottom: s(6),
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.gray[500] }}
        >
          직전 회기
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[500] }}
        >
          {session.date} · {session.status}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        style={{ color: COLORS.gray[800], lineHeight: s(22) }}
      >
        {session.summary}
      </Typography>
    </View>
  );
}

function OlderSessionsToggle({
  sessions,
  expanded,
  onToggle,
}: {
  sessions: PastSession[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <>
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: s(8),
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[100],
        }}
      >
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.gray[700] }}
        >
          이전 회기 흐름 ({sessions.length}건)
        </Typography>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={s(16)}
          color={COLORS.gray[600]}
        />
      </Pressable>
      {expanded && (
        <View style={{ gap: s(8), marginTop: s(4) }}>
          {sessions.map((session, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: COLORS.gray[500], width: s(58) }}
              >
                {session.date}
              </Typography>
              <Typography
                variant="label-01"
                style={{
                  color: COLORS.gray[700],
                  flex: 1,
                  lineHeight: s(18),
                }}
              >
                {session.summary}
              </Typography>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function NextSessionLine() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        paddingTop: s(8),
        borderTopWidth: 1,
        borderTopColor: COLORS.gray[100],
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: COLORS.gray[500] }}
      >
        다음 회기
      </Typography>
      <Typography
        variant="label-02"
        style={{ color: COLORS.gray[700] }}
      >
        {NEXT_DATE}
      </Typography>
    </View>
  );
}

function NextSessionCard({ nextDate }: { nextDate: string }) {
  return (
    <View
      style={{
        padding: s(12),
        borderRadius: s(10),
        backgroundColor: COLORS.gray[50],
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: COLORS.gray[500] }}
      >
        다음 회기
      </Typography>
      <Typography
        variant="label-02"
        style={{ color: COLORS.gray[700] }}
      >
        {nextDate}
      </Typography>
    </View>
  );
}

function BigCTA({ label, hint }: { label: string; hint: string }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        marginTop: s(12),
        paddingHorizontal: s(16),
        paddingVertical: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.primary50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
      }}
    >
      <Icon name="counseling-note-16" size={20} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.primary }}
        >
          {label}
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[600], marginTop: s(2) }}
        >
          {hint}
        </Typography>
      </View>
      <Ionicons
        name="chevron-forward"
        size={s(16)}
        color={COLORS.primary}
      />
    </TouchableOpacity>
  );
}

function ParticipantsBlock({
  participants,
}: {
  participants: { name: string; gender: '남' | '여'; age: number }[];
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(20),
      }}
    >
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.gray[900], marginBottom: s(10) }}
      >
        내담자
      </Typography>
      <View style={{ gap: s(8) }}>
        {participants.map((p) => (
          <View
            key={p.name}
            style={{
              padding: s(14),
              borderRadius: s(12),
              backgroundColor: COLORS.white,
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(10),
            }}
          >
            <View
              style={{
                width: s(32),
                height: s(32),
                borderRadius: s(16),
                backgroundColor: COLORS.gray[100],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="person"
                size={s(16)}
                color={COLORS.gray[500]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(8),
                }}
              >
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.gray[900] }}
                >
                  {p.name}
                </Typography>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.gray[600] }}
                >
                  {p.gender} · 만 {p.age}세
                </Typography>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SessionTimelineSection({
  sessions,
  expanded,
  onToggle,
}: {
  sessions: PastSession[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(24),
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: s(10),
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            회기 일지 흐름
          </Typography>
          <View
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(1),
              borderRadius: s(4),
              backgroundColor: COLORS.gray[100],
            }}
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              {sessions.length}건
            </Typography>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={s(18)}
          color={COLORS.gray[600]}
        />
      </Pressable>
      {expanded && (
        <View style={{ gap: s(8) }}>
          {sessions.map((session, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => ({
                padding: s(14),
                borderRadius: s(12),
                backgroundColor: COLORS.white,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: s(6),
                  gap: s(8),
                }}
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.gray[500] }}
                >
                  {i === 0 ? '직전' : `${i + 1}회 전`}
                </Typography>
                <Typography
                  variant="label-02"
                  style={{ color: COLORS.gray[500] }}
                >
                  {session.date} · {session.status}
                </Typography>
                <View style={{ flex: 1 }} />
                <Icon
                  name="counseling-note-16"
                  size={14}
                  color={COLORS.gray[400]}
                />
              </View>
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[800], lineHeight: s(20) }}
                numberOfLines={2}
              >
                {session.summary}
              </Typography>
            </Pressable>
          ))}
          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              marginTop: s(4),
              paddingVertical: s(10),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: s(4),
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary }}
            >
              상담 상세에서 전체 일지 보기
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={s(14)}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MemoPlaceholder() {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(24),
      }}
    >
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.gray[900], marginBottom: s(10) }}
      >
        메모
      </Typography>
      <View
        style={{
          padding: s(16),
          borderRadius: s(12),
          backgroundColor: COLORS.white,
        }}
      >
        <Typography variant="body-02" style={{ color: COLORS.gray[400] }}>
          작성된 메모가 없습니다
        </Typography>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[500], width: s(56) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.gray[900], flex: 1, textAlign: 'right' }}
      >
        {value}
      </Typography>
    </View>
  );
}
