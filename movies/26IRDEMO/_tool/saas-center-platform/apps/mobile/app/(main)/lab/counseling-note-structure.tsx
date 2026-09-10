import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담일지 구조 — 회기 공통 / 내담자 개별 분리 시안 비교.
 *
 * 그룹 회기에서 일지는 "회기 공통 진행 내용" + "내담자별 반응·기록"으로 자연 분리된다.
 * 현재 시스템은 일지를 내담자 단위로만 다뤄 공통 부분이 N번 중복 작성.
 * 이를 시스템적으로 해결할 3가지 작성 UX + 표시 UX 비교.
 *
 *  옵션 1 · 회기 → 내담자 순차 — 회기 시트에 공통 1번, 내담자 일지 시트에 개별
 *  옵션 2 · 일지 시트 두 영역  — 한 시트에 공통/개별 두 칸 + 공통 sync
 *  옵션 3 · 단일 입력 + 토글  — 한 칸 입력 + "모두에게 적용" 토글로 일괄 복제
 */

type OptionKey = '1' | '2' | '3';

const OPTIONS: {
  key: OptionKey;
  label: string;
  oneline: string;
  desc: string;
}[] = [
  {
    key: '1',
    label: '회기→내담자 순차',
    oneline: '회기 시트에 공통 1번 + 내담자 일지 시트에 개별',
    desc:
      '회기 시트 진입 시 상단에 "회기 공통" 영역이 있어 1번만 작성. 그 다음 내담자 카드 탭하면 일지 시트가 뜨는데, 공통 영역이 read-only로 상단에 미리 채워져 있고 개별 영역만 입력. 작성 흐름이 두 단계라 약간 무거우나 역할이 명확.',
  },
  {
    key: '2',
    label: '시트 내 두 영역',
    oneline: '한 일지 시트에 [회기 공통] + [내담자 개별] 두 칸 + sync',
    desc:
      '일지 시트 안에 두 입력 칸이 위/아래로 분리. 공통 영역을 수정하면 같은 회기의 다른 내담자 일지에도 즉시 반영 (sync). 어디서 시작하든 OK — 상담사 작성 방식 자유도 보존. 모달 한 번에 다 처리.',
  },
  {
    key: '3',
    label: '단일 입력 + 토글',
    oneline: '한 칸 입력 + "이 회기 모두에게 적용" 토글로 일괄 복제',
    desc:
      '기존과 동일하게 입력 칸은 한 개. 다만 상단에 "이 회기 모두에게 적용" 토글이 있어 저장 시 같은 내용이 다른 내담자 일지에도 복제됨. 사용자 부담 최소, 데이터 모델도 단순. 단 공통/개별 경계가 데이터상 모호 → 표시 측에서 활용 제한.',
  },
];

const MOCK = {
  sessionDate: '5/15 (수) 14:00',
  room: '2상담실',
  clients: [
    { id: 'c1', name: '홍길동' },
    { id: 'c2', name: '이영희' },
  ],
  commonText:
    '이번 회기엔 분노 조절 워크북 3장을 진행. 그룹 토론으로 일주일간의 시도 사례를 공유.',
  individualText: {
    c1: '본인 사례 발표에 적극적. 가족과의 한 차례 적용 성공 보고. 학교 환경에서는 여전히 어려움 표현.',
    c2: '다른 멤버에 대한 인식 변화 표현. 적극적 발화. 직장 갈등 빈도 감소 보고.',
  },
};

// ──────────────── Page ────────────────

