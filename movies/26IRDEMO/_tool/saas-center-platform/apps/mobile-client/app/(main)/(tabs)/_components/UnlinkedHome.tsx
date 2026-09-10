/**
 * 미연결 홈 — 로그인 전(1286:10257)과 센터 미연동(1286:10757) 두 상태를 한 화면이 그린다.
 *
 * 구성은 같다: 히어로(일러스트 + 카피 + CTA) → '센터 알아보기' 리스트.
 * 갈리는 건 CTA다 — 계정이 없으면 먼저 로그인시키고, 로그인했으면 아이 정보를 받아
 * 지원 확인 플로우(`(main)/support-check`)로 보낸다(이미 입력했으면 '결과 보기').
 *
 * 시안(1286:10257 로그인 전 · 1286:10757 미연동)에 없는 요소는 두지 않는다 — 옛 하단
 * 탈출구 링크는 제거했다. 초대 코드 입력은 마이(center-links)·일정·활동 탭에 경로가 있다.
 * 상단 배경 글로우는 헤더 뒤까지 덮어야 해서 화면(index.tsx)이 그린다.
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSupportCheckStore } from '@/features/support-check';
import { Button, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS, RADIUS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import ExploreNearbyIcon from '@assets/images/home/explore-nearby.svg';
import ExplorePlayIcon from '@assets/images/home/explore-play.svg';
import ExploreArtIcon from '@assets/images/home/explore-art.svg';
import ExploreMusicIcon from '@assets/images/home/explore-music.svg';
import PlusIcon20 from '@assets/icons/20/PlusIcon20.svg';

/** 히어로 일러스트 원본 비율(시안 179.325 × 136.5) */
const HERO_W = 179;
const HERO_H = 137;

/** 아이콘 배지 — 박스 40 고정, 그 안의 아이콘은 에셋 네이티브 28 고정(기기 폭에 스케일하지 않는다) */
const BADGE_BOX = 40;
const BADGE_ICON = 28;

const EXPLORE_ROWS = [
  {
    key: 'nearby',
    title: '내 주변 센터',
    description: '가까운 곳에서 시작하기',
    Icon: ExploreNearbyIcon,
    href: '/(main)/centers' as Href,
  },
  {
    key: 'play',
    title: '놀이치료',
    description: '놀이로 마음읽기',
    Icon: ExplorePlayIcon,
    // 치료 유형별 콘텐츠가 아직 없다 — 준비 중 안내로 보낸다
    href: {
      pathname: '/(main)/coming-soon',
      params: { title: '놀이치료' },
    } as Href,
  },
  {
    key: 'art',
    title: '미술치료',
    description: '말 대신 그림으로',
    Icon: ExploreArtIcon,
    href: {
      pathname: '/(main)/coming-soon',
      params: { title: '미술치료' },
    } as Href,
  },
  {
    key: 'music',
    title: '음악치료',
    description: '마음을 두드리는 리듬',
    Icon: ExploreMusicIcon,
    href: {
      pathname: '/(main)/coming-soon',
      params: { title: '음악치료' },
    } as Href,
  },
] as const;

interface UnlinkedHomeProps {
  /** 로그인 전 = 가입 유도, 로그인+미연동 = 초대 코드 (그 외 구성은 동일) */
  isGuest: boolean;
  /** 로그인 사용자의 자녀 프로필 — 이미 있으면 CTA가 '결과 보기'가 된다 */
  profileBirthDate: string | null;
}

export function UnlinkedHome({ isGuest, profileBirthDate }: UnlinkedHomeProps) {
  const router = useRouter();
  const answers = useSupportCheckStore();

  // 로컬 저장값 복원 전에는 판단하지 않는다 — CTA 라벨이 깜빡이며 바뀌는 걸 막는다
  if (!answers.isHydrated) {
    return <LoadingView className="py-16" />;
  }

  const hasChildInfo = (answers.birthDate ?? profileBirthDate) !== null;

  return (
    // 시안 1286:10391 하단 여백 36
    <View style={{ paddingBottom: s(36) }}>
      {/* 히어로 — 시안 1286:10390 (gap 24) */}
      <View className="items-center px-4" style={{ rowGap: s(24) }}>
        <Image
          source={require('@assets/images/home/hero-support.png')}
          style={{ width: s(HERO_W), height: s(HERO_H) }}
          resizeMode="contain"
        />

        <View className="w-full items-center" style={{ rowGap: s(16) }}>
          <View className="items-center" style={{ rowGap: s(8) }}>
            <Typography
              variant="headline-02"
              weight="semibold"
              className="text-center"
              style={{ color: COLORS.text.title.default }}
            >
              우리 아이, 어떤 지원을 받을 수 있을까요?
            </Typography>
            <Typography
              variant="body-02-reading"
              className="text-center"
              style={{ color: COLORS.text.body.default }}
            >
              {
                '몇 가지 정보만 입력하면 받을 수 있는 바우처와\n이용 가능한 센터를 찾아드려요.'
              }
            </Typography>
          </View>

          {/* 시안 폭 고정(로그인 120 · 아이 등록하기 131) — 짧은 라벨이 내용폭으로 쪼그라들지 않게 */}
          {isGuest ? (
            // 계정이 없으면 지원 확인부터 시키지 않는다 — 입력한 내용이 남을 곳이 없다
            <Button
              label="로그인"
              size="lg"
              minWidth={120}
              onPress={() => router.push('/(auth)/login')}
            />
          ) : (
            <Button
              label={hasChildInfo ? '결과 보기' : '아이 등록하기'}
              size="lg"
              minWidth={120}
              icon={
                hasChildInfo ? undefined : <PlusIcon20 width={s(20)} height={s(20)} />
              }
              onPress={() =>
                router.push(
                  hasChildInfo
                    ? {
                        pathname: '/(main)/support-check',
                        params: { start: 'result' },
                      }
                    : '/(main)/support-check',
                )
              }
            />
          )}
        </View>
      </View>

      {/* 센터 알아보기 — 시안 1286:10391 (히어로 아래 44) */}
      <View className="px-4" style={{ marginTop: s(44), rowGap: s(12) }}>
        <View className="flex-row items-center justify-between">
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            센터 알아보기
          </Typography>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(main)/centers')}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Typography
              variant="body-03"
              style={{ color: COLORS.text.body.default }}
            >
              전체보기
            </Typography>
          </Pressable>
        </View>

        <View className="rounded-2xl bg-surface">
          {EXPLORE_ROWS.map((row, i) => (
            <View key={row.key}>
              {i > 0 ? (
                <View
                  className="mx-3"
                  style={{ height: 1, backgroundColor: COLORS.border.default }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(row.href)}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <View
                  className="flex-row items-center px-3 py-4"
                  style={{ columnGap: s(12) }}
                >
                  <View
                    className="items-center justify-center overflow-hidden"
                    style={{
                      width: BADGE_BOX,
                      height: BADGE_BOX,
                      // 시안 11.163 → 토큰 12로 정규화(카드 16 ⊃ 배지 12)
                      borderRadius: RADIUS.lg,
                      backgroundColor: COLORS.bg['brand-subtle'],
                    }}
                  >
                    <row.Icon width={BADGE_ICON} height={BADGE_ICON} />
                  </View>
                  <View style={{ rowGap: s(4) }}>
                    <Typography
                      variant="body-01"
                      weight="semibold"
                      style={{ color: COLORS.text.body.strong }}
                    >
                      {row.title}
                    </Typography>
                    <Typography
                      variant="body-03"
                      style={{ color: COLORS.text.body.subtle }}
                    >
                      {row.description}
                    </Typography>
                  </View>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
