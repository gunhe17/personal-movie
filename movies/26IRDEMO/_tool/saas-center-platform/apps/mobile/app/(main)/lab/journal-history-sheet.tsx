import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [회기 상세] 지난 일지 진입점 + 히스토리 시트
 *
 * 확정 동선 — 일정 카드 탭 → 회기 상세 → 상단 brief의 "지난 일지 N개 ›" → 시트 →
 * 회기 카드 탭 → 읽기 전용 일지 시트(상담 목표·내용·개인 메모).
 *
 * 핵심 의도:
 *   - 열람 ≠ 작성. 예정(scheduled) 회기에서 이 회기 일지는 잠겨 있지만,
 *     지난 일지 열람은 상태와 무관하게 상단에서 항상 가능.
 *   - 케이스 한정(이 내담자의 지난 기록). 내정보의 전체 일지 리스트(횡단)와 성격이 다름.
 *   - hero/brief는 가볍게, 전체 히스토리는 별도 시트로 분리 (새 라우트 X).
 */

interface JournalSession {
  date: string;
  status: '완료' | '노쇼' | '취소';
  summary: string;
  goal: string;
  content: string;
  privateMemo: string | null;
}

const CLIENT_NAME = '김민준';

const SESSIONS: JournalSession[] = [
  {
    date: '5/15 (수)',
    status: '완료',
    summary: '학교 친구 관계 어려움 토로, 다음 회기에 역할극 시도 예정',
    goal: '학교에서의 또래 관계 어려움을 풀어내고, 갈등 상황에서 자기 표현을 연습하기.',
    content:
      '오늘 회기에서는 최근 학교에서 친구와 갈등이 있었던 상황을 그림으로 표현했다. 친구가 자기 의견을 들어주지 않을 때 분노를 느꼈다고 했으며, 화가 났을 때 어떤 신체 반응이 있는지 함께 살펴봤다. 다음 회기에서는 역할극으로 실제 표현 방식을 연습하기로 함.',
    privateMemo:
      '어머니와의 면담에서 가정 내 표현 방식 점검 필요. 다음 회기에서 역할극 시도.',
  },
  {
    date: '5/8 (목)',
    status: '완료',
    summary: '감정 카드 활용, 집에서 화내는 빈도 감소',
    goal: '감정을 알아차리고, 적절한 표현 방법 익히기.',
    content:
      '감정 카드를 활용해 최근 한 주간 느꼈던 감정을 분류해봤다. 어머니 보고에 따르면 집에서 화내는 빈도가 줄어들고 있으며, "나 화나"라고 말로 표현하는 경우가 늘었다고 한다. 본 회기에서도 자기 감정을 비교적 명확하게 짚어냄.',
    privateMemo: null,
  },
  {
    date: '5/1 (목)',
    status: '완료',
    summary: '어머니와 갈등 표현, 안전감 형성 진행 중',
    goal: '안전한 환경에서 가족 관계에 대한 감정 탐색.',
    content:
      '어머니와의 관계에서 답답함을 표현. "엄마는 내 말을 안 들어"라고 반복적으로 이야기. 모래상자 작업을 통해 가족 구성원 간 거리감 표현. 라포 형성이 진행 중이며 안전감을 느끼는 듯한 모습 관찰됨.',
    privateMemo: '어머니의 표현 방식이 다소 통제적임. 보호자 면담 일정 별도 잡기.',
  },
  {
    date: '4/24 (목)',
    status: '완료',
    summary: '첫 회기, 라포 형성 단계',
    goal: '내담자와의 라포 형성 및 주호소 탐색.',
    content:
      '첫 회기. 자기 소개와 좋아하는 것에 대해 이야기 나눔. 학교 적응에 대한 어려움이 있다고 어머니 보고. 본인은 학교 이야기를 잘 꺼내지 않으나 친구들과 잘 못 어울린다는 표현. 다음 회기에서 감정 카드 사용 예정.',
    privateMemo: null,
  },
];

const SCHEDULE = {
  client: CLIENT_NAME,
  program: '놀이치료-개인',
  date: '5월 22일 (목)',
  time: '14:00',
  room: '상담실 A',
};

