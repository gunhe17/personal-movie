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
import { useBillablePrefill, useCreateBillable } from '../hooks';
import type { CreateBillablePayload } from '../types';

/**
 * 패키지 선결제 시트 (web PackageBillingModal 간소화)
 *
 * 케이스의 (내담자 참여, 취소 제외) 세션마다 BillableItem 1건씩 발행 — 회기당 단가 × 회기 수.
 * 각 item에 related_session_id가 박혀 세션별 커버 판정이 가능(추가 회기는 미청구로 남음).
 * 회기별 개별 편집은 생략(간소화) — 회기당 단가 1개만 입력.
 */
interface PackageBillingSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  client: { id: string; name: string } | null;
  caseId: string;
  caseType: 'counseling' | 'assessment';
  relatedType: string; // 'counseling_case'
  /** 내담자가 참여한 (취소 제외) 세션 ID 목록 — 세션별 1:1 매핑 발행 */
  sessionIds: string[];
}

function todayDateString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}

export function PackageBillingSheet({
  visible,
  onClose,
  centerId,
  client,
  caseId,
  caseType,
  relatedType,
  sessionIds,
}: PackageBillingSheetProps) {
  const showToast = useToastStore((st) => st.show);
  const prefillQuery = useBillablePrefill(
    visible ? centerId : null,
    visible ? caseType : null,
    visible ? caseId : null,
    { enabled: visible },
  );
  const createBillable = useCreateBillable(centerId);

  const [unitPrice, setUnitPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!visible) {
      setInitialized(false);
      setUnitPrice(0);
      setDescription('');
      setPriceListId(null);
      setMemo('');
      return;
    }
    if (initialized || prefillQuery.data === undefined) return;
    setInitialized(true);
    const first = prefillQuery.data[0];
    setUnitPrice(first?.unit_price ?? 0);
    setDescription(
      first?.description ?? (caseType === 'counseling' ? '상담' : '검사'),
    );
    setPriceListId(first?.price_list_id ?? null);
  }, [visible, prefillQuery.data, initialized, caseType]);

  const sessionCount = sessionIds.length;
  const total = unitPrice * sessionCount;
  const canSubmit = !!client && sessionCount > 0 && !createBillable.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !client) return;
    const payload: CreateBillablePayload = {
      client_id: client.id,
      billable_date: todayDateString(),
      memo: memo.trim() || undefined,
      items: sessionIds.map((sid) => ({
        item_type: 'service',
        price_list_id: priceListId,
        description: description.trim() || '상담',
        quantity: 1,
        unit_price: unitPrice,
        related_type: relatedType,
        related_case_id: caseId,
        related_session_id: sid,
      })),
    };
    createBillable.mutate(payload, {
      onSuccess: (res) => {
        if (res.warnings && res.warnings.length > 0) {
          showToast({ type: 'error', message: res.warnings[0] });
        } else {
          showToast({ type: 'info', message: '패키지 선결제를 발행했어요' });
        }
        onClose();
      },
      onError: () =>
        showToast({
          type: 'error',
          message: '발행에 실패했어요 (이미 개별 청구가 있을 수 있어요)',
        }),
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center justify-between">
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          패키지 선결제
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

      {prefillQuery.isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: s(440) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 내담자 */}
          <View className="mb-4 rounded-2xl bg-gray-50 px-4 py-3">
            <Typography variant="label-01" className="text-gray-500">
              내담자
            </Typography>
            <Typography
              variant="body-02"
              weight="semibold"
              className="mt-0.5 text-gray-900"
            >
              {client?.name ?? '-'}
            </Typography>
          </View>

          {/* 안내 */}
          <View
            className="mb-4 rounded-2xl px-4 py-3"
            style={{ backgroundColor: COLORS.primary50 }}
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.primary700 }}
            >
              전체 {sessionCount}회기를 한 번에 청구해요
            </Typography>
            <Typography variant="label-01" className="mt-1 text-gray-600">
              각 회기에 회기당 단가가 적용돼요. 이후 추가되는 회기는 미청구로
              남아요.
            </Typography>
          </View>

          {/* 회기당 단가 */}
          <Typography
            variant="label-01"
            weight="semibold"
            className="mb-1.5 text-gray-700"
          >
            회기당 단가
          </Typography>
          <View
            className="flex-row items-center rounded-xl border border-gray-200 px-4"
            style={{ height: s(52) }}
          >
            <TextInput
              value={unitPrice > 0 ? unitPrice.toLocaleString() : ''}
              onChangeText={(t) =>
                setUnitPrice(parseInt(t.replace(/[^0-9]/g, '') || '0', 10))
              }
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.gray[400]}
              style={{
                flex: 1,
                textAlign: 'right',
                fontSize: s(16),
                fontWeight: '700',
                color: COLORS.gray[800],
                letterSpacing: -0.41,
              }}
            />
            <Typography variant="body-02" className="ml-2 text-gray-400">
              원
            </Typography>
          </View>

          {/* 총액 */}
          <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
            <Typography variant="body-02" weight="semibold" className="text-gray-700">
              총액 ({sessionCount}회기)
            </Typography>
            <Typography variant="body-01" weight="semibold" className="text-gray-900">
              {total.toLocaleString()}원
            </Typography>
          </View>

          {/* 메모 */}
          <Typography
            variant="label-01"
            weight="semibold"
            className="mb-1.5 mt-4 text-gray-700"
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
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.7}
        className="mt-4 items-center justify-center rounded-md py-3.5"
        style={{ backgroundColor: canSubmit ? COLORS.primary : COLORS.gray[300] }}
        accessibilityLabel="패키지 선결제 발행"
        accessibilityRole="button"
      >
        {createBillable.isPending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography variant="body-02" weight="semibold" className="text-white">
            패키지 선결제 발행
          </Typography>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}
