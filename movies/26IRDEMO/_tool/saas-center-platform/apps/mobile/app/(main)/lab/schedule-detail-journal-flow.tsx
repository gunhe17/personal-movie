import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  Animated,
  Easing,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [일정 상세] 회기 일지 작성 흐름 시안.
 *
 * production `app/(main)/schedule/[id].tsx` 의 시각 톤·구조 그대로 유지하고,
 * **추가**되는 것만 시연:
 *   1. 내담자 Section 하단 primary CTA `일지 N건 작성`
 *      - 미작성 일지가 있을 때만 노출
 *   2. 일지 시트의 N/M progress + 자동 진행 흐름
 *      - 카드 탭, CTA 어느 진입점이든 동일 (탭한 사람 / 미작성 첫명부터)
 *      - 저장 → 다음 미작성 인원으로 cross-fade
 *      - 마지막 저장 → 시트 닫힘 + 토스트
 *
 * 유지되는 것 (production 그대로):
 *   - 헤더 (`[상담] 박지훈 외 3명`)
 *   - 정보 카드 (gray-50, InfoRow 프로그램/날짜/시간/장소)
 *   - 상담 상세 보기 버튼
 *   - 내담자 3-col 그리드 (ClientCard with 출결 chip floating)
 *   - 필드노트 / 메모 Section
 *   - 하단 액션바 (BottomButton 중단/완료)
 *   - Section 라벨은 title-01 semibold gray-900 (production 동일)
 */

const SCREEN_HEIGHT = Dimensions.get('window').height;

type AttendanceStatus = 'unknown' | 'attended' | 'absent' | 'no_show';

interface ParticipantMock {
  id: string;
  name: string;
  gender: '남' | '여';
  age: number;
  attendance: AttendanceStatus;
  noteWritten: boolean;
  noteSummary?: string;
}

const INITIAL_PARTICIPANTS: ParticipantMock[] = [
  {
    id: 'p1',
    name: '박지훈',
    gender: '남',
    age: 7,
    attendance: 'attended',
    noteWritten: false,
  },
  {
    id: 'p2',
    name: '이수연',
    gender: '여',
    age: 6,
    attendance: 'attended',
    noteWritten: true,
    noteSummary: '감정 카드 활용에 적극적, 가족 키워드 풍부.',
  },
  {
    id: 'p3',
    name: '최도윤',
    gender: '남',
    age: 7,
    attendance: 'attended',
    noteWritten: false,
  },
  {
    id: 'p4',
    name: '김민준',
    gender: '여',
    age: 10,
    attendance: 'no_show',
    noteWritten: false,
  },
];

const SCHEDULE_INFO = {
  typeLabel: '상담',
  primaryClient: '박지훈',
  extraCount: 3,
  programName: '놀이치료-그룹',
  sessionNumber: 4,
  dateLabel: '5월 26일 월요일',
  timeRange: '14:00 ~ 15:00',
  duration: 60,
  room: '1번 상담실',
  memo: '오늘은 새 도구 활용 시도 — 감정 카드 가져갈 것.',
  fieldNoteTitle: '놀이치료-그룹 4',
  fieldNoteLinked: false,
};

const ATTENDANCE_PALETTES: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  unknown: { label: '미확인', color: COLORS.gray[600], bg: COLORS.gray[100] },
  attended: {
    label: '참석',
    color: COLORS.palette.green,
    bg: COLORS.paletteBg.green,
  },
  absent: {
    label: '불참',
    color: COLORS.palette.orange,
    bg: COLORS.paletteBg.orange,
  },
  no_show: {
    label: '노쇼',
    color: COLORS.palette.red,
    bg: COLORS.paletteBg.red,
  },
};

export default function ScheduleDetailJournalFlowLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [participants, setParticipants] = useState<ParticipantMock[]>(INITIAL_PARTICIPANTS);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [toast, setToast] = useState(false);

  // 시트 입력 mock
  const [goal, setGoal] = useState('');
  const [content, setContent] = useState('');
  const [memo, setMemo] = useState('');

  const slide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const bodyFade = useRef(new Animated.Value(1)).current;

  const isWritable = (p: ParticipantMock) =>
    (p.attendance === 'attended' || p.attendance === 'absent') &&
    !p.noteWritten;
  const unwrittenCount = participants.filter(isWritable).length;

  const openSheetFromCTA = () => {
    const ids = participants.filter(isWritable).map((p) => p.id);
    if (ids.length === 0) return;
    setQueue(ids);
    setCursor(0);
    resetInputs();
    showSheet();
  };

  const openSheetFromCard = (clientId: string) => {
    const target = participants.find((p) => p.id === clientId);
    if (!target) return;
    if (!isWritable(target)) return; // 노쇼·이미작성·미확인 차단
    const fromHere: string[] = [];
    let met = false;
    for (const p of participants) {
      if (p.id === clientId) met = true;
      if (met && isWritable(p)) fromHere.push(p.id);
    }
    setQueue(fromHere);
    setCursor(0);
    resetInputs();
    showSheet();
  };

  const resetInputs = () => {
    setGoal('');
    setContent('');
    setMemo('');
  };

  const showSheet = () => {
    setSheetVisible(true);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideSheet = () => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slide, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setSheetVisible(false));
  };

  const advanceToNext = (justWrittenId?: string) => {
    if (justWrittenId) {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === justWrittenId
            ? {
                ...p,
                noteWritten: true,
                noteSummary:
                  content.trim().slice(0, 24) ||
                  '회기 일지를 작성했어요. (mock summary)',
              }
            : p,
        ),
      );
    }
    const nextCursor = cursor + 1;
    if (nextCursor >= queue.length) {
      hideSheet();
      setTimeout(() => {
        setToast(true);
        setTimeout(() => setToast(false), 2200);
      }, 240);
      return;
    }
    Animated.sequence([
      Animated.timing(bodyFade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(bodyFade, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      resetInputs();
      setCursor(nextCursor);
    }, 140);
  };

  const handleSave = () => advanceToNext(queue[cursor]);
  const handleSkip = () => advanceToNext();

  const handleReset = () => {
    setParticipants(INITIAL_PARTICIPANTS);
    setQueue([]);
    setCursor(0);
    resetInputs();
    setToast(false);
  };

  const currentParticipant =
    queue.length > 0 ? participants.find((p) => p.id === queue[cursor]) : null;

  const headerTitle = `[${SCHEDULE_INFO.typeLabel}] ${SCHEDULE_INFO.primaryClient}${
    SCHEDULE_INFO.extraCount > 0 ? ` 외 ${SCHEDULE_INFO.extraCount}명` : ''
  }`;
  const programValue = `${SCHEDULE_INFO.programName} ${SCHEDULE_INFO.sessionNumber}회기`;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 fixed (production 동일) */}
      <View
        style={{ paddingHorizontal: s(16), paddingTop: s(12) }}
        className="bg-surface"
      >
        <View style={{ height: s(52) }} className="flex-row items-center bg-surface">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.gray[800]} />
          </TouchableOpacity>
          <Typography
            variant="title-01"
            weight="semibold"
            className="flex-1 text-gray-900"
            style={{ marginLeft: s(6) }}
            numberOfLines={1}
          >
            {headerTitle}
          </Typography>
          <TouchableOpacity onPress={handleReset} hitSlop={8}>
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              Reset
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: COLORS.bg.base }}
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 흰 zone — 정보 카드 (production 동일) */}
        <View
          style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(24) }}
          className="bg-surface"
        >
          <View
            style={{ padding: s(16), gap: s(7) }}
            className="rounded-lg bg-gray-50"
          >
            <InfoRow label="프로그램" value={programValue} />
            <InfoRow label="날짜" value={SCHEDULE_INFO.dateLabel} />
            <InfoRow
              label="시간"
              value={`${SCHEDULE_INFO.timeRange} (${SCHEDULE_INFO.duration}분)`}
            />
            <InfoRow label="장소" value={SCHEDULE_INFO.room} />
          </View>

          {/* 상담 상세 보기 (production 동일) */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              marginTop: s(8),
              paddingHorizontal: s(16),
              paddingVertical: s(12),
              borderRadius: s(12),
              backgroundColor: COLORS.primary50,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.primary }}
            >
              상담 상세 보기
            </Typography>
            <Ionicons name="chevron-forward" size={s(16)} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* 회색 zone */}
        <View className="bg-background">
          {/* 내담자 Section — production 그리드 그대로 + 하단 CTA 추가 */}
          <Section
            label="내담자"
            mt={s(28)}
            trailing={
              <Typography variant="label-01" className="text-gray-500">
                {participants.length}명
              </Typography>
            }
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: s(10),
              }}
            >
              {participants.map((p) => (
                <ClientCard
                  key={p.id}
                  participant={p}
                  onNotePress={() => openSheetFromCard(p.id)}
                />
              ))}
            </View>

            {/* === 추가: 일지 작성 CTA === */}
            {unwrittenCount > 0 && (
              <Pressable
                onPress={openSheetFromCTA}
                style={({ pressed }) => ({
                  marginTop: s(14),
                  backgroundColor: pressed ? COLORS.primary600 : COLORS.primary,
                  borderRadius: s(12),
                  paddingVertical: s(14),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: s(6),
                })}
                accessibilityRole="button"
                accessibilityLabel={`일지 ${unwrittenCount}건 작성`}
              >
                <Ionicons name="create-outline" size={s(16)} color={COLORS.white} />
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.white }}
                >
                  일지 {unwrittenCount}건 작성
                </Typography>
              </Pressable>
            )}
          </Section>

          {/* 필드노트 Section (production 동일 톤, mock 카드) */}
          <Section label="필드노트" mt={s(28)}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                padding: s(16),
                borderRadius: s(12),
                backgroundColor: COLORS.white,
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(12),
              }}
            >
              <View
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(10),
                  backgroundColor: COLORS.paletteBg.violet,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="mic-outline"
                  size={s(20)}
                  color={COLORS.fieldnote}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Typography
                  variant="body-02"
                  weight="semibold"
                  className="text-gray-900"
                  numberOfLines={1}
                >
                  {SCHEDULE_INFO.fieldNoteTitle}
                </Typography>
                <Typography
                  variant="body-03"
                  className="text-gray-500"
                  style={{ marginTop: s(2) }}
                >
                  필드노트 연결하기
                </Typography>
              </View>
              <Ionicons
                name="chevron-forward"
                size={s(16)}
                color={COLORS.gray[400]}
              />
            </TouchableOpacity>
          </Section>

          {/* 메모 Section (production 동일 톤, read-only mock) */}
          <Section
            label="메모"
            mt={s(28)}
            trailing={
              <TouchableOpacity hitSlop={8}>
                <Ionicons
                  name="create-outline"
                  size={s(18)}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            }
          >
            <View
              style={{ padding: s(16) }}
              className="rounded-lg bg-surface"
            >
              <Typography
                variant="body-02"
                className="text-gray-700"
                numberOfLines={5}
              >
                {SCHEDULE_INFO.memo}
              </Typography>
            </View>
          </Section>

          {/* 시연 가이드 */}
          <View
            style={{
              marginTop: s(28),
              marginHorizontal: s(20),
              padding: s(14),
              backgroundColor: COLORS.gray[100],
              borderRadius: s(12),
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.gray[700], marginBottom: s(4) }}
            >
              시연 가이드 (lab 전용)
            </Typography>
            <Typography
              variant="label-02"
              weight="regular"
              style={{ color: COLORS.gray[600], lineHeight: s(18) }}
            >
              · 내담자 그리드 하단 `일지 N건 작성` → 미작성 첫명부터 순차{'\n'}
              · 내담자 카드 탭 → 그 사람부터 순차{'\n'}
              · 출결 노쇼·미확인 / 작성 완료 인원은 자동 건너뛰기{'\n'}
              · 마지막 저장 시 토스트 + 시트 닫힘
            </Typography>
          </View>
        </View>
      </ScrollView>

      {/* 하단 액션바 — production 동일 (중단/완료) */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(12),
          paddingBottom: Math.max(s(12), insets.bottom + s(4)),
          gap: s(10),
        }}
        className="flex-row border-t border-gray-100 bg-surface"
      >
        <BottomButton
          label="중단으로 변경"
          variant="danger"
          onPress={() => {
            /* mock */
          }}
        />
      </View>

      {/* === 추가: 일지 작성 시트 (자동 진행 + N/M progress) === */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideSheet}
      >
        <View style={{ flex: 1 }}>
          {/* dim */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              opacity: fade,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={hideSheet} />
          </Animated.View>

          {/* sheet */}
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              transform: [{ translateY: slide }],
              backgroundColor: COLORS.white,
              borderTopLeftRadius: s(20),
              borderTopRightRadius: s(20),
              maxHeight: SCREEN_HEIGHT * 0.9,
              paddingBottom: insets.bottom + s(8),
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: s(8) }}>
              <View
                style={{
                  width: s(40),
                  height: s(4),
                  borderRadius: s(2),
                  backgroundColor: COLORS.gray[300],
                }}
              />
            </View>

            {/* 시트 헤더 — 이름 + N/M 배지 (production CounselingNoteSheet 톤) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: s(20),
                paddingTop: s(14),
                paddingBottom: s(12),
              }}
            >
              <View style={{ flex: 1 }}>
                {currentParticipant && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Typography
                      variant="title-01"
                      weight="semibold"
                      className="text-gray-900"
                    >
                      {currentParticipant.name}님 일지
                    </Typography>
                    {queue.length > 1 && (
                      <View
                        style={{
                          marginLeft: s(10),
                          paddingHorizontal: s(8),
                          paddingVertical: s(2),
                          borderRadius: s(8),
                          backgroundColor: COLORS.primary50,
                        }}
                      >
                        <Typography
                          variant="label-02"
                          weight="semibold"
                          style={{ color: COLORS.primary700 }}
                        >
                          {cursor + 1} / {queue.length}
                        </Typography>
                      </View>
                    )}
                  </View>
                )}
                {currentParticipant && (
                  <Typography
                    variant="body-03"
                    className="text-gray-500"
                    style={{ marginTop: s(4) }}
                  >
                    {currentParticipant.gender} · 만 {currentParticipant.age}세 ·{' '}
                    {SCHEDULE_INFO.dateLabel}
                  </Typography>
                )}
              </View>
              <TouchableOpacity onPress={hideSheet} hitSlop={8}>
                <Ionicons name="close" size={s(24)} color={COLORS.gray[700]} />
              </TouchableOpacity>
            </View>

            {/* progress bar — 잔여 인원 가시화 */}
            {queue.length > 1 && (
              <View
                style={{
                  marginHorizontal: s(20),
                  height: s(4),
                  borderRadius: s(2),
                  backgroundColor: COLORS.gray[100],
                  overflow: 'hidden',
                  marginBottom: s(4),
                }}
              >
                <View
                  style={{
                    width: `${((cursor + 1) / queue.length) * 100}%`,
                    height: '100%',
                    backgroundColor: COLORS.primary,
                    borderRadius: s(2),
                  }}
                />
              </View>
            )}

            <Animated.View style={{ opacity: bodyFade, flexShrink: 1 }}>
              <ScrollView
                style={{ maxHeight: SCREEN_HEIGHT * 0.6 }}
                contentContainerStyle={{
                  paddingHorizontal: s(20),
                  paddingTop: s(12),
                  paddingBottom: s(20),
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* 상담 목표 */}
                <View
                  style={{
                    backgroundColor: COLORS.primary50,
                    borderRadius: s(12),
                    paddingVertical: s(12),
                    paddingHorizontal: s(14),
                    borderLeftWidth: s(3),
                    borderLeftColor: COLORS.primary,
                    marginBottom: s(16),
                  }}
                >
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.primary700, marginBottom: s(6) }}
                  >
                    상담 목표
                  </Typography>
                  <TextInput
                    value={goal}
                    onChangeText={setGoal}
                    placeholder="이 회기에서 다룰 목표를 적어주세요"
                    placeholderTextColor={COLORS.gray[400]}
                    multiline
                    style={{
                      fontSize: s(14),
                      lineHeight: s(20),
                      color: COLORS.gray[900],
                      minHeight: s(40),
                      padding: 0,
                    }}
                  />
                </View>

                {/* 상담 내용 */}
                <View style={{ marginBottom: s(16) }}>
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.gray[700], marginBottom: s(6) }}
                  >
                    상담 내용
                  </Typography>
                  <View
                    style={{
                      backgroundColor: COLORS.gray[50],
                      borderRadius: s(12),
                      paddingVertical: s(12),
                      paddingHorizontal: s(14),
                    }}
                  >
                    <TextInput
                      value={content}
                      onChangeText={setContent}
                      placeholder="회기 진행 내용을 적어주세요"
                      placeholderTextColor={COLORS.gray[400]}
                      multiline
                      style={{
                        fontSize: s(14),
                        lineHeight: s(22),
                        color: COLORS.gray[900],
                        minHeight: s(80),
                        padding: 0,
                      }}
                    />
                  </View>
                </View>

                {/* 개인 메모 */}
                <View
                  style={{
                    backgroundColor: '#FFFBEB',
                    borderRadius: s(12),
                    paddingVertical: s(12),
                    paddingHorizontal: s(14),
                    borderWidth: 1,
                    borderColor: '#FDE68A',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: s(6),
                    }}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={s(14)}
                      color="#92400E"
                    />
                    <Typography
                      variant="label-02"
                      weight="semibold"
                      style={{ color: '#92400E', marginLeft: s(4) }}
                    >
                      개인 메모
                    </Typography>
                  </View>
                  <TextInput
                    value={memo}
                    onChangeText={setMemo}
                    placeholder="나만 보는 메모"
                    placeholderTextColor="#D6A77A"
                    multiline
                    style={{
                      fontSize: s(14),
                      lineHeight: s(20),
                      color: '#78350F',
                      minHeight: s(40),
                      padding: 0,
                    }}
                  />
                </View>
              </ScrollView>
            </Animated.View>

            {/* 시트 푸터 */}
            <View
              style={{
                flexDirection: 'row',
                gap: s(8),
                paddingHorizontal: s(20),
                paddingTop: s(8),
                borderTopWidth: 1,
                borderTopColor: COLORS.gray[100],
              }}
            >
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed
                    ? COLORS.gray[200]
                    : COLORS.gray[100],
                  paddingVertical: s(14),
                  borderRadius: s(12),
                  alignItems: 'center',
                  marginTop: s(8),
                })}
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[700] }}
                >
                  건너뛰기
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => ({
                  flex: 2,
                  backgroundColor: pressed
                    ? COLORS.primary600
                    : COLORS.primary,
                  paddingVertical: s(14),
                  borderRadius: s(12),
                  alignItems: 'center',
                  marginTop: s(8),
                })}
              >
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.white }}
                >
                  {cursor + 1 < queue.length ? '저장하고 다음' : '저장하고 완료'}
                </Typography>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* 완료 toast */}
      {toast && (
        <View
          style={{
            position: 'absolute',
            left: s(20),
            right: s(20),
            bottom: insets.bottom + s(80),
            backgroundColor: COLORS.gray[900],
            borderRadius: s(12),
            paddingVertical: s(14),
            paddingHorizontal: s(16),
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Ionicons
            name="checkmark-circle"
            size={s(20)}
            color={COLORS.primary300}
          />
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.white, marginLeft: s(8) }}
          >
            회기 일지를 모두 작성했어요
          </Typography>
        </View>
      )}
    </SafeAreaView>
  );
}

