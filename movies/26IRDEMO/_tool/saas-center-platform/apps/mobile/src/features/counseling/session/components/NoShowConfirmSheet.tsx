import { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Toggle } from '@/shared/components/ui/Toggle';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 노쇼 확인 시트 — 원탭 즉시 확정 대신 회기 차감 여부를 먼저 묻는다 (D4).
 * 스펙 §3-1/§3-2: 노쇼는 사유 없음("이유 없이 안 온 것"이 정의) — 차감 여부만 결정.
 * 차감 기본값 OFF — 웹 NoShowReasonModal(initialIsConsumed=false)과 동일.
 */
export function NoShowConfirmSheet({
  visible,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  /** 처리 확정 — 회기 차감 여부 전달 */
  onConfirm: (isConsumed: boolean) => void;
  onClose: () => void;
}) {
  const [isConsumed, setIsConsumed] = useState(false);

  // 열릴 때마다 기본값(차감 OFF)으로 리셋
  useEffect(() => {
    if (visible) setIsConsumed(false);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-gray-900"
        style={{ textAlign: 'center', marginBottom: s(16) }}
      >
        노쇼로 처리할까요?
      </Typography>

      {/* 회기 차감 토글 — 웹 노쇼 모달과 동일 문구 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(12),
          backgroundColor: COLORS.gray[50],
          borderRadius: s(14),
          paddingHorizontal: s(14),
          paddingVertical: s(14),
        }}
      >
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-800">
            회기 차감
          </Typography>
          <Typography variant="body-03" weight="regular" className="text-gray-500">
            이번 노쇼를 남은 회기 1회 사용으로 처리해요.
          </Typography>
        </View>
        <Toggle value={isConsumed} onChange={setIsConsumed} />
      </View>

      <View className="flex-row" style={{ gap: s(8), marginTop: s(20) }}>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="취소"
          style={{
            flex: 1,
            height: s(52),
            borderRadius: s(12),
            backgroundColor: COLORS.gray[100],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="medium" className="text-gray-600">
            취소
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onConfirm(isConsumed)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="노쇼 처리"
          style={{
            flex: 1,
            height: s(52),
            borderRadius: s(12),
            backgroundColor: COLORS.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
            노쇼 처리
          </Typography>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}
