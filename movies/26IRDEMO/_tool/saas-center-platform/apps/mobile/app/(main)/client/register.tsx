import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  type TextInput as TextInputType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import {
  useCreateClient,
  useBatchCreateClients,
  RELATION_DETAIL_MAP,
  GUARDIAN_RELATION_OPTIONS,
  GENDER_OPTIONS,
  type CreateClientPayload,
  type BatchCreateClientsRequest,
} from '@/features/client';
import { formatPhoneInput, formatBirthInput, isValidBirthDate, isValidEmail, parseError } from '@/shared/utils';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

// ─── Steps ───────────────────────────────────────────────

type Step = 'name' | 'birth_gender' | 'phone' | 'guardian_ask' | 'guardian_info' | 'extra' | 'confirm';

const STEP_ORDER: Step[] = ['name', 'birth_gender', 'phone', 'guardian_ask', 'extra', 'confirm'];

function getStepIndex(step: Step): number {
  if (step === 'guardian_info') return STEP_ORDER.indexOf('guardian_ask');
  return STEP_ORDER.indexOf(step);
}

function getProgressSteps(hasGuardian: boolean): Step[] {
  const steps = [...STEP_ORDER];
  if (hasGuardian) {
    steps.splice(steps.indexOf('guardian_ask') + 1, 0, 'guardian_info');
  }
  return steps;
}

// ─── Types ───────────────────────────────────────────────

interface ClientForm {
  name: string;
  birth_date: string;
  gender: 'male' | 'female' | '';
  phone: string;
  email: string;
  address: string;
  memo: string;
}

interface GuardianForm {
  key: number;
  name: string;
  relation: string;
  phone: string;
}

const INITIAL_CLIENT: ClientForm = {
  name: '', birth_date: '', gender: '', phone: '',
  email: '', address: '', memo: '',
};

const createGuardian = (key: number): GuardianForm => ({
  key, name: '', relation: '', phone: '',
});

// ─── Main Component ──────────────────────────────────────

