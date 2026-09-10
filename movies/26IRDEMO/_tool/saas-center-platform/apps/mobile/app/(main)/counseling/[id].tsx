import { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore, usePermission } from '@/features/center';
import {
  useCounselingCaseDetail,
  type CounselingCaseClient,
  type CounselingSessionDetail,
} from '@/features/counseling';
import {
  UnifiedBillingSheet,
  IssuedPaymentPrompt,
  useBillablesByRelated,
  resolveBillingState,
  type BillingActionState,
  type ClientCandidate,
  type IssuedBillable,
} from '@/features/billing';
import { GENDER_LABELS } from '@/features/client';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import {
  getInitial,
  getProfileColor,
} from '../(tabs)/_components/client-variants/helpers';

/** 진행도 바 색 — 디자인 시스템 외 지정값 (사용자 요청, 목록 카드와 동일) */
const ACCENT_BLUE = '#4486FF';
/** 진행도 컨테이너 배경 — 디자인 시스템 외 지정값 (사용자 요청) */
const PROGRESS_BG = '#F5F7F8';
/** 청구 버튼 배경 — mint @ 10% (#00C3BC + 1A), 디자인 시스템 외 지정값 (사용자 요청) */
const MINT_BG = '#00C3BC1A';

function formatSessionDate(value: string): string {
  try {
    return format(parseDate(value), 'yyyy년 M월 d일 (E)', { locale: ko });
  } catch {
    return value;
  }
}

/** hero 날짜 — 예: "6. 18 (수)" */
function formatHeroDate(value: string): string {
  try {
    return format(parseDate(value), 'M. d (E)', { locale: ko });
  } catch {
    return value;
  }
}

/** 시간 범위 — 예: "18:00-16:00" */
function formatTimeRange(start: string, end: string): string {
  try {
    return `${format(parseDate(start), 'HH:mm')}-${format(parseDate(end), 'HH:mm')}`;
  } catch {
    return '';
  }
}

