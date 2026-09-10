import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT, TYPOGRAPHY } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담일지 조회·수정 — wizard 짝 review 시안 (별도 수정 페이지 버전).
 *
 * 변경:
 *  - 수정은 인라인 ✏️ 토글 X — "수정" 버튼 탭 시 별도 페이지로 전환
 *  - 일지 본문 = 상담 목표 + 상담 내용 + 개인 메모 (기존 일지 시트 형식 그대로)
 *  - 디자인은 src/features/counseling/note/components/CounselingNoteSheet 패턴
 *    (goalCard 좌측 accent + contentText 읽기 친화 + memoCard 스티키 노트)
 *
 * 시트 책임 분리 유지:
 *  - 회기 시트(회기 단위) · 일지 시트(내담자 단위)
 *  - 각 시트에서 "수정" 탭 → 별도 페이지 진입 (back으로 시트 복귀)
 *
 * 결정 사항:
 *  (1) 회기 정보 저장 시 sync 자동 + 토스트 "모든 일지에 반영됐어요"
 *  (2) 본인 일지 수정 = 별도 페이지 (← 뒤로 + 헤더 + 저장)
 *  (3) "처음부터 다시" 액션 없음
 *  (4) 회기 정보 미작성이어도 일지 시트 진입 OK
 */

type Mode =
  | 'session-view'
  | 'session-edit'
  | 'note-view'
  | 'note-edit';

const MOCK = {
  sessionDate: '5월 15일 (수) 14:00',
  room: '2상담실',
  program: '집단상담-그룹',
  clients: [
    { id: 'c1', name: '홍길동', hasNote: true },
    { id: 'c2', name: '이영희', hasNote: false },
  ],
};

const INITIAL_SESSION_GOAL = '분노 조절 워크북 3장 정리 + 그룹 공유';
const INITIAL_SESSION_PROCESS =
  '일주일간 시도 사례 발표 → 그룹 피드백 → 다음 과제 부여';

// 일지 (홍길동) — 기존 시트와 동일한 3 필드
const INITIAL_NOTE_GOAL =
  '회기 내에서 본인 분노 사례를 발표하고, 적용 시도 결과를 공유한다';
const INITIAL_NOTE_CONTENT =
  '본인 사례 발표에 적극적이었음. 일주일 간 가족과의 갈등 상황에서 한 차례 적용 성공 보고. 학교 환경에서는 여전히 적용 어려움을 표현. 다음 회기까지 학교 상황에서의 인지 재구성 시도 과제 부여.';
const INITIAL_NOTE_MEMO = '다음 회기에 학교 환경 대응 더 깊게 다룰 것';

