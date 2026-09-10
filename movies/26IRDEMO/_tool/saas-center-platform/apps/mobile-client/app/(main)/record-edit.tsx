/**
 * 기록 수정 — §15-5 "무흔적": 이력도 "수정됨" 딱지도 남기지 않는다.
 *
 * 사건 시각(occurred_at)은 정렬 축이지만 사용자가 고칠 수 있는 값이다 —
 * 다만 날짜 피커가 아직 없어 v1은 본문·개인 메모·기분만 고친다.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MOODS,
  useRecord,
  useUpdateRecord,
  type RecordMood,
} from '@/features/records';
import {
  Button,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS, SHADOWS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import ArrowLeftIcon20 from '@assets/icons/20/ArrowLeftIcon20.svg';

export default function RecordEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordQuery = useRecord(id ?? null);
  const updateRecord = useUpdateRecord();

  const [mood, setMood] = useState<RecordMood | null>(null);
  const [body, setBody] = useState('');
  const [privateMemo, setPrivateMemo] = useState('');
  const [loaded, setLoaded] = useState(false);

  const record = recordQuery.data;
  useEffect(() => {
    if (!record || loaded) return;
    setMood(record.mood);
    setBody(record.body ?? '');
    setPrivateMemo(record.private_memo ?? '');
    setLoaded(true);
  }, [record, loaded]);

  const submit = () => {
    if (!id) return;
    updateRecord.mutate(
      {
        recordId: id,
        input: {
          mood: mood ?? undefined,
          body: body.trim() || null,
          private_memo: privateMemo.trim() || null,
        },
      },
      {
        onSuccess: () => router.back(),
        onError: () =>
          Alert.alert(
            '저장하지 못했어요',
            '잠시 후 다시 시도해 주세요. 작성한 내용은 그대로 있어요.',
          ),
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ArrowLeftIcon20 width={20} height={20} />
        </Pressable>
      </View>

      {recordQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : recordQuery.isError || !record ? (
        <ErrorView className="flex-1" onRetry={() => recordQuery.refetch()} />
      ) : (
        <View className="flex-1">
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: s(16), rowGap: s(16) }}
            bottomOffset={s(24)}
          >
            <View className="flex-row flex-wrap" style={{ gap: s(8) }}>
              {MOODS.map((item) => {
                const active = mood === item.value;
                const tag = COLORS.tag[item.color];
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setMood(item.value)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                  >
                    <View
                      className="rounded-full"
                      style={{
                        paddingHorizontal: s(12),
                        paddingVertical: s(6),
                        backgroundColor: active ? tag.bg : COLORS.bg.base,
                      }}
                    >
                      <Typography
                        variant="body-03"
                        weight="medium"
                        style={{
                          color: active ? tag.fg : COLORS.text.body.default,
                        }}
                      >
                        {item.label}
                      </Typography>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View
              className="rounded-2xl border bg-surface"
              style={{ padding: s(16), borderColor: COLORS.border.subtle }}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="한 줄이어도 괜찮아요"
                placeholderTextColor={COLORS.text.placeholder}
                multiline
                style={{
                  minHeight: s(160),
                  textAlignVertical: 'top',
                  color: COLORS.text.body.strong,
                }}
              />
            </View>

            <View style={{ rowGap: s(6) }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.text.title.default }}
              >
                🔒 나만 볼 수 있어요
              </Typography>
              <View
                className="rounded-2xl bg-surface-sunken"
                style={{ padding: s(16) }}
              >
                <TextInput
                  value={privateMemo}
                  onChangeText={setPrivateMemo}
                  placeholder="나에게 남기는 메모"
                  placeholderTextColor={COLORS.text.placeholder}
                  multiline
                  style={{
                    minHeight: s(72),
                    textAlignVertical: 'top',
                    color: COLORS.text.body.strong,
                  }}
                />
              </View>
            </View>
          </KeyboardAwareScrollView>

          <View className="px-4 pb-4" style={{ ...SHADOWS.card }}>
            <Button
              label="저장"
              size="xl"
              loading={updateRecord.isPending}
              onPress={submit}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
