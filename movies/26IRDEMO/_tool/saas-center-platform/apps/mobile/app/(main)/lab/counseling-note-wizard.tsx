import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담일지 작성 wizard — 회기 정보 → 내담자별 일지 단계 진행.
 *
 * 그룹 상담의 본질: 동일 상황(회기 목표·진행) + 개별 반응.
 * 이 본질을 작성 플로우로 자연 분리 — 한 번에 한 단계만 집중.
 *
 * 흐름:
 *   진입 → STEP 1 회기 정보 → STEP 2 홍길동 → STEP 3 이영희 → 완료
 *
 * 각 단계마다 중단 가능 (임시저장 후 나중에 이어서). 단계 이동·임시저장은 lab 단계라 mock.
 */

type StageKey = 'intro' | 'session' | 'c1' | 'c2' | 'done';

const MOCK = {
  sessionDate: '5월 15일 (수) 14:00',
  room: '2상담실',
  program: '집단상담-그룹',
  clients: [
    { id: 'c1', name: '홍길동' },
    { id: 'c2', name: '이영희' },
  ],
};

// step 표시용 (intro·done 제외)
const STEPS: { key: Exclude<StageKey, 'intro' | 'done'>; label: string; sub: string }[] = [
  { key: 'session', label: '회기 정보', sub: '목표 · 진행 내용' },
  { key: 'c1', label: '홍길동', sub: '본인 반응 · 메모' },
  { key: 'c2', label: '이영희', sub: '본인 반응 · 메모' },
];