export default function CounselingNoteReviewLab() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('session-view');

  // 회기 정보 store
  const [sessionGoal, setSessionGoal] = useState(INITIAL_SESSION_GOAL);
  const [sessionProcess, setSessionProcess] = useState(INITIAL_SESSION_PROCESS);

  // 일지 store (홍길동)
  const [noteGoal, setNoteGoal] = useState(INITIAL_NOTE_GOAL);
  const [noteContent, setNoteContent] = useState(INITIAL_NOTE_CONTENT);
  const [noteMemo, setNoteMemo] = useState(INITIAL_NOTE_MEMO);

  const { message, show } = useToast();

  const isEdit = mode === 'session-edit' || mode === 'note-edit';

  const handleBack = () => {
    if (mode === 'session-edit') setMode('session-view');
    else if (mode === 'note-edit') setMode('note-view');
    else router.back();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg.base }}>
        {/* 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(8),
          }}
        >
          <TouchableOpacity onPress={handleBack} hitSlop={8}>
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              {mode === 'session-edit'
                ? '회기 정보 수정'
                : mode === 'note-edit'
                  ? '홍길동의 상담일지 수정'
                  : '일지 확인·수정'}
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시트 탭 (view 모드만) */}
        {!isEdit && (
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
              {([
                { key: 'session-view', label: '회기 시트' },
                { key: 'note-view', label: '일지 시트' },
              ] as const).map((it) => {
                const active = mode === it.key;
                return (
                  <TouchableOpacity
                    key={it.key}
                    onPress={() => setMode(it.key)}
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
                      {it.label}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(20),
          paddingTop: s(16),
          paddingBottom: isEdit ? s(100) : s(40),
        }}
      >
        {mode === 'session-view' && (
          <SessionView
            goal={sessionGoal}
            process={sessionProcess}
            onEdit={() => setMode('session-edit')}
          />
        )}
        {mode === 'session-edit' && (
          <SessionEdit
            goal={sessionGoal}
            process={sessionProcess}
            onChangeGoal={setSessionGoal}
            onChangeProcess={setSessionProcess}
          />
        )}
        {mode === 'note-view' && (
          <NoteView
            sessionGoal={sessionGoal}
            sessionProcess={sessionProcess}
            noteGoal={noteGoal}
            noteContent={noteContent}
            noteMemo={noteMemo}
            onEdit={() => setMode('note-edit')}
          />
        )}
        {mode === 'note-edit' && (
          <NoteEdit
            goal={noteGoal}
            content={noteContent}
            memo={noteMemo}
            onChangeGoal={setNoteGoal}
            onChangeContent={setNoteContent}
            onChangeMemo={setNoteMemo}
          />
        )}
      </ScrollView>

      {/* 수정 모드 footer */}
      {isEdit && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: COLORS.white,
            borderTopWidth: 1,
            borderTopColor: COLORS.gray[100],
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(12),
            paddingBottom: s(20),
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (mode === 'session-edit') {
                show('회기 정보를 수정했어요. 모든 일지에 반영됐어요');
                setMode('session-view');
              } else {
                show('홍길동의 일지를 수정했어요');
                setMode('note-view');
              }
            }}
            style={{
              height: s(52),
              borderRadius: s(12),
              backgroundColor: COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
              저장
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      <Toast visible={!!message} message={message ?? ''} />
    </View>
  );
}

// ──────────────── 회기 시트 (조회) ────────────────

function SessionView({
  goal,
  process,
  onEdit,
}: {
  goal: string;
  process: string;
  onEdit: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        overflow: 'hidden',
      }}
    >
      <DragHandle />
      <View style={{ paddingHorizontal: s(16), paddingTop: s(12), paddingBottom: s(20), gap: s(16) }}>
        <View>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            회기
          </Typography>
          <Typography variant="label-01" className="text-gray-500" style={{ marginTop: s(2) }}>
            {MOCK.sessionDate} · {MOCK.room} · {MOCK.program}
          </Typography>
        </View>

        {/* 회기 정보 영역 — 좌측 accent goal card 패턴 */}
        <View style={{ gap: s(10) }}>
          <View className="flex-row items-center">
            <Typography variant="label-01" weight="semibold" className="text-gray-700 flex-1">
              회기 정보
            </Typography>
            <TouchableOpacity onPress={onEdit} hitSlop={6} activeOpacity={0.7}>
              <View className="flex-row items-center" style={{ gap: s(4) }}>
                <Icon name="modify-20" size={12} color={COLORS.primary700} />
                <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>
                  수정
                </Typography>
              </View>
            </TouchableOpacity>
          </View>

          {/* 회기 목표 — accent bar 카드 */}
          <View style={localStyles.goalCard}>
            <View style={localStyles.goalAccent} />
            <View style={localStyles.goalContent}>
              <Text style={localStyles.goalLabel}>회기 목표</Text>
              <Text style={localStyles.goalText}>{goal}</Text>
            </View>
          </View>

          {/* 진행 내용 — 읽기 친화 */}
          <View>
            <Typography variant="label-02" weight="semibold" className="text-gray-600" style={{ marginBottom: s(6) }}>
              진행 내용
            </Typography>
            <Text style={localStyles.contentText}>{process}</Text>
          </View>
        </View>

        {/* 내담자 stack */}
        <View style={{ gap: s(8) }}>
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            내담자별 일지 ({MOCK.clients.length}명)
          </Typography>
          {MOCK.clients.map((c) => (
            <View
              key={c.id}
              style={{
                backgroundColor: COLORS.gray[50],
                borderRadius: s(12),
                paddingVertical: s(12),
                paddingHorizontal: s(14),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(10),
              }}
            >
              <View
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(18),
                  backgroundColor: COLORS.primary50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body-02" weight="semibold" style={{ color: COLORS.primary700 }}>
                  {c.name[0]}
                </Typography>
              </View>
              <View style={{ flex: 1, gap: s(2) }}>
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  {c.name}
                </Typography>
                <View className="flex-row items-center" style={{ gap: s(6) }}>
                  <Typography variant="label-02" className="text-gray-500">
                    참석
                  </Typography>
                  <Typography variant="label-02" className="text-gray-300">·</Typography>
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{
                      color: c.hasNote ? COLORS.palette.green : COLORS.palette.yellow,
                    }}
                  >
                    {c.hasNote ? '일지 작성됨' : '일지 미작성'}
                  </Typography>
                </View>
              </View>
              <Icon name="arrow-right" size={14} color={COLORS.gray[400]} />
            </View>
          ))}
          <Typography variant="label-02" className="text-gray-400">
            카드 탭 → 일지 시트로 진입 (한 사람 단위)
          </Typography>
        </View>
      </View>
    </View>
  );
}

