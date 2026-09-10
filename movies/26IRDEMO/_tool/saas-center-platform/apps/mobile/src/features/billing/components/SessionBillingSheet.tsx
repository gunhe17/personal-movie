import { useEffect, useMemo, useState } from 'react';
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
import type { BillableItemType, CreateBillablePayload } from '../types';

/**
 * 세션 단건 청구 발행 시트 (모바일 간소화 버전)
 *
 * web `SessionBillingModal`의 간소화: prefill 항목 확인 + 수량/단가 조정 + 메모 + 발행.
 * 바우처·지원금·할인은 제외(해당 케이스는 web에서 처리) — INFORMATION_SPEC §3-2 참조.
 */
interface SessionBillingSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  client: { id: string; name: string } | null;
  /** prefill 조회용 케이스 타입 */
  caseType: 'counseling' | 'assessment';
  caseId: string;
  /** 청구 항목에 부착할 연관 정보 */
  relatedType: string;
  relatedCaseId: string;
  relatedSessionId?: string;
}

interface ItemRow {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  priceListId: string | null;
  itemType: BillableItemType;
}

function todayDateString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}

export function SessionBillingSheet({
  visible,
  onClose,
  centerId,
  client,
  caseType,
  caseId,
  relatedType,
  relatedCaseId,
  relatedSessionId,
}: SessionBillingSheetProps) {
  const showToast = useToastStore((st) => st.show);

  // 시트가 열려있을 때만 prefill 조회
  const prefillQuery = useBillablePrefill(
    visible ? centerId : null,
    visible ? caseType : null,
    visible ? caseId : null,
    { enabled: visible },
  );

  const createBillable = useCreateBillable(centerId);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [memo, setMemo] = useState('');
  const [initialized, setInitialized] = useState(false);

  // prefill 도착 시 항목 초기화 (시트 1회 오픈당 1회). 닫히면 리셋.
  useEffect(() => {
    if (!visible) {
      setInitialized(false);
      setItems([]);
      setMemo('');
      return;
    }
    if (initialized || prefillQuery.data === undefined) return;
    setInitialized(true);
    const prefill = prefillQuery.data;
    const rows: ItemRow[] =
      prefill.length > 0
        ? prefill.map((it, idx) => ({
            id: idx + 1,
            description: it.description,
            quantity: 1,
            unitPrice: it.unit_price ?? 0,
            priceListId: it.price_list_id ?? null,
            itemType: it.item_type ?? 'service',
          }))
        : [
            {
              id: 1,
              description: caseType === 'counseling' ? '상담' : '검사',
              quantity: 1,
              unitPrice: 0,
              priceListId: null,
              itemType: 'service',
            },
          ];
    setItems(rows);
  }, [visible, prefillQuery.data, initialized, caseType]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    [items],
  );

  const canSubmit =
    !!client &&
    items.length > 0 &&
    items.every((i) => i.description.trim().length > 0) &&
    !createBillable.isPending;

  const updateItem = (id: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const handleSubmit = () => {
    if (!canSubmit || !client) return;
    const payload: CreateBillablePayload = {
      client_id: client.id,
      billable_date: todayDateString(),
      memo: memo.trim() || undefined,
      items: items.map((it) => ({
        item_type: it.itemType,
        price_list_id: it.priceListId,
        description: it.description.trim(),
        quantity: it.quantity,
        unit_price: it.unitPrice,
        related_type: relatedType,
        related_case_id: relatedCaseId,
        related_session_id: relatedSessionId,
      })),
    };
    createBillable.mutate(payload, {
      onSuccess: (res) => {
        // 백엔드 비차단 경고(잔액 부족 등)가 있으면 안내, 없으면 성공 토스트
        if (res.warnings && res.warnings.length > 0) {
          showToast({ type: 'error', message: res.warnings[0] });
        } else {
          showToast({ type: 'info', message: '청구서를 발행했어요' });
        }
        onClose();
      },
      onError: (err: any) => {
        const detail =
          err?.response?.data?.detail || '청구서 발행에 실패했어요';
        showToast({ type: 'error', message: detail });
      },
    });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* 헤더 */}
      <View className="mb-4 flex-row items-center justify-between">
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          청구서 발행
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
          style={{ maxHeight: s(460) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 내담자 (고정) */}
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

          {/* 청구 항목 */}
          <Typography variant="body-02" weight="semibold" className="mb-2 text-gray-900">
            청구 항목
          </Typography>
          <View className="gap-2">
            {items.map((item) => (
              <ItemRowCard
                key={item.id}
                item={item}
                onChange={(patch) => updateItem(item.id, patch)}
              />
            ))}
          </View>

          {/* 금액 요약 */}
          <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
            <Typography variant="body-02" weight="semibold" className="text-gray-700">
              총액
            </Typography>
            <Typography variant="body-01" weight="semibold" className="text-gray-900">
              {subtotal.toLocaleString()}원
            </Typography>
          </View>

          {/* 메모 */}
          <View className="mt-4">
            <Typography
              variant="label-01"
              weight="semibold"
              className="mb-1.5 text-gray-700"
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
                minHeight: s(64),
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
          </View>
        </ScrollView>
      )}

      {/* 발행 버튼 */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.7}
        accessibilityLabel="청구서 발행"
        accessibilityRole="button"
        className="mt-4 items-center justify-center rounded-md py-3.5"
        style={{ backgroundColor: canSubmit ? COLORS.primary : COLORS.gray[300] }}
      >
        {createBillable.isPending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography variant="body-02" weight="semibold" className="text-white">
            청구서 발행
          </Typography>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── 항목 행 (설명 + 수량 stepper + 단가 입력) ───

function ItemRowCard({
  item,
  onChange,
}: {
  item: ItemRow;
  onChange: (patch: Partial<ItemRow>) => void;
}) {
  return (
    <View className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <Typography variant="body-02" weight="medium" className="text-gray-900">
        {item.description}
      </Typography>

      {/* 수량 */}
      <View className="mt-2.5 flex-row items-center justify-between">
        <Typography variant="label-01" className="text-gray-500">
          수량
        </Typography>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => onChange({ quantity: Math.max(1, item.quantity - 1) })}
            className="h-7 w-7 items-center justify-center rounded-full bg-gray-100"
            accessibilityLabel="수량 감소"
            accessibilityRole="button"
          >
            <Ionicons name="remove" size={16} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <Typography
            variant="body-02"
            weight="semibold"
            className="mx-3 text-gray-900"
          >
            {item.quantity}
          </Typography>
          <TouchableOpacity
            onPress={() => onChange({ quantity: item.quantity + 1 })}
            className="h-7 w-7 items-center justify-center rounded-full bg-gray-100"
            accessibilityLabel="수량 증가"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color={COLORS.gray[700]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 단가 */}
      <View className="mt-2 flex-row items-center justify-between">
        <Typography variant="label-01" className="text-gray-500">
          단가
        </Typography>
        <View className="flex-row items-center">
          <TextInput
            value={item.unitPrice > 0 ? String(item.unitPrice) : ''}
            onChangeText={(t) =>
              onChange({ unitPrice: parseInt(t.replace(/[^0-9]/g, '') || '0', 10) })
            }
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.gray[400]}
            style={{
              minWidth: s(80),
              textAlign: 'right',
              fontSize: s(14),
              fontWeight: '600',
              color: COLORS.gray[900],
              letterSpacing: -0.41,
              paddingVertical: 2,
            }}
          />
          <Typography variant="body-02" className="ml-1 text-gray-500">
            원
          </Typography>
        </View>
      </View>
    </View>
  );
}
