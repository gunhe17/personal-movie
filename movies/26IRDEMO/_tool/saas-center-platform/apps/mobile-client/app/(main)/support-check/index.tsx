/**
 * 지원 확인 플로우 — 한 화면 안에서 진행한다.
 *   ① 아이 정보 → ② 자격 문항 → ③ 받을 수 있는 지원(결과) → 센터 찾기
 *
 * 홈(미연동)은 진입점일 뿐이고, 플로우는 전부 이 화면이 소유한다.
 * 입력값은 기기 로컬(`useSupportCheckStore`)에만 남고 서버로 보내지 않는다.
 * 소득·증빙은 서버 eligibility 룰(income_max_pct·need_evidence)에 그대로 물리고,
 * 장애 등록은 대응 축이 없어 증빙 요건으로 흡수한다(`toEligibilityAnswers`).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import {
  SIDO_OPTIONS,
  coordsOfSido,
  toEligibilityAnswers,
  useSupportCheckStore,
  type DisabilityAnswer,
} from '@/features/support-check';
import {
  ageFromBirthDate,
  matchVouchers,
  useVoucherCatalog,
  VoucherCard,
  VOUCHER_GUIDANCE_NOTE,
  type EvidenceAnswer,
  type IncomeAnswer,
  type VoucherMatch,
} from '@/features/voucher';
import {
  BottomSheet,
  Button,
  Chip,
  ErrorView,
  LabeledInput,
  LoadingView,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS, RADIUS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { birthDigitsToIso, birthIsoToDigits } from '@/shared/utils/format';
import { FlowFormHeader } from './_components/FlowFormHeader';
import { OptionRow } from './_components/OptionRow';

type Step = 'child' | 'eligibility' | 'result';

const ACCENT = COLORS.button.primary.bg;
const ACCENT_TINT = COLORS.blue[50];

const STATUS_BADGE: Record<VoucherMatch['status'], { label: string; color: BadgeColor }> = {
  ok: { label: '신청 가능', color: 'green' },
  pending: { label: '확인 필요', color: 'orange' },
  blocked: { label: '대상 아님', color: 'gray' },
};

function matchDescription(match: VoucherMatch, ageText: string): string {
  if (match.reason === 'no_rule') return '자격 기준은 제도 상세에서 확인해 주세요';
  if (match.status === 'ok') return `${ageText} · 입력하신 조건을 충족해요`;
  if (match.status === 'pending') return `${match.pending.join(' · ')} 확인이 필요해요`;
  return match.reason === 'age'
    ? '연령 조건에서 벗어나요'
    : '현재 답변으로는 소득 기준을 넘어요 — 지자체 기준은 다를 수 있어요';
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-8">
      <Typography variant="body-01" weight="semibold" style={{ color: COLORS.text.title.default }}>
        {title}
      </Typography>
      {children}
    </View>
  );
}

export default function SupportCheckScreen() {
  const router = useRouter();
  const { start } = useLocalSearchParams<{ start?: Step }>();
  const meQuery = useMe(); // 게스트는 비활성
  const store = useSupportCheckStore();
  const catalogQuery = useVoucherCatalog();

  // 저장값 > 자녀 프로필 순으로 초기값 — 같은 걸 두 번 묻지 않는다
  const profile = (meQuery.data?.profiles ?? []).find((p) => p.relation === 'child');

  const [step, setStep] = useState<Step>(start === 'result' ? 'result' : 'child');
  const [name, setName] = useState(store.name ?? profile?.display_name ?? '');
  const [gender, setGender] = useState<string | null>(store.gender ?? profile?.gender ?? null);
  const [digits, setDigits] = useState(
    birthIsoToDigits(store.birthDate ?? profile?.birth_date ?? null),
  );
  const [sido, setSido] = useState<string | null>(store.sido);
  const [sidoSheet, setSidoSheet] = useState(false);
  const [income, setIncome] = useState<IncomeAnswer | null>(store.income);
  const [evidence, setEvidence] = useState<EvidenceAnswer | null>(store.evidence);
  const [disability, setDisability] = useState<DisabilityAnswer | null>(store.disability);

  const birthValid = digits.length === 6 && birthDigitsToIso(digits) !== null;
  const age = ageFromBirthDate(birthDigitsToIso(digits) ?? store.birthDate);
  const ageText = age === null ? '나이 미상' : `만 ${age}세`;
  const childName = name.trim() || store.name;

  // 소득 문항 기준치(%) = 카탈로그 룰 중 최대 상한 — 제도마다 달라도 질문은 하나다
  const incomeThreshold = useMemo(() => {
    const pcts = (catalogQuery.data ?? [])
      .map((program) => program.eligibility?.income_max_pct)
      .filter((pct): pct is number => pct != null);
    return pcts.length > 0 ? Math.max(...pcts) : null;
  }, [catalogQuery.data]);

  const matches = useMemo(
    () =>
      matchVouchers(
        toEligibilityAnswers({ ...store, income, evidence, disability }),
        age,
        catalogQuery.data ?? [],
      ),
    [store, income, evidence, disability, age, catalogQuery.data],
  );
  const available = matches.filter((match) => match.status !== 'blocked');
  const blocked = matches.filter((match) => match.status === 'blocked');

  const saveChild = () => {
    const birthDate = birthDigitsToIso(digits);
    if (!birthDate) return;
    store.setChild({ name: name.trim() || null, birthDate, gender, sido });
    setStep('eligibility');
  };

  const saveEligibility = () => {
    store.setEligibility({ income, evidence, disability });
    setStep('result');
  };

  const handleBack = () => {
    if (step === 'result') {
      // 결과에서 뒤로 = 홈으로. 문항 수정은 결과 화면의 '수정'으로 들어간다
      router.back();
      return;
    }
    if (step === 'eligibility') {
      setStep('child');
      return;
    }
    router.back();
  };

  const goCenters = () => {
    // 위치 권한이 없을 때를 대비해 입력한 시/도를 지도 시작점으로 넘긴다
    const coords = coordsOfSido(store.sido ?? sido);
    router.push(
      coords
        ? {
            pathname: '/(main)/centers',
            params: { lat: String(coords.latitude), lng: String(coords.longitude) },
          }
        : '/(main)/centers',
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {step === 'result' ? (
        <View className="h-12 flex-row items-center px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={handleBack}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        </View>
      ) : (
        <FlowFormHeader stepIndex={step === 'child' ? 1 : 2} onBack={handleBack} />
      )}

      {step === 'child' ? (
        <>
          <KeyboardAwareScrollView
            bottomOffset={24}
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: s(16),
              paddingTop: s(24),
              paddingBottom: s(24),
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              아이 정보를 알려주세요
            </Typography>
            <Typography
              variant="body-02"
              className="mt-2"
              style={{ color: COLORS.text.body.default }}
            >
              받을 수 있는 지원과 금액은 아이 나이에 따라 달라져요
            </Typography>

            <View style={{ marginTop: s(24), rowGap: s(24) }}>
              <LabeledInput
                label="생년월일"
                placeholder="생년월일 6자리를 입력해주세요"
                value={digits}
                onChangeText={(value) => setDigits(value.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                status={digits.length === 6 && !birthValid ? 'error' : 'default'}
                helperText={
                  digits.length === 6 && !birthValid
                    ? '생년월일 6자리를 확인해 주세요 (예: 210412)'
                    : undefined
                }
              />

              <View>
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="mb-2"
                  style={{ color: COLORS.gray[700] }}
                >
                  성별 (선택)
                </Typography>
                <View className="flex-row" style={{ columnGap: s(8) }}>
                  <Chip
                    label="여아"
                    selected={gender === 'female'}
                    onPress={() => setGender((prev) => (prev === 'female' ? null : 'female'))}
                  />
                  <Chip
                    label="남아"
                    selected={gender === 'male'}
                    onPress={() => setGender((prev) => (prev === 'male' ? null : 'male'))}
                  />
                </View>
              </View>

              <LabeledInput
                label="이름 (선택)"
                placeholder="아이 이름"
                value={name}
                onChangeText={setName}
                maxLength={100}
              />

              <View>
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="mb-2"
                  style={{ color: COLORS.gray[700] }}
                >
                  거주 지역 (선택)
                </Typography>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSidoSheet(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <View
                    className="flex-row items-center bg-surface px-4"
                    style={{
                      height: s(48),
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: COLORS.border.default,
                    }}
                  >
                    <Typography
                      variant="body-02"
                      className="flex-1"
                      // 고스트(미선택)는 gray-400 — className은 Typography 기본색에 덮인다
                      style={{ color: sido ? COLORS.text.title.default : COLORS.gray[400] }}
                    >
                      {sido ?? '시/도를 선택해주세요'}
                    </Typography>
                    <Ionicons name="chevron-down" size={s(18)} color={COLORS.gray[400]} />
                  </View>
                </Pressable>
                <Typography
                  variant="body-03"
                  className="mt-2"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  위치 권한 없이도 지역 센터를 찾아드리는 데 써요
                </Typography>
              </View>
            </View>
          </KeyboardAwareScrollView>

          <View style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}>
            <Button label="다음" onPress={saveChild} disabled={!birthValid} />
          </View>
        </>
      ) : null}

      {step === 'eligibility' ? (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: s(16),
              paddingTop: s(24),
              paddingBottom: s(24),
            }}
          >
            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {'지원 자격 확인을 위해\n몇 가지만 더 여쭤볼게요'}
            </Typography>
            <Typography
              variant="body-02"
              className="mt-2"
              style={{ color: COLORS.text.body.default }}
            >
              모르면 &apos;잘 모르겠어요&apos;로 넘어가도 결과를 볼 수 있어요
            </Typography>

            <Question
              title={
                incomeThreshold
                  ? `가구 소득이 기준중위소득 ${incomeThreshold}% 이하인가요?`
                  : '가구 소득이 기준중위소득 이하 구간인가요?'
              }
            >
              <OptionRow
                label="네, 기준 이하예요"
                selected={income === 'under'}
                onPress={() => setIncome('under')}
              />
              <OptionRow
                label="아니요, 초과해요"
                selected={income === 'over'}
                onPress={() => setIncome('over')}
              />
              <OptionRow
                label="잘 모르겠어요"
                hint="소득 기준이 있는 지원은 '확인 필요'로 안내해드려요"
                selected={income === 'unknown'}
                onPress={() => setIncome('unknown')}
              />
            </Question>

            <Question title="진단서나 발달·심리 검사 결과가 있나요?">
              <OptionRow
                label="있어요"
                hint="발달재활 서비스 의뢰서·심리검사 결과 등"
                selected={evidence === 'yes'}
                onPress={() => setEvidence('yes')}
              />
              <OptionRow
                label="아직 없어요"
                selected={evidence === 'no'}
                onPress={() => setEvidence('no')}
              />
            </Question>

            <Question title="장애 등록(복지카드)이 되어 있나요?">
              <OptionRow
                label="등록되어 있어요"
                hint="등록증이 증빙을 대신할 수 있어요"
                selected={disability === 'yes'}
                onPress={() => setDisability('yes')}
              />
              <OptionRow
                label="아니요"
                selected={disability === 'no'}
                onPress={() => setDisability('no')}
              />
            </Question>

            <Typography
              variant="body-03"
              className="mt-8"
              style={{ color: COLORS.text.body.subtle }}
            >
              {'답변은 이 기기에만 저장되고 서버로 보내지 않아요.\n최종 자격은 주민센터·복지로에서 확정돼요.'}
            </Typography>
          </ScrollView>

          <View style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}>
            <Button label="받을 수 있는 지원 보기" onPress={saveEligibility} />
          </View>
        </>
      ) : null}

      {step === 'result' ? (
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ paddingTop: s(8), paddingBottom: s(40) }}
        >
          {/* 입력값 요약 — 결과의 전제가 계속 보인다 */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep('child')}
            className="mx-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <View
              className="flex-row items-center rounded-xl px-3 py-3"
              style={{ backgroundColor: COLORS.bg['surface-sunken'], columnGap: s(8) }}
            >
              <View
                className="items-center justify-center rounded-full"
                style={{ width: s(28), height: s(28), backgroundColor: ACCENT_TINT }}
              >
                <Ionicons name="person-outline" size={s(16)} color={ACCENT} />
              </View>
              <Typography
                variant="body-03"
                weight="medium"
                className="flex-1"
                numberOfLines={1}
                style={{ color: COLORS.text.title.default }}
              >
                {[childName, ageText, store.sido].filter(Boolean).join(' · ')}
              </Typography>
              <Typography variant="body-03" weight="medium" style={{ color: ACCENT }}>
                수정
              </Typography>
            </View>
          </Pressable>

          {catalogQuery.isLoading ? (
            <LoadingView className="py-16" />
          ) : catalogQuery.isError ? (
            <ErrorView className="py-16" onRetry={() => catalogQuery.refetch()} />
          ) : (
            <>
              <View className="mt-6 px-4">
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default }}
                >
                  {available.length > 0
                    ? `${childName ? `${childName}님이 ` : ''}받을 수 있는\n지원 ${available.length}건을 찾았어요`
                    : '조건에 맞는 지원을\n아직 찾지 못했어요'}
                </Typography>
                <Typography
                  variant="body-02"
                  className="mt-2"
                  style={{ color: COLORS.text.body.default }}
                >
                  이건 안내예요 — {VOUCHER_GUIDANCE_NOTE}
                </Typography>
              </View>

              <View className="mx-4 mt-4 gap-3">
                {available.map((match) => (
                  <VoucherCard
                    key={match.program.id}
                    program={match.program}
                    badge={STATUS_BADGE[match.status]}
                    description={matchDescription(match, ageText)}
                    onPress={() => router.push(`/(main)/vouchers/${match.program.id}`)}
                  />
                ))}

                {blocked.length > 0 ? (
                  <View
                    className="rounded-xl px-4 py-3"
                    style={{ backgroundColor: COLORS.bg['surface-sunken'] }}
                  >
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.body.subtle }}
                    >
                      {`대상이 아닌 지원 ${blocked.length}건`}
                    </Typography>
                    {blocked.map((match) => (
                      <Typography
                        key={match.program.id}
                        variant="body-03"
                        className="mt-1"
                        numberOfLines={2}
                        // 가라앉힌 정보 — 고스트 회색
                        style={{ color: COLORS.gray[400] }}
                      >
                        {`${match.program.name} — ${matchDescription(match, ageText)}`}
                      </Typography>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* 미응답 문항이 남아 있으면 되돌아갈 길을 준다 */}
              {income === null || evidence === null || disability === null ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('eligibility')}
                  className="mx-4 mt-4"
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <View
                    className="flex-row items-center rounded-2xl px-4 py-3"
                    style={{ backgroundColor: ACCENT_TINT, columnGap: s(8) }}
                  >
                    <Ionicons name="help-circle-outline" size={s(20)} color={ACCENT} />
                    <Typography
                      variant="body-03"
                      className="flex-1"
                      style={{ color: COLORS.text.body.default }}
                    >
                      답하지 않은 문항이 있어요 — 채우면 더 정확해져요
                    </Typography>
                    <Typography variant="body-03" weight="semibold" style={{ color: ACCENT }}>
                      이어서
                    </Typography>
                  </View>
                </Pressable>
              ) : null}

              {/* 마지막 걸음 — 이 지원을 쓸 수 있는 센터 */}
              <View className="mx-4 mt-6 rounded-2xl bg-surface p-4">
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default }}
                >
                  이 지원을 쓸 수 있는 센터 찾기
                </Typography>
                <Typography
                  variant="body-02-reading"
                  className="mt-1"
                  style={{ color: COLORS.text.body.default }}
                >
                  {store.sido
                    ? `${store.sido} 주변 센터를 지도에서 보여드려요. 바우처 취급 여부는 센터에 확인해 주세요.`
                    : '주변 센터를 지도에서 보여드려요. 바우처 취급 여부는 센터에 확인해 주세요.'}
                </Typography>
                <Button
                  label="주변 센터 보기"
                  variant="outline"
                  className="mt-4"
                  onPress={goCenters}
                />
              </View>
            </>
          )}
        </ScrollView>
      ) : null}

      <BottomSheet visible={sidoSheet} onClose={() => setSidoSheet(false)} title="거주 지역">
        <View className="pb-2">
          {SIDO_OPTIONS.map((option) => {
            const selected = sido === option.label;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSido(option.label);
                  setSidoSheet(false);
                }}
                className="flex-row items-center py-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Typography
                  variant="body-01"
                  weight={selected ? 'semibold' : 'regular'}
                  className="flex-1"
                  style={{
                    color: selected ? COLORS.text.title.default : COLORS.text.body.default,
                  }}
                >
                  {option.label}
                </Typography>
                {selected ? (
                  <Ionicons name="checkmark" size={s(20)} color={ACCENT} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
