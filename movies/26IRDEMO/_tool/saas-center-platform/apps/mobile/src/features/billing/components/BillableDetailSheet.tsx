import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';
import { useToastStore } from '@/features/toast';
import { useBillableDetail, usePayments, useCreatePayment } from '../hooks';
import {
  BILLABLE_STATUS_LABELS,
  BILLABLE_STATUS_PALETTE,
  PAYMENT_METHOD_LABELS,
  billingItemIconBg,
} from '../constants';
import type {
  BillableDetail,
  BillableStatus,
  BillableSummary,
  PaymentMethodType,
} from '../types';
import {
  ClientAvatar,
  genderToLabel,
  computeAge,
} from '../clientDisplay';

/**
 * 청구 상세 시트 (web BillableDetailModal 대응 — 조회 + 납부).
 * 청구서(invoice) 레이아웃 → "청구하기" 탭 시 같은 시트 안에서 납부 폼 단계로 전환(2-step).
 * 환불·삭제·메모 수정은 모바일 비범위(관리자 web). 발행됨(issued)·미수금>0일 때만 납부 노출.
 *
 * 성별·나이·프로필 이미지·프로그램은 BillableDetail에 없어 목록의 `summary`로 보강한다.
 * summary 미전달 시(상담/검사 상세 등) 이름·항목 기반으로 graceful fallback.
 */
interface BillableDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  billableId: string | null;
  /** 청구 목록에서 넘기는 요약 — 헤더 아바타/성별/나이/프로그램 표시용 (선택) */
  summary?: BillableSummary | null;
  /** 완납(전액 납부) 시 호출 — 부모가 영수증 모달로 전환하는 용도 (선택) */
  onPaid?: () => void;
}

type Step = 'detail' | 'payment';

const METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: 'card', label: '카드' },
  { value: 'transfer', label: '계좌이체' },
  { value: 'cash', label: '현금' },
];

const QUICK = [25, 50, 75, 100];

/** 청구하기/납부 완료 버튼 teal — DS 외 임시 토큰 */
const TEAL = '#00C3BC';
const TEAL_SOFT = '#00C3BC1A';

