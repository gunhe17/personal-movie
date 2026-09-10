import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { useCenterStore, usePermissionStore } from '@/features/center';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';
import { parseError, isValidEmail } from '@/shared/utils/error';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const setCenterContext = useCenterStore((s) => s.setCenterContext);
  const fetchPermissions = usePermissionStore((s) => s.fetchPermissions);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearErrors = () => setErrors({});

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!email.trim()) {
      next.email = '이메일을 입력해주세요.';
    } else if (!isValidEmail(email.trim())) {
      next.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!password.trim()) {
      next.password = '비밀번호를 입력해주세요.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    clearErrors();

    try {
      await login({ email: email.trim(), password });

      const centers = useAuthStore.getState().centers;

      if (centers.length === 1) {
        setCenterContext(centers[0].id, centers[0].name, centers[0].role_code);
        fetchPermissions(centers[0].id);
        router.replace('/(main)/(tabs)');
      } else {
        router.replace('/(auth)/center-select');
      }
    } catch (error: unknown) {
      const appError = parseError(error);

      switch (appError.type) {
        case 'network':
          setErrors({ general: appError.message });
          break;
        case 'auth':
          setErrors({ general: '이메일 또는 비밀번호가 올바르지 않습니다.' });
          break;
        case 'server':
          setErrors({ general: appError.message });
          break;
        default:
          setErrors({ general: appError.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <Text style={styles.logoText}>MindScope</Text>
          <Text style={styles.subtitle}>상담사 전용</Text>
        </View>

        <View style={styles.form}>
          {/* 일반 에러 메시지 (네트워크, 서버, 인증 실패) */}
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          <View>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="이메일"
              placeholderTextColor={COLORS.gray[400]}
              value={email}
              onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
          </View>

          <View>
            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="비밀번호"
              placeholderTextColor={COLORS.gray[400]}
              value={password}
              onChangeText={(v) => { setPassword(v); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  form: {
    gap: SPACING.md,
  },
  errorBanner: {
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorBannerText: {
    fontSize: 14,
    color: COLORS.error,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    lineHeight: 20,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border.default,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text.body.strong,
    backgroundColor: COLORS.surface,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: SPACING.xs,
    paddingLeft: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  loginButton: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: COLORS.text.state.inverse,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
