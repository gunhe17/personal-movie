import { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import {
  useCounselingCaseDetail,
  type CounselingCaseClient,
  type CounselingSessionDetail,
} from '@/features/counseling';
import { SessionDetailSheet } from '@/features/counseling/session';
import { CounselingNoteSheet } from '@/features/counseling/note';
import {
  SessionBillingSheet,
  BillableDetailSheet,
  PackageBillingSheet,
  useBillablesByRelated,
  resolveBillingState,
  type BillingActionState,
} from '@/features/billing';
import { GENDER_LABELS } from '@/features/client';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import {
  getInitial,
  getProfileColor,
} from '../(tabs)/_components/client-variants/helpers';

/**
 * [백업] integrated 디자인 적용 직전 main 상담 상세 (gray top / white bottom 2-zone, 44 ClientCard grid)의 snapshot.
 * 코드 보존용 — 실험실 진입 시 `?id=<case_id>` 검색 파라미터를 넘기면 실데이터로 동작 가능.
 */

const PRIMARY_BG = 'rgba(19, 189, 250, 0.12)';

type SessionStatusKey = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

const SESSION_STATUS_LABELS: Record<SessionStatusKey, string> = {
  scheduled: '예정',
  completed: '완료',
  no_show: '노쇼',
  cancelled: '취소',
};

function getSessionStatusPalette(status: string) {
  if (status === 'completed') {
    return { color: COLORS.primary, bg: PRIMARY_BG };
  }
  if (status === 'cancelled') {
    return { color: COLORS.palette.red, bg: COLORS.paletteBg.red };
  }
  return { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

function formatSessionDateTime(value: string): string {
  try {
    return format(parseDate(value), 'yyyy-MM-dd (E) HH:mm', { locale: ko });
  } catch {
    return value;
  }
}

export default function CounselingCaseDetailCurrentBackupLab() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const [selectedSession, setSelectedSession] =
    useState<CounselingSessionDetail | null>(null);
  const [noteSheetTarget, setNoteSheetTarget] = useState<{
    sessionId: string;
    sessionStart: string;
    clientId: string;
    clientName: string;
  } | null>(null);
  const [billingTarget, setBillingTarget] = useState<{
    sessionId: string;
    client: { id: string; name: string };
  } | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ billableId: string } | null>(
    null,
  );
  const [packageTarget, setPackageTarget] = useState<{
    client: { id: string; name: string };
    sessionIds: string[];
  } | null>(null);

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useCounselingCaseDetail(centerId, caseId ?? null);

  const { data: caseBillables } = useBillablesByRelated({
    centerId,
    relatedType: ['counseling_session', 'counseling_case'],
    relatedCaseId: caseId ?? null,
  });

  const totalSessions = detail?.total_sessions ?? 0;
  const completedSessions = useMemo(
    () => detail?.sessions.filter((s) => s.status === 'completed').length ?? 0,
    [detail],
  );
  const progress =
    totalSessions > 0 ? Math.min(completedSessions / totalSessions, 1) : 0;

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

  const caseStatusLabel =
    detail?.status === 'completed'
      ? '완료'
      : detail?.status === 'cancelled'
        ? '취소'
        : '진행중';
  const caseStatusPalette =
    detail?.status === 'completed'
      ? { color: COLORS.primary, bg: PRIMARY_BG }
      : detail?.status === 'cancelled'
        ? { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray }
        : { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange };

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
  const sessionIdsFor = (clientId: string) =>
    (detail?.sessions ?? [])
      .filter(
        (sess) =>
          sess.status !== 'cancelled' &&
          sess.clients.some((c) => c.participant_id === clientId),
      )
      .map((sess) => sess.session_id);
  const handleOpenPackage = (c: { client_id: string; name: string }) => {
    const info = packageInfoFor(c.client_id);
    if (info.state !== 'none') {
      if (info.billableId) setDetailTarget({ billableId: info.billableId });
      return;
    }
    if (info.disabled) {
      Alert.alert(
        '패키지 선결제',
        '이미 개별 청구가 있어 패키지 선결제를 진행할 수 없어요.',
      );
      return;
    }
    const sessionIds = sessionIdsFor(c.client_id);
    if (sessionIds.length === 0) {
      Alert.alert('패키지 선결제', '청구할 회기가 없어요.');
      return;
    }
    setPackageTarget({
      client: { id: c.client_id, name: c.name },
      sessionIds,
    });
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
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
        <Typography
          variant="title-01"
          weight="semibold"
          className="flex-1 text-gray-900"
          style={{ marginLeft: s(6) }}
          numberOfLines={1}
        >
          {detail?.program_name || '상담'}
        </Typography>
      </View>

      {!caseId && (
        <View className="flex-1 items-center justify-center gap-2 px-5">
          <Typography variant="body-02" weight="semibold" className="text-gray-600">
            backup snapshot
          </Typography>
          <Typography variant="body-03" className="text-center text-gray-400">
            {'?id=<case_id> 파라미터로 실데이터 확인 가능'}
          </Typography>
        </View>
      )}

      {caseId && isLoading && (
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Typography variant="body-03" className="text-gray-400">
            불러오는 중...
          </Typography>
        </View>
      )}

      {caseId && isError && !isLoading && (
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
          style={{ backgroundColor: COLORS.white }}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View
            style={{
              backgroundColor: COLORS.bg.base,
              paddingTop: s(12),
              paddingBottom: s(24),
            }}
          >
            {pendingNoteSessions.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedSession(pendingNoteSessions[0])}
                accessibilityLabel={`미작성 일지 ${pendingNoteSessions.length}건`}
                accessibilityRole="button"
                style={{
                  marginHorizontal: s(20),
                  marginBottom: s(12),
                  backgroundColor: COLORS.paletteBg.yellow,
                  borderRadius: s(12),
                  paddingHorizontal: s(14),
                  paddingVertical: s(10),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(8),
                }}
              >
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.palette.yellow }}
                >
                  미작성 일지 {pendingNoteSessions.length}건
                </Typography>
                <Typography variant="label-01" className="text-gray-400">
                  ·
                </Typography>
                <Typography variant="label-01" className="text-gray-700">
                  가장 오래된 회기부터 작성하기
                </Typography>
                <View style={{ marginLeft: 'auto' }}>
                  <Icon name="arrow-right" size={14} color={COLORS.gray[500]} />
                </View>
              </TouchableOpacity>
            )}

            <View
              style={{
                marginHorizontal: s(20),
                backgroundColor: COLORS.white,
                borderRadius: s(16),
                padding: s(16),
              }}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Typography
                    variant="headline-02"
                    weight="semibold"
                    className="text-gray-900"
                  >
                    {detail.program_name || '-'}
                  </Typography>
                </View>
                <View
                  style={{ backgroundColor: caseStatusPalette.bg }}
                  className="rounded-full px-2.5 py-1"
                >
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: caseStatusPalette.color }}
                  >
                    {caseStatusLabel}
                  </Typography>
                </View>
              </View>

              <View style={{ marginTop: s(16) }}>
                <View
                  className="flex-row items-center justify-between"
                  style={{ marginBottom: s(8) }}
                >
                  <Typography
                    variant="label-01"
                    weight="medium"
                    className="text-gray-500"
                  >
                    회기 진행
                  </Typography>
                  <Typography
                    variant="label-01"
                    weight="semibold"
                    className="text-gray-900"
                  >
                    {completedSessions}/{totalSessions}
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
                      backgroundColor: COLORS.palette.green,
                    }}
                  />
                </View>
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.white,
              paddingTop: s(24),
              paddingBottom: s(24),
            }}
          >
          <View className="px-5">
            <View
              className="mb-3 flex-row items-baseline"
              style={{ gap: s(6) }}
            >
              <Typography
                variant="body-02"
                weight="bold"
                className="text-gray-900"
              >
                내담자
              </Typography>
              <Typography variant="label-01" className="text-gray-500">
                {detail.clients.length}명
              </Typography>
            </View>
            {detail.clients.length === 0 ? (
              <Typography variant="body-03" className="px-4 py-3 text-gray-400">
                등록된 내담자가 없습니다.
              </Typography>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: s(10),
                }}
              >
                {detail.clients.map((client) => (
                  <ClientCard
                    key={client.client_id}
                    client={client}
                    completed={clientCompletedMap.get(client.client_id) ?? 0}
                    total={totalSessions}
                    packageState={packageInfoFor(client.client_id).state}
                    onPressPackage={() =>
                      handleOpenPackage({
                        client_id: client.client_id,
                        name: client.name,
                      })
                    }
                    onPress={() =>
                      router.push(`/(main)/client/${client.client_id}`)
                    }
                  />
                ))}
              </View>
            )}
          </View>

          <View className="mt-6 px-5">
            <Typography
              variant="body-02"
              weight="bold"
              className="mb-2 text-gray-900"
            >
              회기
            </Typography>
            <View className="gap-2">
              {detail.sessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  onPress={() => setSelectedSession(session)}
                />
              ))}
              {detail.sessions.length === 0 && (
                <Typography variant="body-03" className="px-4 py-3 text-gray-400">
                  등록된 회기가 없습니다.
                </Typography>
              )}
            </View>
          </View>
          </View>
        </ScrollView>
      )}

      {selectedSession && (
        <SessionDetailSheet
          visible={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          centerId={centerId}
          sessionId={selectedSession.session_id}
          sessionStart={selectedSession.start}
          sessionEnd={selectedSession.end}
          roomName={selectedSession.room_name}
          programName={detail?.program_name ?? ''}
          counselorNames={
            detail?.counselors.map((c) => c.counselor_name).filter(Boolean) ?? []
          }
          onOpenNote={({ clientId, name }) => {
            if (!selectedSession) return;
            setNoteSheetTarget({
              sessionId: selectedSession.session_id,
              sessionStart: selectedSession.start,
              clientId,
              clientName: name,
            });
          }}
          caseId={caseId ?? ''}
          onOpenBilling={({ clientId, clientName, billableId, state }) => {
            if (state === 'none') {
              if (!selectedSession) return;
              setBillingTarget({
                sessionId: selectedSession.session_id,
                client: { id: clientId, name: clientName },
              });
            } else if (billableId) {
              setDetailTarget({ billableId });
            }
          }}
        />
      )}

      <SessionBillingSheet
        visible={billingTarget !== null}
        onClose={() => setBillingTarget(null)}
        centerId={centerId}
        client={billingTarget?.client ?? null}
        caseType="counseling"
        caseId={caseId ?? ''}
        relatedType="counseling_session"
        relatedCaseId={caseId ?? ''}
        relatedSessionId={billingTarget?.sessionId}
      />

      <BillableDetailSheet
        visible={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        centerId={centerId}
        billableId={detailTarget?.billableId ?? null}
      />

      <PackageBillingSheet
        visible={packageTarget !== null}
        onClose={() => setPackageTarget(null)}
        centerId={centerId}
        client={packageTarget?.client ?? null}
        caseId={caseId ?? ''}
        caseType="counseling"
        relatedType="counseling_case"
        sessionIds={packageTarget?.sessionIds ?? []}
      />

      <CounselingNoteSheet
        visible={noteSheetTarget !== null}
        onClose={() => setNoteSheetTarget(null)}
        centerId={centerId}
        sessionId={noteSheetTarget?.sessionId ?? null}
        clientId={noteSheetTarget?.clientId ?? null}
        clientName={noteSheetTarget?.clientName}
        sessionStart={noteSheetTarget?.sessionStart}
      />
    </SafeAreaView>
  );
}

