import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [검사 상세] 내담자 배치 비교 lab.
 *
 * 질문: 검사 상세에서 내담자를 (현재처럼) 맨 아래 두는 게 맞나, 위쪽에 작게 같이 보여주는 게 나은가?
 *
 * 근거 — 상담 상세가 이미 푼 방식:
 *   - 1:1 상담 → 내담자 이름이 hero 타이틀 그 자체(성별·나이 inline). 별도 섹션 없음.
 *   - 그룹 상담 → 내담자 캐러셀(상단).
 * 검사는 스펙상 1:1 기본(§3-6). 단 hero 는 검사명으로 시작해야 해(assessment-centric) 이름을
 * 타이틀로 못 올림 → 검사명 아래 컴팩트 1줄이 상담 1:1 패턴에 가장 근접.
 *
 * 탭 — [현재] 내담자 맨 아래 그리드(대조군) / [상단 컴팩트] hero 안 1줄(권장) / [상단 카드] 검사 항목 위 카드.
 *
 * 필드노트는 본 lab 범위 밖 — 상담처럼 케이스 상세가 아니라 일정(회기) 상세 레이어에 둔다(§3-1·§3-6).
 *
 * 전부 mock. 확정 시 production assessment/[id].tsx 에 반영.
 */

type TabKey = 'current' | 'compact' | 'topcard';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'current',
    label: '현재',
    caption: '내담자를 검사 항목 아래 그리드로. "이 검사가 누구 거냐"가 맨 끝에 묻힘.',
  },
  {
    key: 'compact',
    label: '상단 컴팩트',
    caption: '검사명 아래 1줄로 누구인지 즉시 노출(상담 1:1 hero 미러). 하단 내담자 섹션 제거. — 권장',
  },
  {
    key: 'topcard',
    label: '상단 카드',
    caption: '검사 항목 위에 내담자 카드. 탭하면 내담자 상세로. 1:1은 가로 행 카드.',
  },
];

// ──────────────── MOCK ────────────────

const MOCK = {
  assessmentName: '풀배터리 (종합심리검사)',
  hasSet: true,
  statusLabel: '진행중',
  contextLabel: '진행중인 검사',
  schedule: '2026. 6. 10 (수) 14:00 - 16:00',
  room: '검사실',
  note: '검사 전 보호자 동의서 확인',
  finalReportRequired: true,
  completed: 1,
  total: 4,
  client: { name: '김민준', gender: '남', age: 8 },
  tasks: [
    { id: 't1', name: 'BGT (벤더게슈탈트)', status: 'completed' as const },
    { id: 't2', name: 'K-WISC-V', status: 'in_progress' as const },
    { id: 't3', name: 'HTP (집-나무-사람)', status: 'pending' as const },
    { id: 't4', name: 'SCT (문장완성)', status: 'pending' as const },
  ],
};

