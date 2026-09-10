import { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * LAB / 내담자 그리드 — 실험 화면
 *
 * 컨셉:
 *   1) 행 리스트 대신 2열 그리드 카드
 *   2) 성별별 컬러 아바타로 시각적 다양성 확보
 *   3) 상세 시트에서는 "초기 상담일지"를 전면에 강조 (메모 중심 X)
 *
 * 모든 데이터는 화면 내 Mock. API 연동 없음.
 */

type Gender = 'female' | 'male' | 'other';

interface InitialNote {
  intakeDate: string;
  presentingIssue: string;
  background: string;
  goals: string[];
  counselorImpression?: string;
}

interface MockClient {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  initialNote: InitialNote;
  sessionCount: number;
  lastSessionDate: string | null;
}

/* ────────────────────────────────────────────────
 * 성별별 아바타 컬러 팔레트
 * ──────────────────────────────────────────────── */
const AVATAR_PALETTE: Record<
  Gender,
  { bg: string; fg: string; gradient: [string, string]; label: string }
> = {
  female: {
    bg: COLORS.paletteBg.pink,
    fg: COLORS.palette.pink,
    gradient: [COLORS.paletteBg.pink, COLORS.white],
    label: '여',
  },
  male: {
    bg: COLORS.paletteBg.blue,
    fg: COLORS.palette.blue,
    gradient: [COLORS.paletteBg.blue, COLORS.white],
    label: '남',
  },
  other: {
    bg: COLORS.gray[100],
    fg: COLORS.gray[500],
    gradient: [COLORS.gray[100], COLORS.white],
    label: '미지정',
  },
};

/* ────────────────────────────────────────────────
 * Mock 데이터 (10명, 성별/케이스 다양화)
 * ──────────────────────────────────────────────── */