function ClientCard({
  client,
  completed,
  total,
  packageState,
  onPressPackage,
  onPress,
}: {
  client: CounselingCaseClient;
  completed: number;
  total: number;
  packageState: BillingActionState;
  onPressPackage: () => void;
  onPress: () => void;
}) {
  const pkg = {
    none: { label: '선결제', color: COLORS.primary },
    pending: { label: '선결제 확인', color: COLORS.warning },
    completed: { label: '선결제 완료', color: COLORS.success },
  }[packageState];
  const genderLabel = client.gender
    ? GENDER_LABELS[client.gender] ?? client.gender
    : null;
  const age = client.age;
  const initial = getInitial(client.name);
  const profileColor = getProfileColor(client.client_id);
  const metaText = [genderLabel, age != null ? `만 ${age}세` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityLabel={`${client.name} 내담자 상세`}
      accessibilityRole="button"
      style={{
        width: '31%',
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(14),
        paddingHorizontal: s(8),
        alignItems: 'center',
        gap: s(8),
      }}
    >
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: profileColor.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: profileColor.fg }}
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
          {client.name}
        </Typography>
        {metaText.length > 0 && (
          <Typography
            variant="label-02"
            className="text-gray-500"
            numberOfLines={1}
          >
            {metaText}
          </Typography>
        )}
        <Typography
          variant="label-02"
          weight="medium"
          className="text-gray-700"
          numberOfLines={1}
          style={{ marginTop: s(2) }}
        >
          {completed}/{total}회
        </Typography>
      </View>

      <View
        style={{
          width: '100%',
          borderTopWidth: 1,
          borderColor: COLORS.gray[200],
          marginTop: s(2),
          paddingTop: s(8),
        }}
      >
        <TouchableOpacity
          onPress={onPressPackage}
          activeOpacity={0.7}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          accessibilityLabel={`패키지 ${pkg.label}`}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(2),
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: pkg.color }}
          >
            {pkg.label}
          </Typography>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function SessionCard({
  session,
  onPress,
}: {
  session: CounselingSessionDetail;
  onPress: () => void;
}) {
  const dateTime = formatSessionDateTime(session.start);
  const counselorNames = session.counselors
    .map((c) => c.counselor_name)
    .filter(Boolean);
  const subParts = [counselorNames.join(', '), session.room_name].filter(Boolean);
  const statusLabel =
    SESSION_STATUS_LABELS[session.status as SessionStatusKey] ?? session.status;
  const palette = getSessionStatusPalette(session.status);
  const isCancelled = session.status === 'cancelled';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityLabel={`${dateTime} 회기 상세`}
      accessibilityRole="button"
      className="flex-row items-center rounded-2xl bg-gray-50 px-4 py-3.5"
    >
      <View className="flex-1">
        <Typography
          variant="body-02"
          weight="semibold"
          className={isCancelled ? 'text-gray-400' : 'text-gray-900'}
        >
          {dateTime}
        </Typography>
        {subParts.length > 0 && (
          <Typography
            variant="label-01"
            className={isCancelled ? 'mt-1 text-gray-400' : 'mt-1 text-gray-500'}
          >
            {subParts.join(' | ')}
          </Typography>
        )}
      </View>
      <View
        style={{ backgroundColor: palette.bg }}
        className="mr-2 rounded-full px-2.5 py-1"
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: palette.color }}
        >
          {statusLabel}
        </Typography>
      </View>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}
