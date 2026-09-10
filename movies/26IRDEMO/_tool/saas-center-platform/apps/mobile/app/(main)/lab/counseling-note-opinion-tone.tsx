import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [상담일지] 검사 소견 톤 정렬 — mock-only 시안 비교 lab.
 *
 * 목적: 상담일지 바텀시트(CounselingNoteSheet)의 "전반적인 디자인"을
 * 검사 소견 시트(AssessmentOpinionSheet)와 한 가족처럼 통일.
 *
 * 비교 축 = 단일 상담일지 시트의 "시각 톤"
 *  - [현재] production CounselingNoteSheet 본문 재현 (대조군)
 *      chevron-back│날짜│X + 별도 타이틀행 / 흰 배경 보더 입력 4필드 /
 *      보라 틴트 풀폭 초안 버튼 / 단일 등록·완료 / cyan 액센트
 *  - [검사소견톤] AssessmentOpinionSheet 톤 이식
 *      가운데 타이틀 + 좌우 ‹ › 내담자 이동 / 검사 소견 Chip 톤 /
 *      double-diamond 그라데이션 풀폭 초안 / gray-50 입력 4필드 /
 *      닫기 + 저장 2버튼(닫을 때 자동저장) / #4486FF 액센트
 *      + 초안 생성중 상태(이미지 2) 토글
 *
 * 데이터 모델은 그대로 — 상담 목표·진행 내용·다음 상담 내용·개인 메모 4필드 유지.
 * (검사 소견은 단일 textarea지만, 상담일지는 스펙 §3-5 4필드가 ✅ 확정이라 구조는 보존하고 톤만 맞춤)
 *
 * 전부 mock. 사인오프 시 CounselingNoteSheet 에 포팅.
 */

/** 검사 소견 시트의 액센트 블루 (#4486FF) — cyan primary 대신 통일 */
const ACCENT = '#4486FF';
/** 개인 메모 옐로 (디자인 시스템 외 — 현재 시트에서 그대로 계승) */
const MEMO_BG = '#FFFBEB';
const MEMO_BORDER = '#FDE68A';

type Tab = 'current' | 'opinion';
type OpinionState = 'edit' | 'generating';

interface Participant {
  id: string;
  name: string;
  written: boolean;
}

const PARTICIPANTS: Participant[] = [
  { id: 'c1', name: '홍길동', written: false },
  { id: 'c2', name: '박혁거세', written: false },
  { id: 'c3', name: '김나연', written: true },
  { id: 'c4', name: '유지민', written: true },
];

const DATE_LABEL = '2026-04-13 (목)';

export default function CounselingNoteOpinionToneLab() {
  const [tab, setTab] = useState<Tab>('opinion');

  return (
    <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: COLORS.gray[100] }}>
      {/* lab 탭 스위처 */}
      <View style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(12) }}>
        <View
          style={{
            backgroundColor: COLORS.gray[100],
            borderRadius: s(10),
            padding: s(3),
            flexDirection: 'row',
            gap: s(3),
          }}
        >
          {([
            { key: 'current', label: '현재' },
            { key: 'opinion', label: '검사소견톤' },
          ] as const).map((it) => {
            const active = tab === it.key;
            return (
              <TouchableOpacity
                key={it.key}
                onPress={() => setTab(it.key)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: s(8),
                  borderRadius: s(8),
                  alignItems: 'center',
                  backgroundColor: active ? COLORS.white : 'transparent',
                }}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'semibold' : 'medium'}
                  style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}
                >
                  {it.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 시트 프레임 — 바텀시트를 흉내낸 라운드 상단 화이트 면 */}
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.surface,
          borderTopLeftRadius: s(20),
          borderTopRightRadius: s(20),
          overflow: 'hidden',
        }}
      >
        {tab === 'current' ? <CurrentSheet /> : <OpinionSheet />}
      </View>
    </SafeAreaView>
  );
}

/* ════════════════════════════ [현재] 대조군 ════════════════════════════ */

