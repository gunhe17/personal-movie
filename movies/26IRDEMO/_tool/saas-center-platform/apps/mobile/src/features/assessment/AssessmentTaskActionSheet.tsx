import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import RAnimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useToastStore } from '@/features/toast';
import { useTaskStatusActions } from './hooks';
import type { AssessmentTaskSummary } from './types';

type TaskAction = 'cancel' | 'refuse';

interface AssessmentTaskActionSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  caseId: string | null;
  task: AssessmentTaskSummary | null;
}

/** 검사 항목 상태 변경 시트 — 중단·거부(사유 입력)·되돌리기. 완료/삭제는 web 전용 */
export function AssessmentTaskActionSheet({
  visible,
  onClose,
  centerId,
  caseId,
  task,
}: AssessmentTaskActionSheetProps) {
  const [step, setStep] = useState<'menu' | 'reason'>('menu');
  const [pendingAction, setPendingAction] = useState<TaskAction | null>(null);
  const [reason, setReason] = useState('');
  const inputRef = useRef<TextInput>(null);
  const showToast = useToastStore((st) => st.show);
  const { cancel, refuse, rollback } = useTaskStatusActions(centerId, caseId);
  const insets = useSafeAreaInsets();
  const { height: kbHeightSV } = useReanimatedKeyboardAnimation();

  const animatedBottomStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -kbHeightSV.value - insets.bottom),
  }));

  useEffect(() => {
    if (visible) {
      setStep('menu');
      setPendingAction(null);
      setReason('');
    }
  }, [visible]);

  if (!task) return null;

  const isReverted = task.status === 'cancelled' || task.status === 'refused';
  const isPending = cancel.isPending || refuse.isPending || rollback.isPending;

  const goReason = (action: TaskAction) => {
    setPendingAction(action);
    setReason('');
    setStep('reason');
    setTimeout(() => inputRef.current?.focus(), 450);
  };

  const handleRollback = () => {
    rollback.mutate(
      { taskId: task.id },
      {
        onSuccess: () => {
          showToast({ type: 'info', message: '되돌렸어요' });
          onClose();
        },
        onError: () =>
          showToast({ type: 'error', message: '처리 중 오류가 발생했어요' }),
      },
    );
  };

  const handleConfirmReason = () => {
    const trimmed = reason.trim();
    if (!trimmed || !pendingAction) return;
    const onSuccess = () => {
      showToast({
        type: 'info',
        message:
          pendingAction === 'cancel'
            ? '검사를 중단했어요'
            : '검사를 거부 처리했어요',
      });
      onClose();
    };
    const onError = () =>
      showToast({ type: 'error', message: '처리 중 오류가 발생했어요' });

    if (pendingAction === 'cancel') {
      cancel.mutate({ taskId: task.id, reason: trimmed }, { onSuccess, onError });
    } else {
      refuse.mutate(
        { assessmentId: task.assessment_id, reason: trimmed },
        { onSuccess, onError },
      );
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      fullHeight={step === 'reason'}
    >
      {step === 'menu' ? (
        <View style={{ gap: s(4) }}>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            검사 항목 처리
          </Typography>
          <Typography
            variant="body-03"
            style={{ marginBottom: s(12), color: COLORS.gray[500] }}
            numberOfLines={1}
          >
            {task.assessment_name}
          </Typography>

          {isReverted ? (
            <ActionRow
              icon="arrow-undo-outline"
              iconColor={COLORS.primary}
              label="되돌리기"
              description="중단·거부를 취소하고 이전 상태로 되돌려요"
              disabled={isPending}
              onPress={handleRollback}
            />
          ) : (
            <>
              <ActionRow
                icon="pause-circle-outline"
                iconColor={COLORS.warning}
                label="검사 중단"
                description="사유를 입력해 검사를 잠시 멈춰요"
                disabled={isPending}
                onPress={() => goReason('cancel')}
              />
              <ActionRow
                icon="close-circle-outline"
                iconColor={COLORS.error}
                label="검사 거부"
                description="내담자가 검사를 거부했어요"
                disabled={isPending}
                onPress={() => goReason('refuse')}
              />
            </>
          )}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            className="items-center justify-center rounded-md border border-gray-200"
            style={{ paddingVertical: s(13), marginTop: s(8) }}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              닫기
            </Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* 헤더 — 뒤로 + 제목 */}
          <View
            className="flex-row items-center"
            style={{ gap: s(6), marginBottom: s(4) }}
          >
            <TouchableOpacity
              onPress={() => setStep('menu')}
              hitSlop={8}
              accessibilityLabel="뒤로"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.gray[700]} />
            </TouchableOpacity>
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              {pendingAction === 'cancel' ? '검사 중단' : '검사 거부'}
            </Typography>
          </View>
          <Typography
            variant="body-03"
            style={{ marginBottom: s(16), color: COLORS.gray[500] }}
            numberOfLines={1}
          >
            {task.assessment_name}
          </Typography>

          {/* 입력 영역 — OpinionSheet와 동일 구조 (flex ScrollView + scrollEnabled false) */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: s(16) }}
          >
            <TextInput
              ref={inputRef}
              value={reason}
              onChangeText={setReason}
              placeholder={
                pendingAction === 'cancel'
                  ? '중단 사유를 입력해주세요'
                  : '거부 사유를 입력해주세요'
              }
              placeholderTextColor={COLORS.gray[400]}
              multiline
              textAlignVertical="top"
              maxLength={1000}
              scrollEnabled={false}
              style={{
                padding: s(14),
                minHeight: s(200),
                fontSize: s(15),
                lineHeight: s(24),
                color: COLORS.gray[800],
                letterSpacing: -0.41,
                borderWidth: 1,
                borderColor: COLORS.gray[200],
                borderRadius: s(12),
                backgroundColor: COLORS.gray[50],
              }}
            />
          </ScrollView>

          {/* 하단 버튼 — 키보드와 동기화하여 위로 이동 */}
          <RAnimated.View style={[{ paddingTop: s(8) }, animatedBottomStyle]}>
            <View className="flex-row" style={{ gap: s(8) }}>
              <TouchableOpacity
                onPress={() => setStep('menu')}
                disabled={isPending}
                activeOpacity={0.7}
                className="flex-1 items-center justify-center rounded-md border border-gray-200"
                style={{ paddingVertical: s(13) }}
                accessibilityRole="button"
                accessibilityLabel="뒤로"
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[600] }}
                >
                  뒤로
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReason}
                disabled={isPending || reason.trim().length === 0}
                activeOpacity={0.7}
                className="flex-1 items-center justify-center rounded-md"
                style={{
                  paddingVertical: s(13),
                  backgroundColor:
                    isPending || reason.trim().length === 0
                      ? COLORS.gray[300]
                      : COLORS.primary,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  pendingAction === 'cancel' ? '중단하기' : '거부 처리하기'
                }
              >
                {isPending ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    className="text-white"
                  >
                    {pendingAction === 'cancel' ? '중단하기' : '거부 처리하기'}
                  </Typography>
                )}
              </TouchableOpacity>
            </View>
          </RAnimated.View>
        </View>
      )}
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  iconColor,
  label,
  description,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[50],
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: COLORS.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: s(1) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {label}
        </Typography>
        <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
          {description}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}
