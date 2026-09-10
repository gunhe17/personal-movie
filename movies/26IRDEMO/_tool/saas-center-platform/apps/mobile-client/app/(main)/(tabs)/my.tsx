import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore, useMe } from '@/features/auth';
import type { CenterLink } from '@/features/link';
import type { Profile } from '@/features/profile';
import {
  Avatar,
  Button,
  ConfirmModal,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS, RADIUS, SHADOWS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import {
  refetchIfFetched,
  useRefreshControl,
} from '@/shared/hooks/useRefreshControl';
import { formatBirthWithAge } from '@/shared/utils/format';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import BellIcon24 from '@assets/icons/24/BellIcon24.svg';
import GearIcon24 from '@assets/icons/24/GearIcon24.svg';
import LockIcon24 from '@assets/icons/24/LockIcon24.svg';
import BillIcon28 from '@assets/icons/28/BillIcon28.svg';
import DocumentIcon28 from '@assets/icons/28/DocumentIcon28.svg';
import FamilyIcon28 from '@assets/icons/28/FamilyIcon28.svg';
import VoucherIcon28 from '@assets/icons/28/VoucherIcon28.svg';
import { TabHeader } from './_components/TabHeader';
import { SectionTitle } from './_components/SectionTitle';

/**
 * 게스트 화면 액센트 — primary 버튼과 같은 토큰을 참조한다.
 * 그린/블루 확정 시 tokens.js `button/primary` 한 곳만 바꾸면 카드 전체가 따라온다.
 */
const ACCENT = COLORS.button.primary.bg;
const ACCENT_TINT = COLORS.blue[50];

const GUEST_BENEFITS = [
  {
    key: 'schedule',
    icon: 'calendar-outline',
    title: '일정을 놓치지 않아요',
    description: '다음 방문과 검사 일정을 한눈에',
  },
  {
    key: 'record',
    icon: 'folder-open-outline',
    title: '기록이 이어져요',
    description: '폰을 바꿔도 아이의 기록은 그대로',
  },
  {
    key: 'billing',
    icon: 'receipt-outline',
    title: '청구서를 확인해요',
    description: '납부 기한과 결제 내역을 앱에서',
  },
] as const satisfies readonly {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}[];

/** 작은 섹션 라벨 — 시안 14px medium / text/title/subtle (설정 섹션). */
function GroupLabel({ label }: { label: string }) {
  return (
    <Typography
      variant="body-03"
      weight="medium"
      style={{ color: COLORS.text.title.subtle }}
    >
      {label}
    </Typography>
  );
}

/**
 * '전체보기' 텍스트 버튼 — 글자만 있는 작은 표적이라 눌린 게 눈에 안 띈다.
 * 눌림에 축소 + 회색 알약 배경 + 가벼운 햅틱을 얹어 손끝에 닿은 걸 알린다.
 * 배경 알약이 붙어도 줄 높이는 그대로여야 해서 padding만큼 음수 margin으로 상쇄한다.
 */
const PRESS_TINT = COLORS.gray[100];
const PRESS_DURATION = 120;

function MoreButton({ onPress }: { onPress: () => void }) {
  const pressed = useSharedValue(0);

  // worklet 안에서 s() 호출 금지(UI 스레드 크래시) — 렌더 단계에서 숫자로 미리 계산한다
  const padX = s(8);
  const padY = s(2);
  const radius = s(8);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      ['rgba(233,238,240,0)', PRESS_TINT],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="자녀 전체보기"
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: PRESS_DURATION });
        // 햅틱 미지원 기기에서 조용히 넘어가게 — 실패해도 시각 피드백은 그대로 간다
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: PRESS_DURATION });
      }}
      hitSlop={8}
      className="ml-2"
    >
      <Animated.View
        style={[
          {
            paddingHorizontal: padX,
            paddingVertical: padY,
            marginHorizontal: -padX,
            marginVertical: -padY,
            borderRadius: radius,
          },
          animatedStyle,
        ]}
      >
        <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
          전체보기
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

