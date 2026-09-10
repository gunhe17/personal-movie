import { useMemo } from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useClientVouchers, filterUsableVouchers } from '../hooks';
import type { ClientVoucherSummary } from '../types';

/**
 * 청구 발행 시트의 바우처 선택 + 지원금 입력 행.
 *
 * web `VoucherField`/`SubsidyField` 대응. 내담자가 사용 가능한 바우처가 없으면
 * 아무것도 렌더하지 않아 자비(바우처 미사용) 청구 흐름에는 영향이 없다.
 */

export interface SelectedVoucher {
  id: string;
  name: string;
  remainingSessions: number;
  totalSessions: number;
  remainingAmount: number | null;
  totalAmount: number | null;
  supportText: string | null;
}

interface VoucherPickerRowProps {
  centerId: string | null;
  clientId: string | null;
  selected: SelectedVoucher | null;
  onChange: (voucher: SelectedVoucher | null) => void;
  /** 청구서 단위 바우처 지원금 (원) */
  subsidy: number;
  onSubsidyChange: (amount: number) => void;
  /** 금액제 바우처(잔여 금액 있음) 선택 시 true — 지원금 입력 필수 */
  subsidyRequired?: boolean;
}

/** 금액제 바우처 판정 — 잔여 금액이 있으면 지원금 입력 필수 */
export function isAmountVoucher(v: SelectedVoucher | null): boolean {
  return !!v && v.remainingAmount != null;
}

function toSelected(v: ClientVoucherSummary): SelectedVoucher {
  return {
    id: v.id,
    name: v.catalog?.name ?? '바우처',
    remainingSessions: v.remaining_sessions,
    totalSessions: v.total_sessions,
    remainingAmount: v.remaining_amount,
    totalAmount: v.total_amount,
    supportText: v.catalog?.support_amount_text ?? null,
  };
}

export function VoucherPickerRow({
  centerId,
  clientId,
  selected,
  onChange,
  subsidy,
  onSubsidyChange,
  subsidyRequired = false,
}: VoucherPickerRowProps) {
  const { data, isLoading } = useClientVouchers(centerId, clientId);
  const usable = useMemo(() => filterUsableVouchers(data), [data]);

  // 로딩 중이거나 사용 가능한 바우처가 없으면 노출하지 않음 (자비 흐름 무변경).
  // 내담자 변경 시 선택 초기화는 부모(UnifiedBillingSheet)가 담당한다.
  if (isLoading || usable.length === 0) return null;

  const handleSelect = (id: string | null) => {
    if (!id) {
      onChange(null);
      onSubsidyChange(0);
      return;
    }
    const found = usable.find((v) => v.id === id);
    if (!found) return;
    onChange(toSelected(found));
  };

  const handleSubsidyInput = (t: string) => {
    const raw = t.replace(/[^0-9]/g, '');
    onSubsidyChange(raw ? parseInt(raw, 10) : 0);
  };

  return (
    <View style={{ marginTop: s(20) }}>
      <Typography
        variant="label-01"
        weight="semibold"
        className="text-gray-700"
        style={{ marginBottom: s(8) }}
      >
        바우처 <Typography variant="label-01" className="text-gray-400">(선택)</Typography>
      </Typography>

      <View style={{ gap: s(6) }}>
        {/* 바우처 미사용 (자비) */}
        <VoucherOptionRow
          title="바우처 미사용 (자비)"
          selected={selected == null}
          onPress={() => handleSelect(null)}
        />
        {usable.map((v) => (
          <VoucherOptionRow
            key={v.id}
            title={v.catalog?.name ?? '바우처'}
            subtitle={`잔여 ${v.remaining_sessions}/${v.total_sessions}회`}
            selected={selected?.id === v.id}
            onPress={() => handleSelect(v.id)}
          />
        ))}
      </View>

      {/* 선택된 바우처 안내 칩 */}
      {selected && (
        <View
          className="flex-row flex-wrap items-center"
          style={{ marginTop: s(8), gap: s(8) }}
        >
          <View
            className="flex-row items-center rounded-full"
            style={{
              backgroundColor: COLORS.paletteBg.mint,
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              gap: s(4),
            }}
          >
            <Ionicons name="ticket-outline" size={12} color={COLORS.palette.mint} />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.palette.mint }}
            >
              {selected.name} · 잔여 {selected.remainingSessions}/{selected.totalSessions}회
            </Typography>
          </View>
          {selected.remainingAmount != null && selected.totalAmount != null && (
            <Typography variant="label-02" className="text-gray-500">
              잔여 금액 {selected.remainingAmount.toLocaleString()}원
            </Typography>
          )}
          {selected.supportText && (
            <Typography variant="label-02" className="text-gray-500">
              지원금 안내: {selected.supportText}
            </Typography>
          )}
        </View>
      )}

      {/* 지원금 입력 — 바우처 선택 시에만. 금액제 바우처는 필수 */}
      {selected && (
        <View style={{ marginTop: s(16) }}>
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-gray-700"
            style={{ marginBottom: s(8) }}
          >
            바우처 지원금{' '}
            {subsidyRequired ? (
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.error }}
              >
                (필수)
              </Typography>
            ) : (
              <Typography variant="label-01" className="text-gray-400">
                (선택)
              </Typography>
            )}
          </Typography>
          <View
            className="flex-row items-center rounded-md border"
            style={{
              height: s(48),
              paddingHorizontal: s(16),
              borderColor:
                subsidyRequired && subsidy <= 0
                  ? COLORS.error
                  : COLORS.gray[200],
            }}
          >
            <TextInput
              value={subsidy > 0 ? subsidy.toLocaleString() : ''}
              onChangeText={handleSubsidyInput}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.gray[400]}
              style={{
                flex: 1,
                textAlign: 'right',
                fontSize: s(15),
                fontWeight: '700',
                color: COLORS.gray[800],
                letterSpacing: -0.41,
              }}
            />
            <Typography variant="body-02" className="ml-2 text-gray-400">
              원
            </Typography>
          </View>
          {subsidyRequired && subsidy <= 0 && (
            <Typography
              variant="label-02"
              style={{ color: COLORS.error, marginTop: s(6) }}
            >
              금액제 바우처는 지원금을 입력해 주세요
            </Typography>
          )}
        </View>
      )}
    </View>
  );
}

function VoucherOptionRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} ${selected ? '선택됨' : '선택 안 됨'}`}
      style={{
        backgroundColor: selected ? COLORS.primary50 : COLORS.white,
        borderWidth: 1,
        borderColor: selected ? COLORS.primary : COLORS.gray[200],
        borderRadius: s(12),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
      }}
    >
      <View style={{ flex: 1, gap: s(2) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="label-01" className="text-gray-500">
            {subtitle}
          </Typography>
        )}
      </View>
      <View
        style={{
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: selected ? COLORS.primary : 'transparent',
          borderWidth: selected ? 0 : 1.5,
          borderColor: COLORS.gray[300],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
      </View>
    </TouchableOpacity>
  );
}
