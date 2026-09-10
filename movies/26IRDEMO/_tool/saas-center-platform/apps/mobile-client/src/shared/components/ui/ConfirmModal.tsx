import React from 'react';
import { Modal, View } from 'react-native';
import { Button } from './Button';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 시안 Popup(1054:8336) — 폭 280 고정, 문구는 가운데, 버튼 2개가 폭을 반씩 */
const CARD_W = 280;

/**
 * 확인/취소 다이얼로그 — 피그마 Popup(1054:8336).
 *
 * 파괴적 액션에도 빨강을 쓰지 않는다 — 되돌릴 수 없다는 건 문구가 말하고,
 * 색은 겁주는 대신 차분하게 둔다.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: COLORS.bg.overlay }}
      >
        <View
          className="overflow-hidden bg-surface"
          style={{
            width: s(CARD_W),
            maxWidth: '100%',
            borderRadius: s(16),
            // 시안 effect popup — 0,2 / 16 / 10%
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <View
            className="items-center"
            style={{ paddingTop: s(24), paddingHorizontal: s(16), rowGap: s(4) }}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              className="w-full text-center"
              style={{ color: COLORS.text.title.default }}
            >
              {title}
            </Typography>
            {message ? (
              <Typography
                variant="body-03-reading"
                className="w-full text-center"
                style={{ color: COLORS.text.body.default }}
              >
                {message}
              </Typography>
            ) : null}
          </View>

          <View
            className="flex-row"
            style={{
              paddingTop: s(16),
              paddingHorizontal: s(16),
              paddingBottom: s(20),
              columnGap: s(8),
            }}
          >
            <View className="flex-1">
              <Button
                label={cancelLabel}
                variant="assistive"
                size="xl"
                disabled={loading}
                onPress={onCancel}
              />
            </View>
            <View className="flex-1">
              <Button
                label={confirmLabel}
                variant="primary"
                size="xl"
                loading={loading}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