/**
 * 그룹 라벨 + 우측 '전체보기' 행 — 시안 1063:9231.
 * 자녀 섹션은 설정 섹션보다 한 단계 굵다(16 semibold / title-default) — GroupLabel과 별도.
 */
function GroupHeaderRow({
  label,
  onPressMore,
}: {
  label: string;
  onPressMore: () => void;
}) {
  return (
    <View className="h-5 flex-row items-center justify-between">
      <Typography
        variant="body-01"
        weight="semibold"
        numberOfLines={1}
        className="flex-1"
        style={{ color: COLORS.text.title.default }}
      >
        {label}
      </Typography>
      <MoreButton onPress={onPressMore} />
    </View>
  );
}

/** 자녀 카드 고정 치수 — 카드/추가 버튼이 같은 크기로 정렬(가로 스크롤에서 세로 늘어남 방지). */
const CARD_W = s(150);
const CARD_H = s(166);

/**
 * 자녀 카드 그림자 — 시안 594:5510 = border-subtle + drop-shadow(0,-1 / 6.35 / 4%).
 * 위쪽 4% 그림자는 거의 안 보이고 카드 정의는 border가 주도한다.
 * 안드로이드 elevation은 짙은 회색 아래 그림자라 과해 보여 0(테두리만)으로 둔다.
 */
const CARD_SHADOW = {
  shadowColor: '#021C33',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 0,
} as const;

/** 자녀 카드 하단에 붙는 참여 센터 — 이름은 잘려도 "외 N개"는 남아야 한다. */
type CenterSummary = { name: string; extraCount: number };

