import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  LAB_EXPERIMENTS,
  getLabRoute,
  type LabCategory,
  type LabExperiment,
} from '@/features/lab';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Tabs } from '@/shared/components/ui/Tabs';
import { s } from '@/shared/utils/scale';
import { TabTransition } from './_components/TabTransition';

const STATUS_LABEL: Record<NonNullable<LabExperiment['status']>, string> = {
  ready: '준비됨',
  wip: '작업중',
};

const STATUS_COLOR: Record<NonNullable<LabExperiment['status']>, string> = {
  ready: COLORS.success,
  wip: COLORS.warning,
};

export default function LabScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const router = useRouter();
  const [category, setCategory] = useState<LabCategory>('final');

  const { finalCount, agenticCount, legacyCount, experiments } = useMemo(() => {
    const final = LAB_EXPERIMENTS.filter((e) => e.category === 'final');
    const agentic = LAB_EXPERIMENTS.filter((e) => e.category === 'agentic');
    const legacy = LAB_EXPERIMENTS.filter(
      (e) => e.category !== 'final' && e.category !== 'agentic',
    );
    return {
      finalCount: final.length,
      agenticCount: agentic.length,
      legacyCount: legacy.length,
      experiments:
        category === 'final' ? final : category === 'agentic' ? agentic : legacy,
    };
  }, [category]);

  return (
    <TabTransition>
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="h-12 flex-row items-center px-5">
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          실험실
        </Typography>
      </View>

      <View style={{ paddingTop: s(16), paddingHorizontal: s(20) }}>
        <Typography variant="body-03" className="text-gray-600">
          새로운 UI/UX 아이디어를 검증하는 공간. 정식 출시 전 실험용입니다.
        </Typography>
      </View>

      <View style={{ marginTop: s(16), paddingHorizontal: s(20) }}>
        <Tabs<LabCategory>
          value={category}
          onChange={setCategory}
          options={[
            { value: 'final', label: `최종 시안 (${finalCount})` },
            { value: 'agentic', label: `Agentic 시안 (${agenticCount})` },
            { value: 'legacy', label: `이전 시안 (${legacyCount})` },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40) }}>
        {experiments.length === 0 ? (
          <View
            className="items-center justify-center rounded-lg bg-surface"
            style={{ paddingVertical: s(48) }}
          >
            <Ionicons name="flask-outline" size={s(32)} color={COLORS.gray[400]} />
            <View style={{ height: s(8) }} />
            <Typography variant="body-02" className="text-gray-500">
              등록된 실험 화면이 없습니다
            </Typography>
          </View>
        ) : (
          <View className="gap-3">
            {experiments.map((exp) => (
              <TouchableOpacity
                key={exp.slug}
                activeOpacity={0.85}
                onPress={() => router.push(getLabRoute(exp.slug) as Href)}
                className="rounded-lg bg-surface"
                style={{
                  padding: s(16),
                  borderWidth: 1,
                  borderColor: COLORS.border.default,
                }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center" style={{ gap: s(8) }}>
                      <Ionicons
                        name="flask-outline"
                        size={s(16)}
                        color={COLORS.primary}
                      />
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        className="text-gray-900"
                      >
                        {exp.title}
                      </Typography>
                    </View>
                    <View style={{ height: s(6) }} />
                    <Typography variant="body-03" className="text-gray-600">
                      {exp.description}
                    </Typography>
                  </View>

                  <View className="items-end" style={{ gap: s(8) }}>
                    {exp.status && (
                      <View
                        className="rounded-sm"
                        style={{
                          paddingHorizontal: s(6),
                          paddingVertical: s(2),
                          backgroundColor: STATUS_COLOR[exp.status] + '1A',
                        }}
                      >
                        <Typography
                          variant="label-02"
                          weight="medium"
                          style={{ color: STATUS_COLOR[exp.status] }}
                        >
                          {STATUS_LABEL[exp.status]}
                        </Typography>
                      </View>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={s(18)}
                      color={COLORS.gray[400]}
                    />
                  </View>
                </View>

                <View
                  style={{ marginTop: s(10) }}
                  className="flex-row items-center"
                >
                  <Typography variant="caption-01" className="text-gray-400">
                    /lab/{exp.slug}
                  </Typography>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      </SafeAreaView>
    </TabTransition>
  );
}