export default function ClientRegisterScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const createMutation = useCreateClient(centerId);
  const batchMutation = useBatchCreateClients(centerId);

  // Step state
  const [step, setStep] = useState<Step>('name');
  const [hasGuardian, setHasGuardian] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Form state
  const [client, setClient] = useState<ClientForm>(INITIAL_CLIENT);
  const [guardians, setGuardians] = useState<GuardianForm[]>([createGuardian(0)]);
  const [guardianKeyCounter, setGuardianKeyCounter] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Refs
  const inputRefs = useRef<Record<string, TextInputType | null>>({});
  const scrollRef = useRef<ScrollView>(null);

  // ─── Step Navigation ─────────────────────────────────

  const animateTransition = useCallback((nextStep: Step) => {
    Keyboard.dismiss();
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 120, useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      setErrors({});
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  }, [fadeAnim]);

  const allSteps = getProgressSteps(hasGuardian);
  const currentIdx = allSteps.indexOf(step);
  const totalSteps = allSteps.length;

  const goBack = useCallback(() => {
    if (currentIdx > 0) {
      animateTransition(allSteps[currentIdx - 1]);
    } else {
      router.back();
    }
  }, [currentIdx, allSteps, animateTransition, router]);

  const goNext = useCallback((target?: Step) => {
    if (target) {
      animateTransition(target);
    } else if (currentIdx < totalSteps - 1) {
      animateTransition(allSteps[currentIdx + 1]);
    }
  }, [currentIdx, totalSteps, allSteps, animateTransition]);

  // Auto-focus first input on step change
  useEffect(() => {
    const timer = setTimeout(() => {
      const keyMap: Record<string, string> = {
        name: 'name',
        birth_gender: 'birth_date',
        phone: 'phone',
        guardian_info: 'guardian.0.name',
        extra: 'email',
      };
      const refKey = keyMap[step];
      if (refKey) inputRefs.current[refKey]?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, [step]);

  // ─── Helpers ─────────────────────────────────────────

  const updateClient = useCallback(<K extends keyof ClientForm>(field: K, value: ClientForm[K]) => {
    setClient((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const updateGuardian = useCallback((idx: number, field: keyof GuardianForm, value: string) => {
    setGuardians((prev) => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
    const errKey = `guardian.${idx}.${field}`;
    setErrors((prev) => {
      if (!prev[errKey]) return prev;
      const next = { ...prev };
      delete next[errKey];
      return next;
    });
  }, []);

  const addGuardian = useCallback(() => {
    setGuardians((prev) => [...prev, createGuardian(guardianKeyCounter)]);
    setGuardianKeyCounter((k) => k + 1);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      inputRefs.current[`guardian.${guardians.length}.name`]?.focus();
    }, 300);
  }, [guardianKeyCounter, guardians.length]);

  const removeGuardian = useCallback((idx: number) => {
    setGuardians((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ─── Step Validation ─────────────────────────────────

  const validateStep = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    switch (step) {
      case 'name':
        if (!client.name.trim()) errs.name = '이름을 입력해주세요.';
        break;

      case 'birth_gender':
        if (!client.birth_date || client.birth_date.length !== 10) {
          errs.birth_date = '생년월일을 입력해주세요.';
        } else if (!isValidBirthDate(client.birth_date)) {
          errs.birth_date = '올바른 날짜를 입력해주세요.';
        }
        if (!client.gender) errs.gender = '성별을 선택해주세요.';
        break;

      case 'phone':
        if (client.phone && !/^[\d-]*$/.test(client.phone)) {
          errs.phone = '숫자와 하이픈(-)만 입력 가능합니다.';
        }
        break;

      case 'guardian_info':
        guardians.forEach((g, idx) => {
          if (!g.name.trim()) errs[`guardian.${idx}.name`] = '이름을 입력해주세요.';
          if (!g.relation) errs[`guardian.${idx}.relation`] = '관계를 선택해주세요.';
          if (!g.phone.trim()) {
            errs[`guardian.${idx}.phone`] = '연락처를 입력해주세요.';
          } else if (!/^[\d-]*$/.test(g.phone)) {
            errs[`guardian.${idx}.phone`] = '숫자와 하이픈(-)만 입력 가능합니다.';
          }
        });
        break;

      case 'extra':
        if (client.email && !isValidEmail(client.email)) {
          errs.email = '올바른 이메일 형식을 입력해주세요.';
        }
        break;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, client, guardians]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    goNext();
  }, [validateStep, goNext]);

  const handleSkip = useCallback(() => {
    goNext();
  }, [goNext]);

  // ─── Submit ──────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setErrors({});
    let createdClientId: string | null = null;

    try {
      if (hasGuardian && guardians.length > 0) {
        const payload: BatchCreateClientsRequest = {
          guardians: guardians.map((g, idx) => ({
            name: g.name.trim(),
            birth_date: null,
            gender: null,
            phone: g.phone.trim() || null,
            email: null,
            address: null,
            relation_type: 'parent',
            relation_detail: RELATION_DETAIL_MAP[g.relation] ?? 'caregiver',
            is_primary: idx === 0,
            memo: null,
          })),
          children: [{
            name: client.name.trim(),
            birth_date: client.birth_date,
            gender: client.gender as 'male' | 'female',
            phone: client.phone.trim() || null,
            email: client.email.trim() || null,
            address: client.address.trim() || null,
            memo: client.memo.trim() || null,
          }],
        };
        const batchResult = await batchMutation.mutateAsync(payload);
        createdClientId = batchResult.children?.[0]?.id ?? null;
      } else {
        const payload: CreateClientPayload = {
          role: 'client',
          name: client.name.trim(),
          birth_date: client.birth_date.length === 10 ? client.birth_date : null,
          gender: client.gender || null,
          phone: client.phone.trim() || null,
          email: client.email.trim() || null,
          address: client.address.trim() || null,
          memo: client.memo.trim() || null,
        };
        const created = await createMutation.mutateAsync(payload);
        createdClientId = created?.id ?? null;
      }

      // 목록 복귀는 담당 배정 전 내담자가 "내 담당" 스코프에 안 보여 등록 실패로
      // 오인된다(스테이징 검증 O5) → 방금 만든 내담자 상세로 착지
      Alert.alert('등록 완료', '내담자가 등록되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            if (createdClientId) {
              router.replace(`/(main)/client/${createdClientId}`);
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (error) {
      const appError = parseError(error);
      if (appError.status === 409) {
        Alert.alert('등록 실패', '이미 등록된 내담자입니다.\n이름과 생년월일을 확인해주세요.');
      } else {
        Alert.alert('등록 실패', appError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [hasGuardian, guardians, client, batchMutation, createMutation, router]);

  // ─── Reusable UI ─────────────────────────────────────

  const renderInput = (props: {
    refKey: string;
    placeholder: string;
    value: string;
    onChangeText: (v: string) => void;
    errorKey: string;
    keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'email-address';
    maxLength?: number;
    multiline?: boolean;
    returnKeyType?: 'next' | 'done' | 'go';
    onSubmitEditing?: () => void;
    autoFocus?: boolean;
  }) => {
    const error = errors[props.errorKey];
    return (
      <View>
        <TextInput
          ref={(r) => { inputRefs.current[props.refKey] = r; }}
          style={[
            props.multiline ? styles.textarea : styles.input,
            error && styles.inputError,
          ]}
          placeholder={props.placeholder}
          placeholderTextColor={COLORS.gray[400]}
          value={props.value}
          onChangeText={props.onChangeText}
          keyboardType={props.keyboardType ?? 'default'}
          maxLength={props.maxLength}
          multiline={props.multiline}
          returnKeyType={props.multiline ? undefined : (props.returnKeyType ?? 'done')}
          onSubmitEditing={props.onSubmitEditing}
          blurOnSubmit={!props.multiline}
          editable={!submitting}
          autoCapitalize="none"
          autoFocus={props.autoFocus}
          textAlignVertical={props.multiline ? 'top' : 'center'}
        />
        {error && <Text style={styles.fieldError}>{error}</Text>}
      </View>
    );
  };

  // ─── Step Renders ────────────────────────────────────

  const renderStepName = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>내담자 이름을{'\n'}입력해주세요</Text>
      <Text style={styles.stepHint}>정확한 이름을 입력해주세요.</Text>
      <View style={styles.fieldGroup}>
        {renderInput({
          refKey: 'name',
          placeholder: '이름',
          value: client.name,
          onChangeText: (v) => updateClient('name', v),
          errorKey: 'name',
          maxLength: 100,
          returnKeyType: 'go',
          onSubmitEditing: handleNext,
        })}
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.7}>
          <Text style={styles.primaryButtonText}>다음</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepBirthGender = () => {
    const birthError = errors.birth_date;
    const genderError = errors.gender;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>생년월일과 성별을{'\n'}알려주세요</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>생년월일</Text>
          {renderInput({
            refKey: 'birth_date',
            placeholder: 'YYYY-MM-DD',
            value: client.birth_date,
            onChangeText: (v) => updateClient('birth_date', formatBirthInput(v)),
            errorKey: 'birth_date',
            keyboardType: 'number-pad',
            maxLength: 10,
          })}

          <View style={styles.spacerMd} />
          <Text style={styles.fieldLabel}>성별</Text>
          <View style={styles.segmentRow}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.segmentButton,
                  client.gender === opt.value && styles.segmentActive,
                  genderError && !client.gender && styles.segmentError,
                ]}
                onPress={() => updateClient('gender', opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  client.gender === opt.value && styles.segmentTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {genderError && <Text style={styles.fieldError}>{genderError}</Text>}
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.7}>
            <Text style={styles.primaryButtonText}>다음</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStepPhone = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>연락처를{'\n'}입력해주세요</Text>
      <Text style={styles.stepHint}>나중에 입력할 수도 있어요.</Text>
      <View style={styles.fieldGroup}>
        {renderInput({
          refKey: 'phone',
          placeholder: '010-0000-0000',
          value: client.phone,
          onChangeText: (v) => updateClient('phone', formatPhoneInput(v)),
          errorKey: 'phone',
          keyboardType: 'phone-pad',
          maxLength: 13,
          returnKeyType: 'go',
          onSubmitEditing: handleNext,
        })}
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.7}>
          <Text style={styles.primaryButtonText}>다음</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepGuardianAsk = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>보호자를{'\n'}등록할까요?</Text>
      <Text style={styles.stepHint}>보호자를 함께 등록하면 관계가 자동으로 연결됩니다.</Text>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setHasGuardian(true);
            goNext('guardian_info');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryButtonText}>등록하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            setHasGuardian(false);
            goNext('extra');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepGuardianInfo = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>보호자 정보를{'\n'}입력해주세요</Text>

      {guardians.map((g, idx) => (
        <View key={g.key} style={styles.guardianCard}>
          <View style={styles.guardianHeader}>
            <View style={styles.guardianBadge}>
              <Text style={styles.guardianBadgeText}>
                {idx === 0 ? '주 보호자' : `보호자 ${idx + 1}`}
              </Text>
            </View>
            {guardians.length > 1 && (
              <TouchableOpacity onPress={() => removeGuardian(idx)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Ionicons name="close-circle" size={22} color={COLORS.gray[400]} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.fieldLabel}>이름</Text>
          {renderInput({
            refKey: `guardian.${idx}.name`,
            placeholder: '보호자 이름',
            value: g.name,
            onChangeText: (v) => updateGuardian(idx, 'name', v),
            errorKey: `guardian.${idx}.name`,
            maxLength: 100,
            returnKeyType: 'next',
            onSubmitEditing: () => inputRefs.current[`guardian.${idx}.phone`]?.focus(),
          })}

          <View style={styles.spacerSm} />
          <Text style={styles.fieldLabel}>관계</Text>
          <View style={styles.chipRow}>
            {GUARDIAN_RELATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  g.relation === opt && styles.chipActive,
                  errors[`guardian.${idx}.relation`] && !g.relation && styles.chipError,
                ]}
                onPress={() => {
                  updateGuardian(idx, 'relation', opt);
                  setTimeout(() => inputRefs.current[`guardian.${idx}.phone`]?.focus(), 100);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, g.relation === opt && styles.chipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors[`guardian.${idx}.relation`] && (
            <Text style={styles.fieldError}>{errors[`guardian.${idx}.relation`]}</Text>
          )}

          <View style={styles.spacerSm} />
          <Text style={styles.fieldLabel}>연락처</Text>
          {renderInput({
            refKey: `guardian.${idx}.phone`,
            placeholder: '010-0000-0000',
            value: g.phone,
            onChangeText: (v) => updateGuardian(idx, 'phone', formatPhoneInput(v)),
            errorKey: `guardian.${idx}.phone`,
            keyboardType: 'phone-pad',
            maxLength: 13,
          })}
        </View>
      ))}

      <TouchableOpacity style={styles.addGuardianButton} onPress={addGuardian} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
        <Text style={styles.addGuardianText}>보호자 추가</Text>
      </TouchableOpacity>

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.7}>
          <Text style={styles.primaryButtonText}>다음</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepExtra = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>추가 정보를{'\n'}입력해주세요</Text>
      <Text style={styles.stepHint}>나중에 입력할 수도 있어요.</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>이메일</Text>
        {renderInput({
          refKey: 'email',
          placeholder: 'example@email.com',
          value: client.email,
          onChangeText: (v) => updateClient('email', v),
          errorKey: 'email',
          keyboardType: 'email-address',
          maxLength: 100,
          returnKeyType: 'next',
          onSubmitEditing: () => inputRefs.current['address']?.focus(),
        })}

        <View style={styles.spacerMd} />
        <Text style={styles.fieldLabel}>주소</Text>
        {renderInput({
          refKey: 'address',
          placeholder: '주소를 입력해주세요',
          value: client.address,
          onChangeText: (v) => updateClient('address', v),
          errorKey: 'address',
          maxLength: 500,
          returnKeyType: 'next',
          onSubmitEditing: () => inputRefs.current['memo']?.focus(),
        })}

        <View style={styles.spacerMd} />
        <Text style={styles.fieldLabel}>메모</Text>
        {renderInput({
          refKey: 'memo',
          placeholder: '메모를 입력해주세요',
          value: client.memo,
          onChangeText: (v) => updateClient('memo', v),
          errorKey: 'memo',
          multiline: true,
          maxLength: 2000,
        })}
        {client.memo.length > 0 && (
          <Text style={styles.charCount}>{client.memo.length}/2000</Text>
        )}
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.7}>
          <Text style={styles.primaryButtonText}>다음</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipButtonText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepConfirm = () => {
    const genderLabel = client.gender === 'male' ? '남' : client.gender === 'female' ? '여' : '-';
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>입력하신 정보를{'\n'}확인해주세요</Text>

        <View style={styles.confirmCard}>
          <Text style={styles.confirmSectionTitle}>내담자</Text>
          <ConfirmRow label="이름" value={client.name} />
          <ConfirmRow label="생년월일" value={client.birth_date || '-'} />
          <ConfirmRow label="성별" value={genderLabel} />
          {!!client.phone && <ConfirmRow label="연락처" value={client.phone} />}
          {!!client.email && <ConfirmRow label="이메일" value={client.email} />}
          {!!client.address && <ConfirmRow label="주소" value={client.address} />}
          {!!client.memo && <ConfirmRow label="메모" value={client.memo} />}
        </View>

        {hasGuardian && guardians.length > 0 && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmSectionTitle}>보호자</Text>
            {guardians.map((g, idx) => (
              <View key={g.key}>
                {idx > 0 && <View style={styles.confirmDivider} />}
                <ConfirmRow label="이름" value={g.name} />
                <ConfirmRow label="관계" value={g.relation} />
                <ConfirmRow label="연락처" value={g.phone || '-'} />
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? '등록 중...' : '등록하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Step Router ─────────────────────────────────────

  const stepContent: Record<Step, () => React.JSX.Element> = {
    name: renderStepName,
    birth_gender: renderStepBirthGender,
    phone: renderStepPhone,
    guardian_ask: renderStepGuardianAsk,
    guardian_info: renderStepGuardianInfo,
    extra: renderStepExtra,
    confirm: renderStepConfirm,
  };

  // ─── Progress ────────────────────────────────────────

  const progressRatio = (currentIdx + 1) / totalSteps;

  // ─── Main Render ─────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          disabled={submitting}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내담자 등록</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {stepContent[step]()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-Components ──────────────────────────────────────

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  // Header
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.gray[100],
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },

  // Scroll
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.xl,
    paddingTop: 32,
  },

  // Step
  stepContainer: {
    flex: 1,
    gap: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray[900],
    lineHeight: 34,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  stepHint: {
    fontSize: 14,
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginTop: -12,
  },

  // Fields
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[600],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginBottom: 6,
  },
  input: {
    height: 52,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    backgroundColor: COLORS.gray[50],
    fontSize: 16,
    color: COLORS.text.body.strong,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    borderWidth: 1.5,
    borderColor: COLORS.gray[200],
  },
  textarea: {
    minHeight: 100,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: COLORS.gray[50],
    fontSize: 16,
    color: COLORS.text.body.strong,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    borderWidth: 1.5,
    borderColor: COLORS.gray[200],
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.gray[400],
    textAlign: 'right',
    marginTop: 4,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  spacerSm: { height: 8 },
  spacerMd: { height: 16 },

  // Gender segment
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderWidth: 1.5,
    borderColor: COLORS.gray[200],
  },
  segmentActive: {
    backgroundColor: COLORS.primary50,
    borderColor: COLORS.primary,
  },
  segmentError: {
    borderColor: COLORS.error,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  segmentTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Relation chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray[50],
    borderWidth: 1.5,
    borderColor: COLORS.gray[200],
  },
  chipActive: {
    backgroundColor: COLORS.primary50,
    borderColor: COLORS.primary,
  },
  chipError: {
    borderColor: COLORS.error,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  chipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Buttons
  buttonGroup: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  skipButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },

  // Guardian
  guardianCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  guardianHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  guardianBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary50,
  },
  guardianBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  addGuardianButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary200,
    borderStyle: 'dashed',
  },
  addGuardianText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },

  // Confirm
  confirmCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: 10,
  },
  confirmSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray[800],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginBottom: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  confirmLabel: {
    fontSize: 14,
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    width: 70,
  },
  confirmValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'right',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: COLORS.gray[200],
    marginVertical: 6,
  },
});
