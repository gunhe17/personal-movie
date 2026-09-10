import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useToastStore } from '@/features/toast';
import { useCreatePayment } from '../hooks';
import type { PaymentMethodType } from '../types';

/**
 * 납부 등록 시트 (web PaymentModal 대응)
 * 미수금 초과 금액은 입력 단계에서 상한 적용(과오납 방지), 백엔드도 이중 차단.
 * 납부일시는 현재 시각 자동(모바일 간소화) — 날짜 지정이 필요하면 web에서.
 */
interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  billableId: string | null;
  unpaidAmount: number;
}

const METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: 'card', label: '카드' },
  { value: 'transfer', label: '계좌이체' },
  { value: 'cash', label: '현금' },
];

const QUICK = [25, 50, 75, 100];

/** 청구하기/납부 버튼 teal — DS 외 임시 토큰 (BillableDetailSheet와 통일) */
const TEAL = '#00C3BC';

export function PaymentSheet({
  visible,
  onClose,
  centerId,
  billableId,
  unpaidAmount,
}: PaymentSheetProps) {
  const showToast = useToastStore((st) => st.show);
  const createPayment = useCreatePayment(centerId, billableId);

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethodType>('card');
  const [memo, setMemo] = useState('');

  // 열릴 때 미수금 전액으로 초기화
  useEffect(() => {
    if (visible) {
      setAmount(unpaidAmount);
      setMethod('card');
      setMemo('');
    }
  }, [visible, unpaidAmount]);

  const isValid =
    amount > 0 && amount <= unpaidAmount && !createPayment.isPending;
  const remaining = unpaidAmount - amount;

  const handleAmountChange = (t: string) => {
    const parsed = parseInt(t.replace(/[^0-9]/g, '') || '0', 10);
    setAmount(Math.min(parsed, unpaidAmount)); // 과오납 방지 상한
  };

  const handleSubmit = () => {
    if (!isValid) return;
    createPayment.mutate(
      {
        amount,
        payment_method: method,
        paid_at: new Date().toISOString(),
        memo: memo.trim() || undefined,
      },
      {
        onSuccess: () => {
          showToast({ type: 'info', message: '납부를 등록했어요' });
          onClose();
        },
        onError: () =>
          showToast({ type: 'error', message: '납부 등록에 실패했어요' }),
      },
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center justify-between">
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          납부 등록
        </Typography>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityLabel="닫기"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ maxHeight: s(420) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(8) }}
      >
      {/* 금액 */}
      <View className="mb-1.5 flex-row items-center justify-between">
        <Typography variant="body-03" weight="medium" className="text-gray-600">
          납부 금액
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: remaining > 0 ? COLORS.error : COLORS.success }}
        >
          미수금 {remaining.toLocaleString()}원
        </Typography>
      </View>
      <View
        className="flex-row items-center rounded-xl border border-gray-200 px-4"
        style={{ height: s(52) }}
      >
        <TextInput
          value={amount > 0 ? amount.toLocaleString() : ''}
          onChangeText={handleAmountChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={COLORS.gray[400]}
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: s(18),
            fontWeight: '700',
            color: COLORS.gray[800],
            letterSpacing: -0.41,
          }}
        />
        <Typography variant="body-02" className="ml-2 text-gray-400">
          원
        </Typography>
      </View>

      {/* 빠른 비율 */}
      <View className="mt-2 flex-row gap-2">
        {QUICK.map((pct) => {
          const pctAmount = Math.round((unpaidAmount * pct) / 100);
          const active = amount === pctAmount && amount > 0;
          return (
            <TouchableOpacity
              key={pct}
              onPress={() => setAmount(pctAmount)}
              activeOpacity={0.7}
              className="flex-1 items-center rounded-md py-2"
              style={{ backgroundColor: active ? COLORS.primary : COLORS.gray[100] }}
            >
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: active ? COLORS.white : COLORS.gray[600] }}
              >
                {pct}%
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 납부 수단 */}
      <Typography
        variant="body-03"
        weight="medium"
        className="mb-1.5 mt-4 text-gray-600"
      >
        납부 수단
      </Typography>
      <View className="flex-row gap-2">
        {METHODS.map((m) => {
          const active = method === m.value;
          return (
            <TouchableOpacity
              key={m.value}
              onPress={() => setMethod(m.value)}
              activeOpacity={0.7}
              className="flex-1 items-center py-3"
              style={{
                borderRadius: 8,
                backgroundColor: active ? COLORS.primary50 : COLORS.gray[50],
                borderWidth: 1,
                borderColor: active ? COLORS.primary : COLORS.gray[200],
              }}
            >
              <Typography
                variant="body-02"
                weight={active ? 'semibold' : 'regular'}
                style={{ color: active ? COLORS.primary700 : COLORS.gray[600] }}
              >
                {m.label}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 메모 */}
      <Typography
        variant="body-03"
        weight="medium"
        className="mb-1.5 mt-4 text-gray-600"
      >
        메모 (선택)
      </Typography>
      <TextInput
        value={memo}
        onChangeText={setMemo}
        placeholder="메모를 입력하세요"
        placeholderTextColor={COLORS.gray[400]}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: s(56),
          borderWidth: 1,
          borderColor: COLORS.gray[200],
          borderRadius: s(12),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          fontSize: s(14),
          color: COLORS.gray[900],
          letterSpacing: -0.41,
        }}
      />
      </ScrollView>

      {/* 납부 등록 */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!isValid}
        activeOpacity={0.7}
        className="mt-4 items-center justify-center rounded-md py-3.5"
        style={{ backgroundColor: isValid ? TEAL : COLORS.gray[300] }}
        accessibilityLabel="납부 등록"
        accessibilityRole="button"
      >
        {createPayment.isPending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography variant="body-02" weight="semibold" className="text-white">
            납부 등록
          </Typography>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}