const MOCK_CLIENTS: MockClient[] = [
  {
    id: 'mock-01',
    name: '김민지',
    gender: 'female',
    age: 28,
    sessionCount: 6,
    lastSessionDate: '2026-05-02',
    initialNote: {
      intakeDate: '2025-12-15',
      presentingIssue: '직장 내 인간관계 스트레스와 잦은 불안 발작',
      background:
        '디자인 회사 3년 차. 최근 팀장 교체 후 업무 평가 방식이 바뀌면서 평일 저녁마다 가슴 답답함과 호흡 곤란을 겪음. 주말에도 회복이 안 되어 일요일 저녁부터 잠을 설치는 패턴이 6주 이상 지속.',
      goals: [
        '주 1회 이상의 패닉 증상 빈도 절반으로 줄이기',
        '직장 내 상황 대처 스크립트 3가지 확보',
        '주말 회복 루틴 재설계',
      ],
      counselorImpression:
        '완벽주의 성향과 자기비난이 두드러짐. 인지재구성과 호흡 이완을 병행하면 단기 안정화 가능해 보임.',
    },
  },
  {
    id: 'mock-02',
    name: '박서준',
    gender: 'male',
    age: 35,
    sessionCount: 4,
    lastSessionDate: '2026-04-28',
    initialNote: {
      intakeDate: '2026-01-08',
      presentingIssue: '결혼 7년 차, 배우자와의 의사소통 단절감',
      background:
        '맞벌이 부부. 둘째 출산 이후 대화가 일정 공유 중심으로 줄어들었고, 사소한 의견 차이가 큰 다툼으로 번지는 일이 잦아짐. 본인은 갈등 회피 성향이 강해 결국 침묵하는 패턴.',
      goals: [
        '주 1회 30분 부부 대화 시간 확보',
        '감정 표현 어휘 확장 (3주차까지)',
        '갈등 상황에서의 일시 정지 신호 합의',
      ],
      counselorImpression:
        '회피적 애착 패턴 가능성. 부부 동석 회기를 4회기 이후 권유 예정.',
    },
  },
  {
    id: 'mock-03',
    name: '이도현',
    gender: 'male',
    age: 19,
    sessionCount: 2,
    lastSessionDate: '2026-05-05',
    initialNote: {
      intakeDate: '2026-04-20',
      presentingIssue: '재수 생활 중 무기력감과 진로 결정 회피',
      background:
        '수능 재도전 중. 매일 학원 출석은 유지하지만 학습 효율이 30% 수준이라고 자가 보고. 부모와의 진로 대화가 단절되어 있고 SNS 사용 시간이 하루 5시간 이상.',
      goals: [
        '학습-휴식 시간 분리하기',
        '진로 선택지 3개 구체화',
        '부모와 주 1회 진로 대화 재개',
      ],
      counselorImpression:
        '결정 회피 뒤에는 실패에 대한 두려움이 있음. 의사결정 보조 도구 활용 권장.',
    },
  },
  {
    id: 'mock-04',
    name: '정수아',
    gender: 'female',
    age: 42,
    sessionCount: 12,
    lastSessionDate: '2026-05-08',
    initialNote: {
      intakeDate: '2025-09-02',
      presentingIssue: '중학생 자녀와의 갈등 격화, 양육 효능감 저하',
      background:
        '전업주부. 자녀가 사춘기 진입 후 대화가 줄고 방문을 잠그는 행동이 늘어남. 본인은 통제력 상실감을 호소하며 자녀에게 화를 낸 후 깊은 죄책감을 반복 경험.',
      goals: [
        '하루 1회 비판단적 대화 시도',
        '본인 감정 다루기 루틴 확보',
        '자녀의 자율성 인정 연습',
      ],
      counselorImpression:
        '양육 스타일 재구성 + 부모 자신의 회복이 동시에 필요. 자기연민 작업 우선.',
    },
  },
  {
    id: 'mock-05',
    name: '최예린',
    gender: 'female',
    age: 24,
    sessionCount: 8,
    lastSessionDate: '2026-05-09',
    initialNote: {
      intakeDate: '2025-11-18',
      presentingIssue: '연인과의 이별 후 6개월간 지속된 우울 기분',
      background:
        '4년 연애 이별. 식사량 절반 감소, 수면 단편화, 친구 모임 회피. 본인은 "내가 망친 관계"라는 자기비난을 반복하고 있으며 직장에서는 평소처럼 기능 중.',
      goals: [
        '주 3회 이상 식사 규칙성 회복',
        '자기비난 자동사고 식별 및 재구성',
        '사회적 활동 점진적 재개',
      ],
      counselorImpression:
        '주요우울 진단 기준 부합 가능성. 행동활성화부터 시작.',
    },
  },
  {
    id: 'mock-06',
    name: '강현우',
    gender: 'male',
    age: 31,
    sessionCount: 5,
    lastSessionDate: '2026-04-30',
    initialNote: {
      intakeDate: '2026-02-11',
      presentingIssue: '이직 후 적응 어려움과 사회불안',
      background:
        '대기업에서 스타트업으로 이직 4개월. 회의 발언 시 떨림과 얼굴 붉어짐을 의식하기 시작했고, 점심 약속을 피하는 일이 잦아짐. 이전 직장에서는 동일 증상 없음.',
      goals: [
        '회의 발언 노출 빈도 점진적 증가',
        '신체 감각 관찰과 수용',
        '사회적 활동 일지 작성',
      ],
      counselorImpression:
        '상황 특이적 사회불안. 노출 기반 접근이 효과적일 것으로 예상.',
    },
  },
  {
    id: 'mock-07',
    name: '윤지원',
    gender: 'other',
    age: 26,
    sessionCount: 3,
    lastSessionDate: '2026-05-01',
    initialNote: {
      intakeDate: '2026-03-22',
      presentingIssue: '정체성 탐색 중의 혼란과 가족 갈등',
      background:
        '성정체성 탐색 중. 가까운 친구 두 명에게는 커밍아웃했으나 가족은 모름. 가족 모임 후마다 정서적 소진이 크고, 자신의 표현과 가족 기대 사이의 격차로 인한 만성 긴장감.',
      goals: [
        '안전한 자기표현 공간 늘리기',
        '가족 경계 설정 연습',
        '정체성 관련 자원 탐색',
      ],
      counselorImpression:
        '내담자의 속도 존중이 최우선. 외부 자원 연계 가능성 검토.',
    },
  },
  {
    id: 'mock-08',
    name: '한지훈',
    gender: 'male',
    age: 48,
    sessionCount: 7,
    lastSessionDate: '2026-05-06',
    initialNote: {
      intakeDate: '2025-10-30',
      presentingIssue: '사업 실패 후 정체감 상실과 음주 빈도 증가',
      background:
        '10년 운영한 음식점 폐업 후 1년. 재취업 시도 중 반복 거절을 경험. 저녁마다 음주량이 증가하고 있으며 본인은 "쉬는 시간"이라 명명. 가족은 걱정을 표현하기 시작.',
      goals: [
        '음주량/빈도 자기관찰',
        '직업 정체감과 자기 가치 분리',
        '주 2회 비음주 저녁 루틴 만들기',
      ],
      counselorImpression:
        '알코올 사용 패턴 모니터링 필요. 동기강화면담 기법 활용.',
    },
  },
  {
    id: 'mock-09',
    name: '서아인',
    gender: 'female',
    age: 16,
    sessionCount: 2,
    lastSessionDate: '2026-04-25',
    initialNote: {
      intakeDate: '2026-04-10',
      presentingIssue: '학교 친구 관계 어려움과 등교 거부',
      background:
        '고1. 반 친구 그룹에서 점차 배제되는 느낌을 받기 시작한 뒤 등교 거부 2주째. 학업 능력은 양호하나 SNS 알림에 과민하게 반응. 부모와는 비교적 대화 가능.',
      goals: [
        '학교 환경 단계적 재진입',
        '관계 어려움 상황 안전 표현',
        '하루 루틴 회복',
      ],
      counselorImpression:
        '청소년 또래 관계 위기. 학교 상담교사와의 협업 가능성 타진 권장.',
    },
  },
  {
    id: 'mock-10',
    name: '오태경',
    gender: 'male',
    age: 53,
    sessionCount: 9,
    lastSessionDate: '2026-05-07',
    initialNote: {
      intakeDate: '2025-08-14',
      presentingIssue: '은퇴 전환기의 정체성 혼란과 부부관계 재조정',
      background:
        '대기업 임원 명예퇴직 후 8개월. 일상 구조가 무너지면서 우울감과 무기력 증가. 배우자와 함께 보내는 시간이 길어지자 잦은 갈등 발생. 새로운 역할 모색 중.',
      goals: [
        '하루 단위 의미 있는 활동 3개 설계',
        '부부 역할 재계약',
        '경제활동 외 정체감 탐색',
      ],
      counselorImpression:
        '생애 전환기 적응 이슈. 의미 중심 접근 + 부부 동석 권유 검토.',
    },
  },
];

