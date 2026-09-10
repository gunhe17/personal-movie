import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Pressable,
  Linking,
  Image,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore, usePermission } from '@/features/center';
import {
  useClientDetail,
  useClientCases,
  useCounselingCases,
  useToggleFavorite,
  useClientSignals,
  useClientFormInstances,
  useClientDocuments,
  useClientRelations,
  type ClientSignal,
  type RelationInfo,
} from '@/features/client';
import { CounselingNoteSheet } from '@/features/counseling/note';
import { BillableDetailSheet, ClientBillingSheet } from '@/features/billing';
import { formatKstDate, parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { Badge } from '@/shared/components/ui/Badge';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon, type IconName } from '@/shared/components/icons';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';
import { ClientDetailSkeleton } from './_components/DetailSkeleton';
import {
  getInitial,
  getProfileColor,
} from '../../(tabs)/_components/client-variants/helpers';

// 카드 그림자 — Figma: X0 Y-1 / blur 15.8 / #000000 6%
const CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 1,
} as const;

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatPhone(phone: string): string {
  const d = phone.replace(/[^\d]/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return phone;
}

/** 오늘 기준 남은 일수 (음수면 과거) */
function diffInDays(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 다음 상담까지 남은 일수 → 말풍선용 단어 */
function daysUntilWord(diff: number): string {
  if (diff === 0) return '오늘';
  if (diff === 1) return '하루';
  if (diff === 2) return '이틀';
  if (diff === 3) return '사흘';
  return `${diff}일`;
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const centerId = useCenterStore((store) => store.centerId);

  const { data: client, isLoading, isError, refetch } = useClientDetail(centerId, id!);
  const { data: assessmentCases } = useClientCases(centerId, id!);
  const { data: counselingCases } = useCounselingCases(centerId, id!, client?.name ?? null);
  const { can } = usePermission();
  const canBilling = can('read:billing') || can('write:billing');
  const { data: signalsData } = useClientSignals(centerId, id!);
  const allSignals = signalsData?.items ?? [];
  const signals = canBilling
    ? allSignals
    : allSignals.filter((sig) => sig.type !== 'billing_unpaid');

  // 신호 퀵 액션 — 일지 시트 즉시 노출용 state
  const [noteSheetTarget, setNoteSheetTarget] = useState<{
    sessionId: string;
    sessionStart: string | undefined;
  } | null>(null);
  // 미수 안전망 — 미수 청구 목록/상세 시트
  const [billingListOpen, setBillingListOpen] = useState(false);
  const [billingDetailId, setBillingDetailId] = useState<string | null>(null);
  const toggleFavorite = useToggleFavorite(centerId);
  const isFavorited = client?.is_favorited ?? false;
  const handleToggleFavorite = () => {
    if (!id || toggleFavorite.isPending) return;
    toggleFavorite.mutate({ clientId: id, next: !isFavorited });
  };

  const age = useMemo(() => (client ? calculateAge(client.birth_date) : null), [client]);

  const counselingList = counselingCases ?? [];
  const assessmentList = assessmentCases ?? [];

  // 보호자 관계 — 스펙 §3-3: 아동 내담자의 실제 연락 대상은 보호자 (D3)
  const { data: relations } = useClientRelations(centerId, id!);
  const guardians = useMemo(
    () => (relations ?? []).filter((rel) => rel.relationType === 'guardian'),
    [relations],
  );

  // 문서 = 사전기록지(form_instance) + 업로드 문서 합산
  const { data: formInstances } = useClientFormInstances(centerId, id!);
  const { data: documents } = useClientDocuments(centerId, id!);
  const documentCount = (formInstances?.total ?? 0) + (documents?.total ?? 0);

  // 진입 카드 탭 — 1건이면 바로 케이스 상세, 2건+면 리스트 페이지로.
  const handleCounselingPress = () => {
    if (counselingList.length === 0) return;
    if (counselingList.length === 1) {
      router.push(`/(main)/counseling/${counselingList[0].case_id}`);
      return;
    }
    router.push(`/(main)/client/${id}/cases?type=counseling`);
  };
  const handleAssessmentPress = () => {
    if (assessmentList.length === 0) return;
    if (assessmentList.length === 1) {
      router.push(`/(main)/assessment/${assessmentList[0].case_id}`);
      return;
    }
    router.push(`/(main)/client/${id}/cases?type=assessment`);
  };
  const handleDocumentsPress = () => {
    router.push(`/(main)/client/${id}/documents`);
  };

  /**
   * 신호 카드 탭 = 진짜 퀵 액션.
   * 신호 응답에 target_id가 있으면 적절한 시트/페이지를 즉시 노출.
   * target이 없는 경우(legacy)만 카테고리 진입으로 폴백.
   */
  const handleSignalAction = (signal: ClientSignal) => {
    switch (signal.type) {
      case 'session_today':
      case 'log_missing':
        if (signal.session_id) {
          setNoteSheetTarget({
            sessionId: signal.session_id,
            sessionStart: signal.session_start ?? undefined,
          });
        } else {
          handleCounselingPress();
        }
        return;
      case 'assessment_result_ready':
        if (signal.assessment_case_id) {
          router.push(`/(main)/assessment/${signal.assessment_case_id}`);
        } else {
          handleAssessmentPress();
        }
        return;
      case 'billing_unpaid':
        setBillingListOpen(true);
        return;
      default:
        return;
    }
  };

  // 가장 가까운 다음 회기 (말풍선·기록 D-day 공용)
  const nextCounselingDays = useMemo(() => {
    const upcoming = counselingList
      .filter((c) => c.next_session_start)
      .map((c) => parseDate(c.next_session_start!))
      .filter((d) => d.getTime() > Date.now())
      .sort((a, b) => a.getTime() - b.getTime());
    return upcoming[0] ? diffInDays(upcoming[0]) : null;
  }, [counselingList]);

  // 빠른 로딩에선 스켈레톤을 띄우지 않음(깜빡임 방지)
  const showSkeleton = useDelayedSkeleton(isLoading);

  if (isLoading || showSkeleton) {
    return (
      <ScreenGradient>
        <SafeAreaView className="flex-1" edges={['top']}>
          <Header
            onBack={() => router.back()}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
          />
          {showSkeleton ? <ClientDetailSkeleton /> : null}
        </SafeAreaView>
      </ScreenGradient>
    );
  }

  if (isError || !client) {
    return (
      <ScreenGradient>
        <SafeAreaView className="flex-1" edges={['top']}>
          <Header
            onBack={() => router.back()}
            isFavorited={isFavorited}
            onToggleFavorite={handleToggleFavorite}
          />
          <View className="flex-1 items-center justify-center" style={{ gap: s(8) }}>
            <Ionicons name="cloud-offline-outline" size={s(40)} color={COLORS.gray[300]} />
            <Typography variant="body-02" weight="semibold" className="text-gray-600">
              정보를 불러올 수 없습니다
            </Typography>
            <TouchableOpacity
              onPress={() => refetch()}
              style={{ marginTop: s(8), paddingHorizontal: s(20), paddingVertical: s(10) }}
              className="rounded-md bg-primary"
            >
              <Typography variant="body-03" weight="semibold" className="text-white">
                다시 시도
              </Typography>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScreenGradient>
    );
  }

  const birthText = client.birth_date ? formatKstDate(client.birth_date) : '-';
  const phoneText = client.phone ? formatPhone(client.phone) : '연락처 없음';
  const genderLabel =
    client.gender === 'female' ? '여' : client.gender === 'male' ? '남' : null;

  // 빠른 연락 대상 — 본인 연락처 우선, 없으면 대표 보호자(정렬 1순위) 연락처로 폴백 (D3)
  const guardianWithPhone = guardians.find((g) => g.phone) ?? null;
  const contactViaGuardian = !client.phone && !!guardianWithPhone;
  const contactPhone = client.phone ?? guardianWithPhone?.phone ?? null;

  const onCall = () => {
    if (contactPhone) Linking.openURL(`tel:${contactPhone.replace(/[^\d+]/g, '')}`);
  };
  const onSms = () => {
    if (contactPhone) Linking.openURL(`sms:${contactPhone.replace(/[^\d+]/g, '')}`);
  };

  // 말풍선 — 좌: 미작성 일지 신호, 우: 다음 상담 D-day
  const logMissing = signals.find((sig) => sig.type === 'log_missing') ?? null;
  // "N건" 패턴만 카운트로 인정 (detail 안의 날짜·연도 오인 방지)
  const logMissingCount = logMissing?.detail.match(/(\d+)\s*건/)?.[1] ?? null;

  return (
    <ScreenGradient>
      <SafeAreaView className="flex-1" edges={['top']}>
        <Header
          onBack={() => router.back()}
          isFavorited={isFavorited}
          onToggleFavorite={handleToggleFavorite}
        />

        <ScrollView
          contentContainerStyle={{ paddingTop: s(24), paddingBottom: s(40) }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 히어로 — 아바타 + 말풍선 (헤더 아래 mb-3) ─── */}
          <View className="flex-row items-center justify-center" style={{ paddingHorizontal: s(16) }}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              {logMissing && (
                <FloatingBubble
                  baseY={-s(30)}
                  phase={0}
                  bobDuration={2200}
                  swayDuration={2800}
                  bobAmp={9}
                  swayDeg={1.4}
                  swayDir={1}
                >
                <SpeechBubble
                  side="left"
                  iconName="report-color-16"
                  iconLeft={12.5}
                  onPress={() => handleSignalAction(logMissing)}
                >
                  {logMissingCount ? (
                    <Typography variant="label-01" weight="medium" style={{ color: COLORS.white, textAlign: 'center' }}>
                      {'작성할 상담일지가\n'}
                      <Typography variant="label-01" weight="medium" style={{ color: BUBBLE_HL }}>
                        {logMissingCount}건
                      </Typography>
                      {' 있어요'}
                    </Typography>
                  ) : (
                    <Typography variant="label-01" weight="medium" style={{ color: COLORS.white, textAlign: 'center' }}>
                      {'작성할 상담일지가\n있어요'}
                    </Typography>
                  )}
                </SpeechBubble>
                </FloatingBubble>
              )}
            </View>

            <HeroAvatar name={client.name} seed={client.id} imageUrl={client.profile_image_url} />

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {nextCounselingDays !== null && (
                <FloatingBubble
                  baseY={-s(10)}
                  phase={520}
                  bobDuration={2700}
                  swayDuration={3400}
                  bobAmp={6}
                  swayDeg={1.1}
                  swayDir={-1}
                >
                <SpeechBubble
                  side="right"
                  iconName="date-16"
                  iconLeft={10}
                  onPress={handleCounselingPress}
                >
                  <Typography variant="label-01" weight="medium" style={{ color: COLORS.white, textAlign: 'center' }}>
                    {nextCounselingDays === 0 ? '오늘 ' : '다음 상담까지\n'}
                    <Typography variant="label-01" weight="medium" style={{ color: BUBBLE_HL }}>
                      {nextCounselingDays === 0 ? '상담' : daysUntilWord(nextCounselingDays)}
                    </Typography>
                    {nextCounselingDays === 0 ? '이 있어요' : ' 남았어요'}
                  </Typography>
                </SpeechBubble>
                </FloatingBubble>
              )}
            </View>
          </View>

          {/* 아바타 그림자 — 흐릿한 타원 (아바타에 더 가깝게) */}
          <View style={{ alignItems: 'center', marginTop: s(4), marginBottom: s(15) }}>
            <AvatarShadow />
          </View>

          {/* ─── 내담자 정보 카드 (height 290) ─── */}
          <View
            className="bg-surface"
            style={{
              ...CARD_SHADOW,
              marginHorizontal: s(16),
              height: s(290),
              borderRadius: s(20),
              padding: s(20),
            }}
          >
            {/* 이름 + 성별/나이 */}
            <View className="flex-row items-center" style={{ gap: s(8) }}>
              <Typography variant="headline-02" weight="semibold" className="text-gray-900">
                {client.name}
              </Typography>
              <GenderAgeMeta genderLabel={genderLabel} age={age} size="lg" />
            </View>

            {/* 생년월일 (mt 14) / 연락처 (mb 14) */}
            <InfoRow label="생년월일" value={birthText} style={{ marginTop: s(14) }} />
            <InfoRow
              label="연락처"
              value={phoneText}
              muted={!client.phone}
              style={{ marginTop: s(8), marginBottom: s(14) }}
            />

            {/* 메모 (height 88) */}
            <View
              className="bg-gray-50 rounded-md"
              style={{ height: s(88), padding: s(12) }}
            >
              {/* 메모 타이틀 — Title S (body-03/medium/title-subtle) */}
              <Typography variant="body-03" weight="medium" className="text-gray-600">
                메모
              </Typography>
              <ScrollView
                style={{ flex: 1, marginTop: s(2) }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                <Typography
                  variant="body-02"
                  weight="regular"
                  // 작성된 메모 없으면 disabled(text/state/disabled) — 고스트 텍스트는 inline style
                  style={{
                    color: client.memo?.trim()
                      ? COLORS.text.body.default
                      : COLORS.text.state.disabled,
                  }}
                >
                  {client.memo?.trim() || '작성된 메모가 없어요'}
                </Typography>
              </ScrollView>
            </View>

            {/* 전화 / 문자 버튼 — 본인 연락처 없고 보호자가 있으면 보호자 연결 (D3) */}
            <View className="flex-row" style={{ gap: s(10), marginTop: s(14) }}>
              <ContactButton
                label={contactViaGuardian ? '보호자 전화' : '전화 걸기'}
                iconName="call-20"
                onPress={onCall}
                disabled={!contactPhone}
              />
              <ContactButton
                label={contactViaGuardian ? '보호자 문자' : '문자 보내기'}
                iconName="text-message-20"
                onPress={onSms}
                disabled={!contactPhone}
              />
            </View>
          </View>

          {/* ─── 보호자 — 이름·관계 + 전화/문자 빠른 연락 (D3, 스펙 §3-3 빠른 액션) ─── */}
          {guardians.length > 0 && (
            <View style={{ marginHorizontal: s(16), marginTop: s(16) }}>
              <View
                className="bg-surface"
                style={{ ...CARD_SHADOW, borderRadius: s(20), paddingHorizontal: s(16), paddingVertical: s(20) }}
              >
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.gray[600], marginBottom: s(4) }}
                >
                  보호자
                </Typography>
                {guardians.map((guardian) => (
                  <GuardianRow key={guardian.clientId} guardian={guardian} />
                ))}
              </View>
            </View>
          )}

          {/* ─── 기록 (상담 / 검사 / 문서) ─── */}
          <View style={{ marginHorizontal: s(16), marginTop: s(16) }}>
            <View
              className="bg-surface"
              style={{ ...CARD_SHADOW, borderRadius: s(20), paddingHorizontal: s(16), paddingVertical: s(20) }}
            >
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.gray[600], marginBottom: s(4) }}
              >
                기록
              </Typography>
              <RecordRow
                icon="counseling-color-24"
                label="상담"
                count={counselingList.length}
                dDay={nextCounselingDays}
                onPress={handleCounselingPress}
              />
              <RecordRow
                icon="assessment-color-24"
                label="검사"
                count={assessmentList.length}
                onPress={handleAssessmentPress}
              />
              <RecordRow
                icon="document-color-24"
                label="문서"
                count={documentCount}
                onPress={handleDocumentsPress}
                isLast
              />
            </View>
          </View>

          {/* 일지 시트 — 신호 퀵 액션으로 즉시 노출 (회기 시트 우회) */}
          <CounselingNoteSheet
            visible={noteSheetTarget !== null}
            onClose={() => setNoteSheetTarget(null)}
            centerId={centerId}
            sessionId={noteSheetTarget?.sessionId ?? null}
            clientId={id ?? null}
            clientName={client?.name}
            sessionStart={noteSheetTarget?.sessionStart}
          />

          {/* 미수 안전망 — 미수 청구 목록 → 선택 시 상세(납부 등록까지) */}
          <ClientBillingSheet
            visible={billingListOpen}
            onClose={() => setBillingListOpen(false)}
            centerId={centerId}
            clientId={id ?? null}
            onSelectBillable={(billableId) => {
              setBillingListOpen(false);
              setBillingDetailId(billableId);
            }}
          />
          <BillableDetailSheet
            visible={billingDetailId !== null}
            onClose={() => setBillingDetailId(null)}
            centerId={centerId}
            billableId={billingDetailId}
          />
        </ScrollView>
      </SafeAreaView>
    </ScreenGradient>
  );
}