// ──────────────── Production schedule/[id].tsx 와 동일한 헬퍼들 ────────────────

function Section({
  label,
  mt,
  children,
  trailing,
  onLayout,
}: {
  label: string;
  mt?: number;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View
      style={{ marginTop: mt, paddingHorizontal: s(20) }}
      onLayout={onLayout}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ marginBottom: s(10) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-gray-900"
        >
          {label}
        </Typography>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      <Typography
        variant="body-03"
        className="text-gray-500"
        style={{ width: s(56) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="medium"
        className="flex-1 text-gray-800"
      >
        {value}
      </Typography>
    </View>
  );
}

/** production ClientCard 와 동일한 3-col grid 카드 — 출결 chip floating */
function ClientCard({
  participant,
  onNotePress,
}: {
  participant: ParticipantMock;
  onNotePress: () => void;
}) {
  const attPalette = ATTENDANCE_PALETTES[participant.attendance];
  const hasNote = participant.noteWritten;
  const isNoShow = participant.attendance === 'no_show';
  const initial = participant.name.charAt(0);

  // 출결 노쇼·미확인 / 이미 작성된 일지 → 카드 비활성/dim
  const disabled = isNoShow || participant.attendance === 'unknown';

  return (
    <View style={{ width: '31%', position: 'relative' }}>
      <TouchableOpacity
        onPress={onNotePress}
        activeOpacity={0.85}
        disabled={disabled && !hasNote}
        style={{
          backgroundColor: hasNote ? COLORS.white : COLORS.primary50,
          borderRadius: s(12),
          paddingVertical: s(14),
          paddingHorizontal: s(8),
          alignItems: 'center',
          gap: s(8),
          borderWidth: hasNote ? 0 : 1,
          borderStyle: hasNote ? undefined : 'dashed',
          borderColor: hasNote ? undefined : COLORS.primary300,
          opacity: disabled && !hasNote ? 0.5 : 1,
        }}
        accessibilityRole="button"
        accessibilityLabel={`${participant.name} ${hasNote ? '일지 보기' : '일지 작성'}`}
      >
        {/* 아바타 (mock — getProfileColor 대신 단순화) */}
        <View
          style={{
            width: s(44),
            height: s(44),
            borderRadius: s(22),
            backgroundColor: COLORS.gray[100],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-700"
          >
            {initial}
          </Typography>
        </View>
        <View style={{ alignItems: 'center', gap: s(2) }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {participant.name}
          </Typography>
          <Typography
            variant="label-02"
            className="text-gray-500"
            numberOfLines={1}
          >
            {participant.gender} · 만 {participant.age}세
          </Typography>
          <View
            className="flex-row items-center"
            style={{ gap: s(2), marginTop: s(2) }}
          >
            {hasNote ? (
              <>
                <Icon
                  name="counseling-note-16"
                  size={11}
                  color={COLORS.gray[500]}
                />
                <Typography
                  variant="label-02"
                  weight="medium"
                  className="text-gray-600"
                >
                  일지 보기
                </Typography>
              </>
            ) : (
              <>
                <Ionicons
                  name="create-outline"
                  size={11}
                  color={
                    disabled ? COLORS.gray[400] : COLORS.primary700
                  }
                />
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{
                    color: disabled ? COLORS.gray[400] : COLORS.primary700,
                  }}
                >
                  일지 작성
                </Typography>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* 출결 chip — 우상단 floating (production 동일) */}
      <Pressable
        hitSlop={6}
        style={{
          position: 'absolute',
          top: -s(4),
          right: -s(4),
          backgroundColor: attPalette.bg,
          paddingHorizontal: s(8),
          paddingVertical: s(3),
          borderRadius: s(10),
          borderWidth: 2,
          borderColor: COLORS.bg.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(2),
        }}
        accessibilityRole="button"
        accessibilityLabel={`${participant.name} 출결 ${attPalette.label}`}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: attPalette.color }}
        >
          {attPalette.label}
        </Typography>
        <Ionicons name="chevron-down" size={s(10)} color={attPalette.color} />
      </Pressable>
    </View>
  );
}

function BottomButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'danger';
  onPress: () => void;
}) {
  const bg =
    variant === 'primary' ? COLORS.primary : COLORS.gray[100];
  const fg =
    variant === 'primary' ? COLORS.white : COLORS.error;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        paddingVertical: s(14),
        borderRadius: s(12),
        backgroundColor: bg,
        alignItems: 'center',
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: fg }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}
