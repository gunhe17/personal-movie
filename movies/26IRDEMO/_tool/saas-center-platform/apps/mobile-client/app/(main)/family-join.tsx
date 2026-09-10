/** 가족 합류 — 초대 코드 입력. 화면 규약은 센터 연결(app/(link)/code)과 같다. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useJoinFamily } from '@/features/family';
import { getErrorMessage } from '@/shared/api/client';
import { Button, CodeInput, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const CODE_LENGTH = 6;
const AUTO_PRESS_SCALE = 0.97;
const AUTO_PRESS_DOWN_MS = 90;
const AUTO_PRESS_UP_MS = 130;

export default function FamilyJoinScreen() {
  const router = useRouter();
  const joinMutation = useJoinFamily();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const handleChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
  };

  const submitCode = (value: string) => {
    setError(null);
    joinMutation.mutate(value, {
      onSuccess: () => router.replace('/(main)/family'),
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 404 || status === 410) {
            setError('코드를 다시 확인해 주세요. 만료됐다면 다시 받아야 해요.');
            return;
          }
        }
        setError(getErrorMessage(err, '합류하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      },
    });
  };

  const handleSubmit = () => {
    if (code.length !== CODE_LENGTH) {
      setError('6자리 코드를 모두 입력해 주세요.');
      return;
    }
    submitCode(code);
  };

  // 다 채우면 [합류하기]가 눌리는 모션을 보여주고, 그 모션이 끝난 뒤 요청
  const handleComplete = (value: string) => {
    if (joinMutation.isPending) return;
    ctaScale.value = withSequence(
      withTiming(AUTO_PRESS_SCALE, { duration: AUTO_PRESS_DOWN_MS }),
      withTiming(1, { duration: AUTO_PRESS_UP_MS }, (finished) => {
        if (finished) runOnJS(submitCode)(value);
      }),
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <View className="h-[52px] flex-row items-center px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          bottomOffset={24}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: s(14), paddingBottom: s(24) }}
          keyboardShouldPersistTaps="handled"
        >
          <Typography
            variant="headline-01"
            weight="semibold"
            style={{ color: COLORS.text.headline }}
          >
            가족에게 받은{'\n'}초대 코드를 입력해주세요
          </Typography>
          <Typography
            variant="body-02"
            weight="medium"
            style={{ marginTop: s(8), color: COLORS.text.title.subtle }}
          >
            영문·숫자 조합의 6자리 코드예요
          </Typography>

          <View style={{ marginTop: s(107) }}>
            <CodeInput
              value={code}
              onChangeText={handleChange}
              onComplete={handleComplete}
              errorText={error}
              length={CODE_LENGTH}
            />
          </View>
        </KeyboardAwareScrollView>

        <View
          className="bg-background"
          style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}
        >
          <Animated.View style={ctaStyle}>
            <Button
              label="합류하기"
              onPress={handleSubmit}
              loading={joinMutation.isPending}
              disabled={code.length !== CODE_LENGTH}
            />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}
