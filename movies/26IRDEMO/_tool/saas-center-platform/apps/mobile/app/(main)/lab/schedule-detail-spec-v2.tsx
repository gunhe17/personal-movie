/**
 * [일정 상세] — INFORMATION_SPEC §3-1 일정 상세 v2 반영 시안 (lab)
 *
 * 약속 카드 직하에 "최근 회기 요약 hero" 추가.
 *  - 직전 회기 날짜·상태 + 일지 summary 1줄 + 다음 회기 일자
 *  - 의도: "굳이 상담 상세로 안 들어가도 이번 회기 직전 컨텍스트 잡기"
 *
 * 도메인 경계 — hero는 임상 묶음(키워드 칩·출석 패턴·사전기록지)을 끌어오지 않는다.
 * 직전 1줄 요약 + 다음 일자만. 가벼운 brief.
 *
 * 하단 영역(참여 내담자·필드노트·취소 사유·메모)은 자리만 단순 mock — 시안 의도와 무관.
 */

import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

// ─── mock 데이터 ───
const MOCK_SCHEDULE = {
  programName: '놀이치료-개인',
  date: '5/22 (목)',
  startTime: '14:00',
  endTime: '15:00',
  roomName: '상담실 A',
  status: 'upcoming' as 'upcoming' | 'in_progress' | 'completed' | 'cancelled',
  primaryClient: { name: '김민준', gender: 'male' as const, age: 9 },
};

// hero — 직전 회기 + 다음 회기 (스펙 §3-1 v2)
const MOCK_HERO = {
  prevSession: {
    date: '5/15 (수)',
    status: '완료',
    // 일지 모델의 summary 필드를 그대로 노출 (자연 문장)
    summary: '분노 표현 위주로 진행, 가족 관계 키워드 중심으로 풀었음.',
  },
  nextSession: {
    date: '5/29 (목)',
    time: '14:00',
  },
};

const MOCK_PARTICIPANTS = [
  { id: 'p1', name: '김민준', gender: '남', age: 9 },
];

const MOCK_FIELDNOTE_CONNECTED = false;
const MOCK_MEMO = '오늘은 새 도구 활용 시도 — 감정 카드 가져갈 것.';

export default function ScheduleDetailSpecV2Lab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(8),
            backgroundColor: COLORS.white,
          }}
          className="flex-row items-center"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center"
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={s(24)} />
          </TouchableOpacity>
          <Typography variant="headline-02" weight="semibold">
            일정 상세
          </Typography>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingTop: s(16),
            paddingHorizontal: s(20),
            paddingBottom: insets.bottom + s(40),
            gap: s(16),
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1) 약속 카드 (상단) — 프로그램·날짜·시간·장소 */}
          <PromiseCard />

          {/* 2) 최근 회기 요약 hero — NEW (스펙 §3-1 v2) */}
          <RecentSessionHero />

          {/* 3) 참여 내담자 섹션 */}
          <SectionLabel title="참여 내담자" />
          <ParticipantList />

          {/* 4) 필드노트 섹션 */}
          <SectionLabel title="필드노트" />
          <FieldNoteCard />

          {/* 5) 메모 섹션 */}
          <SectionLabel title="메모" />
          <MemoCard />

          {/* 안내 */}
          <View
            style={{
              marginTop: s(8),
              padding: s(14),
              borderRadius: s(12),
              backgroundColor: COLORS.gray[100],
            }}
          >
            <Typography variant="caption-01" style={{ color: COLORS.gray[600] }}>
              본 lab은 일정 상세 hero 시안 검토용입니다. 하단 섹션(참여 내담자·필드노트·메모)은
              자리만 단순 mock — 정식 production 화면은 별도.
            </Typography>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── 1) 약속 카드 ───
function PromiseCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        gap: s(10),
      }}
    >
      {/* 헤더: 내담자명 + 프로그램 + 상태 뱃지 */}
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
            backgroundColor: COLORS.primary,
          }}
        />
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ flex: 1, color: COLORS.gray[900] }}
          numberOfLines={1}
        >
          {MOCK_SCHEDULE.primaryClient.name}님의 놀이치료
        </Typography>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(4),
            borderRadius: s(8),
            backgroundColor: COLORS.gray[100],
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.gray[600] }}
          >
            예정
          </Typography>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

      {/* 일정 정보 */}
      <View style={{ gap: s(8) }}>
        <InfoRow label="프로그램" value={MOCK_SCHEDULE.programName} />
        <InfoRow
          label="날짜·시간"
          value={`${MOCK_SCHEDULE.date} ${MOCK_SCHEDULE.startTime}~${MOCK_SCHEDULE.endTime}`}
        />
        <InfoRow label="장소" value={MOCK_SCHEDULE.roomName} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: s(72) }}>
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.gray[500] }}
        >
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="medium"
        style={{ flex: 1, color: COLORS.gray[900] }}
        numberOfLines={1}
      >
        {value}
      </Typography>
    </View>
  );
}

// ─── 2) 최근 회기 요약 hero (스펙 §3-1 v2) ───
function RecentSessionHero() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* 좌측 컬러 라인 — 시각 위계 (feedback_visual_hierarchy) */}
      <View
        style={{
          width: 4,
          backgroundColor: COLORS.primary,
        }}
      />
      <View
        style={{
          flex: 1,
          paddingVertical: s(14),
          paddingHorizontal: s(16),
          gap: s(10),
        }}
      >
        {/* hero 라벨 */}
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          최근 회기 요약
        </Typography>

        {/* 직전 회기 날짜 + 상태 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
          }}
        >
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            직전 회기
          </Typography>
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {MOCK_HERO.prevSession.date}
          </Typography>
          <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>
            ·
          </Typography>
          <View
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(2),
              borderRadius: s(4),
              backgroundColor: COLORS.paletteBg.green,
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.palette.green }}
            >
              {MOCK_HERO.prevSession.status}
            </Typography>
          </View>
        </View>

        {/* 일지 summary 1줄 (자연 문장) */}
        <Typography
          variant="body-02"
          style={{
            color: COLORS.gray[800],
            lineHeight: s(22),
          }}
        >
          {MOCK_HERO.prevSession.summary}
        </Typography>

        {/* 다음 회기 일자 */}
        <View
          style={{
            marginTop: s(2),
            paddingTop: s(10),
            borderTopWidth: 1,
            borderTopColor: COLORS.gray[100],
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
          }}
        >
          <Ionicons
            name="arrow-forward"
            size={s(14)}
            color={COLORS.gray[400]}
          />
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            다음 회기
          </Typography>
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {MOCK_HERO.nextSession.date} {MOCK_HERO.nextSession.time}
          </Typography>
        </View>
      </View>
    </View>
  );
}

// ─── 3) 참여 내담자 ───
function ParticipantList() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        gap: s(12),
      }}
    >
      {MOCK_PARTICIPANTS.map((p) => (
        <View
          key={p.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(12),
          }}
        >
          <View
            style={{
              width: s(40),
              height: s(40),
              borderRadius: s(20),
              backgroundColor: COLORS.primary50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.primary700 }}
            >
              {p.name.charAt(0)}
            </Typography>
          </View>
          <View style={{ flex: 1, gap: s(2) }}>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              {p.name}
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[500] }}
            >
              {p.gender} · 만 {p.age}세
            </Typography>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── 4) 필드노트 ───
function FieldNoteCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: COLORS.gray[100],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name="mic-outline"
          size={s(18)}
          color={COLORS.gray[500]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.gray[900] }}
        >
          {MOCK_FIELDNOTE_CONNECTED ? '연결된 필드노트' : '연결된 필드노트 없음'}
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[500], marginTop: s(2) }}
        >
          {MOCK_FIELDNOTE_CONNECTED
            ? '회기 후 녹음 1건'
            : '회기 후 녹음을 연결할 수 있어요'}
        </Typography>
      </View>
      <Ionicons
        name="chevron-forward"
        size={s(18)}
        color={COLORS.gray[400]}
      />
    </View>
  );
}

// ─── 5) 메모 ───
function MemoCard() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
      }}
    >
      <Typography
        variant="body-02"
        style={{
          color: COLORS.gray[800],
          lineHeight: s(22),
        }}
      >
        {MOCK_MEMO}
      </Typography>
    </View>
  );
}

// ─── 공통: 섹션 라벨 ───
function SectionLabel({ title }: { title: string }) {
  return (
    <Typography
      variant="label-01"
      weight="semibold"
      style={{ color: COLORS.gray[600], marginTop: s(4) }}
    >
      {title}
    </Typography>
  );
}