/** 청구일/발행일 — "2026년 6월 6일" */
function fmtDate(v?: string | null) {
  if (!v) return '-';
  try {
    return format(parseDate(v), 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return v;
  }
}

/** 프로그램 요약 — summary.item_summary 우선, 없으면 항목에서 도출 */
function deriveProgram(
  summary: BillableSummary | null | undefined,
  detail: BillableDetail | undefined,
): string | null {
  if (summary?.item_summary) return summary.item_summary;
  const items = detail?.items ?? [];
  if (items.length === 0) return null;
  if (items.length === 1) return items[0].description;
  return `${items[0].description} 외 ${items.length - 1}건`;
}

export function BillableDetailSheet({
  visible,
  onClose,
  centerId,
  billableId,
  summary,
  onPaid,
}: BillableDetailSheetProps) {
  const showToast = useToastStore((st) => st.show);
  const { data: detail, isLoading } = useBillableDetail(
    visible ? centerId : null,
    visible ? billableId : null,
  );
  const { data: payments } = usePayments(
    visible ? centerId : null,
    visible ? billableId : null,
  );
  const createPayment = useCreatePayment(centerId, billableId);

  const [step, setStep] = useState<Step>('detail');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethodType>('card');
  const [memo, setMemo] = useState('');

  // 시트 열릴 때 항상 상세 단계로 초기화
  useEffect(() => {
    if (visible) setStep('detail');
  }, [visible]);

  const status = detail?.status as BillableStatus | undefined;
  const palette = status ? BILLABLE_STATUS_PALETTE[status] : null;
  const unpaidAmount = detail?.unpaid_amount ?? 0;
  const canPay = detail?.status === 'issued' && unpaidAmount > 0;

  const clientName = summary?.client_name ?? detail?.client_name ?? '내담자';
  const genderLabel = genderToLabel(summary?.client_gender);
  const age = computeAge(summary?.client_birth_date);
  const program = deriveProgram(summary, detail);
  const avatarSeed = summary?.client_id ?? detail?.client_id ?? clientName;

  // 금액 분해 — total_amount는 이미 지원금·할인 차감 후(net)라, 정가 합계를 역산해 표시
  const subsidyAmount = detail?.subsidy_amount ?? 0;
  const discountAmount = detail?.discount_amount ?? 0;
  const grossSubtotal = (detail?.total_amount ?? 0) + subsidyAmount + discountAmount;
  const hasDeductions = subsidyAmount > 0 || discountAmount > 0;

  // 납부 단계 진입 — 미수금 전액으로 초기화
  const goToPayment = () => {
    setAmount(unpaidAmount);
    setMethod('card');
    setMemo('');
    setStep('payment');
  };

  const handleAmountChange = (t: string) => {
    const parsed = parseInt(t.replace(/[^0-9]/g, '') || '0', 10);
    setAmount(Math.min(parsed, unpaidAmount)); // 과오납 방지 상한
  };

  const remaining = unpaidAmount - amount;
  const isPayValid = amount > 0 && amount <= unpaidAmount && !createPayment.isPending;

  const handleSubmitPayment = () => {
    if (!isPayValid) return;
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
          // 전액 납부(완납)면 영수증으로 전환, 부분 납부면 닫기.
          if (amount >= unpaidAmount && onPaid) onPaid();
          else onClose();
        },
        onError: () =>
          showToast({ type: 'error', message: '납부 등록에 실패했어요' }),
      },
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* 헤더 — 가운데 "{내담자}의 청구서" + 우측 닫기 (단계 공통) */}
      <View
        className="flex-row items-center justify-center"
        style={{ marginBottom: s(20), minHeight: s(28) }}
      >
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {clientName}의 청구서
        </Typography>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityLabel="닫기"
          accessibilityRole="button"
          style={{ position: 'absolute', right: 0 }}
        >
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>

      {isLoading || !detail ? (
        <View className="items-center py-12">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : step === 'payment' ? (
        // ─── 납부 단계 ───
        <>
          <ScrollView
            style={{ maxHeight: s(440) }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: s(12) }}
          >
            {/* 납부 금액 */}
            <Typography
              variant="body-03"
              weight="medium"
              className="text-gray-600"
              style={{ marginBottom: s(8) }}
            >
              납부 금액
            </Typography>
            <View
              className="flex-row items-center rounded-xl border border-gray-200"
              style={{ height: s(52), paddingHorizontal: s(16) }}
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
            <View className="flex-row" style={{ marginTop: s(8), gap: s(8) }}>
              {QUICK.map((pct) => {
                const pctAmount = Math.round((unpaidAmount * pct) / 100);
                const active = amount === pctAmount && amount > 0;
                return (
                  <TouchableOpacity
                    key={pct}
                    onPress={() => setAmount(pctAmount)}
                    activeOpacity={0.7}
                    className="flex-1 items-center rounded-md py-2"
                    style={{
                      backgroundColor: active ? COLORS.gray[900] : COLORS.gray[100],
                    }}
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

            {/* 미수금 잔액 */}
            <Typography
              variant="label-01"
              weight="medium"
              style={{
                marginTop: s(8),
                textAlign: 'right',
                color: remaining > 0 ? COLORS.error : COLORS.success,
              }}
            >
              미수금 {remaining.toLocaleString()}원
            </Typography>

            {/* 납부 수단 */}
            <Typography
              variant="body-03"
              weight="medium"
              className="text-gray-600"
              style={{ marginTop: s(20), marginBottom: s(8) }}
            >
              납부 수단
            </Typography>
            <View className="flex-row" style={{ gap: s(8) }}>
              {METHODS.map((m) => {
                const active = method === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => setMethod(m.value)}
                    activeOpacity={0.7}
                    className="flex-1 items-center justify-center"
                    style={{
                      height: s(52),
                      borderRadius: 8,
                      backgroundColor: active ? COLORS.primary50 : COLORS.white,
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

            {/* 구분선 */}
            <View style={{ marginTop: s(20), marginBottom: s(20) }}>
              <DashedLine />
            </View>

            {/* 메모 */}
            <Typography
              variant="label-01"
              weight="semibold"
              className="text-gray-700"
              style={{ marginBottom: s(8) }}
            >
              메모(선택)
            </Typography>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력해주세요"
              placeholderTextColor={COLORS.gray[400]}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: s(80),
                borderWidth: 1,
                borderColor: COLORS.gray[200],
                borderRadius: s(12),
                paddingHorizontal: s(14),
                paddingVertical: s(12),
                fontSize: s(14),
                color: COLORS.gray[900],
                letterSpacing: -0.41,
              }}
            />
          </ScrollView>

          {/* 하단: 이전 / 납부 완료 */}
          <View className="flex-row" style={{ marginTop: s(20), gap: s(10) }}>
            <TouchableOpacity
              onPress={() => setStep('detail')}
              activeOpacity={0.7}
              className="items-center justify-center rounded-md border border-gray-200"
              style={{ width: s(96), height: s(52) }}
              accessibilityLabel="이전"
              accessibilityRole="button"
            >
              <Typography variant="body-01" weight="semibold" className="text-gray-700">
                이전
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmitPayment}
              disabled={!isPayValid}
              activeOpacity={0.8}
              className="flex-1 items-center justify-center rounded-md"
              style={{ height: s(52), backgroundColor: isPayValid ? TEAL : COLORS.gray[300] }}
              accessibilityLabel="납부 완료"
              accessibilityRole="button"
            >
              {createPayment.isPending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Typography variant="body-01" weight="semibold" className="text-white">
                  납부 완료
                </Typography>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        // ─── 상세(청구서) 단계 ───
        <>
          <ScrollView style={{ maxHeight: s(440) }} showsVerticalScrollIndicator={false}>
            {/* 내담자 헤더 */}
            <View className="flex-row items-center" style={{ gap: s(12), marginBottom: s(20) }}>
              <ClientAvatar
                name={clientName}
                imageUrl={summary?.client_profile_image_url ?? null}
                seed={avatarSeed}
              />
              <View style={{ flex: 1, gap: s(3) }}>
                <View className="flex-row items-center" style={{ gap: s(6) }}>
                  <Typography
                    variant="body-01"
                    weight="semibold"
                    className="text-gray-900"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {clientName}
                  </Typography>
                  <GenderAgeMeta genderLabel={genderLabel} age={age} />
                </View>
                {program && (
                  <Typography
                    variant="body-03"
                    weight="medium"
                    className="text-gray-600"
                    numberOfLines={1}
                  >
                    {program}
                  </Typography>
                )}
              </View>
              {status && palette && (
                <BadgeRound bg={palette.bg} color={palette.color}>
                  {BILLABLE_STATUS_LABELS[status]}
                </BadgeRound>
              )}
            </View>

            {/* 청구일 / 발행일 */}
            <View
              className="rounded-2xl bg-gray-50"
              style={{ paddingHorizontal: s(16), paddingVertical: s(14), gap: s(8) }}
            >
              <InfoRow label="청구일" value={fmtDate(detail.billable_date)} />
              <InfoRow label="발행일" value={fmtDate(detail.issued_at)} />
            </View>

            {/* 청구 항목 */}
            <Typography
              variant="body-03"
              weight="medium"
              style={{ marginTop: s(24), marginBottom: s(12), color: COLORS.text.title.subtle }}
            >
              청구 항목 ({detail.items.length}건)
            </Typography>
            <View style={{ gap: s(14) }}>
              {detail.items.map((item) => (
                <View key={item.id} className="flex-row items-center" style={{ gap: s(10) }}>
                  <View
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(10),
                      backgroundColor: billingItemIconBg(item.related_type),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={
                        item.related_type?.startsWith('assessment')
                          ? 'assessment-20'
                          : 'counseling-20'
                      }
                      size={s(20)}
                    />
                  </View>
                  <View className="flex-1" style={{ gap: s(2) }}>
                    <View className="flex-row items-center" style={{ gap: s(6) }}>
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        numberOfLines={1}
                        style={{ flexShrink: 1, color: COLORS.text.body.strong }}
                      >
                        {item.description}
                      </Typography>
                      {item.voucher_name && (
                        <View
                          className="flex-row items-center rounded-full"
                          style={{
                            backgroundColor: COLORS.paletteBg.mint,
                            paddingHorizontal: s(6),
                            paddingVertical: s(2),
                            gap: s(3),
                          }}
                        >
                          <Ionicons
                            name="ticket-outline"
                            size={10}
                            color={COLORS.palette.mint}
                          />
                          <Typography
                            variant="label-02"
                            weight="semibold"
                            style={{ color: COLORS.palette.mint }}
                            numberOfLines={1}
                          >
                            {item.voucher_name}
                          </Typography>
                        </View>
                      )}
                    </View>
                    <Typography
                      variant="body-03"
                      weight="regular"
                      style={{ color: COLORS.text.body.default }}
                    >
                      {item.quantity}개 × {item.unit_price.toLocaleString()}원
                    </Typography>
                  </View>
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    style={{ color: COLORS.text.body.strong }}
                  >
                    {item.amount.toLocaleString()}원
                  </Typography>
                </View>
              ))}
            </View>

            {/* 금액 요약 — 점선 구분 */}
            <View style={{ marginTop: s(20) }}>
              <DashedLine />
              <View style={{ paddingVertical: s(24), gap: s(10) }}>
                {hasDeductions && (
                  <>
                    <AmountRow label="정가 합계" value={grossSubtotal} muted />
                    {subsidyAmount > 0 && (
                      <AmountRow label="바우처 지원금" value={subsidyAmount} muted negative />
                    )}
                    {discountAmount > 0 && (
                      <AmountRow label="할인" value={discountAmount} muted negative />
                    )}
                  </>
                )}
                <AmountRow
                  label={hasDeductions ? '청구액' : '총액'}
                  value={detail.total_amount}
                />
                <AmountRow label="납부액" value={detail.paid_amount} />
              </View>
              <DashedLine />
              <View style={{ paddingTop: s(24) }}>
                <AmountRow label="미수금" value={detail.unpaid_amount} danger />
              </View>
            </View>

            {/* 납부 기록 */}
            {payments && payments.items.length > 0 && (
              <View style={{ marginTop: s(24) }}>
                <Typography
                  variant="body-02"
                  weight="semibold"
                  className="text-gray-900"
                  style={{ marginBottom: s(12) }}
                >
                  납부 기록 ({payments.items.length}건)
                </Typography>
                <View style={{ gap: s(8) }}>
                  {payments.items.map((p) => (
                    <View
                      key={p.id}
                      className="flex-row items-center justify-between rounded-xl bg-gray-50"
                      style={{ paddingHorizontal: s(12), paddingVertical: s(10) }}
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <View className="rounded bg-gray-100 px-1.5 py-0.5">
                            <Typography variant="label-02" className="text-gray-600">
                              {PAYMENT_METHOD_LABELS[p.payment_method]}
                            </Typography>
                          </View>
                          <Typography variant="label-01" className="text-gray-500">
                            {fmtDate(p.paid_at)}
                          </Typography>
                        </View>
                        {p.receipt_number ? (
                          <Typography variant="label-02" className="mt-0.5 text-gray-400">
                            영수증 {p.receipt_number}
                          </Typography>
                        ) : null}
                      </View>
                      <Typography variant="body-02" weight="medium" className="text-gray-900">
                        {p.amount.toLocaleString()}원
                      </Typography>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* 청구하기(납부) — 미수금 있는 발행 건만. 색상은 DS 외 임시 teal */}
          {canPay && (
            <TouchableOpacity
              onPress={goToPayment}
              activeOpacity={0.8}
              className="items-center justify-center rounded-md"
              style={{ marginTop: s(20), height: s(52), backgroundColor: TEAL_SOFT }}
              accessibilityLabel="청구하기"
              accessibilityRole="button"
            >
              <Typography variant="body-01" weight="semibold" style={{ color: TEAL }}>
                청구하기
              </Typography>
            </TouchableOpacity>
          )}
        </>
      )}
    </BottomSheet>
  );
}

/** 절취선 느낌의 점선 구분 (gray-200) */
/**
 * 절취선 느낌의 점선 구분 (gray-200).
 * iOS는 `borderTopWidth`+`dashed`를 실선으로 렌더하므로, 4면 borderWidth dashed를
 * 높이 0 컨테이너에 넣고 overflow로 클리핑해 가로 점선만 노출한다.
 */
function DashedLine() {
  return (
    <View style={{ height: 1, overflow: 'hidden' }}>
      <View
        style={{
          height: 2,
          borderWidth: 1,
          borderColor: COLORS.gray[200],
          borderStyle: 'dashed',
        }}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      {/* 라벨 — body-03 medium / body/default (영수증 모달과 통일) */}
      <Typography
        variant="body-03"
        weight="medium"
        className="text-body-default"
        style={{ width: s(56) }}
      >
        {label}
      </Typography>
      {/* 데이터 — body-03 regular / body/default */}
      <Typography variant="body-03" weight="regular" className="flex-1 text-body-default">
        {value}
      </Typography>
    </View>
  );
}

function AmountRow({
  label,
  value,
  muted,
  negative,
  danger,
}: {
  label: string;
  value: number;
  /** 정가 합계·바우처 지원금·할인 등 보조 정보 — 작고 흐리게 */
  muted?: boolean;
  /** 차감 항목 — 값 앞에 − 표시 */
  negative?: boolean;
  /** 미수금 — 금액을 status/danger 색으로 */
  danger?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      {/* 라벨 — body-03 medium / body/default (muted은 한 톤 흐리게) */}
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: muted ? COLORS.gray[500] : COLORS.text.body.default }}
      >
        {label}
      </Typography>
      {/* 금액 — 기본 title-01 semibold / body/strong. muted는 body-02 regular gray, 미수금만 status/danger */}
      <Typography
        variant={muted ? 'body-02' : 'title-01'}
        weight={muted ? 'regular' : 'semibold'}
        style={{
          color: danger
            ? COLORS.error
            : muted
              ? COLORS.gray[500]
              : COLORS.text.body.strong,
        }}
      >
        {negative ? '−' : ''}
        {value.toLocaleString()}원
      </Typography>
    </View>
  );
}