// ─── 화면 배경 그라데이션 (#E5FAFF → #EAF6E9, 위→아래) ───
function ScreenGradient({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['#E5FAFF', '#EAF6E9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

// ─── 말풍선 둥둥 떠다니기 — 사인 기반 상하 bob + 미세한 좌우 sway(흔들림) ───
// 두 모션의 주기를 다르게 둬(2.2s / 2.8s) 반복감 없이 유기적으로 떠다니게 한다.
function FloatingBubble({
  baseY,
  phase = 0,
  bobDuration = 2200,
  swayDuration = 2800,
  bobAmp = 8,
  swayDeg = 1.2,
  swayDir = 1,
  children,
}: {
  baseY: number;
  phase?: number;
  /** 상하 bob 주기(ms). 좌우를 다르게 줘 동기화를 깨뜨린다 */
  bobDuration?: number;
  /** 좌우 sway 주기(ms) */
  swayDuration?: number;
  /** 상하 진폭(px, s() 적용 전) */
  bobAmp?: number;
  /** 회전 각도(deg) */
  swayDeg?: number;
  /** 회전 시작 방향. +1: -deg→+deg, -1: +deg→-deg (좌우 반대로 흔들기) */
  swayDir?: 1 | -1;
  children: React.ReactNode;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const bobLoop = makeLoop(bob, bobDuration);
    const swayLoop = makeLoop(sway, swayDuration);
    const t = setTimeout(() => {
      bobLoop.start();
      swayLoop.start();
    }, phase);
    return () => {
      clearTimeout(t);
      bobLoop.stop();
      swayLoop.stop();
    };
  }, [bob, sway, phase, bobDuration, swayDuration]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [baseY, baseY - s(bobAmp)],
  });
  const rotate = sway.interpolate({
    inputRange: [0, 1],
    outputRange:
      swayDir === 1 ? [`-${swayDeg}deg`, `${swayDeg}deg`] : [`${swayDeg}deg`, `-${swayDeg}deg`],
  });

  return (
    <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>{children}</Animated.View>
  );
}

// 말풍선 강조색 (숫자/날짜)
const BUBBLE_HL = '#7FB2FF';

// ─── 말풍선 — 110×60 다크 버블 + 상단 좌측 아이콘 배지 + 하단 내측 꼬리 ───
function SpeechBubble({
  side,
  iconName,
  iconLeft,
  onPress,
  children,
}: {
  side: 'left' | 'right';
  iconName: IconName;
  /** 아이콘 배지의 좌측 여백(px) — 좌측 버블 12.5 / 우측 버블 10 */
  iconLeft: number;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      accessibilityRole="button"
    >
      {/* 본문 버블 (110×60, p-10) */}
      <View
        style={{
          width: s(110),
          height: s(60),
          backgroundColor: COLORS.gray[700],
          borderRadius: s(14),
          padding: s(10),
          marginTop: s(12),
          justifyContent: 'center',
        }}
      >
        {children}
      </View>

      {/* 아이콘 배지 — 상단에 겹치게, 좌측 여백 iconLeft */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: s(iconLeft),
          width: s(24),
          height: s(24),
          borderRadius: s(12),
          backgroundColor: COLORS.white,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      >
        <Icon name={iconName} size={s(16)} />
      </View>

      {/* 꼬리 — 12.99×6.5 직각삼각형. 내측 변이 수직(버블 모서리와 이어짐) */}
      <View
        style={{
          position: 'absolute',
          bottom: -s(6.5),
          [side === 'left' ? 'right' : 'left']: s(16),
          width: 0,
          height: 0,
          borderTopWidth: s(6.5),
          borderTopColor: COLORS.gray[700],
          ...(side === 'left'
            ? { borderLeftWidth: s(13), borderLeftColor: 'transparent' }
            : { borderRightWidth: s(13), borderRightColor: 'transparent' }),
        }}
      />
    </Pressable>
  );
}

// ─── 히어로 아바타 — 100×100 이미지/이니셜 원형 + 옅은 그림자 ───
function HeroAvatar({
  name,
  seed,
  imageUrl,
}: {
  name: string;
  seed: string;
  imageUrl?: string | null;
}) {
  const color = getProfileColor(seed);
  const [imgError, setImgError] = useState(false);
  const showImage = !!imageUrl && !imgError;
  return (
    <View
      style={{
        width: s(100),
        height: s(100),
        borderRadius: s(50),
        backgroundColor: color.bg,
        borderWidth: s(4),
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: s(8),
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={{ width: s(100), height: s(100) }}
          onError={() => setImgError(true)}
        />
      ) : (
        <Typography variant="headline-01" weight="bold" style={{ color: color.fg }}>
          {getInitial(name)}
        </Typography>
      )}
    </View>
  );
}

// ─── 아바타 하단 흐릿한 타원 그림자 ───
// 단색+shadow는 가장자리가 또렷해 그림자 느낌이 안 난다.
// radial gradient로 중앙(#B9E2E5 @70%)에서 가장자리(투명)로 자연스럽게 사라지게 해 blur처럼 표현.
function AvatarShadow() {
  const w = s(100);
  const h = s(22);
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id="avatarShadow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor="#B9E2E5" stopOpacity={0.4} />
          <Stop offset="55%" stopColor="#B9E2E5" stopOpacity={0.22} />
          <Stop offset="100%" stopColor="#B9E2E5" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h / 2} rx={w * 0.46} ry={h * 0.42} fill="url(#avatarShadow)" />
    </Svg>
  );
}

