import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import {
  ageFromBirthDate,
  matchVouchers,
  useVoucherCatalog,
  VoucherCard,
  VOUCHER_GUIDANCE_NOTE,
  type EligibilityAnswers,
  type EvidenceAnswer,
  type IncomeAnswer,
  type VoucherMatch,
} from '@/features/voucher';
import {
  Button,
  ErrorView,
  LoadingView,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { refetchIfFetched, useRefreshControl } from '@/shared/hooks/useRefreshControl';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="rounded-full border px-4 py-2"
      style={{
        backgroundColor: selected ? COLORS.bg.selected : COLORS.surface,
        borderColor: selected ? COLORS.border.active : COLORS.border.default,
      }}
    >
      <Typography
        variant="body-03"
        weight={selected ? 'semibold' : 'regular'}
        style={{
          color: selected ? COLORS.brand[600] : COLORS.text.body.default,
        }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

const STATUS_BADGE: Record<
  VoucherMatch['status'],
  { label: string; color: BadgeColor }
> = {
  ok: { label: '받을 수 있어 보여요', color: 'green' },
  pending: { label: '이것만 준비되면', color: 'gray' },
  blocked: { label: '조건이 안 맞아요', color: 'gray' },
};

function matchDescription(match: VoucherMatch): string {
  if (match.reason === 'no_rule') {
    return '자격 기준은 제도 상세에서 확인해 주세요';
  }
  if (match.status === 'ok') {
    return `${match.program.support_target ?? '기준 충족'} — 신청할 수 있어 보여요`;
  }
  if (match.status === 'pending') {
    return `${match.pending.join(' · ')}이 준비되면 신청할 수 있어요`;
  }
  return match.reason === 'age'
    ? '연령 기준을 벗어나요'
    : '현재 답변으로는 소득 기준을 넘어요 — 지자체 기준은 다를 수 있어요';
}

/**
 * 1분 자격 확인 — 자가진단 2문항 → 서버 eligibility 룰 매칭.
 * 판정 아닌 안내(§7-2). 답변은 화면 상태로만 쓰고 저장·전송하지 않는다.
 */
export default function EligibilityCheckScreen() {
  const router = useRouter();
  const meQuery = useMe(); // 게스트는 비활성 — 연령 조건 미적용
  const catalogQuery = useVoucherCatalog();
  const refreshControl = useRefreshControl(() =>
    Promise.all([refetchIfFetched(meQuery), catalogQuery.refetch()]),
  );
  const [answers, setAnswers] = useState<EligibilityAnswers>({
    income: null,
    evidence: null,
  });
  const [showResult, setShowResult] = useState(false);

  const firstBirthDate =
    meQuery.data?.profiles.find((profile) => profile.birth_date)?.birth_date ?? null;

  // 소득 문항 기준치 = 카탈로그 룰 중 최대 상한 (제도별 상한이 달라도 질문은 하나)
  const incomePcts = (catalogQuery.data ?? [])
    .map((program) => program.eligibility?.income_max_pct)
    .filter((pct): pct is number => pct != null);
  const incomeThreshold = incomePcts.length > 0 ? Math.max(...incomePcts) : null;

  const ready = answers.income !== null && answers.evidence !== null;
  const results = showResult
    ? matchVouchers(answers, ageFromBirthDate(firstBirthDate), catalogQuery.data ?? [])
    : [];
  const okCount = results.filter((match) => match.status !== 'blocked').length;

  const setIncome = (income: IncomeAnswer) =>
    setAnswers((prev) => ({ ...prev, income }));
  const setEvidence = (evidence: EvidenceAnswer) =>
    setAnswers((prev) => ({ ...prev, evidence }));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-[52px] flex-row items-center px-4">
        {showResult ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다시 확인"
            onPress={() => setShowResult(false)}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        ) : router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }}
      >
        {!showResult ? (
          <>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.state.brand }}
            >
              1분 자격 확인
            </Typography>
            <Typography
              variant="headline-01"
              weight="semibold"
              className="mt-2"
              style={{ color: COLORS.text.headline }}
            >
              받을 수 있는 지원을{'\n'}찾아드릴게요
            </Typography>

            <View className="mt-6 rounded-xl bg-surface p-4">
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {incomeThreshold
                  ? `가구 소득이 기준중위소득 ${incomeThreshold}% 이하인가요?`
                  : '가구 소득이 기준중위소득 이하 구간인가요?'}
              </Typography>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Chip
                  label="네, 기준 이하예요"
                  selected={answers.income === 'under'}
                  onPress={() => setIncome('under')}
                />
                <Chip
                  label="초과해요"
                  selected={answers.income === 'over'}
                  onPress={() => setIncome('over')}
                />
                <Chip
                  label="잘 모르겠어요"
                  selected={answers.income === 'unknown'}
                  onPress={() => setIncome('unknown')}
                />
              </View>
            </View>

            <View className="mt-3 rounded-xl bg-surface p-4">
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                진단서나 발달·심리 검사 결과가 있나요?
              </Typography>
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Chip
                  label="있어요"
                  selected={answers.evidence === 'yes'}
                  onPress={() => setEvidence('yes')}
                />
                <Chip
                  label="아직 없어요"
                  selected={answers.evidence === 'no'}
                  onPress={() => setEvidence('no')}
                />
              </View>
            </View>

            <Button
              label="받을 수 있는 지원 보기"
              onPress={() => setShowResult(true)}
              disabled={!ready}
              className="mt-6"
            />
            <Typography
              variant="body-03"
              className="mt-3 text-center"
              style={{ color: COLORS.text.caption.subtle }}
            >
              입력한 답은 추천에만 쓰고 저장하지 않아요{'\n'}
              최종 자격은 주민센터·복지로에서 확정돼요
            </Typography>
          </>
        ) : catalogQuery.isLoading ? (
          <LoadingView className="py-12" />
        ) : catalogQuery.isError ? (
          <ErrorView className="py-12" onRetry={() => catalogQuery.refetch()} />
        ) : (
          <>
            <Typography
              variant="headline-01"
              weight="semibold"
              style={{ color: COLORS.text.headline }}
            >
              받을 수 있어 보이는{'\n'}지원 {okCount}개
            </Typography>

            <View className="mt-6 gap-3">
              {results.map((match) => (
                <VoucherCard
                  key={match.program.id}
                  program={match.program}
                  badge={STATUS_BADGE[match.status]}
                  description={matchDescription(match)}
                  muted={match.status === 'blocked'}
                  onPress={() => router.push(`/(main)/vouchers/${match.program.id}`)}
                />
              ))}
            </View>

            <Typography
              variant="body-03"
              className="mt-6"
              style={{ color: COLORS.text.caption.subtle }}
            >
              이건 안내예요 — {VOUCHER_GUIDANCE_NOTE}
            </Typography>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