export default function CounselingNoteWizardLab() {
  const router = useRouter();
  const [stage, setStage] = useState<StageKey>('intro');
  const [abortModal, setAbortModal] = useState(false);
  const [savedStep, setSavedStep] = useState<number>(-1); // -1=시작 전, 0=회기 정보 작성됨, 1=홍길동까지, 2=이영희까지

  // 입력 mock
  const [sessionGoal, setSessionGoal] = useState('');
  const [sessionProcess, setSessionProcess] = useState('');
  const [c1Note, setC1Note] = useState('');
  const [c1Memo, setC1Memo] = useState('');
  const [c2Note, setC2Note] = useState('');
  const [c2Memo, setC2Memo] = useState('');

  const stepIndex = STEPS.findIndex((s) => s.key === stage);
  const isStepStage = stepIndex >= 0;

  const handleStart = () => setStage(savedStep >= 0 ? STEPS[Math.min(savedStep + 1, STEPS.length - 1)].key : 'session');

  const handleNext = () => {
    setSavedStep(stepIndex);
    if (stepIndex < STEPS.length - 1) {
      setStage(STEPS[stepIndex + 1].key);
    } else {
      setStage('done');
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStage(STEPS[stepIndex - 1].key);
  };

  const handleAbortConfirm = () => {
    setSavedStep(stepIndex);
    setAbortModal(false);
    setStage('intro');
  };

  const handleReset = () => {
    setStage('intro');
    setSavedStep(-1);
    setSessionGoal('');
    setSessionProcess('');
    setC1Note('');
    setC1Memo('');
    setC2Note('');
    setC2Memo('');
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.white }} edges={['top']}>
      {/* 헤더 */}
      <View
        style={{
          height: s(52),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(8),
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (isStepStage) {
              setAbortModal(true);
            } else {
              router.back();
            }
          }}
          hitSlop={8}
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="flex-1 text-gray-900">
          상담일지 작성
        </Typography>
        {stage !== 'intro' && stage !== 'done' && (
          <TouchableOpacity onPress={handleReset} hitSlop={8}>
            <Typography variant="label-01" weight="medium" className="text-gray-500">
              초기화
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      {/* Stepper (1·2·3 단계에서만) */}
      {isStepStage && (
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(8),
            paddingBottom: s(16),
            backgroundColor: COLORS.white,
          }}
        >
          <View className="flex-row items-center" style={{ gap: s(4) }}>
            {STEPS.map((s_, idx) => {
              const active = idx === stepIndex;
              const done = idx < stepIndex;
              const color = done
                ? COLORS.palette.green
                : active
                  ? COLORS.primary
                  : COLORS.gray[200];
              return (
                <View key={s_.key} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                  <View
                    style={{
                      width: s(22),
                      height: s(22),
                      borderRadius: s(11),
                      backgroundColor: color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Icon name="check-primary-20" size={12} color={COLORS.white} />
                    ) : (
                      <Typography variant="label-02" weight="bold" style={{ color: active ? COLORS.white : COLORS.gray[500] }}>
                        {idx + 1}
                      </Typography>
                    )}
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={{ flex: 1, height: 2, backgroundColor: done ? COLORS.palette.green : COLORS.gray[200] }} />
                  )}
                </View>
              );
            })}
          </View>
          <View className="flex-row" style={{ gap: s(4), marginTop: s(8) }}>
            {STEPS.map((s_, idx) => (
              <View key={s_.key} style={{ flex: 1 }}>
                <Typography
                  variant="label-02"
                  weight={idx === stepIndex ? 'semibold' : 'medium'}
                  style={{
                    color: idx === stepIndex ? COLORS.gray[900] : COLORS.gray[400],
                  }}
                  numberOfLines={1}
                >
                  {s_.label}
                </Typography>
              </View>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: stage === 'intro' || stage === 'done' ? COLORS.bg.base : COLORS.white }}
        contentContainerStyle={{ paddingBottom: s(120) }}
      >
        {stage === 'intro' && (
          <IntroStage
            savedStep={savedStep}
            onStart={handleStart}
            sessionMeta={`${MOCK.program} · ${MOCK.sessionDate}`}
          />
        )}
        {stage === 'session' && (
          <SessionStage
            goal={sessionGoal}
            onGoal={setSessionGoal}
            process={sessionProcess}
            onProcess={setSessionProcess}
          />
        )}
        {stage === 'c1' && (
          <ClientStage
            clientName={MOCK.clients[0].name}
            sessionGoal={sessionGoal}
            sessionProcess={sessionProcess}
            note={c1Note}
            onNote={setC1Note}
            memo={c1Memo}
            onMemo={setC1Memo}
          />
        )}
        {stage === 'c2' && (
          <ClientStage
            clientName={MOCK.clients[1].name}
            sessionGoal={sessionGoal}
            sessionProcess={sessionProcess}
            note={c2Note}
            onNote={setC2Note}
            memo={c2Memo}
            onMemo={setC2Memo}
          />
        )}
        {stage === 'done' && <DoneStage onReset={handleReset} />}
      </ScrollView>

      {/* Footer navigation */}
      {isStepStage && (
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingVertical: s(12),
            backgroundColor: COLORS.white,
            borderTopWidth: 1,
            borderTopColor: COLORS.gray[100],
            flexDirection: 'row',
            gap: s(8),
          }}
        >
          {stepIndex > 0 ? (
            <TouchableOpacity
              onPress={handlePrev}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: s(16),
                height: s(48),
                borderRadius: s(12),
                backgroundColor: COLORS.gray[100],
                justifyContent: 'center',
              }}
            >
              <Typography variant="body-02" weight="semibold" className="text-gray-700">
                이전
              </Typography>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setAbortModal(true)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: s(16),
                height: s(48),
                borderRadius: s(12),
                justifyContent: 'center',
              }}
            >
              <Typography variant="body-02" weight="medium" className="text-gray-500">
                중단
              </Typography>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: s(48),
              borderRadius: s(12),
              backgroundColor: COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
              {stepIndex === STEPS.length - 1 ? '저장 후 완료' : '저장하고 다음'}
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* 중단 confirm modal */}
      <Modal
        transparent
        visible={abortModal}
        animationType="fade"
        onRequestClose={() => setAbortModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            paddingHorizontal: s(40),
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              padding: s(20),
              gap: s(12),
            }}
          >
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              지금 작성을 중단할까요?
            </Typography>
            <Typography variant="body-03" className="text-gray-600">
              지금까지 작성한 내용은 임시 저장돼요. 다음에 이어서 작성할 수 있어요.
            </Typography>
            <View className="flex-row" style={{ gap: s(8), marginTop: s(8) }}>
              <TouchableOpacity
                onPress={() => setAbortModal(false)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: s(44),
                  borderRadius: s(10),
                  backgroundColor: COLORS.gray[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body-02" weight="semibold" className="text-gray-700">
                  계속 작성
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAbortConfirm}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  height: s(44),
                  borderRadius: s(10),
                  backgroundColor: COLORS.gray[900],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
                  중단하기
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ──────────────── Stage components ────────────────

function IntroStage({
  savedStep,
  onStart,
  sessionMeta,
}: {
  savedStep: number;
  onStart: () => void;
  sessionMeta: string;
}) {
  const hasResume = savedStep >= 0 && savedStep < STEPS.length - 1;
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(24), gap: s(20) }}>
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          gap: s(8),
        }}
      >
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
          진입 안내
        </Typography>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {sessionMeta}
        </Typography>
        <Typography variant="body-03" className="text-gray-600">
          그룹 상담의 본질에 맞춰 단계별로 작성해요. 회기 정보는 1번, 내담자별 반응은 각자 입력합니다.
        </Typography>
      </View>

      {/* 작성 단계 미리보기 */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          gap: s(12),
        }}
      >
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          작성 단계 ({STEPS.length}단계)
        </Typography>
        {STEPS.map((s_, idx) => {
          const done = idx <= savedStep;
          return (
            <View key={s_.key} className="flex-row items-center" style={{ gap: s(10) }}>
              <View
                style={{
                  width: s(28),
                  height: s(28),
                  borderRadius: s(14),
                  backgroundColor: done ? COLORS.palette.green : COLORS.gray[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? (
                  <Icon name="check-primary-20" size={14} color={COLORS.white} />
                ) : (
                  <Typography variant="label-01" weight="bold" className="text-gray-500">
                    {idx + 1}
                  </Typography>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  {s_.label}
                </Typography>
                <Typography variant="label-02" className="text-gray-500">
                  {s_.sub}
                </Typography>
              </View>
              {done && (
                <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.green }}>
                  작성됨
                </Typography>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={onStart}
        activeOpacity={0.85}
        style={{
          height: s(52),
          borderRadius: s(12),
          backgroundColor: COLORS.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
          {hasResume ? `이어서 작성 (${savedStep + 2}단계부터)` : '작성 시작'}
        </Typography>
      </TouchableOpacity>

      {hasResume && (
        <Typography variant="label-02" className="text-center text-gray-500">
          이전에 작성하던 회기 정보·일지가 남아있어요
        </Typography>
      )}
    </View>
  );
}

function SessionStage({
  goal,
  onGoal,
  process,
  onProcess,
}: {
  goal: string;
  onGoal: (v: string) => void;
  process: string;
  onProcess: (v: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8), gap: s(16) }}>
      <StageHeader
        chip="STEP 1"
        title="회기 정보"
        desc="이번 회기 전체에 적용되는 내용을 작성해요. 참여 내담자 모두에게 동일하게 들어가요."
      />

      <FormField label="회기 목표" placeholder="이번 회기에서 다룰 핵심 주제·목표를 적어주세요" value={goal} onChangeText={onGoal} />

      <FormField
        label="진행 내용"
        placeholder="회기에서 진행한 활동·방식을 적어주세요"
        value={process}
        onChangeText={onProcess}
        minHeight={120}
      />
    </View>
  );
}

function ClientStage({
  clientName,
  sessionGoal,
  sessionProcess,
  note,
  onNote,
  memo,
  onMemo,
}: {
  clientName: string;
  sessionGoal: string;
  sessionProcess: string;
  note: string;
  onNote: (v: string) => void;
  memo: string;
  onMemo: (v: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8), gap: s(16) }}>
      <StageHeader
        chip={clientName}
        title={`${clientName}의 반응`}
        desc="회기 정보는 자동 적용돼요. 이 단계에선 본인의 반응·관찰만 입력해요."
      />

      {/* 회기 정보 read-only 미리보기 */}
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(12),
          padding: s(14),
          gap: s(8),
        }}
      >
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <View
            style={{
              width: s(14),
              height: s(14),
              borderRadius: s(3),
              backgroundColor: COLORS.gray[300],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="label-02" weight="bold" style={{ color: COLORS.white, fontSize: 8 }}>
              ✓
            </Typography>
          </View>
          <Typography variant="label-02" weight="semibold" className="text-gray-600">
            회기 정보 (STEP 1에서 작성)
          </Typography>
        </View>
        <View style={{ gap: s(4) }}>
          <Typography variant="label-02" className="text-gray-500">목표</Typography>
          <Typography variant="body-03" className="text-gray-700" numberOfLines={2}>
            {sessionGoal || '(작성 안 됨 — STEP 1로 돌아가 입력)'}
          </Typography>
        </View>
        <View style={{ gap: s(4) }}>
          <Typography variant="label-02" className="text-gray-500">진행 내용</Typography>
          <Typography variant="body-03" className="text-gray-700" numberOfLines={2}>
            {sessionProcess || '(작성 안 됨 — STEP 1로 돌아가 입력)'}
          </Typography>
        </View>
      </View>

      <FormField
        label={`${clientName}의 반응 · 관찰`}
        placeholder={`${clientName}이 회기에서 보인 반응·표현·변화를 적어주세요`}
        value={note}
        onChangeText={onNote}
        minHeight={120}
      />

      <FormField
        label="개인 메모 (상담사 전용)"
        placeholder="내담자와 공유되지 않는 비공개 메모예요"
        value={memo}
        onChangeText={onMemo}
        minHeight={80}
        secondary
      />
    </View>
  );
}

function DoneStage({ onReset }: { onReset: () => void }) {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(48),
        alignItems: 'center',
        gap: s(16),
      }}
    >
      <View
        style={{
          width: s(72),
          height: s(72),
          borderRadius: s(36),
          backgroundColor: COLORS.paletteBg.green,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="check-primary-20" size={36} color={COLORS.palette.green} />
      </View>
      <Typography variant="headline-02" weight="semibold" className="text-center text-gray-900">
        일지를 모두 작성했어요
      </Typography>
      <Typography variant="body-03" className="text-center text-gray-600">
        회기 정보와 내담자별 반응이 저장되었어요.{'\n'}상담 상세에서 흐름을 확인할 수 있어요.
      </Typography>
      <TouchableOpacity
        onPress={onReset}
        activeOpacity={0.7}
        style={{
          paddingHorizontal: s(16),
          paddingVertical: s(10),
          marginTop: s(8),
          borderRadius: s(10),
          backgroundColor: COLORS.gray[100],
        }}
      >
        <Typography variant="body-03" weight="semibold" className="text-gray-700">
          시안 다시 보기
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

// ──────────────── 보조 ────────────────

function StageHeader({
  chip,
  title,
  desc,
}: {
  chip: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={{ gap: s(8), marginBottom: s(4) }}>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: COLORS.primary50,
          paddingHorizontal: s(8),
          paddingVertical: s(3),
          borderRadius: s(4),
        }}
      >
        <Typography variant="label-02" weight="bold" style={{ color: COLORS.primary700 }}>
          {chip}
        </Typography>
      </View>
      <Typography variant="headline-02" weight="semibold" className="text-gray-900">
        {title}
      </Typography>
      <Typography variant="body-03" className="text-gray-600">
        {desc}
      </Typography>
    </View>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  minHeight = 80,
  secondary,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  minHeight?: number;
  secondary?: boolean;
}) {
  return (
    <View style={{ gap: s(6) }}>
      <Typography
        variant="label-01"
        weight="semibold"
        className={secondary ? 'text-gray-600' : 'text-gray-800'}
      >
        {label}
      </Typography>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: s(minHeight),
          backgroundColor: COLORS.gray[50],
          borderRadius: s(10),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          fontSize: s(14),
          lineHeight: s(20),
          color: COLORS.gray[900],
          letterSpacing: -0.41,
        }}
      />
    </View>
  );
}