export default function CounselingNoteStructureLab() {
  const router = useRouter();
  const [option, setOption] = useState<OptionKey>('1');
  const current = OPTIONS.find((o) => o.key === option)!;

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg.base }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              일지 구조 · 비교
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 옵션 탭 */}
        <View style={{ paddingHorizontal: s(20), paddingBottom: s(8) }}>
          <View
            style={{
              backgroundColor: COLORS.gray[100],
              borderRadius: s(8),
              padding: s(2),
              flexDirection: 'row',
              gap: s(2),
            }}
          >
            {OPTIONS.map((o) => {
              const active = option === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => setOption(o.key)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: s(7),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    borderRadius: s(6),
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="label-02"
                    weight={active ? 'semibold' : 'medium'}
                    style={{
                      color: active ? COLORS.gray[900] : COLORS.gray[500],
                    }}
                  >
                    옵션 {o.key}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: COLORS.white }}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* 옵션 헤더 */}
        <View
          style={{
            backgroundColor: COLORS.bg.base,
            paddingTop: s(16),
            paddingBottom: s(24),
            paddingHorizontal: s(20),
          }}
        >
          <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>
            옵션 {current.key}
          </Typography>
          <Typography
            variant="headline-02"
            weight="semibold"
            className="text-gray-900"
            style={{ marginTop: s(4) }}
          >
            {current.label}
          </Typography>
          <Typography
            variant="body-03"
            className="text-gray-700"
            style={{ marginTop: s(8) }}
          >
            {current.oneline}
          </Typography>
          <View
            style={{
              marginTop: s(12),
              padding: s(12),
              backgroundColor: COLORS.white,
              borderRadius: s(10),
            }}
          >
            <Typography variant="label-01" className="text-gray-600">
              {current.desc}
            </Typography>
          </View>
        </View>

        {/* 작성 측 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingTop: s(24),
            paddingHorizontal: s(20),
          }}
        >
          <SectionLabel index={1} title="작성 측 (일지 시트)" />
          {option === '1' && <Write1 />}
          {option === '2' && <Write2 />}
          {option === '3' && <Write3 />}
        </View>

        {/* 표시 측 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingTop: s(32),
            paddingHorizontal: s(20),
          }}
        >
          <SectionLabel
            index={2}
            title="표시 측 (상담 상세 흐름 영역)"
          />
          {(option === '1' || option === '2') && <DisplayWithCommon />}
          {option === '3' && <DisplayChipOnly />}
        </View>
      </ScrollView>
    </View>
  );
}

// ──────────────── 공통 보조 ────────────────

function SectionLabel({ index, title }: { index: number; title: string }) {
  return (
    <View
      className="flex-row items-center"
      style={{ gap: s(8), marginBottom: s(12) }}
    >
      <View
        style={{
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: COLORS.gray[900],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="label-02" weight="bold" style={{ color: COLORS.white }}>
          {index}
        </Typography>
      </View>
      <Typography variant="body-02" weight="bold" className="text-gray-900">
        {title}
      </Typography>
    </View>
  );
}

/** 시트 외곽 wrapper — radius xl + 살짝 어두운 헤더 */
function SheetMock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        borderWidth: 1,
        borderColor: COLORS.gray[200],
        overflow: 'hidden',
      }}
    >
      {/* drag handle */}
      <View style={{ alignItems: 'center', paddingTop: s(8) }}>
        <View
          style={{
            width: s(36),
            height: s(4),
            borderRadius: s(2),
            backgroundColor: COLORS.gray[300],
          }}
        />
      </View>
      <View style={{ paddingHorizontal: s(16), paddingTop: s(12), paddingBottom: s(16) }}>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="label-01" className="text-gray-500" style={{ marginTop: s(2) }}>
            {subtitle}
          </Typography>
        )}
        <View style={{ marginTop: s(16), gap: s(12) }}>{children}</View>
      </View>
    </View>
  );
}