const TASK_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: '예정', bg: COLORS.paletteBg.gray, fg: COLORS.palette.gray },
  in_progress: { label: '진행중', bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  completed: { label: '완료', bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
};

// ──────────────── Page ────────────────

export default function AssessmentDetailClientsLab() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState<TabKey>('compact');
  const active = TABS.find((t) => t.key === tabKey)!;
  const progress = MOCK.completed / MOCK.total;
  const metaText = `${MOCK.client.gender} · 만 ${MOCK.client.age}세`;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      {/* 헤더 */}
      <View
        className="h-[52px] flex-row items-center px-5"
        style={{ backgroundColor: COLORS.bg.base }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">
          검사 상세 · 내담자 배치
        </Typography>
      </View>

      {/* 탭 pill */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: COLORS.gray[50],
            borderRadius: s(10),
            padding: s(3),
          }}
        >
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTabKey(t.key)}
                style={{
                  flex: 1,
                  paddingVertical: s(8),
                  borderRadius: s(8),
                  alignItems: 'center',
                  backgroundColor: on ? COLORS.white : 'transparent',
                }}
              >
                <Typography
                  variant="label-01"
                  weight={on ? 'semibold' : 'medium'}
                  style={{ color: on ? COLORS.gray[900] : COLORS.gray[500] }}
                >
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography
          variant="caption-01"
          className="text-gray-500"
          style={{ marginTop: s(8), paddingHorizontal: s(2) }}
        >
          {active.caption}
        </Typography>
      </View>

      <ScrollView
        style={{ backgroundColor: COLORS.white, marginTop: s(12) }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ───── 상단 Gray Zone (Hero) ───── */}
        <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(12), paddingBottom: s(20) }}>
          <View
            style={{
              marginHorizontal: s(20),
              backgroundColor: COLORS.white,
              borderRadius: s(20),
              padding: s(20),
              gap: s(16),
            }}
          >
            {/* context label + status badge */}
            <View className="flex-row items-center">
              <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                {MOCK.contextLabel}
              </Typography>
              <View style={{ marginLeft: 'auto' }}>
                <View
                  style={{ backgroundColor: COLORS.paletteBg.orange }}
                  className="rounded-full px-2.5 py-1"
                >
                  <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>
                    {MOCK.statusLabel}
                  </Typography>
                </View>
              </View>
            </View>

            {/* 검사명 + 세트 */}
            <View className="flex-row items-center" style={{ gap: s(8) }}>
              {MOCK.hasSet && (
                <View
                  className="items-center justify-center rounded-sm border border-gray-200"
                  style={{ height: s(22), paddingHorizontal: s(6) }}
                >
                  <Typography variant="label-02" weight="medium" style={{ color: COLORS.warning }}>
                    세트
                  </Typography>
                </View>
              )}
              <Typography
                variant="headline-02"
                weight="semibold"
                className="flex-1 text-gray-900"
                numberOfLines={2}
              >
                {MOCK.assessmentName}
              </Typography>
            </View>

            {/* [상단 컴팩트] — 검사명 아래 내담자 1줄 */}
            {tabKey === 'compact' && (
              <View className="flex-row items-center" style={{ gap: s(8), marginTop: s(-4) }}>
                <View
                  style={{
                    width: s(28),
                    height: s(28),
                    borderRadius: s(14),
                    backgroundColor: COLORS.primary50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                    {MOCK.client.name.charAt(0)}
                  </Typography>
                </View>
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  {MOCK.client.name}
                </Typography>
                <Typography variant="body-03" className="text-gray-500">
                  {metaText}
                </Typography>
                <View style={{ marginLeft: 'auto' }}>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.gray[400]} />
                </View>
              </View>
            )}

            {/* 진행도 (상담 hero 토큰 통일: title-01 + 6px bar) */}
            <View style={{ gap: s(10) }}>
              <View className="flex-row items-baseline" style={{ gap: s(4) }}>
                <Typography variant="title-01" weight="bold" style={{ color: COLORS.primary }}>
                  {MOCK.completed}
                </Typography>
                <Typography variant="body-02" weight="medium" className="text-gray-400">
                  / {MOCK.total}건 완료
                </Typography>
              </View>
              <View
                style={{
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: COLORS.gray[100],
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: '100%',
                    backgroundColor: COLORS.primary,
                    borderRadius: s(3),
                  }}
                />
              </View>
            </View>

            <View className="h-px bg-gray-100" />

            {/* info block (일정 / 종합보고서 / 메모) */}
            <View style={{ gap: s(8) }}>
              <View className="flex-row">
                <Typography variant="label-01" className="text-gray-500" style={{ width: s(72) }}>
                  일정
                </Typography>
                <View className="flex-1">
                  <Typography variant="label-01" weight="medium" className="text-gray-900">
                    {MOCK.schedule}
                  </Typography>
                  <Typography variant="label-01" className="text-gray-600">
                    {MOCK.room}
                  </Typography>
                </View>
              </View>
              <View className="flex-row items-center">
                <Typography variant="label-01" className="text-gray-500" style={{ width: s(72) }}>
                  종합보고서
                </Typography>
                <Typography variant="label-01" weight="medium" style={{ color: COLORS.warning }}>
                  작성이 필요해요
                </Typography>
              </View>
              <View className="flex-row">
                <Typography variant="label-01" className="text-gray-500" style={{ width: s(72) }}>
                  메모
                </Typography>
                <Typography variant="label-01" weight="medium" className="flex-1 text-gray-900" numberOfLines={2}>
                  {MOCK.note}
                </Typography>
              </View>
            </View>
          </View>
        </View>

        {/* ───── 하단 White Zone ───── */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingTop: s(24),
            paddingBottom: s(24),
            paddingHorizontal: s(20),
          }}
        >
          {/* [상단 카드] — 검사 항목 위에 내담자 카드 */}
          {tabKey === 'topcard' && (
            <View style={{ marginBottom: s(24) }}>
              <Typography variant="title-01" weight="semibold" className="text-gray-900" style={{ marginBottom: s(12) }}>
                내담자
              </Typography>
              <TouchableOpacity
                activeOpacity={0.85}
                style={{
                  backgroundColor: COLORS.gray[50],
                  borderRadius: s(16),
                  paddingVertical: s(14),
                  paddingHorizontal: s(16),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(12),
                }}
              >
                <View
                  style={{
                    width: s(44),
                    height: s(44),
                    borderRadius: s(22),
                    backgroundColor: COLORS.primary50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                    {MOCK.client.name.charAt(0)}
                  </Typography>
                </View>
                <View className="flex-1">
                  <Typography variant="body-02" weight="semibold" className="text-gray-900">
                    {MOCK.client.name}
                  </Typography>
                  <Typography variant="label-01" className="text-gray-500">
                    {metaText}
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray[400]} />
              </TouchableOpacity>
            </View>
          )}

          {/* 검사 항목 */}
          <Typography variant="title-01" weight="semibold" className="text-gray-900" style={{ marginBottom: s(12) }}>
            검사 항목
          </Typography>
          <View style={{ gap: s(10) }}>
            {MOCK.tasks.map((task) => {
              const st = TASK_STATUS[task.status];
              return (
                <View
                  key={task.id}
                  style={{
                    backgroundColor: COLORS.gray[50],
                    borderRadius: s(16),
                    paddingVertical: s(14),
                    paddingHorizontal: s(16),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: s(8),
                  }}
                >
                  <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>
                    {task.name}
                  </Typography>
                  <View style={{ backgroundColor: st.bg }} className="rounded-full px-2.5 py-1">
                    <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>
                      {st.label}
                    </Typography>
                  </View>
                  <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
                </View>
              );
            })}
          </View>

          {/* [현재] — 내담자 맨 아래 그리드 */}
          {tabKey === 'current' && (
            <View style={{ marginTop: s(32) }}>
              <View className="flex-row items-baseline" style={{ gap: s(6), marginBottom: s(12) }}>
                <Typography variant="title-01" weight="semibold" className="text-gray-900">
                  내담자
                </Typography>
                <Typography variant="label-01" className="text-gray-500">
                  1명
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10) }}>
                <View
                  className="flex-1"
                  style={{
                    backgroundColor: COLORS.gray[50],
                    borderRadius: s(16),
                    paddingVertical: s(16),
                    paddingHorizontal: s(10),
                    alignItems: 'center',
                    gap: s(10),
                  }}
                >
                  <View
                    style={{
                      width: s(52),
                      height: s(52),
                      borderRadius: s(26),
                      backgroundColor: COLORS.primary50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="title-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                      {MOCK.client.name.charAt(0)}
                    </Typography>
                  </View>
                  <View style={{ alignItems: 'center', gap: s(2) }}>
                    <Typography variant="body-02" weight="semibold" className="text-gray-900">
                      {MOCK.client.name}
                    </Typography>
                    <Typography variant="label-02" className="text-gray-500">
                      {metaText}
                    </Typography>
                    <Typography variant="label-02" weight="medium" className="text-gray-700" style={{ marginTop: s(2) }}>
                      {MOCK.completed}/{MOCK.total}건
                    </Typography>
                  </View>
                </View>
                {/* 1:1 이라 한 칸 비어 보임 — 그리드가 단일 내담자엔 과한 신호 */}
                <View className="flex-1" />
              </View>
            </View>
          )}
        </View>

        {/* 판정 카드 */}
        <View style={{ marginHorizontal: s(20), marginTop: s(8) }}>
          <View
            style={{
              backgroundColor: COLORS.primary50,
              borderRadius: s(16),
              padding: s(16),
              gap: s(6),
            }}
          >
            <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
              판정
            </Typography>
            <Typography variant="body-03" className="text-gray-700" style={{ lineHeight: 20 }}>
              검사는 1:1 기본 → "누구 거냐"가 즉시 잡혀야 함. 상단 컴팩트가 상담 1:1 hero 패턴에 가장
              근접하고, 하단 그리드는 단일 내담자에 과한 신호. 그룹 케이스면 그리드 유지.
            </Typography>
            <Typography variant="body-03" className="text-gray-700" style={{ lineHeight: 20, marginTop: s(4) }}>
              필드노트는 케이스 상세가 아니라 일정(회기) 상세 레이어에 — 상담과 동일(§3-1·§3-6).
            </Typography>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