// ──────────────── 회기 시트 (수정 — 별도 페이지) ────────────────

function SessionEdit({
  goal,
  process,
  onChangeGoal,
  onChangeProcess,
}: {
  goal: string;
  process: string;
  onChangeGoal: (v: string) => void;
  onChangeProcess: (v: string) => void;
}) {
  return (
    <View style={{ gap: s(16) }}>
      <View
        style={{
          backgroundColor: COLORS.paletteBg.blue,
          borderRadius: s(10),
          padding: s(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(8),
        }}
      >
        <View
          style={{
            width: s(8),
            height: s(8),
            borderRadius: s(4),
            backgroundColor: COLORS.palette.blue,
          }}
        />
        <Typography variant="label-01" className="text-gray-700 flex-1">
          저장 시 같은 회기의 모든 일지에 자동 반영돼요
        </Typography>
      </View>

      <View style={{ gap: s(20) }}>
        <View>
          <SectionLabel title="회기 목표" />
          <TextInput
            style={[localStyles.input, localStyles.inputSmall]}
            value={goal}
            onChangeText={onChangeGoal}
            placeholder="이번 회기에서 다룰 핵심 주제·목표를 적어주세요"
            placeholderTextColor={COLORS.gray[400]}
            multiline
            textAlignVertical="top"
            maxLength={3000}
          />
        </View>
        <View>
          <SectionLabel title="진행 내용" />
          <TextInput
            style={[localStyles.input, localStyles.inputLarge]}
            value={process}
            onChangeText={onChangeProcess}
            placeholder="회기에서 진행한 활동·방식을 적어주세요"
            placeholderTextColor={COLORS.gray[400]}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
        </View>
      </View>
    </View>
  );
}

// ──────────────── 일지 시트 (조회) ────────────────

function NoteView({
  sessionGoal,
  sessionProcess,
  noteGoal,
  noteContent,
  noteMemo,
  onEdit,
}: {
  sessionGoal: string;
  sessionProcess: string;
  noteGoal: string;
  noteContent: string;
  noteMemo: string;
  onEdit: () => void;
}) {
  const sessionFilled = !!sessionGoal && !!sessionProcess;

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        overflow: 'hidden',
      }}
    >
      <DragHandle />
      <View style={{ paddingHorizontal: s(16), paddingTop: s(12), paddingBottom: s(20), gap: s(16) }}>
        {/* 타이틀 + 수정 액션 */}
        <View className="flex-row items-center">
          <View style={{ flex: 1 }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              홍길동의 상담일지
            </Typography>
            <Typography variant="label-01" className="text-gray-500" style={{ marginTop: s(2) }}>
              {MOCK.sessionDate}
            </Typography>
          </View>
          <TouchableOpacity onPress={onEdit} hitSlop={6} activeOpacity={0.7}>
            <View className="flex-row items-center" style={{ gap: s(4) }}>
              <Icon name="modify-20" size={14} color={COLORS.primary700} />
              <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                수정
              </Typography>
            </View>
          </TouchableOpacity>
        </View>

        {/* 회기 정보 미리보기 (read-only) */}
        <View
          style={{
            backgroundColor: COLORS.gray[100],
            borderRadius: s(12),
            padding: s(14),
            gap: s(10),
          }}
        >
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Ionicons name="bookmark" size={12} color={COLORS.gray[500]} />
            <Typography variant="label-02" weight="semibold" className="text-gray-600 flex-1">
              회기 정보 (read-only)
            </Typography>
            <Typography variant="label-02" className="text-gray-400">
              회기 시트에서 수정
            </Typography>
          </View>
          {sessionFilled ? (
            <View style={{ gap: s(8) }}>
              <View style={{ gap: s(2) }}>
                <Typography variant="label-02" className="text-gray-500">회기 목표</Typography>
                <Typography variant="body-03" className="text-gray-700">{sessionGoal}</Typography>
              </View>
              <View style={{ gap: s(2) }}>
                <Typography variant="label-02" className="text-gray-500">진행 내용</Typography>
                <Typography variant="body-03" className="text-gray-700">{sessionProcess}</Typography>
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: s(10),
                padding: s(12),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(8),
              }}
            >
              <Typography variant="body-03" className="text-gray-600 flex-1">
                회기 정보가 아직 작성되지 않았어요
              </Typography>
              <TouchableOpacity activeOpacity={0.7}>
                <View className="flex-row items-center" style={{ gap: s(4) }}>
                  <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>
                    회기 시트로
                  </Typography>
                  <Icon name="arrow-right" size={12} color={COLORS.primary700} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 상담 목표 — 좌측 accent bar 카드 (기존 일지 시트 디자인) */}
        {noteGoal ? (
          <View style={localStyles.goalCard}>
            <View style={localStyles.goalAccent} />
            <View style={localStyles.goalContent}>
              <Text style={localStyles.goalLabel}>상담 목표</Text>
              <Text style={localStyles.goalText}>{noteGoal}</Text>
            </View>
          </View>
        ) : null}

        {/* 상담 내용 — 읽기 친화 타이포 */}
        <View>
          <SectionLabel title="상담 내용" />
          {noteContent ? (
            <Text style={localStyles.contentText}>{noteContent}</Text>
          ) : (
            <Text style={localStyles.empty}>작성된 내용이 없습니다</Text>
          )}
        </View>

        {/* 개인 메모 — 스티키 노트 카드 */}
        {noteMemo ? (
          <View style={localStyles.memoCard}>
            <View style={localStyles.memoHeader}>
              <Ionicons name="lock-closed" size={12} color={COLORS.warning} />
              <Text style={localStyles.memoLabel}>개인 메모</Text>
            </View>
            <Text style={localStyles.memoText}>{noteMemo}</Text>
          </View>
        ) : null}

        <Text style={localStyles.meta}>2026. 5. 15  16:42 수정</Text>
      </View>
    </View>
  );
}

