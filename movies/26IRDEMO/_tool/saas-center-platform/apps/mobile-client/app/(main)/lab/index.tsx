/**
 * 실험실 — 반영 전 시안 목록 (개발 빌드 전용).
 *
 * 진입: 마이 탭 > 설정 > 실험실. 목록은 `src/features/lab/registry.ts`가 소유한다.
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LAB_EXPERIMENTS, getLabRoute } from '@/features/lab';
import { Badge, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export default function LabListScreen() {
  const router = useRouter();

  if (!__DEV__) {
    return <Redirect href="/(main)/(tabs)" />;
  }

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
          실험실
        </Typography>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: s(16), paddingBottom: s(40) }}
      >
        <Typography variant="body-02" style={{ color: COLORS.text.body.default }}>
          반영 전 시안을 확인하는 공간. 실데이터가 아닌 mock으로 그려지며,
          여기서 확정된 것만 실제 화면에 반영한다.
        </Typography>

        {LAB_EXPERIMENTS.length === 0 ? (
          <View
            className="mt-4 items-center justify-center rounded-2xl bg-surface"
            style={{ paddingVertical: s(48) }}
          >
            <Ionicons name="flask-outline" size={s(32)} color={COLORS.gray[400]} />
            <Typography
              variant="body-02"
              className="mt-2"
              style={{ color: COLORS.text.body.subtle }}
            >
              등록된 시안이 없습니다
            </Typography>
          </View>
        ) : (
          <View className="mt-4" style={{ rowGap: 12 }}>
            {LAB_EXPERIMENTS.map((exp) => (
              <Pressable
                key={exp.slug}
                accessibilityRole="button"
                onPress={() => router.push(getLabRoute(exp.slug) as Href)}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <View
                  className="rounded-2xl bg-surface p-4"
                  style={{ borderWidth: 1, borderColor: COLORS.border.subtle }}
                >
                  <View className="flex-row items-start" style={{ columnGap: 8 }}>
                    <Typography
                      variant="body-01"
                      weight="semibold"
                      className="flex-1"
                      style={{ color: COLORS.text.title.default }}
                    >
                      {exp.title}
                    </Typography>
                    {exp.status ? (
                      <Badge
                        shape="rect"
                        label={exp.status === 'ready' ? '준비됨' : '작업중'}
                        color={exp.status === 'ready' ? 'green' : 'orange'}
                      />
                    ) : null}
                  </View>
                  <Typography
                    variant="body-03"
                    className="mt-2"
                    style={{ color: COLORS.text.body.default }}
                  >
                    {exp.description}
                  </Typography>
                  <Typography
                    variant="label-02"
                    className="mt-3"
                    style={{ color: COLORS.text.body.subtle }}
                  >
                    /lab/{exp.slug}
                  </Typography>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