function CurrentSheet() {
  const [activeId, setActiveId] = useState('c1');
  const active = PARTICIPANTS.find((p) => p.id === activeId)!;

  return (
    <View style={{ flex: 1 }}>
      {/* 드래그 핸들 */}
      <View style={{ alignItems: 'center', paddingTop: s(14), paddingBottom: s(14) }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray[300] }} />
      </View>

      {/* 헤더 — chevron-back │ 날짜 │ X */}
      <View
        style={{
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(20),
        }}
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.gray[700]} />
        <Typography variant="body-01" weight="semibold" style={{ color: COLORS.gray[900] }}>
          {DATE_LABEL}
        </Typography>
        <Ionicons name="close" size={24} color={COLORS.gray[700]} />
      </View>

      {/* 타이틀 행 */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(4), paddingBottom: s(16) }}>
        <Typography variant="headline-02" weight="bold" style={{ color: COLORS.gray[900] }}>
          {active.name}의 상담일지
        </Typography>
      </View>

      {/* 칩 (cyan 톤) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: s(16) }}
        contentContainerStyle={{ paddingHorizontal: s(20), gap: s(8) }}
      >
        {PARTICIPANTS.map((p) => {
          const isActive = p.id === activeId;
          const bg = isActive ? COLORS.primary50 : p.written ? COLORS.gray[800] : COLORS.white;
          const border = isActive ? COLORS.primary : p.written ? COLORS.gray[800] : COLORS.gray[300];
          const fg = isActive ? COLORS.primary : p.written ? COLORS.white : COLORS.gray[700];
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setActiveId(p.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: s(34),
                paddingHorizontal: s(14),
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: bg,
                borderColor: border,
              }}
            >
              {p.written && (
                <Ionicons name="checkmark" size={s(14)} color={fg} style={{ marginRight: s(3) }} />
              )}
              <Typography variant="body-03" weight="semibold" style={{ color: fg }}>
                {p.name}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: s(20), gap: s(20) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 보라 틴트 풀폭 초안 버튼 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(8),
            backgroundColor: COLORS.fieldnote + '14',
            borderRadius: s(12),
            paddingHorizontal: s(14),
            paddingVertical: s(12),
          }}
        >
          <Ionicons name="sparkles" size={s(18)} color={COLORS.fieldnote} />
          <Typography variant="body-03" weight="semibold" style={{ color: COLORS.fieldnote, flex: 1 }}>
            연결된 필드노트로 상담일지 초안 만들기
          </Typography>
          <Ionicons name="chevron-forward" size={s(16)} color={COLORS.fieldnote} />
        </View>

        <CurrentField label="상담 목표" placeholder="이번 회기의 목표를 입력해 주세요" minHeight={96} />
        <CurrentField label="진행 내용" placeholder="이번 회기의 진행 내용을 기록해 주세요" minHeight={120} />
        <CurrentField label="다음 상담 내용" placeholder="다음 회기에서 다룰 내용을 입력해 주세요" minHeight={96} />
        <CurrentField label="개인 메모" placeholder="나만 볼 수 있는 메모예요" minHeight={96} isPrivate />
      </ScrollView>

      {/* 단일 등록 버튼 */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(20) }}>
        <View
          style={{
            width: '100%',
            paddingVertical: s(14),
            borderRadius: s(10),
            backgroundColor: COLORS.primary,
            alignItems: 'center',
          }}
        >
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
            등록
          </Typography>
        </View>
      </View>
    </View>
  );
}

function CurrentField({
  label,
  placeholder,
  minHeight,
  isPrivate,
}: {
  label: string;
  placeholder: string;
  minHeight: number;
  isPrivate?: boolean;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(6), gap: s(4) }}>
        {isPrivate && <Ionicons name="lock-closed" size={12} color={COLORS.warning} />}
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: isPrivate ? COLORS.warning : COLORS.gray[700] }}
        >
          {label}
        </Typography>
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: s(minHeight),
          padding: s(12),
          borderRadius: s(12),
          borderWidth: 1,
          borderColor: isPrivate ? MEMO_BORDER : COLORS.gray[200],
          backgroundColor: isPrivate ? MEMO_BG : COLORS.white,
          fontSize: s(14),
          lineHeight: s(20),
          color: COLORS.gray[900],
          letterSpacing: -0.41,
        }}
      />
    </View>
  );
}

/* ═══════════════════════ [검사소견톤] 신규 시안 ═══════════════════════ */