export default function CounselingCaseDetailScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  // 청구는 권한 기반 노출 — read|write:billing 없으면 청구 UI 숨김 (counselor는 보통 own 보유)
  const { can } = usePermission();
  const canBilling = can('read:billing') || can('write:billing');
  // 통합 청구 시트 — 카드의 청구 버튼이 진입점. initialClientId로 step1(내담자 선택) 자동 skip
  const [billingTarget, setBillingTarget] = useState<{
    initialClientId: string;
  } | null>(null);
  const [issuedBillable, setIssuedBillable] = useState<IssuedBillable | null>(
    null,
  );

  const openSessionDetail = (session: CounselingSessionDetail) => {
    router.push({
      pathname: '/(main)/counseling/session/[id]',
      params: { id: session.session_id },
    });
  };

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useCounselingCaseDetail(centerId, caseId ?? null);

  const { data: caseBillables } = useBillablesByRelated({
    centerId: canBilling ? centerId : null,
    relatedType: ['counseling_session', 'counseling_case'],
    relatedCaseId: caseId ?? null,
  });

  const totalSessions = detail?.total_sessions ?? 0;
  // 진행 회기 = 열린 회기(완료+노쇼) — 노쇼도 소진(07-16 확정 정의). 완료만 세면 웹과 어긋난다
  const completedSessions = useMemo(
    () =>
      detail?.sessions.filter(
        (s) => s.status === 'completed' || s.status === 'no_show',
      ).length ?? 0,
    [detail],
  );
  const progress =
    totalSessions > 0 ? Math.min(completedSessions / totalSessions, 1) : 0;

  // hero 날짜/시간/장소용 대표 회기 — 다가오는 예정 회기 우선, 없으면 가장 최근 회기
  const heroSession = useMemo(() => {
    if (!detail?.sessions?.length) return null;
    const sorted = [...detail.sessions].sort(
      (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime(),
    );
    const now = Date.now();
    const upcoming = sorted.find(
      (s) => s.status === 'scheduled' && parseDate(s.start).getTime() >= now,
    );
    return upcoming ?? sorted.find((s) => s.status === 'scheduled') ?? sorted[sorted.length - 1];
  }, [detail]);

  const clientCompletedMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!detail?.sessions) return map;
    for (const session of detail.sessions) {
      for (const participant of session.clients) {
        if (participant.is_consumed) {
          map.set(
            participant.participant_id,
            (map.get(participant.participant_id) ?? 0) + 1,
          );
        }
      }
    }
    return map;
  }, [detail]);

  const pendingNoteSessions = useMemo(() => {
    if (!detail?.sessions) return [];
    return detail.sessions
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.clients.some((c) => !c.has_note),
      )
      .sort(
        (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime(),
      );
  }, [detail]);

  // 회기 리스트 표시 순서 — 히어로와 동일 기준:
  //   ① 미래 예정(다음 회기, 가까운 날짜 ↑)
  //   ② 과거인데 '예정'으로 남은 stale(완료 처리 누락 → 처리 필요)
  //   ③ 완료/취소/노쇼(정리된 과거, 최근 ↑)
  const sortedSessions = useMemo(() => {
    if (!detail?.sessions) return [];
    const now = Date.now();
    const ts = (s: CounselingSessionDetail) => parseDate(s.start).getTime();
    const futureScheduled: CounselingSessionDetail[] = [];
    const staleScheduled: CounselingSessionDetail[] = [];
    const resolved: CounselingSessionDetail[] = [];
    for (const s of detail.sessions) {
      if (s.status === 'scheduled') {
        (ts(s) >= now ? futureScheduled : staleScheduled).push(s);
      } else {
        resolved.push(s);
      }
    }
    futureScheduled.sort((a, b) => ts(a) - ts(b)); // 가까운 미래 먼저
    staleScheduled.sort((a, b) => ts(b) - ts(a)); // 최근 과거 먼저
    resolved.sort((a, b) => ts(b) - ts(a)); // 최근 먼저
    return [
      ...futureScheduled.map((s) => ({ session: s, isStale: false })),
      ...staleScheduled.map((s) => ({ session: s, isStale: true })),
      ...resolved.map((s) => ({ session: s, isStale: false })),
    ];
  }, [detail]);
  const firstPendingDate = pendingNoteSessions[0]
    ? formatSessionDate(pendingNoteSessions[0].start)
    : null;

  // hero 아바타 — 첫 내담자 기준
  const firstClient = detail?.clients[0];
  const heroProfile = getProfileColor(firstClient?.client_id ?? caseId ?? '');
  const heroInitial = getInitial(firstClient?.name ?? '상');
  const heroImageUrl = firstClient?.profile_image_url ?? null;
  const heroMeta = (() => {
    if (!firstClient || (detail?.clients.length ?? 0) !== 1) return null;
    const genderLabel = firstClient.gender
      ? GENDER_LABELS[firstClient.gender] ?? firstClient.gender
      : null;
    const age = firstClient.age ?? null;
    if (!genderLabel && age == null) return null;
    return { genderLabel, age };
  })();
  const heroDateTime = heroSession
    ? `${formatHeroDate(heroSession.start)} ${formatTimeRange(heroSession.start, heroSession.end)}`
    : null;
  const heroRoom = heroSession
    ? heroSession.room_name ?? detail?.room_name ?? null
    : null;

  const packageInfoFor = (clientId: string) => {
    const pkg = caseBillables?.find(
      (b) => b.is_package && b.client_id === clientId,
    );
    const hasSession =
      caseBillables?.some((b) => !b.is_package && b.client_id === clientId) ??
      false;
    return {
      state: resolveBillingState(pkg),
      billableId: pkg?.id,
      disabled: hasSession && !pkg,
    };
  };
  // UnifiedBillingSheet에 전달할 ClientCandidate[] — 내담자별 회기 + 청구 마킹
  const billingClients: ClientCandidate[] = useMemo(() => {
    if (!detail) return [];
    return detail.clients.map((c) => {
      const sessions = (detail.sessions ?? [])
        .filter((sess) =>
          sess.clients.some((p) => p.participant_id === c.client_id),
        )
        .map((sess) => {
          const billed =
            caseBillables?.some(
              (b) =>
                b.client_id === c.client_id &&
                b.related_session_ids.includes(sess.session_id),
            ) ?? false;
          return {
            id: sess.session_id,
            start: sess.start,
            end: sess.end,
            sessionNumber: 0,
            status: sess.status,
            billed,
          };
        });
      return {
        client: {
          id: c.client_id,
          name: c.name,
          gender: c.gender,
          age: c.age,
          profileImageUrl: c.profile_image_url,
          program: detail.program_name,
        },
        sessions,
      };
    });
  }, [detail, caseBillables]);

  const handleOpenBilling = (c: { client_id: string; name: string }) => {
    const candidate = billingClients.find((b) => b.client.id === c.client_id);
    const billableCount = candidate?.sessions.filter(
      (s) => !s.billed && s.status !== 'cancelled',
    ).length ?? 0;
    if (billableCount === 0) {
      Alert.alert('청구', '청구 가능한 회기가 없어요.');
      return;
    }
    setBillingTarget({ initialClientId: c.client_id });
  };

  // 1:1(개인) 상담은 내담자 카드가 없으므로 hero 하단에 청구 버튼을 둔다 (검사 hero와 동일).
  const heroBillingClient =
    detail && detail.clients.length === 1 ? detail.clients[0] : null;
  const heroBillingState: BillingActionState = heroBillingClient
    ? packageInfoFor(heroBillingClient.client_id).state
    : 'none';
  const heroBillingLabel =
    heroBillingState === 'pending'
      ? '청구 확인'
      : heroBillingState === 'completed'
        ? '청구 완료'
        : '청구하기';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      {/* 헤더 — back 버튼만 (타이틀 없음) */}
      <View
        className="h-[52px] flex-row items-center px-5"
        style={{ backgroundColor: COLORS.bg.base }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Typography variant="body-03" className="text-gray-400">
            불러오는 중...
          </Typography>
        </View>
      )}

      {isError && !isLoading && (
        <View className="flex-1 items-center justify-center gap-2 px-5">
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={COLORS.gray[300]}
          />
          <Typography variant="body-02" weight="semibold" className="text-gray-600">
            불러올 수 없습니다
          </Typography>
          <Typography variant="body-03" className="text-center text-gray-400">
            네트워크 연결을 확인하고 다시 시도해주세요.
          </Typography>
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.7}
            accessibilityLabel="다시 시도"
            accessibilityRole="button"
            className="mt-2 rounded-md bg-primary px-5 py-2"
          >
            <Typography variant="body-03" weight="semibold" className="text-white">
              다시 시도
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {detail && !isLoading && (
        <ScrollView
          // 배경 흰색 → 하단 바운스 흰색. 상단 바운스는 아래 회색 View로 덮음.
          style={{ backgroundColor: COLORS.white }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* 상단 바운스 시 회색 유지 — 콘텐츠 위로 확장된 회색 배경 */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -600,
              left: 0,
              right: 0,
              height: 600,
              backgroundColor: COLORS.bg.base,
            }}
          />
          {/* ────────── 상단 Gray Zone (alert + hero card) ────────── */}
          <View
            style={{
              backgroundColor: COLORS.bg.base,
              paddingTop: s(24),
              paddingBottom: s(32),
            }}
          >
            {/* 일지 미작성 alert — primary solid 배경으로 강조 */}
            {pendingNoteSessions.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openSessionDetail(pendingNoteSessions[0])}
                accessibilityLabel={`작성해야 할 일지 ${pendingNoteSessions.length}건`}
                accessibilityRole="button"
                style={{
                  marginHorizontal: s(20),
                  marginBottom: s(16),
                  backgroundColor: COLORS.primary,
                  borderRadius: s(20),
                  paddingHorizontal: s(20),
                  paddingVertical: s(18),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(14),
                }}
              >
                <Icon name="non-write-note" size={34} />
                <View style={{ flex: 1, gap: s(2) }}>
                  {firstPendingDate && (
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {firstPendingDate}
                      {pendingNoteSessions.length > 1
                        ? ` 외 ${pendingNoteSessions.length - 1}건`
                        : ''}
                    </Typography>
                  )}
                  <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
                    작성하지 않은 상담일지가 있어요!
                  </Typography>
                </View>
              </TouchableOpacity>
            )}

            {/* Hero — 아바타 + 정보 + 진행도 (목록 카드 톤) */}
            <View
              style={{
                marginHorizontal: s(20),
                backgroundColor: COLORS.white,
                borderRadius: s(20),
                padding: s(20),
                gap: s(18),
              }}
            >
              {/* 케이스 코드(최상단 caption) + 상단(아바타 + 정보) */}
              <View style={{ gap: s(4) }}>
                {detail.case_code && (
                  <Typography
                    variant="label-01"
                    weight="regular"
                    numberOfLines={1}
                    style={{ color: COLORS.gray[500] }}
                  >
                    {detail.case_code}
                  </Typography>
                )}
                {/* 상단: 아바타(프로필 이미지 → 이니셜 폴백) + 정보 */}
                <View style={{ flexDirection: 'row', gap: s(14), alignItems: 'center' }}>
                {heroImageUrl ? (
                  <Image
                    source={{ uri: heroImageUrl }}
                    style={{
                      width: s(52),
                      height: s(52),
                      borderRadius: s(26),
                      backgroundColor: heroProfile.bg,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: s(52),
                      height: s(52),
                      borderRadius: s(26),
                      backgroundColor: heroProfile.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="title-01" weight="semibold" style={{ color: heroProfile.fg }}>
                      {heroInitial}
                    </Typography>
                  </View>
                )}
                <View style={{ flex: 1, gap: s(4), justifyContent: 'center' }}>
                  <View className="flex-row items-center" style={{ gap: s(6) }}>
                    <Typography
                      variant="title-01"
                      weight="semibold"
                      numberOfLines={1}
                      style={{ flexShrink: 1, color: COLORS.gray.black }}
                    >
                      {detail.clients.length > 0
                        ? detail.clients.length === 1
                          ? detail.clients[0].name
                          : `${detail.clients[0].name} 외 ${detail.clients.length - 1}명`
                        : '상담'}
                    </Typography>
                    {heroMeta && (
                      <GenderAgeMeta
                        genderLabel={heroMeta.genderLabel}
                        age={heroMeta.age}
                        size="lg"
                      />
                    )}
                  </View>
                  <Typography
                    variant="body-02"
                    weight="medium"
                    numberOfLines={1}
                    style={{ color: COLORS.gray.black }}
                  >
                    {detail.program_name || '-'}
                  </Typography>
                  {heroDateTime && (
                    <View className="flex-row items-center">
                      <Typography
                        variant="body-02"
                        weight="regular"
                        numberOfLines={1}
                        style={{ flexShrink: 1, color: COLORS.gray[600] }}
                      >
                        {heroDateTime}
                      </Typography>
                      {heroRoom && (
                        <>
                          <View
                            style={{
                              width: 1,
                              height: s(10),
                              backgroundColor: COLORS.gray[200],
                              marginHorizontal: s(8),
                            }}
                          />
                          <Typography
                            variant="body-02"
                            weight="regular"
                            numberOfLines={1}
                            style={{ flexShrink: 1, color: COLORS.gray[600] }}
                          >
                            {heroRoom}
                          </Typography>
                        </>
                      )}
                    </View>
                  )}
                </View>
                </View>
              </View>

              {/* 진행도 — sunken 컨테이너 */}
              <View
                style={{
                  backgroundColor: PROGRESS_BG,
                  borderRadius: s(12),
                  paddingHorizontal: s(16),
                  paddingVertical: s(12),
                  gap: s(10),
                }}
              >
                <View className="flex-row items-center" style={{ gap: s(4) }}>
                  <Typography variant="body-03" weight="semibold" style={{ color: COLORS.gray[900] }}>
                    {completedSessions}/{totalSessions}
                  </Typography>
                  <Typography
                    variant="body-03"
                    weight="medium"
                    style={{ flex: 1, color: COLORS.gray[500] }}
                  >
                    회기 진행했어요
                  </Typography>
                  <Icon name="green-flag-20" size={s(20)} />
                </View>
                <View
                  style={{
                    height: s(6),
                    borderRadius: s(3),
                    backgroundColor: COLORS.gray[200],
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${progress * 100}%`,
                      height: '100%',
                      backgroundColor: ACCENT_BLUE,
                      borderRadius: s(3),
                    }}
                  />
                </View>
              </View>

              {/* 청구하기 — 1:1은 hero 카드 하단 (그룹은 내담자 카드). 검사 hero와 동일 디자인 */}
              {heroBillingClient && canBilling && (
                <TouchableOpacity
                  onPress={() =>
                    handleOpenBilling({
                      client_id: heroBillingClient.client_id,
                      name: heroBillingClient.name,
                    })
                  }
                  activeOpacity={0.7}
                  style={{
                    width: '100%',
                    height: s(44),
                    backgroundColor: MINT_BG,
                    borderRadius: s(10),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: s(4),
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={heroBillingLabel}
                >
                  <Icon
                    name={
                      heroBillingState === 'completed'
                        ? 'green-check-16'
                        : 'mint-charge-16'
                    }
                    size={16}
                  />
                  <Typography
                    variant="body-03"
                    weight="medium"
                    style={{ color: COLORS.gray[600] }}
                  >
                    {heroBillingLabel}
                  </Typography>
                </TouchableOpacity>
              )}
            </View>

            {/* 내담자 — 그룹 회기에서만 노출 (1:1은 hero 카드로 통합) */}
            {detail.clients.length > 1 && (
            <View style={{ marginTop: s(20) }}>
              <View
                className="flex-row items-center"
                style={{
                  marginBottom: s(12),
                  paddingHorizontal: s(20),
                  gap: s(6),
                }}
              >
                <Icon name="people-20" size={20} color={COLORS.gray[400]} />
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.gray[600] }}
                >
                  {detail.clients.length}명의 내담자가 참여중이에요
                </Typography>
              </View>
              {detail.clients.length === 0 ? (
                <Typography
                  variant="body-03"
                  className="text-gray-400"
                  style={{ paddingHorizontal: s(20) }}
                >
                  등록된 내담자가 없습니다.
                </Typography>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: s(20),
                    gap: s(10),
                  }}
                >
                  {detail.clients.map((client) => (
                    <ClientCard
                      key={client.client_id}
                      client={client}
                      completed={clientCompletedMap.get(client.client_id) ?? 0}
                      total={totalSessions}
                      showBilling={canBilling}
                      billingState={packageInfoFor(client.client_id).state}
                      onPressBilling={() =>
                        handleOpenBilling({
                          client_id: client.client_id,
                          name: client.name,
                        })
                      }
                      onPress={() =>
                        router.push(`/(main)/client/${client.client_id}`)
                      }
                    />
                  ))}
                </ScrollView>
              )}
            </View>
            )}
          </View>

          {/* ────────── 하단 White Zone (회기 리스트) ────────── */}
          <View
            style={{
              flexGrow: 1,
              backgroundColor: COLORS.white,
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              paddingTop: s(24),
              paddingBottom: s(32),
              paddingHorizontal: s(20),
            }}
          >
            {/* 회기 */}
            <View
              className="flex-row items-baseline"
              style={{ gap: s(6), marginBottom: s(4) }}
            >
              <Typography variant="title-01" weight="semibold" className="text-gray-900">
                회기
              </Typography>
              <Typography variant="label-01" style={{ color: COLORS.text.label.default }}>
                {detail.sessions.length}
              </Typography>
            </View>
            <View>
              {sortedSessions.map(({ session, isStale }, idx) => (
                <View key={session.session_id}>
                  <SessionRow
                    session={session}
                    isStale={isStale}
                    onPress={() => openSessionDetail(session)}
                  />
                  {idx < sortedSessions.length - 1 && (
                    <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />
                  )}
                </View>
              ))}
              {sortedSessions.length === 0 && (
                <Typography variant="body-03" className="py-3 text-gray-400">
                  등록된 회기가 없습니다.
                </Typography>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 통합 청구 시트 — 내담자 카드 "청구" 버튼 진입. 회기 선택 + 발행 한 곳에서 처리 */}
      <UnifiedBillingSheet
        visible={billingTarget !== null}
        onClose={() => setBillingTarget(null)}
        centerId={centerId}
        caseId={caseId ?? ''}
        caseType="counseling"
        clients={billingClients}
        initialClientId={billingTarget?.initialClientId}
        onIssued={setIssuedBillable}
      />

      <IssuedPaymentPrompt
        issued={issuedBillable}
        centerId={centerId}
        onDone={() => setIssuedBillable(null)}
      />
    </SafeAreaView>
  );
}

// ---------- 내부 컴포넌트 ----------

/**
 * 내담자 카드 — 152×178, 28pt 아바타 + 이름·성별·나이·진행 회기 + 하단 패키지 액션.
 * 가로 스크롤. 스펙 §3-2: 이름·성별·나이·진행 회기.
 */
function ClientCard({
  client,
  completed,
  total,
  showBilling,
  billingState,
  onPressBilling,
  onPress,
}: {
  client: CounselingCaseClient;
  completed: number;
  total: number;
  showBilling: boolean;
  billingState: BillingActionState;
  onPressBilling: () => void;
  onPress: () => void;
}) {
  const pkg = {
    none: { label: '청구', color: COLORS.primary },
    pending: { label: '청구 확인', color: COLORS.warning },
    completed: { label: '청구 완료', color: COLORS.success },
  }[billingState];
  const genderLabel = client.gender
    ? GENDER_LABELS[client.gender] ?? client.gender
    : null;
  const age = client.age;

  const profileColor = getProfileColor(client.client_id);
  const initial = getInitial(client.name);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityLabel={`${client.name} 내담자 상세`}
      accessibilityRole="button"
      style={{
        width: s(152),
        // 청구 버튼이 있을 때만 고정 높이(178). 없으면 콘텐츠에 맞게 줄여 빈 영역 제거.
        height: showBilling ? s(178) : undefined,
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingVertical: s(16),
        paddingHorizontal: s(10),
        alignItems: 'center',
        gap: s(8),
      }}
    >
      {client.profile_image_url ? (
        <Image
          source={{ uri: client.profile_image_url }}
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: profileColor.bg,
          }}
        />
      ) : (
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: profileColor.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: profileColor.fg }}
          >
            {initial}
          </Typography>
        </View>
      )}

      <View style={{ alignItems: 'center', gap: s(2) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {client.name}
        </Typography>
        {(genderLabel || age != null) && (
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            {genderLabel && (
              <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[600] }}>
                {genderLabel}
              </Typography>
            )}
            {genderLabel && age != null && (
              <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }} />
            )}
            {age != null && (
              <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[600] }}>
                {`만 ${age}세`}
              </Typography>
            )}
          </View>
        )}
        <Typography
          variant="label-01"
          weight="regular"
          numberOfLines={1}
          style={{ marginTop: s(2), color: COLORS.gray[500] }}
        >
          {completed}/{total}회
        </Typography>
      </View>

      {showBilling && (
        <TouchableOpacity
          onPress={onPressBilling}
          activeOpacity={0.7}
          accessibilityLabel={pkg.label}
          accessibilityRole="button"
          style={{
            width: '100%',
            height: s(36),
            backgroundColor: MINT_BG,
            borderRadius: s(10),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(4),
            marginTop: s(4),
          }}
        >
          <Icon
            name={billingState === 'completed' ? 'green-check-16' : 'mint-charge-16'}
            size={16}
          />
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            {pkg.label}
          </Typography>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function SessionRow({
  session,
  isStale = false,
  onPress,
}: {
  session: CounselingSessionDetail;
  /** 과거인데 '예정'으로 남은 회기 — 완료 처리 확인용 상시 말풍선 노출 */
  isStale?: boolean;
  onPress: () => void;
}) {
  const dateLabel = formatSessionDate(session.start);
  const timeLabel = formatTimeRange(session.start, session.end);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={
        isStale ? `${dateLabel} 회기 · 완료 확인 필요` : `${dateLabel} 회기 상세`
      }
      accessibilityRole="button"
      style={{ paddingVertical: s(16) }}
    >
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {dateLabel}
          </Typography>
          {timeLabel.length > 0 && (
            <Typography variant="body-03" style={{ color: COLORS.gray[500] }} numberOfLines={1}>
              {timeLabel}
            </Typography>
          )}
        </View>
        <View className="flex-row items-center" style={{ gap: s(4) }}>
          <SessionStatusBadge status={session.status} />
          <Icon name="arrow-right-with-left-empty-20" size={s(20)} />
        </View>
      </View>

      {/* stale 회기 — 플로팅 툴팁(일정 메뉴 카운트다운 툴팁과 동일 디자인).
          영역 차지 없이 '예정' 뱃지 위에 떠서 아래 캐럿으로 가리킴.
          pointerEvents none → 탭은 아래 행으로 통과(상태 시트로 이동) */}
      {isStale && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -s(6),
            right: s(20),
            backgroundColor: COLORS.gray[900],
            paddingHorizontal: s(10),
            paddingVertical: s(5),
            borderRadius: s(8),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            elevation: 4,
            zIndex: 10,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.white }}
            numberOfLines={1}
          >
            회기가 완료됐나요?
          </Typography>
          {/* 아래쪽 캐럿 — '예정' 뱃지를 가리킴 */}
          <View
            style={{
              position: 'absolute',
              bottom: -s(4),
              right: s(16),
              width: 0,
              height: 0,
              borderLeftWidth: s(5),
              borderRightWidth: s(5),
              borderTopWidth: s(5),
              borderStyle: 'solid',
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: COLORS.gray[900],
            }}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const palette =
    status === 'completed'
      ? { color: COLORS.tag.green.fg, bg: COLORS.tag.green.bg, label: '완료' }
      : status === 'cancelled'
        ? { color: COLORS.tag.red.fg, bg: COLORS.tag.red.bg, label: '취소' }
        : status === 'no_show'
          ? { color: COLORS.tag.orange.fg, bg: COLORS.tag.orange.bg, label: '노쇼' }
          : { color: COLORS.tag.gray.fg, bg: COLORS.tag.gray.bg, label: '예정' };
  return (
    <BadgeRound bg={palette.bg} color={palette.color}>
      {palette.label}
    </BadgeRound>
  );
}
