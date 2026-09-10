/** 센터 연결 — 초대 코드 입력. 시안 1015:8365. 6칸 입력은 공용 CodeInput. */
import React, { useEffect, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useVerifyInvitation, useLinkFlowStore } from '@/features/link';
import { getErrorMessage } from '@/shared/api/client';
import { Button, CodeInput, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const CODE_LENGTH = 6;
/** 마지막 자리를 채우면 [다음]을 대신 눌러 준다 — 그 눌림을 눈으로 보여주는 모션 */
const AUTO_PRESS_SCALE = 0.97;
const AUTO_PRESS_DOWN_MS = 90;
const AUTO_PRESS_UP_MS = 130;

export default function LinkCodeScreen() {
  const router = useRouter();
  const setVerified = useLinkFlowStore((state) => state.setVerified);
  const verifyMutation = useVerifyInvitation();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const handleChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
  };

  // QR·딥링크 진입 — ?code=6자리면 채운다. 제출은 아래 자동 제출이 맡는다.
  // pendingCode = 비로그인 딥링크가 가입 게이트를 살아남은 코드 (스토어 스태시).
  const { code: codeParam, profileId } = useLocalSearchParams<{
    code?: string;
    profileId?: string;
  }>();
  const pendingCode = useLinkFlowStore((state) => state.pendingCode);
  const clearPendingCode = useLinkFlowStore((state) => state.clearPendingCode);
  const consumedParamRef = useRef<string | null>(null);
  useEffect(() => {
    const incoming =
      typeof codeParam === 'string' && codeParam ? codeParam : pendingCode;
    if (!incoming || consumedParamRef.current === incoming) return;
    consumedParamRef.current = incoming;
    if (pendingCode) clearPendingCode();
    setCode(incoming.replace(/[^A-Za-z0-9]/g, '').slice(0, CODE_LENGTH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam, pendingCode]);

  // 자녀 상세에서 왔으면 그 아이를 confirm까지 들고 간다(진입 경로가 이미 대상을 안다)
  const setTargetProfileId = useLinkFlowStore((state) => state.setTargetProfileId);
  useEffect(() => {
    setTargetProfileId(typeof profileId === 'string' && profileId ? profileId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const submitCode = (value: string) => {
    setError(null);
    verifyMutation.mutate(value, {
      onSuccess: (result) => {
        // 딥링크 자동 검증 경로에선 code state가 아직 스테일 — 인자 값을 쓴다
        setVerified(value, result);
        router.push('/(link)/confirm');
      },
      onError: (err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 404 || status === 410) {
            setError(
              '코드를 다시 확인해 주세요. 만료됐다면 센터에 재발급을 요청할 수 있어요.',
            );
            return;
          }
        }
        setError(getErrorMessage(err, '확인하지 못했어요. 잠시 후 다시 시도해 주세요.'));
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

  // 다 채우면 [다음]이 눌리는 모션을 보여주고, 그 모션이 끝난 뒤 요청
  const handleComplete = (value: string) => {
    if (verifyMutation.isPending) return;
    ctaScale.value = withSequence(
      withTiming(AUTO_PRESS_SCALE, { duration: AUTO_PRESS_DOWN_MS }),
      withTiming(1, { duration: AUTO_PRESS_UP_MS }, (finished) => {
        if (finished) runOnJS(submitCode)(value);
      }),
    );
  };

  const goHome = () => router.replace('/(main)/(tabs)');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <View className="h-[52px] flex-row items-center justify-between px-4">
          {router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="뒤로가기"
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
            </Pressable>
          ) : (
            <View />
          )}
          {/* 시안엔 없다 — 뒤로 갈 데가 없는 온보딩 진입에서만 남기는 탈출구 */}
          {router.canGoBack() ? null : (
            <Pressable accessibilityRole="button" onPress={goHome} hitSlop={8}>
              <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
                나중에 할게요
              </Typography>
            </Pressable>
          )}
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
            센터에서 받은{'\n'}초대 코드를 입력해주세요
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

        {/* 하단 CTA — 시안 1015:8376. 키보드 위로 띄우지 않는다(띄우면 입력 칸을 덮는다).
            6자리를 채우면 자동 제출이 대신 눌러 주므로 가려도 경로가 막히지 않는다 */}
        <View
          className="bg-background"
          style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}
        >
          <Animated.View style={ctaStyle}>
            <Button
              label="다음"
              onPress={handleSubmit}
              loading={verifyMutation.isPending}
              disabled={code.length !== CODE_LENGTH}
            />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}
