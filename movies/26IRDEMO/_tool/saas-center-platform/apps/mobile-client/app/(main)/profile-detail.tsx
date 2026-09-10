/**
 * 자녀(프로필) 상세 — 시안 594:5776. 본인이 보호자이자 내담자면 본인 프로필 상세로도 쓰인다.
 *
 * 센터 연결 유무로 화면이 갈린다:
 *   연결됨   — 소속 센터(탭하면 센터 상세) + 상담·검사 이력. 센터 명부의 투영이라 수정·삭제 잠김.
 *   미연결   — 센터 데이터가 없어 보여줄 게 기록뿐이다. 히어로 밑 [센터 연결하기] +
 *              기록 목록(시안 1015:8164). 기록은 전역 평면이라 연결과 무관하게 쌓인다(설계 §15-6).
 *
 * 기록 건수는 표시하지 않는다 — 시안에는 "기록 5"가 있으나 §7-1·§15-6이 집계 표시를 금지한다
 * (2026-07-30 사용자 판정).
 * 바우처 섹션은 내담자별 발급 바우처 API가 없어 보류(생기면 추가).
 */
import React from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import { useFamilyMembers } from '@/features/family';
import {
  ProgressHistoryCard,
  useProfileProgress,
  type AssessmentProgress,
  type CounselingProgress,
} from '@/features/progress';
import { useDeleteProfile } from '@/features/profile';
import { useRecords, type AppRecord } from '@/features/records';
import {
  Button,
  ConfirmModal,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { getErrorMessage } from '@/shared/api/client';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatBirthWithAge } from '@/shared/utils/format';
import { toKst } from '@/shared/utils/date';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import CallIcon20 from '@assets/icons/20/CallIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import LinkIcon20 from '@assets/icons/20/LinkIcon20.svg';
import MessageIcon20 from '@assets/icons/20/MessageIcon20.svg';
import UserIcon20 from '@assets/icons/20/UserIcon20.svg';

/** 미리보기 개수 — 초과분은 카드 안에서 [전체보기]로 펼친다(ProgressHistoryCard와 같은 결) */
const RECORD_PREVIEW = 3;

/** 소속 센터 행의 연락 버튼 — 32 원형, surface-sunken 배경. */
function ContactCircle({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}>
      {({ pressed }) => (
        <View
          className="items-center justify-center"
          style={{
            width: s(32),
            height: s(32),
            borderRadius: s(16),
            backgroundColor: pressed ? COLORS.gray[200] : COLORS.bg['surface-sunken'],
          }}
        >
          {icon}
        </View>
      )}
    </Pressable>
  );
}

/** 히어로 아바타 — 흰 테두리 + 옅은 그림자. */
function HeroAvatar({ uri }: { uri: string | null }) {
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={{
        width: s(72),
        height: s(72),
        borderRadius: s(36),
        borderWidth: 3,
        borderColor: COLORS.white,
        backgroundColor: COLORS.action['primary-subtle'],
        // 시안 profile drop-shadow (0,-1.6 / 12.9 / 8%) — 안드로이드 elevation은 과해 낮춤
        shadowColor: '#000B14',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: s(72), height: s(72) }} resizeMode="cover" />
      ) : (
        <UserIcon20 width={s(34)} height={s(34)} />
      )}
    </View>
  );
}

/** 세로 구분 점(·) 사이의 얇은 라인. */
function DotDivider() {
  return (
    <View style={{ width: 1, height: s(10), backgroundColor: COLORS.border.default }} />
  );
}

/**
 * 기록 행 — 시안 1015:9762. 썸네일 45×48 + [날짜 / 시각].
 * 기록 탭 카드(RecordListCard)와 달리 본문·북마크·작성자를 빼고 날짜 축만 남긴 압축형이라
 * 공용화하지 않는다. 첨부 없는 기록도 행 높이가 흔들리지 않게 빈 썸네일 자리를 유지한다.
 */