/** 입력 영역 mock — 라벨 + 입력 박스 */
function FieldMock({
  label,
  icon,
  readonly,
  value,
  hint,
  sync,
}: {
  label: string;
  icon?: 'pencil' | 'lock' | 'sync';
  readonly?: boolean;
  value: string;
  hint?: string;
  sync?: boolean;
}) {
  return (
    <View style={{ gap: s(6) }}>
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          {label}
        </Typography>
        {icon === 'lock' && (
          <Ionicon name="lock" />
        )}
        {icon === 'pencil' && (
          <Ionicon name="pencil" />
        )}
        {sync && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(4),
              backgroundColor: COLORS.paletteBg.blue,
              paddingHorizontal: s(6),
              paddingVertical: s(2),
              borderRadius: s(4),
            }}
          >
            <Ionicon name="sync" color={COLORS.palette.blue} size={10} />
            <Typography variant="label-02" weight="medium" style={{ color: COLORS.palette.blue }}>
              회기 공통
            </Typography>
          </View>
        )}
      </View>
      <View
        style={{
          backgroundColor: readonly ? COLORS.gray[100] : COLORS.gray[50],
          borderRadius: s(10),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          minHeight: s(60),
        }}
      >
        <Typography
          variant="body-03"
          className={readonly ? 'text-gray-600' : 'text-gray-800'}
        >
          {value}
        </Typography>
      </View>
      {hint && (
        <Typography variant="label-02" className="text-gray-400">
          {hint}
        </Typography>
      )}
    </View>
  );
}

function Ionicon({
  name,
  color,
  size = 12,
}: {
  name: 'lock' | 'pencil' | 'sync';
  color?: string;
  size?: number;
}) {
  // pseudo-icon: 작은 컬러 dot + 라벨
  const palette: Record<string, string> = {
    lock: COLORS.gray[500],
    pencil: COLORS.palette.green,
    sync: color ?? COLORS.palette.blue,
  };
  const labels: Record<string, string> = {
    lock: 'read-only',
    pencil: '입력',
    sync: '동기화',
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(3),
      }}
    >
      <View
        style={{
          width: s(size * 0.7),
          height: s(size * 0.7),
          borderRadius: s(size * 0.35),
          backgroundColor: palette[name],
        }}
      />
      <Typography variant="label-02" style={{ color: palette[name] }}>
        {labels[name]}
      </Typography>
    </View>
  );
}

/** 토글 mock */
function ToggleRow({
  label,
  desc,
  on,
}: {
  label: string;
  desc?: string;
  on: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(10),
        paddingHorizontal: s(12),
        paddingVertical: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
      }}
    >
      <View style={{ flex: 1 }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-900">
          {label}
        </Typography>
        {desc && (
          <Typography variant="label-02" className="text-gray-500" style={{ marginTop: s(2) }}>
            {desc}
          </Typography>
        )}
      </View>
      <View
        style={{
          width: s(40),
          height: s(24),
          borderRadius: s(12),
          backgroundColor: on ? COLORS.primary : COLORS.gray[300],
          paddingHorizontal: s(2),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: on ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: s(20),
            height: s(20),
            borderRadius: s(10),
            backgroundColor: COLORS.white,
          }}
        />
      </View>
    </View>
  );
}

// ──────────────── Write — 작성 측 시안 ────────────────

/** 옵션 1 — 회기 시트 + 일지 시트 두 단계 */
function Write1() {
  return (
    <View style={{ gap: s(16) }}>
      <StepTag step="STEP 1" />
      <SheetMock
        title="회기 정보"
        subtitle={`${MOCK.sessionDate} · ${MOCK.room}`}
      >
        <FieldMock
          label="회기 공통"
          icon="pencil"
          value={MOCK.commonText}
          hint="이번 회기에 진행한 활동·테마. 모든 참여 내담자에게 동일하게 적용됩니다"
        />
        <View style={{ gap: s(6) }}>
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            참여 내담자 · 카드 탭하여 개별 일지 작성
          </Typography>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            {MOCK.clients.map((c) => (
              <View
                key={c.id}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.gray[50],
                  borderRadius: s(10),
                  padding: s(10),
                  alignItems: 'center',
                  gap: s(4),
                }}
              >
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  {c.name}
                </Typography>
                <Typography variant="label-02" className="text-gray-500">
                  개별 일지 →
                </Typography>
              </View>
            ))}
          </View>
        </View>
      </SheetMock>

      <View
        className="items-center"
        style={{ paddingVertical: s(4) }}
      >
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>

      <StepTag step="STEP 2" />
      <SheetMock
        title={`${MOCK.clients[0].name}의 상담일지`}
        subtitle={MOCK.sessionDate}
      >
        <FieldMock
          label="회기 공통"
          icon="lock"
          readonly
          value={MOCK.commonText}
          hint="STEP 1에서 작성한 회기 공통 내용 (자동으로 채워짐)"
        />
        <FieldMock
          label={`${MOCK.clients[0].name} 본인 기록`}
          icon="pencil"
          value={MOCK.individualText.c1}
        />
      </SheetMock>
    </View>
  );
}