// ──────────────── 일지 시트 (수정 — 별도 페이지) ────────────────

function NoteEdit({
  goal,
  content,
  memo,
  onChangeGoal,
  onChangeContent,
  onChangeMemo,
}: {
  goal: string;
  content: string;
  memo: string;
  onChangeGoal: (v: string) => void;
  onChangeContent: (v: string) => void;
  onChangeMemo: (v: string) => void;
}) {
  return (
    <View style={{ gap: s(20) }}>
      <View>
        <SectionLabel title="상담 목표" />
        <TextInput
          style={[localStyles.input, localStyles.inputSmall]}
          value={goal}
          onChangeText={onChangeGoal}
          placeholder="이번 회기의 목표를 입력해 주세요"
          placeholderTextColor={COLORS.gray[400]}
          multiline
          textAlignVertical="top"
          maxLength={3000}
        />
      </View>
      <View>
        <SectionLabel title="상담 내용" />
        <TextInput
          style={[localStyles.input, localStyles.inputLarge]}
          value={content}
          onChangeText={onChangeContent}
          placeholder="상담 내용을 기록해 주세요"
          placeholderTextColor={COLORS.gray[400]}
          multiline
          textAlignVertical="top"
          maxLength={5000}
        />
      </View>
      <View>
        <SectionLabel title="개인 메모" isPrivate />
        <TextInput
          style={[localStyles.input, localStyles.inputSmall, localStyles.inputPrivate]}
          value={memo}
          onChangeText={onChangeMemo}
          placeholder="나만 볼 수 있는 메모예요"
          placeholderTextColor={COLORS.gray[400]}
          multiline
          textAlignVertical="top"
          maxLength={3000}
        />
      </View>
    </View>
  );
}