function OpinionSheet() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [state, setState] = useState<OpinionState>('edit');
  const active = PARTICIPANTS[activeIdx];
  const canPrev = activeIdx > 0;
  const canNext = activeIdx < PARTICIPANTS.length - 1;

  return (
    <View style={{ flex: 1 }}>
      {/* 드래그 핸들 */}
      <View style={{ alignItems: 'center', paddingTop: s(10), paddingBottom: s(14) }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray[300] }} />
      </View>

      {/* 헤더 — ‹ │ 가운데 타이틀 │ › (검사 소견 톤: 가운데 타이틀) */}
      <View
        style={{
          height: s(48),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(16),
        }}
      >
        <TouchableOpacity
          onPress={() => canPrev && setActiveIdx((i) => i - 1)}
          hitSlop={8}
          disabled={!canPrev}
          accessibilityLabel="이전 내담자"
        >
          <Ionicons name="chevron-back" size={24} color={canPrev ? COLORS.gray[700] : COLORS.gray[300]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" numberOfLines={1} style={{ color: COLORS.gray[900] }}>
          {active.name}의 상담일지
        </Typography>
        <TouchableOpacity
          onPress={() => canNext && setActiveIdx((i) => i + 1)}
          hitSlop={8}
          disabled={!canNext}
          accessibilityLabel="다음 내담자"
        >
          <Ionicons name="chevron-forward" size={24} color={canNext ? COLORS.gray[700] : COLORS.gray[300]} />
        </TouchableOpacity>
      </View>

      {/* 칩 — 검사 소견 Chip 톤 (active 블루 아웃라인 / 작성완료 다크+체크 / 미작성 회색) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: s(52) }}
        contentContainerStyle={{ paddingHorizontal: s(16), gap: s(6), alignItems: 'center' }}
      >
        {PARTICIPANTS.map((p, idx) => (
          <OpinionChip
            key={p.id}
            label={p.name}
            active={idx === activeIdx}
            written={p.written}
            onPress={() => setActiveIdx(idx)}
          />
        ))}
      </ScrollView>

      {state === 'generating' ? (
        <GeneratingView />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: s(16), paddingTop: s(8), paddingBottom: s(20), gap: s(18) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 초안 작성하기 — double-diamond 그라데이션 풀폭 */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => setState('generating')}>
            <LinearGradient
              colors={['#5CCBFF', '#C4C3FF', '#D9C2FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: s(44),
                borderRadius: s(12),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: s(8),
              }}
            >
              <Icon name="double-diamond-16" size={16} />
              <Typography variant="body-03" weight="semibold" style={{ color: '#5B5FE0' }}>
                초안 작성하기
              </Typography>
            </LinearGradient>
          </TouchableOpacity>

          <OpinionField label="상담 목표" placeholder="이번 회기의 목표를 입력해 주세요" minHeight={92} />
          <OpinionField label="진행 내용" placeholder="이번 회기의 진행 내용을 기록해 주세요" minHeight={120} />
          <OpinionField label="다음 상담 내용" placeholder="다음 회기에서 다룰 내용을 입력해 주세요" minHeight={92} />
          <OpinionField
            label="개인 메모"
            placeholder="개인 메모는 내담자에게 공유되지 않아요"
            minHeight={92}
            isPrivate
          />
        </ScrollView>
      )}

      {/* 푸터 — 닫기 + 저장 (검사 소견 톤) */}
      <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(16), paddingTop: s(8) }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setState('edit')}
          style={{
            width: s(122),
            paddingVertical: s(13),
            borderRadius: s(10),
            borderWidth: 1,
            borderColor: COLORS.gray[200],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[600] }}>
            닫기
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            flex: 1,
            paddingVertical: s(13),
            borderRadius: s(10),
            backgroundColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.white }}>
            저장
          </Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** 검사 소견 톤 초안 생성중 — 이미지 2 재현 */
function GeneratingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(16) }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.fieldnote} />
        <View style={{ position: 'absolute' }}>
          <Icon name="double-diamond-16" size={18} />
        </View>
      </View>
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[500] }}>
        일지 초안을 작성하고 있어요
      </Typography>
    </View>
  );
}

function OpinionField({
  label,
  placeholder,
  minHeight,
  isPrivate,
}: {
  label: string;
  placeholder: string;
  minHeight: number;
  isPrivate?: boolean;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(8), gap: s(4) }}>
        {isPrivate && <Ionicons name="lock-closed" size={13} color={COLORS.warning} />}
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: isPrivate ? COLORS.warning : COLORS.gray[600] }}
        >
          {label}
        </Typography>
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: s(minHeight),
          padding: s(14),
          borderRadius: s(12),
          borderWidth: 1,
          borderColor: isPrivate ? MEMO_BORDER : COLORS.gray[200],
          backgroundColor: isPrivate ? MEMO_BG : COLORS.gray[50],
          fontSize: s(15),
          lineHeight: s(24),
          color: COLORS.gray[800],
          letterSpacing: -0.41,
        }}
      />
    </View>
  );
}

/** 검사 소견 Chip 톤 — active 블루 아웃라인 / 작성완료 다크+체크 / 미작성 회색 */
function OpinionChip({
  label,
  active,
  written,
  onPress,
}: {
  label: string;
  active: boolean;
  written: boolean;
  onPress: () => void;
}) {
  const bg = active ? COLORS.primary50 : written ? COLORS.gray[800] : COLORS.white;
  const border = active ? ACCENT : written ? COLORS.gray[800] : COLORS.gray[200];
  const fg = active ? ACCENT : written ? COLORS.white : COLORS.gray[600];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(4),
        height: s(32),
        paddingHorizontal: s(12),
        borderRadius: s(20),
        borderWidth: 1,
        backgroundColor: bg,
        borderColor: border,
      }}
    >
      {written && !active && <Ionicons name="checkmark" size={13} color={COLORS.success} />}
      <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: fg }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
}