/* ────────────────────────────────────────────────
 * 유틸
 * ──────────────────────────────────────────────── */
function getInitial(name: string): string {
  if (!name) return '?';
  return name.slice(0, 1);
}

function formatDate(date: string | null): string {
  if (!date) return '회기 없음';
  const [y, m, d] = date.split('-');
  return `${y}.${m}.${d}`;
}

/* ────────────────────────────────────────────────
 * 그리드 카드
 * ──────────────────────────────────────────────── */
interface ClientCardProps {
  client: MockClient;
  onPress: (client: MockClient) => void;
}

function ClientCard({ client, onPress }: ClientCardProps) {
  const palette = AVATAR_PALETTE[client.gender];

  return (
    <TouchableOpacity
      onPress={() => onPress(client)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}, ${palette.label}, ${client.age}세`}
      className="flex-1 rounded-lg bg-surface"
      style={{
        padding: s(14),
        borderWidth: 1,
        borderColor: COLORS.gray[100],
        gap: s(10),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: s(48),
            height: s(48),
            borderRadius: s(24),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="title-01"
            weight="bold"
            style={{ color: palette.fg }}
          >
            {getInitial(client.name)}
          </Typography>
        </LinearGradient>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(999),
            backgroundColor: palette.bg,
          }}
        >
          <Typography
            variant="caption-01"
            weight="semibold"
            style={{ color: palette.fg }}
          >
            {palette.label}
          </Typography>
        </View>
      </View>

      <View style={{ gap: s(2) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {client.name}
        </Typography>
        <Typography variant="label-01" className="text-gray-600">
          {client.age}세
        </Typography>
      </View>

      <View
        className="flex-row items-center justify-between"
        style={{
          paddingTop: s(8),
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[100],
        }}
      >
        <Typography variant="label-02" className="text-gray-500">
          회기 {client.sessionCount}
        </Typography>
        <Typography variant="label-02" className="text-gray-500">
          {client.lastSessionDate ? formatDate(client.lastSessionDate) : '—'}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────
 * 상세 (초기 상담일지 강조)
 * ──────────────────────────────────────────────── */
interface ClientDetailModalProps {
  client: MockClient | null;
  onClose: () => void;
}

function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  if (!client) return null;
  const palette = AVATAR_PALETTE[client.gender];
  const note = client.initialNote;

  return (
    <Modal
      visible={!!client}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="닫기"
        accessibilityRole="button"
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <View className="flex-1 justify-end">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="bg-background"
            style={{
              borderTopLeftRadius: s(20),
              borderTopRightRadius: s(20),
              maxHeight: '92%',
            }}
          >
            {/* 핸들 + 헤더 */}
            <View className="items-center" style={{ paddingTop: s(10) }}>
              <View
                style={{
                  width: s(40),
                  height: s(4),
                  borderRadius: s(2),
                  backgroundColor: COLORS.gray[200],
                }}
              />
            </View>

            <View
              className="flex-row items-center justify-between"
              style={{ paddingHorizontal: s(20), paddingVertical: s(14) }}
            >
              <Typography variant="title-01" weight="semibold" className="text-gray-900">
                내담자 상세
              </Typography>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Ionicons name="close" size={24} color={COLORS.gray[700]} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: s(20),
                paddingBottom: s(36),
              }}
            >
              {/* 상단 프로필 */}
              <View
                className="flex-row items-center"
                style={{ gap: s(14), marginBottom: s(18) }}
              >
                <LinearGradient
                  colors={palette.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: s(72),
                    height: s(72),
                    borderRadius: s(36),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="headline-01"
                    weight="bold"
                    style={{ color: palette.fg }}
                  >
                    {getInitial(client.name)}
                  </Typography>
                </LinearGradient>
                <View style={{ flex: 1, gap: s(4) }}>
                  <Typography
                    variant="headline-02"
                    weight="bold"
                    className="text-gray-900"
                  >
                    {client.name}
                  </Typography>
                  <View className="flex-row items-center" style={{ gap: s(6) }}>
                    <View
                      style={{
                        paddingHorizontal: s(8),
                        paddingVertical: s(2),
                        borderRadius: s(999),
                        backgroundColor: palette.bg,
                      }}
                    >
                      <Typography
                        variant="caption-01"
                        weight="semibold"
                        style={{ color: palette.fg }}
                      >
                        {palette.label}
                      </Typography>
                    </View>
                    <Typography variant="body-03" className="text-gray-600">
                      {client.age}세
                    </Typography>
                  </View>
                </View>
              </View>

              {/* 초기 상담일지 — 강조 카드 */}
              <View
                className="rounded-lg"
                style={{
                  backgroundColor: COLORS.primary50,
                  padding: s(16),
                  borderLeftWidth: s(4),
                  borderLeftColor: COLORS.primary,
                  gap: s(14),
                }}
              >
                <View
                  className="flex-row items-center justify-between"
                  style={{ gap: s(8) }}
                >
                  <View className="flex-row items-center" style={{ gap: s(6) }}>
                    <View
                      style={{
                        width: s(6),
                        height: s(6),
                        borderRadius: s(3),
                        backgroundColor: COLORS.primary,
                      }}
                    />
                    <Typography
                      variant="label-01"
                      weight="semibold"
                      style={{ color: COLORS.primary700 }}
                    >
                      초기 상담일지
                    </Typography>
                  </View>
                  <Typography
                    variant="label-02"
                    style={{ color: COLORS.primary700 }}
                  >
                    접수 {formatDate(note.intakeDate)}
                  </Typography>
                </View>

                {/* 주호소 — 가장 크게 */}
                <View style={{ gap: s(6) }}>
                  <Typography
                    variant="caption-01"
                    weight="semibold"
                    className="text-gray-500"
                  >
                    주호소
                  </Typography>
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    className="text-gray-900"
                  >
                    {note.presentingIssue}
                  </Typography>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: COLORS.primary100,
                  }}
                />

                {/* 배경 */}
                <View style={{ gap: s(6) }}>
                  <Typography
                    variant="caption-01"
                    weight="semibold"
                    className="text-gray-500"
                  >
                    배경
                  </Typography>
                  <Typography
                    variant="body-02-reading"
                    className="text-gray-800"
                  >
                    {note.background}
                  </Typography>
                </View>

                {/* 상담 목표 */}
                <View style={{ gap: s(8) }}>
                  <Typography
                    variant="caption-01"
                    weight="semibold"
                    className="text-gray-500"
                  >
                    상담 목표
                  </Typography>
                  <View style={{ gap: s(6) }}>
                    {note.goals.map((goal, idx) => (
                      <View
                        key={idx}
                        className="flex-row"
                        style={{ gap: s(8) }}
                      >
                        <View
                          style={{
                            width: s(18),
                            height: s(18),
                            borderRadius: s(9),
                            backgroundColor: COLORS.primary100,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: s(1),
                          }}
                        >
                          <Typography
                            variant="caption-01"
                            weight="bold"
                            style={{ color: COLORS.primary700 }}
                          >
                            {idx + 1}
                          </Typography>
                        </View>
                        <Typography
                          variant="body-03"
                          className="flex-1 text-gray-800"
                        >
                          {goal}
                        </Typography>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 첫인상 / 사례 개념화 */}
                {note.counselorImpression ? (
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: s(10),
                      padding: s(12),
                      gap: s(6),
                      borderWidth: 1,
                      borderColor: COLORS.primary100,
                    }}
                  >
                    <Typography
                      variant="caption-01"
                      weight="semibold"
                      className="text-gray-500"
                    >
                      첫인상 · 사례 개념화
                    </Typography>
                    <Typography
                      variant="body-03"
                      style={{
                        color: COLORS.gray[700],
                        fontStyle: 'italic',
                        lineHeight: s(20),
                      }}
                    >
                      “{note.counselorImpression}”
                    </Typography>
                  </View>
                ) : null}
              </View>

              {/* 메타 — 작게 */}
              <View
                className="flex-row"
                style={{
                  marginTop: s(16),
                  gap: s(10),
                }}
              >
                <View
                  className="flex-1 items-center rounded-md bg-surface"
                  style={{
                    paddingVertical: s(12),
                    borderWidth: 1,
                    borderColor: COLORS.gray[100],
                    gap: s(2),
                  }}
                >
                  <Typography
                    variant="caption-01"
                    className="text-gray-500"
                  >
                    누적 회기
                  </Typography>
                  <Typography
                    variant="title-01"
                    weight="bold"
                    className="text-gray-900"
                  >
                    {client.sessionCount}
                  </Typography>
                </View>
                <View
                  className="flex-1 items-center rounded-md bg-surface"
                  style={{
                    paddingVertical: s(12),
                    borderWidth: 1,
                    borderColor: COLORS.gray[100],
                    gap: s(2),
                  }}
                >
                  <Typography
                    variant="caption-01"
                    className="text-gray-500"
                  >
                    마지막 회기
                  </Typography>
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    className="text-gray-900"
                  >
                    {client.lastSessionDate ? formatDate(client.lastSessionDate) : '—'}
                  </Typography>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

/* ────────────────────────────────────────────────
 * 메인 화면
 * ──────────────────────────────────────────────── */
export default function LabClientGridScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<MockClient | null>(null);

  const handleCardPress = useCallback((client: MockClient) => {
    setSelected(client);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MockClient }) => (
      <ClientCard client={item} onPress={handleCardPress} />
    ),
    [handleCardPress]
  );

  const ListHeader = useMemo(
    () => (
      <View style={{ paddingTop: s(4), paddingBottom: s(16), gap: s(6) }}>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          내담자 그리드
        </Typography>
        <Typography variant="body-03" className="text-gray-600">
          성별 컬러 아바타 + 그리드 레이아웃, 초기 상담일지 강조 상세
        </Typography>
        <View
          className="flex-row"
          style={{ marginTop: s(10), gap: s(8) }}
        >
          {(['female', 'male', 'other'] as Gender[]).map((g) => {
            const p = AVATAR_PALETTE[g];
            return (
              <View
                key={g}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: s(10),
                  paddingVertical: s(6),
                  borderRadius: s(999),
                  backgroundColor: p.bg,
                  gap: s(6),
                }}
              >
                <View
                  style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: s(4),
                    backgroundColor: p.fg,
                  }}
                />
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: p.fg }}
                >
                  {p.label}
                </Typography>
              </View>
            );
          })}
        </View>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-12 flex-row items-center px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            내담자 그리드
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      <FlatList
        data={MOCK_CLIENTS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={ListHeader}
        columnWrapperStyle={{ gap: s(12) }}
        contentContainerStyle={{
          paddingHorizontal: s(20),
          paddingBottom: s(40),
        }}
        ItemSeparatorComponent={() => <View style={{ height: s(12) }} />}
        showsVerticalScrollIndicator={false}
      />

      <ClientDetailModal client={selected} onClose={handleClose} />
    </SafeAreaView>
  );
}
