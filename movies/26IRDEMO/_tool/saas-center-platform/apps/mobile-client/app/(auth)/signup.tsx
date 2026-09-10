import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth';
import { useLinkFlowStore } from '@/features/link';
import { getErrorMessage } from '@/shared/api/client';
import { Button, LabeledInput, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** 액센트 — 로그인 화면과 동일 토큰(primary 버튼과 한 곳에서 따라온다) */
const ACCENT = COLORS.button.primary.bg;

type FieldErrors = Partial<Record<'name' | 'phone' | 'email' | 'password', string>>;

export default function SignupScreen() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /** 필드별 검증 오류 — 해당 인풋에 붙는다 */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  /** 서버 오류(중복 가입 등) — 폼 단위로 */
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** 입력을 고치는 즉시 해당 필드 오류를 걷어낸다 */
  const clearError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setFormError(null);
  };

  /** 전 필드를 한 번에 검증 — 첫 오류에서 멈추지 않고 모두 표시한다 */
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = '이름을 입력해 주세요.';
    if (phone.trim().replace(/[^0-9]/g, '').length < 10)
      next.phone = '휴대폰 번호를 확인해 주세요.';
    if (!EMAIL_PATTERN.test(email.trim()))
      next.email = '올바른 이메일 형식으로 입력해 주세요.';
    if (password.length < 8) next.password = '비밀번호는 8자 이상으로 입력해 주세요.';
    return next;
  };

  const handleSubmit = async () => {
    const next = validate();
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await signup({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim(),
      });
      // 딥링크로 들어온 초대 코드가 있으면 연결 플로우로 복귀
      router.replace(
        useLinkFlowStore.getState().pendingCode ? '/(link)/code' : '/(main)/(tabs)',
      );
    } catch (err) {
      setFormError(
        getErrorMessage(err, '가입하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      );
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-1">
        <View className="h-[52px] flex-row items-center px-4">
          {router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="뒤로가기"
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
            </Pressable>
          ) : null}
        </View>
        <KeyboardAwareScrollView
          bottomOffset={24}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }}
          keyboardShouldPersistTaps="handled"
        >
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: ACCENT }}
          >
            마인드스코프
          </Typography>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-2"
            style={{ color: COLORS.text.headline }}
          >
            만나서 반가워요
          </Typography>
          <Typography
            variant="body-02"
            className="mt-1.5"
            style={{ color: COLORS.text.body.default }}
          >
            이메일로 간단히 시작할 수 있어요
          </Typography>

          <View className="mt-8 gap-4">
            <LabeledInput
              label="이름"
              placeholder="홍길동"
              value={name}
              onChangeText={(v) => {
                setName(v);
                clearError('name');
              }}
              status={fieldErrors.name ? 'error' : 'default'}
              helperText={fieldErrors.name}
              autoCapitalize="none"
            />
            <LabeledInput
              label="휴대폰 번호"
              placeholder="010-0000-0000"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                clearError('phone');
              }}
              status={fieldErrors.phone ? 'error' : 'default'}
              helperText={fieldErrors.phone}
              keyboardType="phone-pad"
            />
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
            />
            <LabeledInput
              label="비밀번호"
              placeholder="8자 이상 입력해 주세요"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clearError('password');
              }}
              status={fieldErrors.password ? 'error' : 'default'}
              helperText={fieldErrors.password}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {formError ? (
            <Typography
              variant="body-03"
              className="mt-3"
              style={{ color: COLORS.status.danger }}
            >
              {formError}
            </Typography>
          ) : null}

          <Button
            label="가입하기"
            onPress={handleSubmit}
            loading={submitting}
            className="mt-6"
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/login')}
            className="mt-5 items-center py-2"
          >
            <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
              이미 계정이 있으신가요?{' '}
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: ACCENT }}
              >
                로그인
              </Typography>
            </Typography>
          </Pressable>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}