/** 옵션 2 — 일지 시트 한 번에 두 영역 + sync */
function Write2() {
  return (
    <View style={{ gap: s(12) }}>
      <SheetMock
        title={`${MOCK.clients[0].name}의 상담일지`}
        subtitle={`${MOCK.sessionDate} · 그룹 ${MOCK.clients.length}명`}
      >
        <FieldMock
          label="회기 공통"
          icon="pencil"
          sync
          value={MOCK.commonText}
          hint={`이 영역을 수정하면 ${MOCK.clients
            .filter((c) => c.id !== 'c1')
            .map((c) => c.name)
            .join(', ')} 일지에도 즉시 반영`}
        />
        <FieldMock
          label={`${MOCK.clients[0].name} 본인 기록`}
          icon="pencil"
          value={MOCK.individualText.c1}
        />
      </SheetMock>
      <View
        style={{
          backgroundColor: COLORS.paletteBg.blue,
          borderRadius: s(10),
          padding: s(12),
          flexDirection: 'row',
          gap: s(8),
          alignItems: 'flex-start',
        }}
      >
        <Ionicon name="sync" />
        <View style={{ flex: 1 }}>
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.palette.blue }}>
            sync 동작
          </Typography>
          <Typography variant="label-02" className="text-gray-700" style={{ marginTop: s(2) }}>
            "회기 공통" 영역 수정·저장 시 같은 회기의 다른 내담자 일지에도 즉시 반영. 별도 확인 없이 자동 동기화 + 토스트 안내.
          </Typography>
        </View>
      </View>
    </View>
  );
}

/** 옵션 3 — 단일 입력 + 토글 */
function Write3() {
  return (
    <View style={{ gap: s(12) }}>
      <SheetMock
        title={`${MOCK.clients[0].name}의 상담일지`}
        subtitle={`${MOCK.sessionDate} · 그룹 ${MOCK.clients.length}명`}
      >
        <ToggleRow
          label="이 회기 모두에게 적용"
          desc="저장 시 같은 회기의 다른 내담자 일지에도 동일 내용 복제"
          on
        />
        <FieldMock
          label="상담 내용"
          icon="pencil"
          value={`${MOCK.commonText}\n\n${MOCK.individualText.c1}`}
        />
      </SheetMock>
      <View
        style={{
          backgroundColor: COLORS.paletteBg.yellow,
          borderRadius: s(10),
          padding: s(12),
          gap: s(4),
        }}
      >
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.palette.yellow }}>
          한계
        </Typography>
        <Typography variant="label-02" className="text-gray-700">
          공통/개별 경계가 데이터상 없음 → 표시 측에서 "회기 공통 미리보기"를 만들 수 없고, AI 요약 의존 ↑. 작성은 쉽지만 흐름 영역에서 활용이 줄어듦.
        </Typography>
      </View>
    </View>
  );
}

function StepTag({ step }: { step: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: COLORS.gray[900],
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        borderRadius: s(4),
      }}
    >
      <Typography variant="label-02" weight="bold" style={{ color: COLORS.white }}>
        {step}
      </Typography>
    </View>
  );
}

