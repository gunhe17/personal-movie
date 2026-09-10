import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth';
import { useLinkFlowStore } from '@/features/link';
import { getErrorMessage } from '@/shared/api/client';
import { Button, LabeledInput, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** 액센트 — primary 버튼과 같은 토큰(그린/블루 확정 시 tokens.js 한 곳만 교체) */
const ACCENT = COLORS.button.primary.bg;

/** 진입 스태거 — 화면 전환(안드로이드 180ms)보다 늘어지지 않게 짧게 */
const ENTER_DURATION = 260;
const stagger = (order: number) => FadeInDown.duration(ENTER_DURATION).delay(order * 45);

/** 서버 인증 실패는 필드로 귀속이 안 돼 폼이 좌우로 흔들린다 */
const SHAKE_OFFSET = 8;
const SHAKE_STEP = 55;

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const runShake = () => {
    shake.value = withSequence(
      withTiming(-SHAKE_OFFSET, { duration: SHAKE_STEP }),
      withTiming(SHAKE_OFFSET, { duration: SHAKE_STEP }),
      withTiming(-SHAKE_OFFSET / 2, { duration: SHAKE_STEP }),
      withTiming(0, { duration: SHAKE_STEP }),
    );
  };

  const clearError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setFormError(null);
  };

  const handleSubmit = async () => {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = '이메일을 입력해 주세요.';
    if (!password) next.password = '비밀번호를 입력해 주세요.';
    if (next.email || next.password) {
      setFieldErrors(next);
      setFormError(null);
      runShake();
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // 딥링크로 들어온 초대 코드가 있으면 연결 플로우로 복귀
      router.replace(
        useLinkFlowStore.getState().pendingCode ? '/(link)/code' : '/(main)/(tabs)',
      );
    } catch (err) {
      setFormError(
        getErrorMessage(err, '로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.'),
      );
      setSubmitting(false);
      runShake();
    }
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
          contentContainerStyle={{ paddingTop: s(8), paddingBottom: s(40) }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={stagger(0)}>
            <Typography variant="body-02" weight="medium" style={{ color: ACCENT }}>
              마인드스코프
            </Typography>
            <Typography
              variant="headline-01"
              weight="semibold"
              className="mt-2"
              style={{ color: COLORS.text.headline }}
            >
              로그인
            </Typography>
          </Animated.View>

          <Animated.View entering={stagger(1)} style={shakeStyle}>
            <View className="mt-8 gap-4">
              <LabeledInput
                label="이메일"
                placeholder="example@email.com"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearError('email');
                }}
                status={fieldErrors.email ? 'error' : 'default'}
                helperText={fieldErrors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
              />
              <LabeledInput
                label="비밀번호"
                placeholder="비밀번호를 입력해 주세요"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
                status={fieldErrors.password ? 'error' : 'default'}
                helperText={fieldErrors.password}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                rightIcon={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                    onPress={() => setPasswordVisible((prev) => !prev)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.icon.secondary}
                    />
                  </Pressable>
                }
              />
            </View>

            {formError ? (
              <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: 12 }}>
                <Typography variant="body-03" style={{ color: COLORS.status.danger }}>
                  {formError}
                </Typography>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View entering={stagger(2)}>
            <Button
              label="로그인"
              onPress={handleSubmit}
              loading={submitting}
              className="mt-6"
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/signup')}
              className="mt-5 items-center py-2"
              hitSlop={8}
            >
              <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
                아직 계정이 없으신가요?{' '}
                <Typography variant="body-03" weight="semibold" style={{ color: ACCENT }}>
                  회원가입
                </Typography>
              </Typography>
            </Pressable>
          </Animated.View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
