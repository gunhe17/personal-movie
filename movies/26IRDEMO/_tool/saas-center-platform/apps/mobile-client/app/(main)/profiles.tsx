/**
 * 자녀 전체 목록 — 마이 탭 「N명의 자녀가 있어요 · 전체보기」에서 진입. 시안 778:6913.
 *
 * 마이 탭의 가로 스크롤 카드가 3장을 넘기면 뒤가 안 보여서, 세로 목록으로 전부 펼쳐 보는 화면.
 * 카드 = 프로필(+연동 뱃지) · 참여 센터(2개 이상이면 접기/펼치기) · 하단 고정 CTA로 자녀 추가.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMe } from '@/features/auth';
import type { CenterLink } from '@/features/link';
import {
  ProfileAddNoticeSheet,
  useProfileNoticeStore,
  type Profile,
} from '@/features/profile';
import {
  Avatar,
  Badge,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import {
  refetchIfFetched,
  useRefreshControl,
} from '@/shared/hooks/useRefreshControl';
import { formatBirthWithAge } from '@/shared/utils/format';
import ArrowLeftIcon24 from '@assets/icons/24/ArrowLeftIcon24.svg';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';
import ArrowUpIcon20 from '@assets/icons/20/ArrowUpIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import PlusIcon20 from '@assets/icons/20/PlusIcon20.svg';

/** 센터명 한 줄 — 접힘/펼침 어디서나 같은 활자(시안 15/18 Medium). */
function CenterName({ name }: { name: string }) {
  return (
    <Typography
      variant="body-02"
      weight="medium"
      numberOfLines={1}
      className="flex-1"
      style={{ color: COLORS.text.body.default }}
    >
      {name}
    </Typography>
  );
}

/**
 * 참여 센터 블록 — 시안 793:7803(펼침) / 793:7845(접힘).
 * 접힘에는 센터 아이콘과 "외 N개"가 붙고, 펼치면 센터명만 줄줄이 나온다(시안 그대로).
 */
function CenterList({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false);

  // 1개뿐이면 펼칠 게 없다 — 화살표 없이 한 줄
  if (names.length === 1) {
    return (
      <View className="flex-row items-center" style={{ columnGap: s(4) }}>
        <CenterIcon20 width={s(20)} height={s(20)} />
        <CenterName name={names[0]} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? '참여 센터 접기' : '참여 센터 모두 보기'}
      onPress={() => setExpanded((prev) => !prev)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {expanded ? (
        <View style={{ rowGap: s(12) }}>
          {names.map((name, i) => (
            <View key={`${name}-${i}`} className="flex-row items-center">
              <CenterName name={name} />
              {i === 0 ? <ArrowUpIcon20 width={s(20)} height={s(20)} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-row items-center" style={{ columnGap: s(10) }}>
          <View className="flex-1 flex-row items-center" style={{ columnGap: s(4) }}>
            <CenterIcon20 width={s(20)} height={s(20)} />
            <Typography
              variant="body-02"
              weight="medium"
              numberOfLines={1}
              style={{ color: COLORS.text.body.default, flexShrink: 1 }}
            >
              {names[0]}
            </Typography>
            <Typography
              variant="body-03"
              numberOfLines={1}
              style={{ color: COLORS.text.body.default }}
            >
              외 {names.length - 1}개
            </Typography>
          </View>
          <ArrowDownIcon20 width={s(20)} height={s(20)} />
        </View>
      )}
    </Pressable>
  );
}

/** 자녀 카드 — 시안 793:7642. 센터가 없으면 구분선·센터 블록 없이 프로필 행만. */
function ProfileCard({
  profile,
  centerNames,
  onPress,
}: {
  profile: Profile;
  centerNames: string[];
  onPress: () => void;
}) {
  const birth = formatBirthWithAge(profile.birth_date);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="rounded-2xl bg-surface"
        style={{ padding: s(16), rowGap: s(16) }}
      >
        <View className="flex-row items-center" style={{ columnGap: s(12) }}>
          <Avatar uri={profile.image_url} size={s(44)} />
          <View className="flex-1" style={{ rowGap: s(8) }}>
            <View className="flex-row items-center" style={{ columnGap: s(8) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                numberOfLines={1}
                style={{ color: COLORS.text.title.default, flexShrink: 1 }}
              >
                {profile.display_name}
              </Typography>
              {profile.is_linked ? (
                <Badge label="연동" color="blue" variant="outline" size="xs" />
              ) : null}
            </View>
            {birth ? (
              <Typography
                variant="body-03"
                numberOfLines={1}
                style={{ color: COLORS.text.body.default }}
              >
                {birth}
              </Typography>
            ) : null}
          </View>
        </View>

        {centerNames.length > 0 ? (
          <>
            <View style={{ height: 1, backgroundColor: COLORS.border.subtle }} />
            <CenterList names={centerNames} />
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProfilesScreen() {
  const router = useRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const refreshControl = useRefreshControl(() => refetchIfFetched(meQuery));

  // 자녀 추가 전 안내(시안 793:8085) — 한 번 끄면 다음부터 폼으로 바로 간다
  const [noticeVisible, setNoticeVisible] = useState(false);
  const noticeDismissed = useProfileNoticeStore((s) => s.addNoticeDismissed);
  const noticeHydrated = useProfileNoticeStore((s) => s.isHydrated);
  const dismissNotice = useProfileNoticeStore((s) => s.dismissAddNotice);

  const goProfileForm = () => router.push('/(main)/profile-form');

  const handleAddPress = () => {
    // 복원 전이면 껐는지 알 수 없다 — 그땐 안내를 띄우지 않고 바로 폼으로
    if (!noticeHydrated || noticeDismissed) {
      goProfileForm();
      return;
    }
    setNoticeVisible(true);
  };

  const handleNoticeConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) dismissNotice();
    setNoticeVisible(false);
    goProfileForm();
  };

  const profiles = me?.profiles ?? [];

  // 프로필별 참여 센터(active 링크만) — 마이 탭 자녀 카드와 같은 집계
  const activeNamesByProfile = new Map<string, string[]>();
  for (const link of (me?.links ?? []) as CenterLink[]) {
    if (link.status !== 'active') continue;
    const names = activeNamesByProfile.get(link.profile_id) ?? [];
    names.push(link.center_name);
    activeNamesByProfile.set(link.profile_id, names);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ArrowLeftIcon24 width={24} height={24} />
        </Pressable>
      </View>

      {meQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: s(12),
            paddingTop: s(12),
            paddingBottom: s(24),
            rowGap: s(12),
          }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            {profiles.length}명의 자녀가 있어요
          </Typography>

          {profiles.length === 0 ? (
            <EmptyView
              title="등록된 자녀가 없어요"
              description="아래 [자녀 추가]로 프로필을 만들어 주세요."
            />
          ) : (
            profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                centerNames={activeNamesByProfile.get(profile.id) ?? []}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/profile-detail',
                    params: { profileId: profile.id },
                  })
                }
              />
            ))
          )}
        </ScrollView>
      )}

      <View
        className="bg-background"
        style={{
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
        }}
      >
        <Button
          label="자녀 추가"
          icon={<PlusIcon20 width={s(20)} height={s(20)} />}
          onPress={handleAddPress}
        />
      </View>

      <ProfileAddNoticeSheet
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        onConfirm={handleNoticeConfirm}
      />
    </SafeAreaView>
  );
}