// ──────────────── Display — 표시 측 시안 ────────────────

/** 옵션 1·2 — 공통 본문 미리보기 + 내담자 chip */
function DisplayWithCommon() {
  return (
    <View style={{ gap: s(12) }}>
      <Typography variant="label-01" className="text-gray-600">
        공통/개별 분리가 데이터상 있으므로, 흐름 영역의 회기 카드에 공통 1줄 미리보기를 함께 노출
      </Typography>
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(12),
          paddingVertical: s(12),
          paddingHorizontal: s(14),
          gap: s(8),
        }}
      >
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {MOCK.sessionDate}
          </Typography>
          <View style={{ marginLeft: 'auto' }}>
            <Icon name="arrow-right" size={12} color={COLORS.gray[400]} />
          </View>
        </View>
        <Typography variant="body-03" className="text-gray-700" numberOfLines={2}>
          {MOCK.commonText}
        </Typography>
        <View className="flex-row" style={{ gap: s(8), flexWrap: 'wrap', marginTop: s(2) }}>
          {MOCK.clients.map((c) => (
            <View
              key={c.id}
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(5),
                borderRadius: s(20),
                backgroundColor: COLORS.white,
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
              }}
            >
              <Typography variant="label-01" weight="semibold" className="text-gray-800">
                {c.name}
              </Typography>
              <View
                style={{
                  backgroundColor: COLORS.paletteBg.green,
                  paddingHorizontal: s(6),
                  paddingVertical: s(1),
                  borderRadius: s(4),
                }}
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.palette.green }}
                >
                  완료
                </Typography>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          backgroundColor: COLORS.paletteBg.green,
          borderRadius: s(10),
          padding: s(12),
          gap: s(4),
        }}
      >
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.palette.green }}>
          이점
        </Typography>
        <Typography variant="label-02" className="text-gray-700">
          상담사가 작성한 회기 공통 내용이 그대로 케이스 흐름의 자료. AI 요약 의존 없이 신뢰도 ↑.
        </Typography>
      </View>
    </View>
  );
}

/** 옵션 3 — chip만 (공통 본문 활용 불가) */
function DisplayChipOnly() {
  return (
    <View style={{ gap: s(12) }}>
      <Typography variant="label-01" className="text-gray-600">
        공통/개별 구분이 데이터에 없어, 흐름 영역에서는 일지 상태 chip만 표시
      </Typography>
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(12),
          paddingVertical: s(12),
          paddingHorizontal: s(14),
          gap: s(10),
        }}
      >
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            {MOCK.sessionDate}
          </Typography>
          <View style={{ marginLeft: 'auto' }}>
            <Icon name="arrow-right" size={12} color={COLORS.gray[400]} />
          </View>
        </View>
        <View className="flex-row" style={{ gap: s(8), flexWrap: 'wrap' }}>
          {MOCK.clients.map((c) => (
            <View
              key={c.id}
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(5),
                borderRadius: s(20),
                backgroundColor: COLORS.white,
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
              }}
            >
              <Typography variant="label-01" weight="semibold" className="text-gray-800">
                {c.name}
              </Typography>
              <View
                style={{
                  backgroundColor: COLORS.paletteBg.green,
                  paddingHorizontal: s(6),
                  paddingVertical: s(1),
                  borderRadius: s(4),
                }}
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.palette.green }}
                >
                  완료
                </Typography>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          backgroundColor: COLORS.paletteBg.yellow,
          borderRadius: s(10),
          padding: s(12),
          gap: s(4),
        }}
      >
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.palette.yellow }}>
          한계
        </Typography>
        <Typography variant="label-02" className="text-gray-700">
          "그래서 이 회기엔 뭐 했지?"를 한눈에 못 봄 → 회기 시트 진입해서 일지 본문 열어야 확인 가능.
        </Typography>
      </View>
    </View>
  );
}
