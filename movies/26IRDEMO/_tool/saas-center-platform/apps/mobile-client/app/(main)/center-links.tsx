/**
 * 센터 연결 관리 — 연결된 센터 목록 + 초대 코드로 새 센터 연결.
 * 마이 탭 리뉴얼 톤(bg-base · 흰 카드 · 섹션 타이틀 body-01 semibold)에 맞춘 전용 화면.
 * 앱에서 센터 연결 해제는 제공하지 않는다 — 해제는 센터를 통해서만.
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import { linkStatusInfo } from '@/features/link/constants';
import {
  Badge,
  Button,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';

export default function CenterLinksScreen() {
  const router = useRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const refreshControl = useRefreshControl(() => meQuery.refetch());

  const links = me?.links ?? [];
  const profileNameById = new Map(
    (me?.profiles ?? []).map((p) => [p.id, p.display_name]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-[52px] flex-row items-center px-4" style={{ columnGap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          센터 연결
        </Typography>
      </View>

      {meQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingTop: s(8), paddingBottom: s(40) }}
        >
          <View className="px-4">
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              연결된 센터
            </Typography>

            {links.length === 0 ? (
              <View className="mt-3 rounded-2xl bg-surface p-4">
                <Typography variant="body-02" style={{ color: COLORS.text.body.default }}>
                  아직 연결된 센터가 없어요
                </Typography>
                <Typography
                  variant="body-03"
                  className="mt-1"
                  style={{ color: COLORS.text.caption.default }}
                >
                  센터에서 받은 초대 코드로 연결하면 일정·소식·청구서를 볼 수 있어요
                </Typography>
              </View>
            ) : (
              <View className="mt-3 rounded-2xl bg-surface p-4">
                {links.map((link, i) => {
                  const status = linkStatusInfo(link.status);
                  const childName = profileNameById.get(link.profile_id);
                  return (
                    <View key={link.id}>
                      {i > 0 ? (
                        <View
                          className="my-4"
                          style={{ height: 1, backgroundColor: COLORS.border.default }}
                        />
                      ) : null}
                      <View className="flex-row items-center justify-between">
                        <View className="mr-3 flex-1">
                          <Typography
                            variant="body-01"
                            weight="semibold"
                            numberOfLines={1}
                            style={{ color: COLORS.text.title.default }}
                          >
                            {link.center_name}
                          </Typography>
                          {childName ? (
                            <Typography
                              variant="body-03"
                              className="mt-0.5"
                              style={{ color: COLORS.text.caption.default }}
                            >
                              {childName}
                            </Typography>
                          ) : null}
                        </View>
                        <Badge label={status.label} color={status.color} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Button
              label="센터 연결하기"
              variant="secondary"
              onPress={() => router.push('/(link)/code')}
              className="mt-5"
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
