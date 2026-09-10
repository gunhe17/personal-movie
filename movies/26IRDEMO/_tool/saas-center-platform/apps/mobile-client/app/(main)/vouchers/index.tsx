/**
 * 바우처 홈 — 시안 480:4615.
 *
 * 상단(흰 배경) = 내 보유 바우처 카드 스택(프로필별), 하단(회색) = 자격 확인 배너 + 제도 카탈로그.
 * 게스트·미연결 계정은 보유 바우처가 없으므로 카탈로그 표면만 보인다.
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import { buildProfileColorMap } from '@/features/profile';
import {
  ProgramTicketCard,
  useMyVouchers,
  useVoucherCatalog,
  VoucherStack,
  VOUCHER_GUIDANCE_NOTE,
} from '@/features/voucher';
import { EmptyView, ErrorView, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import {
  refetchIfFetched,
  useRefreshControl,
} from '@/shared/hooks/useRefreshControl';
import { ScheduleFilterChip } from '../(tabs)/_components/ScheduleFilterChip';

export default function VoucherHomeScreen() {
  const router = useRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const isLinked = (me?.links ?? []).some((link) => link.status === 'active');

  const myVouchersQuery = useMyVouchers(isLinked);
  const catalogQuery = useVoucherCatalog();
  const programs = catalogQuery.data ?? [];
  const myVouchers = useMemo(() => myVouchersQuery.data ?? [], [myVouchersQuery.data]);

  const refreshControl = useRefreshControl(() =>
    Promise.all([
      refetchIfFetched(meQuery),
      refetchIfFetched(myVouchersQuery),
      catalogQuery.refetch(),
    ]),
  );

  // 바우처를 가진 프로필만 칩으로 — 없는 아이를 고르면 빈 스택이 된다
  const voucherProfiles = useMemo(() => {
    const owners = new Set(myVouchers.map((voucher) => voucher.profile_id));
    return (me?.profiles ?? []).filter((profile) => owners.has(profile.id));
  }, [me, myVouchers]);
  const profileColorById = useMemo(
    () => buildProfileColorMap(me?.profiles ?? []),
    [me],
  );

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const activeProfile =
    voucherProfiles.find((profile) => profile.id === selectedProfileId) ??
    voucherProfiles[0];
  const activeVouchers = useMemo(
    () =>
      activeProfile
        ? myVouchers.filter((voucher) => voucher.profile_id === activeProfile.id)
        : [],
    [myVouchers, activeProfile],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView
        className="flex-1 bg-background"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* 보유 바우처 — 흰 배경 블록 */}
        <View className="bg-surface pb-6">
          <View className="h-12 flex-row items-center px-4">
            {router.canGoBack() ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="뒤로가기"
                onPress={() => router.back()}
                hitSlop={8}
                style={{ marginRight: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
              </Pressable>
            ) : null}
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              바우처
            </Typography>
          </View>

          {activeProfile ? (
            <>
              {voucherProfiles.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  // 가로 ScrollView는 flex 컬럼 안에서 세로로 늘어난다 — 콘텐츠 높이에 고정
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{
                    columnGap: s(8),
                    paddingHorizontal: s(16),
                    paddingVertical: s(10),
                  }}
                >
                  {voucherProfiles.map((profile) => (
                    <ScheduleFilterChip
                      key={profile.id}
                      label={profile.display_name}
                      active={activeProfile.id === profile.id}
                      color={profileColorById.get(profile.id)}
                      imageUrl={profile.image_url}
                      inactiveTone="surface"
                      onPress={() => setSelectedProfileId(profile.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <View className="px-4">
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  className="mb-4 mt-2"
                  style={{ color: COLORS.text.title.default }}
                >
                  {activeProfile.display_name}님의 바우처
                </Typography>
                {/* 프로필이 바뀌면 스택 선택 상태를 새로 — key로 리마운트 */}
                <VoucherStack key={activeProfile.id} vouchers={activeVouchers} />
              </View>
            </>
          ) : (
            <View className="px-4 pt-2">
              <Typography
                variant="headline-01"
                weight="semibold"
                style={{ color: COLORS.text.headline }}
              >
                받을 수 있는 지원을{'\n'}알아봐요
              </Typography>
              <Typography
                variant="body-02"
                className="mt-1.5"
                style={{ color: COLORS.text.body.default }}
              >
                치료비 부담을 덜어주는 공공 지원 제도예요
              </Typography>
              {isLinked && myVouchersQuery.isLoading ? (
                <LoadingView className="py-6" />
              ) : null}
            </View>
          )}
        </View>

        {/* 1분 자격 확인 배너 */}
        <View className="mt-6 px-4">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(main)/vouchers/check')}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <LinearGradient
              colors={['#3388F0', '#5EB9FF']} // 시안 480:4628 배너 전용 그라디언트
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.2 }}
              style={{
                borderRadius: s(12),
                paddingHorizontal: s(16),
                paddingVertical: s(16),
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View className="flex-1">
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.text.state.inverse }}
                >
                  몇 가지 질문만 답하면 알려드려요
                </Typography>
                <Typography
                  variant="body-02"
                  weight="semibold"
                  className="mt-2"
                  style={{ color: COLORS.text.state.inverse }}
                >
                  내가 받을 수 있는 지원 혜택은?
                </Typography>
              </View>
              <Image
                source={require('@assets/images/voucher/eligibility-quiz.png')}
                style={{ width: s(51), height: s(49) }}
                resizeMode="contain"
              />
            </LinearGradient>
          </Pressable>
        </View>

        {/* 최신 바우처 — 제도 카탈로그 */}
        <View className="mt-6">
          <View className="flex-row items-center px-4" style={{ columnGap: 4 }}>
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              최신 바우처
            </Typography>
            {programs.length > 0 ? (
              <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
                {programs.length}
              </Typography>
            ) : null}
          </View>

          {catalogQuery.isLoading ? (
            <LoadingView className="py-10" />
          ) : catalogQuery.isError ? (
            <ErrorView className="py-10" onRetry={() => catalogQuery.refetch()} />
          ) : programs.length === 0 ? (
            <View className="mx-4 mt-3 rounded-xl bg-surface">
              <EmptyView
                title="등록된 지원 제도가 아직 없어요"
                description="제도 정보가 준비되면 여기에서 보여드릴게요"
                className="py-10"
              />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              className="mt-3"
              contentContainerStyle={{ paddingHorizontal: 16, columnGap: 12 }}
            >
              {programs.map((program) => (
                <ProgramTicketCard
                  key={program.id}
                  program={program}
                  onPress={() => router.push(`/(main)/vouchers/${program.id}`)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <Typography
          variant="body-03"
          className="mt-6 px-4"
          style={{ color: COLORS.text.caption.subtle }}
        >
          {VOUCHER_GUIDANCE_NOTE}
        </Typography>
      </ScrollView>
    </SafeAreaView>
  );
}