export default function JournalHistorySheetLab() {
  const router = useRouter();
  const [listOpen, setListOpen] = useState(false);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(52),
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
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(8),
          paddingBottom: s(40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 회기 상세 상단 brief (mock) ── */}
        <View style={{ gap: s(10) }}>
          <View style={{ gap: s(2) }}>
            <Typography
              variant="headline-02"
              weight="bold"
              style={{ color: COLORS.gray[900] }}
            >
              {SCHEDULE.client}
            </Typography>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              {SCHEDULE.program}
            </Typography>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
              <Icon name="time" size={18} color={COLORS.gray[500]} />
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.gray[700] }}
              >
                {SCHEDULE.date} {SCHEDULE.time}
              </Typography>
            </View>
            <View
              style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300] }}
            />
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.gray[700] }}
            >
              {SCHEDULE.room}
            </Typography>
          </View>
        </View>

        {/* ── 진입점: 지난 일지 N개 ── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setListOpen(true)}
          style={{
            marginTop: s(16),
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(10),
            paddingHorizontal: s(14),
            paddingVertical: s(13),
            borderRadius: s(12),
            backgroundColor: COLORS.gray[50],
          }}
        >
          <View
            style={{
              width: s(32),
              height: s(32),
              borderRadius: s(8),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.primary50,
            }}
          >
            <Ionicons name="document-text" size={s(17)} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, gap: s(1) }}>
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              지난 일지 {SESSIONS.length}개
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[500] }}
            >
              상담 전에 지난 회기 기록을 확인해보세요
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={s(18)} color={COLORS.gray[400]} />
        </TouchableOpacity>

        {/* ── 이하 회기 상세 본문 (예정 상태 — 일지 잠김, 맥락 표현용 dim) ── */}
        <View style={{ marginTop: s(24), opacity: 0.45 }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[500], marginBottom: s(12) }}
          >
            일정이 진행되었나요?
          </Typography>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            {['완료', '노쇼', '취소'].map((l) => (
              <View
                key={l}
                style={{
                  flex: 1,
                  paddingVertical: s(14),
                  borderRadius: s(12),
                  backgroundColor: COLORS.gray[50],
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[700] }}
                >
                  {l}
                </Typography>
              </View>
            ))}
          </View>
          <View
            style={{
              marginTop: s(16),
              padding: s(14),
              borderRadius: s(12),
              backgroundColor: COLORS.gray[50],
              alignItems: 'center',
            }}
          >
            <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>
              회기를 완료해야 일지를 작성할 수 있어요
            </Typography>
          </View>
        </View>

        {/* 안내 (lab 전용) */}
        <View
          style={{
            marginTop: s(24),
            padding: s(12),
            borderRadius: s(10),
            backgroundColor: COLORS.gray[100],
            gap: s(4),
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[700] }}
          >
            동선
          </Typography>
          <Typography
            variant="label-02"
            style={{ color: COLORS.gray[600], lineHeight: s(18) }}
          >
            상단 "지난 일지 {SESSIONS.length}개" 탭 → 히스토리 시트(날짜 내림차순)
            {'\n'}→ 회기 카드 탭 → 읽기 전용 일지 시트
            {'\n'}예정 상태에서도 항상 열람 가능 (아래 작성 영역은 잠김)
          </Typography>
        </View>
      </ScrollView>

      {/* 지난 일지 목록 시트 */}
      <HistoryListSheet
        visible={listOpen}
        onClose={() => setListOpen(false)}
        clientName={CLIENT_NAME}
        sessions={SESSIONS}
        onSelect={(i) => setDetailIdx(i)}
      />

      {/* 읽기 전용 일지 시트 (목록 위에 stack) */}
      <JournalDetailSheet
        session={detailIdx != null ? SESSIONS[detailIdx] : null}
        clientName={CLIENT_NAME}
        onBack={() => setDetailIdx(null)}
      />
    </View>
  );
}

/* ───────── 지난 일지 목록 시트 ───────── */