// ──────────────── 공통 보조 ────────────────

function SectionLabel({ title, isPrivate }: { title: string; isPrivate?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(6), gap: s(4) }}>
      {isPrivate && (
        <Ionicons name="lock-closed" size={12} color={COLORS.warning} />
      )}
      <Text style={localStyles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function DragHandle() {
  return (
    <View style={{ alignItems: 'center', paddingTop: s(10), paddingBottom: s(8) }}>
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: COLORS.gray[300],
        }}
      />
    </View>
  );
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: s(40),
        left: s(20),
        right: s(20),
        backgroundColor: COLORS.gray[900],
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: s(12),
        shadowOffset: { width: 0, height: s(4) },
        elevation: 6,
      }}
    >
      <Icon name="check-primary-20" size={16} color={COLORS.palette.green} />
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.white, flex: 1 }}>
        {message}
      </Typography>
    </View>
  );
}

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(t);
  }, [message]);
  return { message, show: setMessage };
}

// ──────────────── 일지 시트 디자인 그대로 ────────────────

const localStyles = StyleSheet.create({
  // 기존 CounselingNoteSheet 의 viewStyles + styles 일부 복제 (디자인 그대로)
  goalCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary50,
    borderRadius: s(12),
    overflow: 'hidden',
  },
  goalAccent: {
    width: 3,
    backgroundColor: COLORS.primary,
  },
  goalContent: {
    flex: 1,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
  },
  goalLabel: {
    fontSize: s(12),
    fontWeight: '600',
    color: COLORS.primary700,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginBottom: s(4),
  },
  goalText: {
    fontSize: s(14),
    fontWeight: '500',
    color: COLORS.gray[900],
    lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  contentText: {
    fontSize: s(15),
    color: COLORS.gray[900],
    lineHeight: s(26),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(12),
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: s(6),
  },
  memoLabel: {
    fontSize: s(12),
    fontWeight: '600',
    color: COLORS.warning,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoText: {
    fontSize: s(14),
    color: COLORS.gray[800],
    lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  meta: {
    fontSize: s(12),
    color: COLORS.gray[400],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    marginTop: s(4),
  },
  sectionLabelText: {
    fontSize: s(13),
    fontWeight: '600',
    color: COLORS.gray[700],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  empty: {
    fontSize: s(14),
    color: COLORS.gray[400],
    lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  input: {
    fontSize: s(14),
    lineHeight: s(20),
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    padding: s(12),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
    textAlignVertical: 'top',
  },
  inputPrivate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  inputSmall: {
    minHeight: s(96),
  },
  inputLarge: {
    minHeight: s(120),
  },
});
