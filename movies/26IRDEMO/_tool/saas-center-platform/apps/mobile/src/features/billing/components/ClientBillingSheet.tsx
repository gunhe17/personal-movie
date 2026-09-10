import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useClientBillables } from '../hooks';

/**
 * 내담자 미수 청구 목록 시트 (미수 안전망).
 *
 * billing_unpaid 신호에는 청구 ID가 없어, 내담자 청구를 조회해 미수(unpaid>0)만 보여준다.
 * 항목 탭 → onSelectBillable로 부모가 청구 상세 시트를 띄운다.
 */
interface ClientBillingSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  clientId: string | null;
  onSelectBillable: (billableId: string) => void;
}

export function ClientBillingSheet({
  visible,
  onClose,
  centerId,
  clientId,
  onSelectBillable,
}: ClientBillingSheetProps) {
  const { data, isLoading } = useClientBillables(
    visible ? centerId : null,
    visible ? clientId : null,
  );
  const unpaid = (data?.items ?? []).filter((b) => b.unpaid_amount > 0);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="mb-4 flex-row items-center justify-between">
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          미수 청구
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

      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : unpaid.length === 0 ? (
        <View className="items-center py-10">
          <Ionicons
            name="checkmark-circle-outline"
            size={40}
            color={COLORS.gray[300]}
          />
          <Typography variant="body-02" className="mt-2 text-gray-400">
            미수 청구가 없어요
          </Typography>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: s(420) }} showsVerticalScrollIndicator={false}>
          <View className="gap-2">
            {unpaid.map((b) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => onSelectBillable(b.id)}
                activeOpacity={0.7}
                className="flex-row items-center justify-between rounded-2xl bg-gray-50 px-4 py-3"
                accessibilityLabel={`${b.item_summary} 청구 상세`}
                accessibilityRole="button"
              >
                <View className="flex-1 pr-2">
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    className="text-gray-900"
                    numberOfLines={1}
                  >
                    {b.item_summary || '청구'}
                  </Typography>
                  <Typography variant="label-01" className="mt-0.5 text-gray-500">
                    {b.billable_date}
                  </Typography>
                </View>
                <View className="items-end">
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    style={{ color: COLORS.error }}
                  >
                    미수 {b.unpaid_amount.toLocaleString()}원
                  </Typography>
                  <Typography variant="label-01" className="text-gray-400">
                    총 {b.total_amount.toLocaleString()}원
                  </Typography>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}