function HistoryListSheet({
  visible,
  onClose,
  clientName,
  sessions,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  clientName: string;
  sessions: JournalSession[];
  onSelect: (index: number) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(20),
            borderTopRightRadius: s(20),
            maxHeight: '88%',
            paddingTop: s(8),
          }}
        >
          <SheetHandle />

          {/* 헤더 */}
          <View
            style={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              {clientName}님의 지난 일지
            </Typography>
            <View
              style={{
                paddingHorizontal: s(7),
                paddingVertical: s(2),
                borderRadius: s(6),
                backgroundColor: COLORS.gray[100],
              }}
            >
              <Typography
                variant="label-02"
                weight="medium"
                style={{ color: COLORS.gray[600] }}
              >
                {sessions.length}개
              </Typography>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={s(22)} color={COLORS.gray[800]} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingTop: s(6),
              paddingBottom: Math.max(s(20), insets.bottom + s(8)),
              gap: s(10),
            }}
            showsVerticalScrollIndicator={false}
          >
            {sessions.map((session, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => onSelect(i)}
                style={{
                  borderRadius: s(12),
                  backgroundColor: COLORS.gray[50],
                  padding: s(14),
                  gap: s(6),
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}
                >
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    style={{ color: COLORS.gray[900] }}
                  >
                    {session.date}
                  </Typography>
                  <Typography variant="label-02" style={{ color: COLORS.gray[500] }}>
                    {i === 0 ? '직전 회기' : `${i + 1}회 전`}
                  </Typography>
                  <View style={{ flex: 1 }} />
                  <Ionicons
                    name="chevron-forward"
                    size={s(16)}
                    color={COLORS.gray[400]}
                  />
                </View>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.gray[700], lineHeight: s(20) }}
                  numberOfLines={2}
                >
                  {session.summary}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ───────── 읽기 전용 일지 시트 ───────── */

function JournalDetailSheet({
  session,
  clientName,
  onBack,
}: {
  session: JournalSession | null;
  clientName: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={session != null}
      transparent
      animationType="slide"
      onRequestClose={onBack}
    >
      <Pressable
        onPress={onBack}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(20),
            borderTopRightRadius: s(20),
            maxHeight: '92%',
            paddingTop: s(8),
          }}
        >
          <SheetHandle />

          {/* 헤더 — 뒤로(목록) + 날짜 + 닫기 */}
          <View
            style={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
              borderBottomWidth: 1,
              borderBottomColor: COLORS.gray[100],
            }}
          >
            <TouchableOpacity onPress={onBack} hitSlop={8}>
              <Ionicons name="chevron-back" size={s(22)} color={COLORS.gray[800]} />
            </TouchableOpacity>
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              {session?.date} · {clientName}
            </Typography>
            <View style={{ flex: 1 }} />
          </View>

          {session && (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: s(LAYOUT.screenPaddingX),
                paddingTop: s(18),
                paddingBottom: Math.max(s(24), insets.bottom + s(12)),
                gap: s(22),
              }}
              showsVerticalScrollIndicator={false}
            >
              <ReadBlock label="상담 목표" value={session.goal} />
              <ReadBlock label="상담 내용" value={session.content} reading />
              {session.privateMemo && (
                <ReadBlock label="개인 메모" value={session.privateMemo} memo />
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReadBlock({
  label,
  value,
  reading,
  memo,
}: {
  label: string;
  value: string;
  reading?: boolean;
  memo?: boolean;
}) {
  return (
    <View style={{ gap: s(8) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
        {memo && (
          <Ionicons name="lock-closed" size={s(13)} color={COLORS.gray[500]} />
        )}
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.gray[600] }}
        >
          {label}
        </Typography>
      </View>
      {memo ? (
        <View
          style={{
            padding: s(14),
            borderRadius: s(12),
            backgroundColor: COLORS.gray[100],
          }}
        >
          <Typography
            variant="body-02"
            style={{ color: COLORS.gray[800], lineHeight: s(24) }}
          >
            {value}
          </Typography>
        </View>
      ) : (
        <Typography
          variant={reading ? 'body-01-reading' : 'body-02'}
          style={{ color: COLORS.gray[800], lineHeight: s(reading ? 26 : 22) }}
        >
          {value}
        </Typography>
      )}
    </View>
  );
}

function SheetHandle() {
  return (
    <View
      style={{
        width: s(36),
        height: s(4),
        borderRadius: s(2),
        backgroundColor: COLORS.gray[300],
        alignSelf: 'center',
        marginBottom: s(4),
      }}
    />
  );
}