// ─── 정보 라인 (라벨 | 값) — body-03 ───
function InfoRow({
  label,
  value,
  style,
  muted = false,
}: {
  label: string;
  value: string;
  style?: ViewStyle;
  /** 값이 비어 안내 문구를 보여줄 때 — 흐린 톤으로 표시 */
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-center" style={style}>
      <View style={{ width: s(64) }}>
        <Typography variant="body-03" weight="regular" style={{ color: COLORS.text.body.default }}>
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="medium"
        className="flex-1"
        style={{ color: muted ? COLORS.gray[400] : COLORS.text.body.strong }}
        numberOfLines={1}
      >
        {value}
      </Typography>
    </View>
  );
}

// ─── 연락 버튼 (전화 / 문자) ───
function ContactButton({
  label,
  iconName,
  onPress,
  disabled,
}: {
  label: string;
  iconName: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: s(48),
        borderRadius: s(12),
        backgroundColor: '#E9EEF0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
        opacity: disabled ? 0.5 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={iconName} size={s(20)} color={COLORS.gray[600]} />
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[600] }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── 보호자 행 — 이름·관계 배지·연락처 + 전화/문자 빠른 연락 (D3) ───
function GuardianRow({ guardian }: { guardian: RelationInfo }) {
  const phoneDigits = guardian.phone?.replace(/[^\d+]/g, '') ?? null;
  return (
    <View
      className="flex-row items-center"
      style={{ gap: s(12), paddingVertical: s(10) }}
    >
      <View style={{ flex: 1, gap: s(2) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="body-01" weight="medium" className="text-gray-900" numberOfLines={1}>
            {guardian.name}
          </Typography>
          <Badge>{guardian.relationLabel}</Badge>
        </View>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: guardian.phone ? COLORS.gray[600] : COLORS.gray[400] }}
        >
          {guardian.phone ? formatPhone(guardian.phone) : '연락처 없음'}
        </Typography>
      </View>
      <GuardianContactIconButton
        iconName="call-20"
        accessibilityLabel={`${guardian.name} 전화 걸기`}
        disabled={!phoneDigits}
        onPress={() => phoneDigits && Linking.openURL(`tel:${phoneDigits}`)}
      />
      <GuardianContactIconButton
        iconName="text-message-20"
        accessibilityLabel={`${guardian.name} 문자 보내기`}
        disabled={!phoneDigits}
        onPress={() => phoneDigits && Linking.openURL(`sms:${phoneDigits}`)}
      />
    </View>
  );
}

// ─── 보호자 연락 아이콘 버튼 — ContactButton과 동일 톤의 원형 축약형 ───
function GuardianContactIconButton({
  iconName,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  iconName: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        width: s(44),
        height: s(44),
        borderRadius: s(22),
        backgroundColor: '#E9EEF0',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon name={iconName} size={s(20)} color={COLORS.gray[600]} />
    </TouchableOpacity>
  );
}

// ─── 기록 행 (상담 / 검사 / 문서) ───
function RecordRow({
  icon,
  label,
  count,
  dDay,
  onPress,
  isLast = false,
}: {
  icon: IconName;
  label: string;
  count: number | null;
  dDay?: number | null;
  onPress: () => void;
  isLast?: boolean;
}) {
  const isEmpty = count !== null && count === 0;
  return (
    <TouchableOpacity
      onPress={isEmpty ? undefined : onPress}
      disabled={isEmpty}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
        paddingVertical: s(12),
        opacity: isEmpty ? 0.5 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${count !== null ? ` ${count}건` : ''}`}
    >
      <View style={{ width: s(28), height: s(28), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={s(24)} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: s(6) }}>
        <Typography variant="body-01" weight="medium" className="text-gray-900">
          {label}
        </Typography>
        {count !== null && (
          <Typography variant="label-01" weight="regular" style={{ color: COLORS.gray[600] }}>
            {count}
          </Typography>
        )}
      </View>
      {dDay !== null && dDay !== undefined && <RecordDdayBadge days={dDay} />}
      <Icon name="arrow-right" size={s(16)} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

// ─── 기록 D-day 뱃지 — 목록 카드와 동일 톤 (임박=빨강, 그 외=회색) ───
function RecordDdayBadge({ days }: { days: number }) {
  if (days < 0) return null;
  const imminent = days <= 1; // D-DAY·D-1 = 빨강, 이틀 이상 = 회색
  return (
    <BadgeRound
      bg={imminent ? '#FF2D550F' : '#F5F7F8'}
      color={imminent ? '#E23B3B' : COLORS.gray[600]}
    >
      {days === 0 ? 'D-DAY' : `D-${days}`}
    </BadgeRound>
  );
}

// ─── 헤더 — 뒤로가기(좌) · 관심 하트(우) ───
function Header({
  onBack,
  isFavorited,
  onToggleFavorite,
}: {
  onBack: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <View
      style={{ height: s(52), paddingHorizontal: s(8) }}
      className="flex-row items-center justify-between"
    >
      <TouchableOpacity
        onPress={onBack}
        className="h-10 w-10 items-center justify-center"
        accessibilityLabel="뒤로 가기"
        accessibilityRole="button"
      >
        <Icon name="arrow-left" size={s(24)} />
      </TouchableOpacity>
      {onToggleFavorite && (
        <FavoriteHeartButton isFavorited={!!isFavorited} onPress={onToggleFavorite} />
      )}
    </View>
  );
}

/**
 * 하트 토글 버튼 — 디자인 스펙 §8.3 spring easing.
 *
 * 절제된 마이크로 인터랙션:
 * - 항상: 빠른 1.0 → 1.18 → 1.0 spring pulse
 * - 채울 때만: 아주 옅은 링 한 번 (scale 1.0 → 1.4, opacity 0.22 → 0)
 */
function FavoriteHeartButton({
  isFavorited,
  onPress,
}: {
  isFavorited: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const burstScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  const lastFavoritedRef = useRef(isFavorited);

  useEffect(() => {
    lastFavoritedRef.current = isFavorited;
  }, [isFavorited]);

  const handlePress = () => {
    const willBeFavorited = !lastFavoritedRef.current;

    scale.setValue(0.88);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();

    if (willBeFavorited) {
      burstScale.setValue(1);
      burstOpacity.setValue(0.22);
      Animated.parallel([
        Animated.timing(burstScale, {
          toValue: 1.4,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(burstOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }

    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="h-10 w-10 items-center justify-center"
      accessibilityLabel={isFavorited ? '관심 해제' : '관심 표시'}
      accessibilityRole="button"
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: s(24),
          height: s(24),
          borderRadius: s(12),
          backgroundColor: COLORS.error,
          opacity: burstOpacity,
          transform: [{ scale: burstScale }],
        }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={s(24)}
          color={isFavorited ? COLORS.error : COLORS.gray[400]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