/** 자녀 카드 — 아바타·이름·생년(만 N세) + 하단 참여 센터. 탭하면 프로필 편집. */
function ChildCard({
  profile,
  center,
  onPress,
}: {
  profile: Profile;
  center: CenterSummary;
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
        className="bg-surface"
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border.subtle,
          ...CARD_SHADOW,
        }}
      >
        {/* 시안 523:4651 — pt 16 / pb 12 / px 16, 아바타↔이름 12 */}
        <View className="flex-1 items-center px-4 pb-3 pt-4">
          <Avatar uri={profile.image_url} size={s(44)} />
          <Typography
            variant="body-02"
            weight="semibold"
            className="mt-3"
            numberOfLines={1}
            style={{ color: COLORS.text.title.default }}
          >
            {profile.display_name}
          </Typography>
          {birth ? (
            <Typography
              variant="body-03"
              className="mt-1"
              numberOfLines={1}
              style={{ color: COLORS.text.body.default }}
            >
              {birth}
            </Typography>
          ) : null}
        </View>
        <View
          className="flex-row items-center py-3 pl-3 pr-4"
          style={{ borderTopWidth: 1, borderTopColor: COLORS.border.subtle }}
        >
          <CenterIcon20 width={s(20)} height={s(20)} />
          {/* 시안 1063:9245 — 센터명만 말줄임하고 "외 N개"는 별도 노드로 항상 보인다
              (한 문자열로 합치면 긴 센터명에서 개수가 통째로 잘린다) */}
          <View className="ml-1 flex-1 flex-row items-center">
            <Typography
              variant="body-03"
              weight="medium"
              numberOfLines={1}
              style={{ color: COLORS.text.body.default, flexShrink: 1 }}
            >
              {center.name}
            </Typography>
            {center.extraCount > 0 ? (
              <Typography
                variant="body-03"
                weight="medium"
                className="ml-1"
                numberOfLines={1}
                style={{ color: COLORS.text.body.default }}
              >
                외 {center.extraCount}개
              </Typography>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 빠른 이동 아이콘 버튼 — 가족관계·바우처·서류·청구서.
 * 시안 594:5312 — 폭 54, 아이콘 박스 40×40(radius 8, bg/surface-sunken), 아이콘 28, 박스↔라벨 12.
 */
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="items-center"
      style={({ pressed }) => ({ width: s(54), opacity: pressed ? 0.6 : 1 })}
      hitSlop={8}
    >
      <View
        className="items-center justify-center"
        style={{
          width: s(40),
          height: s(40),
          borderRadius: RADIUS.sm,
          backgroundColor: COLORS.bg['surface-sunken'],
        }}
      >
        {icon}
      </View>
      <Typography
        variant="body-03"
        weight="medium"
        className="mt-3"
        numberOfLines={1}
        style={{ color: COLORS.text.body.default }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

/** 설정 행 — 아이콘 + 라벨 + 화살표. */
function SettingRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View className="items-center justify-center" style={{ width: s(24), height: s(24) }}>
        {icon}
      </View>
      <Typography
        variant="body-01"
        weight="medium"
        className="ml-2 flex-1"
        style={{ color: COLORS.text.title.default }}
      >
        {label}
      </Typography>
      <ArrowRightIcon20 width={s(20)} height={s(20)} />
    </Pressable>
  );
}

export default function MyScreen() {
  const tabClearance = useTabBarClearance();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const meQuery = useMe();
  const me = meQuery.data;
  const logout = useAuthStore((s) => s.logout);
  const refreshControl = useRefreshControl(() => refetchIfFetched(meQuery));

  // 로그아웃 confirm
  const [logoutVisible, setLogoutVisible] = useState(false);

  const openCreateSheet = () => router.push('/(main)/profile-form');

  const openProfileDetail = (profileId: string) =>
    router.push({ pathname: '/(main)/profile-detail', params: { profileId } });

  const goSoon = (title: string) =>
    router.push({ pathname: '/(main)/coming-soon', params: { title } });

  const handleLogout = async () => {
    await logout();
    setLogoutVisible(false);
    // 로그아웃 후에도 게스트로 둘러볼 수 있게 탭 홈으로
    router.replace('/(main)/(tabs)');
  };

  // 게스트 — 계정이 있어야 하는 화면이므로 가입/로그인 안내
  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <TabHeader title="마이" />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: s(16), paddingBottom: tabClearance }}
        >
          {/* 히어로 — 게스트 홈(UnlinkedHome)과 같은 카드 언어로 맞춘다 */}
          <View
            className="mx-4 items-center rounded-2xl bg-surface px-5 pb-5 pt-7"
            style={SHADOWS.card}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: s(72), height: s(72), backgroundColor: ACCENT_TINT }}
            >
              <Ionicons name="person-outline" size={s(32)} color={ACCENT} />
            </View>
            <Typography
              variant="body-03"
              weight="medium"
              className="mt-4"
              style={{ color: ACCENT }}
            >
              둘러보는 중이에요
            </Typography>
            <Typography
              variant="headline-02"
              weight="semibold"
              className="mt-1 text-center"
              style={{ color: COLORS.text.title.default }}
            >
              계정을 만들면{'\n'}기록이 안전하게 이어져요
            </Typography>
            <Typography
              variant="body-02"
              className="mt-2 text-center"
              style={{ color: COLORS.text.body.default }}
            >
              폰이 바뀌어도 아이의 일정과 소식을{'\n'}계속 볼 수 있어요
            </Typography>
            <Button
              label="가입하기"
              onPress={() => router.push('/(auth)/signup')}
              className="mt-6"
              style={{ alignSelf: 'stretch' }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/login')}
              className="mt-4 items-center py-1"
              hitSlop={8}
            >
              <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
                이미 계정이 있으신가요?{' '}
                <Typography
                  variant="body-03"
                  weight="semibold"
                  style={{ color: ACCENT }}
                >
                  로그인
                </Typography>
              </Typography>
            </Pressable>
          </View>

          {/* 가입 유인 — 왜 계정이 필요한지 */}
          <View className="mt-9 px-4">
            <SectionTitle label="가입하면 이런 게 좋아요" />
            <View className="mt-3 rounded-2xl bg-surface">
              {GUEST_BENEFITS.map((benefit, i) => (
                <View key={benefit.key}>
                  {i > 0 ? (
                    <View
                      className="mx-4"
                      style={{ height: 1, backgroundColor: COLORS.border.subtle }}
                    />
                  ) : null}
                  <View className="flex-row items-center gap-3 px-4 py-4">
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 40, height: 40, backgroundColor: ACCENT_TINT }}
                    >
                      <Ionicons name={benefit.icon} size={20} color={ACCENT} />
                    </View>
                    <View className="flex-1">
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {benefit.title}
                      </Typography>
                      <Typography
                        variant="body-03"
                        className="mt-0.5"
                        style={{ color: COLORS.text.caption.default }}
                      >
                        {benefit.description}
                      </Typography>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 실험실 — 미연동/게스트 시안도 확인해야 하므로 게스트 화면에도 둔다(개발 빌드 전용) */}
          {__DEV__ ? (
            <View className="mt-9 px-4">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(main)/lab')}
                className="flex-row items-center rounded-2xl bg-surface px-4 py-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Ionicons name="flask-outline" size={s(24)} color={COLORS.text.title.default} />
                <Typography
                  variant="body-01"
                  weight="medium"
                  className="ml-2 flex-1"
                  style={{ color: COLORS.text.title.default }}
                >
                  실험실
                </Typography>
                <ArrowRightIcon20 width={s(20)} height={s(20)} />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const profiles = me?.profiles ?? [];
  const headerAvatar = profiles.find((p) => p.relation === 'self')?.image_url ?? null;
  const groupLabel = `${profiles.length}명의 자녀가 있어요`;

  // 프로필별 참여 센터(active 링크만) 집계 — 자녀 카드 하단 문구
  const activeLinksByProfile = new Map<string, CenterLink[]>();
  for (const link of me?.links ?? []) {
    if (link.status !== 'active') continue;
    const arr = activeLinksByProfile.get(link.profile_id) ?? [];
    arr.push(link);
    activeLinksByProfile.set(link.profile_id, arr);
  }
  const centerFor = (profileId: string): CenterSummary => {
    const links = activeLinksByProfile.get(profileId) ?? [];
    if (links.length === 0) return { name: '연결된 센터 없음', extraCount: 0 };
    return { name: links[0].center_name, extraCount: links.length - 1 };
  };

  return (
    <View className="flex-1 bg-surface">
      {/* 상단 배경 그라데이션 — 시안 1063:9205 (#ECF6FE → 투명, h 391).
          상태바 뒤까지 덮어야 흰 띠가 생기지 않아 SafeAreaView 바깥에 둔다(records 탭과 같은 방식). */}
      <LinearGradient
        colors={['#ECF6FE', 'rgba(236,246,254,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s(391) }}
        pointerEvents="none"
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        <TabHeader title="마이" />

        {meQuery.isLoading ? (
          <LoadingView className="flex-1" />
        ) : meQuery.isError ? (
          <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={refreshControl}
            contentContainerStyle={{ paddingTop: s(20), paddingBottom: tabClearance }}
          >
            {/* 프로필 헤더 — 이름·이메일 + 계정 관리 */}
            <View className="flex-row items-center px-4">
              <Avatar uri={headerAvatar} size={s(44)} />
              <View className="ml-3 flex-1">
                <Typography
                  variant="title-01"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ color: COLORS.text.title.default }}
                >
                  {me?.person.name}님, 반가워요
                </Typography>
                <Typography
                  variant="label-01"
                  className="mt-0.5"
                  numberOfLines={1}
                  style={{ color: COLORS.text.body.default }}
                >
                  {me?.account.email}
                </Typography>
              </View>
              <Button
                label="계정 관리"
                variant="assistive"
                size="md"
                onPress={() => goSoon('계정 관리')}
                className="ml-2"
              />
            </View>

            {/* 자녀 프로필 — 가로 스크롤 카드 */}
            <View className="mt-7">
              <View className="px-4">
                <GroupHeaderRow
                  label={groupLabel}
                  onPressMore={() => router.push('/(main)/profiles')}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingVertical: s(4),
                  gap: 12,
                }}
              >
                {profiles.map((profile) => (
                  <ChildCard
                    key={profile.id}
                    profile={profile}
                    center={centerFor(profile.id)}
                    onPress={() => openProfileDetail(profile.id)}
                  />
                ))}
                {/* 프로필 추가 카드 */}
                <Pressable
                  accessibilityRole="button"
                  onPress={openCreateSheet}
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <View
                    className="items-center justify-center"
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: COLORS.border.default,
                      borderStyle: 'dashed',
                    }}
                  >
                    <Ionicons name="add" size={s(24)} color={COLORS.icon.secondary} />
                    <Typography
                      variant="body-03"
                      weight="medium"
                      className="mt-1"
                      style={{ color: COLORS.text.body.default }}
                    >
                      프로필 추가
                    </Typography>
                  </View>
                </Pressable>
              </ScrollView>
            </View>

            {/* 빠른 이동 — 시안 594:5485 (좌우 32, 4개 균등 분산, 구분선 없음) */}
            <View
              className="mt-7 flex-row items-start justify-between"
              style={{ paddingHorizontal: s(32) }}
            >
              <QuickAction
                icon={<FamilyIcon28 width={s(28)} height={s(28)} />}
                label="가족관계"
                onPress={() => router.push('/(main)/family')}
              />
              <QuickAction
                icon={<VoucherIcon28 width={s(28)} height={s(28)} />}
                label="바우처"
                onPress={() => router.push('/(main)/vouchers')}
              />
              <QuickAction
                icon={<DocumentIcon28 width={s(28)} height={s(28)} />}
                label="서류"
                onPress={() => goSoon('서류')}
              />
              <QuickAction
                icon={<BillIcon28 width={s(28)} height={s(28)} />}
                label="청구서"
                onPress={() => router.push('/(main)/billing')}
              />
            </View>

            {/* 그룹 구분 밴드 — 시안 594:5694 (h 8, bg/base), 위아래 24 */}
            <View
              className="mt-6"
              style={{ height: 8, backgroundColor: COLORS.bg.base }}
            />

            {/* 설정 — 시안 594:5557 (알림·앱 잠금·환경 설정 3행, 라벨↔목록 12) */}
            <View className="mt-6 px-4">
              <GroupLabel label="설정" />
              <View className="mt-3">
                <SettingRow
                  icon={<BellIcon24 width={s(24)} height={s(24)} />}
                  label="알림 설정"
                  onPress={() => router.push('/(main)/notifications')}
                />
                <SettingRow
                  icon={<LockIcon24 width={s(24)} height={s(24)} />}
                  label="앱 잠금"
                  onPress={() => goSoon('앱 잠금')}
                />
                <SettingRow
                  icon={<GearIcon24 width={s(24)} height={s(24)} />}
                  label="환경 설정"
                  onPress={() => goSoon('환경 설정')}
                />
                {/* 실험실 — 반영 전 시안 확인용, 개발 빌드에서만 노출 */}
                {__DEV__ ? (
                  <SettingRow
                    icon={
                      <Ionicons
                        name="flask-outline"
                        size={s(24)}
                        color={COLORS.text.title.default}
                      />
                    }
                    label="실험실"
                    onPress={() => router.push('/(main)/lab')}
                  />
                ) : null}
              </View>
            </View>

            {/* 로그아웃 */}
            <View className="mt-8 px-4">
              <Pressable
                accessibilityRole="button"
                onPress={() => setLogoutVisible(true)}
                className="h-12 items-center justify-center rounded-lg"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? COLORS.gray[200] : COLORS.gray[100],
                })}
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[700] }}
                >
                  로그아웃
                </Typography>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* 로그아웃 confirm */}
        <ConfirmModal
          visible={logoutVisible}
          title="로그아웃할까요?"
          message="언제든 다시 로그인해서 이어볼 수 있어요."
          confirmLabel="로그아웃"
          cancelLabel="취소"
          onConfirm={handleLogout}
          onCancel={() => setLogoutVisible(false)}
        />
      </SafeAreaView>
    </View>
  );
}