function RecordRow({ record, onPress }: { record: AppRecord; onPress: () => void }) {
  const thumbnail = record.media.find((m) => m.url);
  // 서버는 UTC naive를 준다 — KST 벽시계로 옮겨야 시각이 9시간 밀리지 않는다
  const occurredAt = toKst(record.occurred_at);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${format(occurredAt, 'M월 d일')} 기록`}
      onPress={onPress}
      className="w-full flex-row items-center"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, columnGap: s(16) })}
    >
      <View
        style={{
          width: s(45),
          height: s(48),
          borderRadius: s(9),
          backgroundColor: COLORS.gray[100],
          overflow: 'hidden',
        }}
      >
        {thumbnail?.url ? (
          <Image
            source={{ uri: thumbnail.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View className="flex-1" style={{ rowGap: s(8) }}>
        <Typography
          variant="body-01"
          weight="medium"
          numberOfLines={1}
          style={{ color: COLORS.black }}
        >
          {format(occurredAt, 'yyyy. MM. dd EEEE', { locale: ko })}
        </Typography>
        <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
          {format(occurredAt, 'a h:mm', { locale: ko })}
        </Typography>
      </View>
    </Pressable>
  );
}

export default function ProfileDetailScreen() {
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const meQuery = useMe();
  const progressQuery = useProfileProgress(profileId ?? null);

  const profile = (meQuery.data?.profiles ?? []).find((p) => p.id === profileId) ?? null;
  const centers = (meQuery.data?.links ?? []).filter(
    (l) => l.profile_id === profileId && l.status === 'active',
  );
  const isLinked = profile?.is_linked ?? false;

  const genderLabel =
    profile?.gender === 'male' ? '남자' : profile?.gender === 'female' ? '여자' : null;
  const birth = formatBirthWithAge(profile?.birth_date ?? null);

  const counseling = progressQuery.data?.counseling ?? [];
  const assessments = progressQuery.data?.assessments ?? [];

  // 미연결이면 보여줄 게 기록뿐 — 연결된 프로필 화면에선 굳이 받지 않는다
  const recordsQuery = useRecords({ profileId: profileId ?? null, enabled: !isLinked });
  const records = recordsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const [showAllRecords, setShowAllRecords] = React.useState(false);
  const visibleRecords = showAllRecords ? records : records.slice(0, RECORD_PREVIEW);
  const refreshControl = useRefreshControl(() =>
    Promise.all([progressQuery.refetch(), recordsQuery.refetch()]),
  );

  // 삭제는 되돌릴 수 없어 가족 관리자(owner)만 — 서버도 403으로 막는다.
  // 센터에 연결된 프로필은 센터 명부의 투영이라 삭제 불가(서버 409).
  const familyQuery = useFamilyMembers();
  const isFamilyOwner = (familyQuery.data ?? []).some(
    (member) => member.person_id === meQuery.data?.person.id && member.role === 'owner',
  );
  const [deleteVisible, setDeleteVisible] = React.useState(false);
  const deleteMutation = useDeleteProfile();

  const goCounseling = (item: CounselingProgress) =>
    router.push({
      pathname: '/(main)/counseling-case/[caseId]',
      params: { caseId: item.case_id, profileId: profileId ?? '' },
    });
  const goAssessment = (item: AssessmentProgress) =>
    router.push({
      pathname: '/(main)/assessment-case/[caseId]',
      params: { caseId: item.case_id, profileId: profileId ?? '' },
    });
  const openCenter = (centerId: string) =>
    router.push({
      pathname: '/(main)/center-detail',
      params: { centerId, profileId: profileId ?? '' },
    });
  const openRecord = (record: AppRecord) =>
    router.push(`/(main)/record-detail?id=${record.id}`);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 히어로 뒤 그라데이션 글로우 — 시안 594:6148 (Ellipse 582×608, top -220, Layer blur 100.8).
          RN엔 도형 블러가 없어(expo-blur 미설치), 시안 그라데이션 색을 그대로 쓰고 base로
          페이드해 100px 블러의 부드러운 글로우를 재현한다. 색 하드코딩 = 장식 그라데이션 예외. */}
      <LinearGradient
        colors={['#EBFBE3', '#DDF0F8', 'rgba(245,247,248,0)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s(340) }}
        pointerEvents="none"
      />

      <View className="h-[52px] flex-row items-center justify-between px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        {/* 센터에 연결된 프로필은 센터 명부의 투영이라 앱에서 못 지운다(서버도 409) */}
        {profile && !isLinked && isFamilyOwner ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleteVisible(true)}
            hitSlop={8}
          >
            <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
              삭제
            </Typography>
          </Pressable>
        ) : null}
      </View>

      {meQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError || !profile ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingBottom: s(40) }}
        >
          {/* 프로필 히어로 */}
          <View className="items-center pt-2">
            <HeroAvatar uri={profile.image_url} />
            <Typography
              variant="headline-02"
              weight="semibold"
              className="mt-3"
              style={{ color: COLORS.text.title.default }}
            >
              {profile.display_name}
            </Typography>
            <View className="mt-2 flex-row items-center" style={{ columnGap: s(8) }}>
              {birth ? (
                <Typography variant="body-01" style={{ color: COLORS.text.body.default }}>
                  {birth}
                </Typography>
              ) : null}
              {birth && genderLabel ? <DotDivider /> : null}
              {genderLabel ? (
                <Typography variant="body-01" style={{ color: COLORS.text.body.default }}>
                  {genderLabel}
                </Typography>
              ) : null}
            </View>

            {/* 미연결이면 여기서 연결로 — 시안 1015:9757 (Button primary/md) */}
            {!isLinked ? (
              <Button
                label="센터 연결하기"
                size="md"
                icon={<LinkIcon20 width={s(20)} height={s(20)} color={COLORS.white} />}
                onPress={() =>
                  router.push({
                    pathname: '/(link)/code',
                    params: { profileId: profile.id },
                  })
                }
                style={{ marginTop: s(20) }}
              />
            ) : null}
          </View>

          {!isLinked ? (
            /* 기록 — 미연결 프로필의 유일한 콘텐츠 (시안 1015:8186) */
            <View className="px-4" style={{ marginTop: s(28) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                기록
              </Typography>
              <View
                className="mt-3 rounded-2xl bg-surface p-4"
                style={{ rowGap: s(16) }}
              >
                {recordsQuery.isLoading ? (
                  <LoadingView className="py-4" />
                ) : records.length === 0 ? (
                  <Typography variant="body-02" style={{ color: COLORS.text.caption.default }}>
                    아직 기록이 없어요
                  </Typography>
                ) : (
                  <>
                    {visibleRecords.map((record, i) => (
                      <React.Fragment key={record.id}>
                        {i > 0 ? (
                          <View
                            style={{ height: 1, backgroundColor: COLORS.border.default }}
                          />
                        ) : null}
                        <RecordRow record={record} onPress={() => openRecord(record)} />
                      </React.Fragment>
                    ))}
                    {/* 전체보기/접기 — 미리보기 초과일 때만, 그 자리에서 펼침 */}
                    {records.length > RECORD_PREVIEW ? (
                      <Button
                        label={showAllRecords ? '접기' : '전체보기'}
                        variant="outline"
                        size="lg"
                        onPress={() => setShowAllRecords((v) => !v)}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </View>
          ) : (
            <>
          {/* 소속 센터 — 탭하면 센터 상세로 */}
          <View className="mt-8 px-4">
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              소속 센터
            </Typography>
            <View className="mt-3 rounded-2xl bg-surface p-4">
              {centers.length === 0 ? (
                <Typography variant="body-02" style={{ color: COLORS.text.caption.default }}>
                  연결된 센터가 없어요
                </Typography>
              ) : (
                centers.map((center, i) => (
                  <View key={center.id}>
                    {i > 0 ? (
                      <View
                        className="my-4"
                        style={{ height: 1, backgroundColor: COLORS.border.default }}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openCenter(center.center_id)}
                      className="flex-row items-center gap-2"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <View
                        className="items-center justify-center overflow-hidden"
                        style={{
                          width: s(28),
                          height: s(28),
                          borderRadius: s(14),
                          backgroundColor: COLORS.bg['surface-sunken'],
                        }}
                      >
                        {center.center_logo_url ? (
                          <Image
                            source={{ uri: center.center_logo_url }}
                            style={{ width: s(28), height: s(28) }}
                            resizeMode="cover"
                          />
                        ) : (
                          <CenterIcon20 width={s(16)} height={s(16)} />
                        )}
                      </View>
                      <Typography
                        variant="body-02"
                        weight="medium"
                        numberOfLines={1}
                        className="flex-1"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {center.center_name}
                      </Typography>
                      {/* 연락 버튼 — 센터 전화가 있을 때만 (탭은 상세 이동과 분리) */}
                      {center.center_phone ? (
                        <View className="flex-row items-center gap-2">
                          <ContactCircle
                            icon={<CallIcon20 width={s(20)} height={s(20)} />}
                            label="전화"
                            onPress={() => Linking.openURL(`tel:${center.center_phone}`)}
                          />
                          <ContactCircle
                            icon={<MessageIcon20 width={s(20)} height={s(20)} />}
                            label="문자"
                            onPress={() => Linking.openURL(`sms:${center.center_phone}`)}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* 상담·검사 이력 — 각 탭 3개 미리보기, 전체보기로 펼침 */}
          <View className="mt-8 px-4">
            <Typography
              variant="body-01"
              weight="semibold"
              className="mb-3"
              style={{ color: COLORS.text.title.default }}
            >
              상담·검사 이력
            </Typography>
            <ProgressHistoryCard
              counseling={counseling}
              assessments={assessments}
              loading={progressQuery.isLoading}
              preview={3}
              onCounselingPress={goCounseling}
              onAssessmentPress={goAssessment}
            />
          </View>
            </>
          )}

        </ScrollView>
      )}

      <ConfirmModal
        visible={deleteVisible}
        title="프로필을 지울까요?"
        message={
          profile
            ? `${profile.display_name}와 함께 쌓아 둔 기록도 사라져요. 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="삭제"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!profile) return;
          deleteMutation.mutate(profile.id, {
            onSuccess: () => {
              setDeleteVisible(false);
              router.back();
            },
            onError: (err) => {
              setDeleteVisible(false);
              Alert.alert('지우지 못했어요', getErrorMessage(err, '잠시 후 다시 시도해 주세요.'));
            },
          });
        }}
        onCancel={() => setDeleteVisible(false)}
      />
    </SafeAreaView>
  );
}
