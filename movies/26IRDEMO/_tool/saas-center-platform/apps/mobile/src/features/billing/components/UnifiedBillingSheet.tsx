import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { SetBadge } from '@/shared/components/ui/Badge';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';
import { useToastStore, GlobalToastHost } from '@/features/toast';
import { Icon } from '@/shared/components/icons';
import { ClientAvatar, genderToLabel } from '../clientDisplay';
import { useBillablePrefill, useCreateBillable } from '../hooks';
import type { BillableItemType, CreateBillablePayload } from '../types';
import {
  VoucherPickerRow,
  isAmountVoucher,
  type SelectedVoucher,
} from './VoucherPickerRow';

/**
 * 통합 청구 시트 — 케이스 상세 / 회기 상세 공용.
 *
 * 플로우: 내담자 선택(그룹만) → 회기 선택 → 발행.
 * 선택 범위에 따라 자동 분기:
 *   - 청구 가능한 전체 회기 선택 → 패키지 (related_type='counseling_case')
 *   - 부분 선택 → 회기별 청구 (related_type='counseling_session')
 *
 * 호출자 책임:
 *   - 케이스 상세: clients 전체 + 각 내담자의 회기 + 청구 상태 마킹 전달
 *   - 회기 상세: 동일하게 전달하되 initialSelectedSessionIds로 현재 회기 pre-select
 */

export interface SessionForBilling {
  id: string;
  start: string;
  /** 회기 종료 시각 — 시간 범위(00:00 - 00:00) 표시용 */
  end?: string;
  sessionNumber: number;
  status: string; // 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  /** 이미 청구된 회기 — 체크박스 비활성화 */
  billed: boolean;
}

export interface ClientCandidate {
  client: {
    id: string;
    name: string;
    gender?: string | null;
    age?: number | null;
    profileImageUrl?: string | null;
    program?: string | null;
  };
  sessions: SessionForBilling[];
}

interface AssessmentBillingItem {
  referenceId: string;
  description: string;
  itemType: BillableItemType;
  unitPrice: number;
  priceListId: string | null;
  selected: boolean;
}

export interface AssessmentTaskForBilling {
  assessmentId: string;
  assessmentName: string;
}

interface UnifiedBillingSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  caseId: string;
  caseType: 'counseling' | 'assessment';
  /** 내담자 후보 — 1명이면 자동 선택, 2명+면 step 1에서 선택 */
  clients: ClientCandidate[];
  /** 미리 선택된 내담자 ID — 케이스 상세 내담자 카드 진입 시 사용 */
  initialClientId?: string;
  /** 회기 상세 진입 시 pre-select할 회기 ID 목록 */
  initialSelectedSessionIds?: string[];
  /** 검사 케이스의 task 목록 — 세트 케이스에서 개별 청구 모드에 사용 */
  tasks?: AssessmentTaskForBilling[];
  /** 발행 성공(미수금>0) 시 — 부모가 '납부 처리?' 모달 + 납부 시트를 띄우도록 */
  onIssued?: (result: { billableId: string; unpaidAmount: number }) => void;
}

type Step = 'client' | 'sessions' | 'pricing';

function todayDateString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}

// ─── 내담자 정보 박스 (sessions / pricing 공용) ───
// UnifiedBillingSheet보다 먼저 선언해서 hoisting 의존성 제거 (Hermes 캐시 이슈 회피)
function ClientInfoBox({
  client,
  program,
  showChange,
  onChange,
}: {
  client?: ClientCandidate['client'];
  program?: string | null;
  showChange?: boolean;
  onChange?: () => void;
}) {
  const name = client?.name ?? '-';
  const genderLabel = genderToLabel(client?.gender);
  const age = client?.age;

  return (
    <View
      className="flex-row items-center rounded-xl bg-gray-50"
      style={{
        gap: s(12),
        marginBottom: s(20),
        paddingHorizontal: s(16),
        paddingVertical: s(14),
      }}
    >
      <ClientAvatar
        name={name}
        imageUrl={client?.profileImageUrl ?? null}
        seed={client?.id ?? name}
      />
      <View style={{ flex: 1, gap: s(2) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {name}
          </Typography>
          <GenderAgeMeta genderLabel={genderLabel} age={age} />
        </View>
        {program ? (
          <Typography
            variant="body-03"
            weight="medium"
            className="text-gray-600"
            numberOfLines={1}
          >
            {program}
          </Typography>
        ) : null}
      </View>
      {showChange && onChange && (
        <TouchableOpacity
          onPress={onChange}
          hitSlop={6}
          accessibilityLabel="내담자 변경"
          accessibilityRole="button"
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[600] }}
          >
            변경
          </Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function UnifiedBillingSheet({
  visible,
  onClose,
  centerId,
  caseId,
  caseType,
  clients,
  initialClientId,
  initialSelectedSessionIds,
  tasks,
  onIssued,
}: UnifiedBillingSheetProps) {
  const showToast = useToastStore((st) => st.show);

  // ─── client selection ───
  const autoClientId = useMemo(() => {
    if (initialClientId) return initialClientId;
    if (clients.length === 1) return clients[0]?.client.id ?? null;
    return null;
  }, [initialClientId, clients]);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    autoClientId,
  );
  const [step, setStep] = useState<Step>(autoClientId ? 'sessions' : 'client');

  // ─── session selection ───
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(
    new Set(initialSelectedSessionIds ?? []),
  );

  // ─── billing form ───
  const [unitPrice, setUnitPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [prefillInitialized, setPrefillInitialized] = useState(false);

  // ─── 바우처 (선택) ───
  const [selectedVoucher, setSelectedVoucher] = useState<SelectedVoucher | null>(
    null,
  );
  const [subsidy, setSubsidy] = useState(0);

  const isAssessment = caseType === 'assessment';
  const prefillAssessmentItemsRef = useRef<AssessmentBillingItem[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentBillingItem[]>([]);
  // 세트(패키지) 단가 수기 수정 — 단가표에 검사 단가가 없으면 0원 발행(자동 완납)이 되므로
  // 웹과 동일하게 수기 입력을 허용한다 (단가 수기 입력은 의도된 정책, 07-20 확정)
  const [packagePriceOverride, setPackagePriceOverride] = useState<number | null>(null);

  const prefillQuery = useBillablePrefill(
    visible ? centerId : null,
    visible ? caseType : null,
    visible ? caseId : null,
    { enabled: visible },
  );
  const createBillable = useCreateBillable(centerId);

  // 시트 OPEN 시점에 state 초기화 — useState 초기값은 1회만 잡히므로
  // 매번 열릴 때 현재 props(initialClientId 등) 기반으로 다시 세팅 필요
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setSelectedClientId(autoClientId);
      setStep(autoClientId ? 'sessions' : 'client');
      setSelectedSessionIds(new Set(initialSelectedSessionIds ?? []));
      setUnitPrice(0);
      setDescription('');
      setPriceListId(null);
      setMemo('');
      setPrefillInitialized(false);
      setAssessmentItems([]);
      setPackagePriceOverride(null);
      setSelectedVoucher(null);
      setSubsidy(0);
      prefillAssessmentItemsRef.current = [];
    }
    prevVisibleRef.current = visible;
  }, [visible, autoClientId, initialSelectedSessionIds]);

  // 내담자 변경 시 바우처 선택·지원금 초기화 (바우처는 내담자 종속 — stale 방지)
  useEffect(() => {
    setSelectedVoucher(null);
    setSubsidy(0);
  }, [selectedClientId]);

  // prefill 도착 시 초기화 (1회)
  useEffect(() => {
    if (!visible) return;
    if (prefillInitialized || prefillQuery.data === undefined) return;
    setPrefillInitialized(true);

    if (isAssessment) {
      const allItems = prefillQuery.data.map((item) => ({
        referenceId: item.reference_id,
        description: item.description,
        itemType: item.item_type,
        unitPrice: item.unit_price,
        priceListId: item.price_list_id,
        selected: true,
      }));
      prefillAssessmentItemsRef.current = allItems;
      // 개별(단일) 검사만 리스트로. 세트(패키지)는 헤더로 별도 노출. 기본 전체 선택.
      setAssessmentItems(allItems.filter((it) => it.itemType !== 'package'));
    } else {
      const first = prefillQuery.data[0];
      setUnitPrice(first?.unit_price ?? 0);
      setDescription(first?.description ?? '상담');
      setPriceListId(first?.price_list_id ?? null);
    }
  }, [visible, prefillQuery.data, prefillInitialized, isAssessment]);

  const selectedClient = clients.find(
    (c) => c.client.id === selectedClientId,
  );
  const sessionsForClient = selectedClient?.sessions ?? [];
  // 취소 회기는 선택 불가 → 항상 리스트 최하단 (그 외 순서는 유지)
  const sortedSessionsForClient = [...sessionsForClient].sort(
    (a, b) =>
      Number(a.status === 'cancelled') - Number(b.status === 'cancelled'),
  );
  const selectableSessions = sessionsForClient.filter(
    (s) => !s.billed && s.status !== 'cancelled',
  );
  const selectedCount = selectedSessionIds.size;
  // 현재 내담자 리스트에 실제로 포함된 선택 회기 수 — 내담자 미선택 시 0 (총 0개 옆 "N개 선택" 버그 방지)
  const selectedCountForClient = sessionsForClient.filter((sx) =>
    selectedSessionIds.has(sx.id),
  ).length;
  const allSelectableSelected =
    selectableSessions.length > 0 &&
    selectableSessions.every((s) => selectedSessionIds.has(s.id));
  const isPackageMode = allSelectableSelected && selectableSessions.length > 1;
  const total = unitPrice * selectedCount;

  // ─── assessment 파생값 (세트 헤더 + 하위 단일검사 트리) ───
  // assessmentItems = 개별(단일) 검사 항목. packageItem = 세트(전체) 항목.
  const packageItemRaw =
    prefillAssessmentItemsRef.current.find((it) => it.itemType === 'package') ??
    null;
  const packageItem = packageItemRaw
    ? {
        ...packageItemRaw,
        unitPrice: packagePriceOverride ?? packageItemRaw.unitPrice,
      }
    : null;
  const selectedIndividualItems = assessmentItems.filter((it) => it.selected);
  const assessmentSelectedCount = selectedIndividualItems.length;
  const allAssessmentSelected =
    assessmentItems.length > 0 && assessmentItems.every((it) => it.selected);
  // 세트가 있고 하위 단일검사 전체 선택 → 세트(패키지)로 청구, 부분 선택 → 개별 청구
  const useSetBilling = !!packageItem && allAssessmentSelected;
  const billingItems = useSetBilling ? [packageItem] : selectedIndividualItems;
  const assessmentTotal = useSetBilling
    ? packageItem.unitPrice
    : selectedIndividualItems.reduce((sum, it) => sum + it.unitPrice, 0);

  // ─── 금액 요약 (바우처 지원금 반영) ───
  // 바우처 선택은 회기 차감만; 실제 금액 차감은 지원금(subsidy) 입력값으로 결정.
  const subtotal = isAssessment ? assessmentTotal : total;
  const effectiveSubsidy = selectedVoucher && subsidy > 0 ? subsidy : 0;
  const finalAmount = Math.max(subtotal - effectiveSubsidy, 0);
  // 금액제 바우처(잔여 금액 있음) 선택 시 지원금 입력 필수
  const subsidyRequired = isAmountVoucher(selectedVoucher);
  const subsidyMissing = subsidyRequired && subsidy <= 0;
  const amountCountLabel = isAssessment
    ? assessmentSelectedCount > 0
      ? `(${assessmentSelectedCount}건)`
      : ''
    : selectedCount > 0
      ? `(${selectedCount}회기)`
      : '';

  const handleBackToClient = () => {
    if (clients.length > 1 && !initialClientId) {
      setStep('client');
    }
  };

  const toggleSession = (sessionId: string, billed: boolean) => {
    if (billed) return;
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(selectableSessions.map((s) => s.id)));
    }
  };

  const toggleAssessmentItem = (referenceId: string) => {
    setAssessmentItems((prev) =>
      prev.map((it) =>
        it.referenceId === referenceId ? { ...it, selected: !it.selected } : it,
      ),
    );
  };

  const toggleAllAssessmentItems = () => {
    const target = !allAssessmentSelected;
    setAssessmentItems((prev) =>
      prev.map((it) => ({ ...it, selected: target })),
    );
  };

  const canSubmit = isAssessment
    ? !!selectedClient &&
      assessmentSelectedCount > 0 &&
      // 0원 항목이 남아 있으면 발행 차단 — 0원 청구는 백엔드가 자동 완납 처리해 잘못된 완납 이력이 남는다
      billingItems.every((it) => it.unitPrice > 0) &&
      !subsidyMissing &&
      !createBillable.isPending
    : !!selectedClient &&
      selectedCount > 0 &&
      unitPrice > 0 &&
      !subsidyMissing &&
      !createBillable.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !selectedClient) return;

    let payload: CreateBillablePayload;

    // 바우처 선택 시 모든 item에 연결 + 청구서 단위 지원금 (백엔드가 회기 비율 분배·차감)
    const clientVoucherId = selectedVoucher?.id ?? null;
    const subsidyAmount = selectedVoucher && subsidy > 0 ? subsidy : undefined;

    if (isAssessment) {
      const billingSessionId = selectedClient.sessions?.[0]?.id;
      payload = {
        client_id: selectedClient.client.id,
        billable_date: todayDateString(),
        memo: memo.trim() || undefined,
        subsidy_amount: subsidyAmount,
        items: billingItems.map((item) => ({
          item_type: item.itemType,
          price_list_id: item.priceListId,
          description: item.description,
          quantity: 1,
          unit_price: item.unitPrice,
          related_type: 'assessment_session',
          related_case_id: caseId,
          related_session_id: billingSessionId,
          client_voucher_id: clientVoucherId,
        })),
      };
    } else {
      const selectedIds = Array.from(selectedSessionIds);
      const relatedType = isPackageMode
        ? 'counseling_case'
        : 'counseling_session';
      payload = {
        client_id: selectedClient.client.id,
        billable_date: todayDateString(),
        memo: memo.trim() || undefined,
        subsidy_amount: subsidyAmount,
        items: selectedIds.map((sid) => ({
          item_type: 'service',
          price_list_id: priceListId,
          description: description.trim() || '상담',
          quantity: 1,
          unit_price: unitPrice,
          related_type: relatedType,
          related_case_id: caseId,
          related_session_id: sid,
          client_voucher_id: clientVoucherId,
        })),
      };
    }

    createBillable.mutate(payload, {
      onSuccess: (res) => {
        onClose();
        if (res.warnings && res.warnings.length > 0) {
          showToast({ type: 'error', message: res.warnings[0] });
          return;
        }
        // 미수금 있으면 부모가 '납부 처리?' 모달 → 납부 시트로 이어감.
        // 0원·완납 자동 처리(미수금 0)면 토스트만.
        if (onIssued && res.unpaid_amount > 0) {
          // 이 시트(BottomSheet=RN Modal)가 닫히는 애니메이션이 끝난 뒤 ConfirmModal을 띄운다.
          // RN은 두 Modal을 동시에 present하면 두 번째(납부 확인 모달)가 안 뜨므로,
          // onClose()로 시트가 unmount된 다음으로 지연시킨다(닫힘 200ms + 여유).
          const issued = { billableId: res.id, unpaidAmount: res.unpaid_amount };
          setTimeout(() => onIssued(issued), 300);
        } else {
          showToast({
            type: 'info',
            message:
              isPackageMode && !isAssessment
                ? '패키지 선결제를 발행했어요'
                : '청구서를 발행했어요',
          });
        }
      },
      onError: (err: any) => {
        const detail =
          err?.response?.data?.detail ||
          '청구서 발행에 실패했어요';
        showToast({ type: 'error', message: detail });
      },
    });
  };

  // ─── render ───
  const canGoBack =
    (step === 'sessions' && clients.length > 1 && !initialClientId) ||
    step === 'pricing';
  const goBack = () => {
    if (step === 'pricing') setStep('sessions');
    else handleBackToClient();
  };

  // 단계 인디케이터 — picker step 필요한 경우 3단계, 아니면 2단계
  const needsClientPicker = clients.length > 1 && !initialClientId;
  const stepLabels = needsClientPicker
    ? ['내담자 선택', isAssessment ? '검사 선택' : '회기 선택', isAssessment ? '청구 확인' : '단가 입력']
    : [isAssessment ? '검사 선택' : '회기 선택', isAssessment ? '청구 확인' : '단가 입력'];
  const stepIndex = needsClientPicker
    ? step === 'client'
      ? 0
      : step === 'sessions'
        ? 1
        : 2
    : step === 'sessions'
      ? 0
      : 1;
  const showStepIndicator = true;

  // client step의 "다음" 버튼 활성화 조건
  const canAdvanceClient = !!selectedClientId;
  const canGoNext = isAssessment
    ? assessmentSelectedCount > 0
    : selectedCountForClient > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} fullHeight>
      {/* 헤더 — 닫기(X)만 우측 정렬. 핸들 바 바로 아래 붙임 */}
      <View
        className="flex-row items-center justify-end"
        style={{
          marginTop: -s(8),
          marginBottom: s(8),
          minHeight: s(28),
        }}
      >
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityLabel="닫기"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>

      {/* 단계 인디케이터 */}
      {showStepIndicator && (
        <View style={{ marginBottom: s(28), alignItems: 'center' }}>
          <View className="flex-row items-center">
            {stepLabels.map((label, idx) => {
              const active = idx === stepIndex;
              // 각 단계는 실제로 "선택"이 이뤄졌을 때만 완료 처리
              // (선택 없이 다음 단계로 건너뛰면 완료로 표시되지 않도록)
              const sessionsStepIndex = needsClientPicker ? 1 : 0;
              const isClientStep = needsClientPicker && idx === 0;
              const isSessionsStep = idx === sessionsStepIndex;
              // 회기/검사 단계 완료 = 현재 내담자 기준 실제 선택 수 > 0
              // (canGoNext는 pre-select된 stale 선택까지 포함하므로 사용하지 않음)
              const sessionsStepComplete = isAssessment
                ? assessmentSelectedCount > 0
                : selectedCountForClient > 0;
              const done =
                idx < stepIndex &&
                (!isClientStep || !!selectedClientId) &&
                (!isSessionsStep || sessionsStepComplete);
              const circleBg = done
                ? COLORS.primary
                : active
                  ? COLORS.blue[100]
                  : COLORS.bg['emphasis-subtle'];
              const numberColor = done
                ? COLORS.white
                : active
                  ? COLORS.primary
                  : COLORS.text.body.subtle;
              return (
                <View
                  key={idx}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      // 자유 이동 — idx에 해당하는 step으로 직접 점프
                      const target: Step =
                        needsClientPicker
                          ? idx === 0
                            ? 'client'
                            : idx === 1
                              ? 'sessions'
                              : 'pricing'
                          : idx === 0
                            ? 'sessions'
                            : 'pricing';
                      setStep(target);
                    }}
                    activeOpacity={0.7}
                    hitSlop={6}
                    accessibilityLabel={`${label} 단계로 이동`}
                    accessibilityRole="button"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(6),
                    }}
                  >
                    <View
                      style={{
                        width: s(22),
                        height: s(22),
                        borderRadius: s(11),
                        backgroundColor: circleBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done ? (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.white}
                        />
                      ) : (
                        <Typography
                          variant="label-02"
                          weight="semibold"
                          style={{ color: numberColor }}
                        >
                          {idx + 1}
                        </Typography>
                      )}
                    </View>
                    <Typography
                      variant="body-02"
                      weight={active ? 'semibold' : 'medium'}
                      style={{
                        color: done
                          ? COLORS.text.state.brand
                          : active
                            ? COLORS.gray[900]
                            : COLORS.gray[400],
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Typography>
                  </TouchableOpacity>
                  {idx < stepLabels.length - 1 && (
                    <View
                      style={{
                        width: stepLabels.length === 3 ? s(20) : s(50),
                        height: 1,
                        marginHorizontal: stepLabels.length === 3 ? s(8) : s(16),
                        backgroundColor: done
                          ? COLORS.primary
                          : COLORS.border.default,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {step === 'client' ? (
        <>
          <ClientPickerStep
            clients={clients}
            selectedId={selectedClientId}
            onSelect={(id) => setSelectedClientId(id)}
          />

          {/* 다음 버튼 — 내담자 선택 시 활성화, 회기 선택 step으로 진행 */}
          <TouchableOpacity
            onPress={() => selectedClientId && setStep('sessions')}
            disabled={!canAdvanceClient}
            activeOpacity={0.7}
            className="mt-4 items-center justify-center rounded-md"
            style={{
              height: s(52),
              backgroundColor: canAdvanceClient
                ? COLORS.primary
                : COLORS.button.primary['bg-disabled'],
            }}
            accessibilityLabel="다음"
            accessibilityRole="button"
          >
            <Typography
              variant="body-01"
              weight="semibold"
              style={{
                color: canAdvanceClient
                  ? COLORS.white
                  : COLORS.text.state.disabled,
              }}
            >
              다음
            </Typography>
          </TouchableOpacity>
        </>
      ) : prefillQuery.isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : step === 'sessions' ? (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: s(8) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {selectedClient && (
              <ClientInfoBox
                client={selectedClient.client}
                program={selectedClient.client.program}
                showChange={clients.length > 1 && !initialClientId}
                onChange={handleBackToClient}
              />
            )}

            {isAssessment ? (
              <>
                {/* 검사 선택 */}
                <View className="mb-4 flex-row items-center justify-between">
                  <Typography variant="headline-02" weight="semibold" className="text-gray-900">
                    청구할 검사를 선택해주세요
                  </Typography>
                </View>
                <Typography variant="label-01" className="mb-3 text-gray-500">
                  총 {assessmentItems.length}건
                  {assessmentSelectedCount > 0 ? (
                    <>
                      {' · '}
                      <Typography
                        variant="label-01"
                        weight="semibold"
                        style={{ color: COLORS.text.state.brand }}
                      >
                        {assessmentSelectedCount}건 선택
                      </Typography>
                    </>
                  ) : null}
                </Typography>

                {assessmentItems.length === 0 && (
                  <View className="mb-4 items-center rounded-xl bg-gray-50 px-3 py-4">
                    <Typography variant="body-03" className="text-gray-400">
                      청구할 검사가 없어요
                    </Typography>
                  </View>
                )}

                {/* 세트 = 하나의 컨테이너(카드). 선택 시 하위 단일검사 전체 선택/해제 */}
                {packageItem && (
                  <AssessmentItemCheckRow
                    item={{ ...packageItem, selected: allAssessmentSelected }}
                    onToggle={toggleAllAssessmentItems}
                  />
                )}

                {/* 단일 검사 = 컨테이너 없이 리스트로 나열 */}
                {assessmentItems.length > 0 && (
                  <View
                    className="mb-4"
                    style={{
                      marginTop: packageItem ? s(8) : 0,
                      // 세트 하위일 때 세트 카드 안 텍스트(border 1 + padding 14)와 정렬
                      paddingHorizontal: packageItem ? s(14) : 0,
                    }}
                  >
                    {assessmentItems.map((item, idx) => (
                      <View key={item.referenceId}>
                        {idx > 0 && (
                          <View
                            style={{ height: 1, backgroundColor: COLORS.gray[100] }}
                          />
                        )}
                        <PlainTestRow
                          item={item}
                          onToggle={() => toggleAssessmentItem(item.referenceId)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                {/* 회기 선택 */}
                <View className="mb-4 flex-row items-center justify-between">
                  <Typography variant="headline-02" weight="semibold" className="text-gray-900">
                    청구할 회기를 선택해주세요
                  </Typography>
                  <TouchableOpacity
                    onPress={toggleSelectAll}
                    hitSlop={6}
                    disabled={selectableSessions.length === 0}
                    accessibilityLabel={allSelectableSelected ? '전체 해제' : '전체 선택'}
                    accessibilityRole="button"
                  >
                    <Typography
                      variant="body-03"
                      weight="regular"
                      style={{
                        color:
                          selectableSessions.length === 0
                            ? COLORS.gray[400]
                            : COLORS.text.body.default,
                      }}
                    >
                      {allSelectableSelected ? '전체 해제' : '전체 선택'}
                    </Typography>
                  </TouchableOpacity>
                </View>
                {isPackageMode && (
                  <View
                    className="mb-3 rounded-xl px-4 py-3"
                    style={{ backgroundColor: COLORS.primary50 }}
                  >
                    <Typography
                      variant="body-02"
                      weight="semibold"
                      style={{ color: COLORS.text.state.brand }}
                    >
                      전체 {selectableSessions.length}회기를 한 번에 청구해요
                    </Typography>
                    <Typography
                      variant="label-01"
                      className="mt-1"
                      style={{ color: COLORS.text.body.default }}
                    >
                      각 회기에 회기당 단가가 적용돼요. 이후 추가되는 회기는
                      미청구로 남아요.
                    </Typography>
                  </View>
                )}

                <Typography variant="label-01" className="mb-3 text-gray-500">
                  총 {sessionsForClient.length}개의 회기
                  {selectedCountForClient > 0 ? (
                    <>
                      {' · '}
                      <Typography
                        variant="label-01"
                        weight="semibold"
                        style={{ color: COLORS.text.state.brand }}
                      >
                        {selectedCountForClient}개 선택
                      </Typography>
                    </>
                  ) : null}
                </Typography>

                <View className="mb-4" style={{ gap: s(6) }}>
                  {sessionsForClient.length === 0 && (
                    <View
                      className="items-center justify-center rounded-xl bg-gray-50 px-3"
                      style={{ height: s(64) }}
                    >
                      <Typography
                        variant="body-03"
                        style={{ color: COLORS.text.body.subtle }}
                      >
                        {selectedClient
                          ? '청구할 회기가 없어요'
                          : '내담자를 선택하면 청구할 회기를 고를 수 있어요'}
                      </Typography>
                    </View>
                  )}
                  {sortedSessionsForClient.map((sess) => {
                    const isSelected = selectedSessionIds.has(sess.id);
                    const isDisabled = sess.billed || sess.status === 'cancelled';
                    return (
                      <SessionCheckRow
                        key={sess.id}
                        session={sess}
                        isSelected={isSelected}
                        isDisabled={isDisabled}
                        onToggle={() => toggleSession(sess.id, isDisabled)}
                      />
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={() => setStep('pricing')}
            disabled={!canGoNext}
            activeOpacity={0.7}
            className="mt-4 items-center justify-center rounded-md"
            style={{
              height: s(52),
              backgroundColor: canGoNext ? COLORS.primary : COLORS.button.primary['bg-disabled'],
            }}
            accessibilityLabel="다음"
            accessibilityRole="button"
          >
            <Typography
              variant="body-01"
              weight="semibold"
              style={{
                color: canGoNext ? COLORS.white : COLORS.text.state.disabled,
              }}
            >
              다음
            </Typography>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: s(8) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isAssessment ? (
              <>
                {/* 검사 항목 요약 — 청구 대상(세트 또는 개별). 세트 청구 시 포함 단일검사도 하위로 노출 */}
                {billingItems.length > 0 && (
                  <View
                    className="rounded-xl bg-gray-50"
                    style={{
                      paddingHorizontal: s(16),
                      paddingVertical: s(14),
                      gap: s(10),
                    }}
                  >
                    {billingItems.map((item) => (
                    <View
                      key={item.referenceId}
                      className="flex-row items-center justify-between"
                      style={{ gap: s(8) }}
                    >
                      <View className="flex-row items-center" style={{ flex: 1, gap: s(6) }}>
                        {item.itemType === 'package' && <SetBadge />}
                        <Typography
                          variant="body-02"
                          weight={item.itemType === 'package' ? 'semibold' : 'medium'}
                          className="text-gray-800"
                          numberOfLines={1}
                          style={{ flexShrink: 1 }}
                        >
                          {item.description}
                        </Typography>
                      </View>
                      {/* 단가 수기 수정 — 단가표 미등록(0원) 검사도 발행 가능하게 (0원 발행=자동 완납 함정 방지) */}
                      <View className="flex-row items-center" style={{ gap: s(2) }}>
                        <TextInput
                          value={item.unitPrice > 0 ? item.unitPrice.toLocaleString() : ''}
                          onChangeText={(t) => {
                            const v = parseInt(t.replace(/[^0-9]/g, '') || '0', 10);
                            if (item.itemType === 'package') {
                              setPackagePriceOverride(v);
                            } else {
                              setAssessmentItems((prev) =>
                                prev.map((it) =>
                                  it.referenceId === item.referenceId
                                    ? { ...it, unitPrice: v }
                                    : it,
                                ),
                              );
                            }
                          }}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={COLORS.gray[400]}
                          style={{
                            minWidth: s(64),
                            textAlign: 'right',
                            fontSize: s(15),
                            fontWeight: '600',
                            color: item.unitPrice > 0 ? COLORS.gray[800] : COLORS.gray[400],
                            letterSpacing: -0.41,
                            paddingVertical: 0,
                          }}
                        />
                        <Typography variant="body-02" weight="medium" className="text-gray-700">
                          원
                        </Typography>
                      </View>
                    </View>
                    ))}

                    {/* 세트 청구 시 — 세트에 포함된 단일 검사 목록(세트보다 낮은 위계) */}
                    {useSetBilling && assessmentItems.length > 0 && (
                      <View style={{ paddingLeft: s(10), gap: s(4) }}>
                        {assessmentItems.map((sub) => (
                          <Typography
                            key={sub.referenceId}
                            variant="body-03"
                            weight="regular"
                            numberOfLines={1}
                            style={{ color: COLORS.text.body.default }}
                          >
                            {sub.description}
                          </Typography>
                        ))}
                      </View>
                    )}
                  </View>
                )}
                {/* 총액은 아래 통합 금액 요약(바우처 지원금 반영) 섹션에서 표시 */}
              </>
            ) : (
              <>
                {/* 선택한 회기 요약 */}
                {selectedCountForClient > 0 && (
                  <View
                    className="rounded-xl bg-gray-50"
                    style={{
                      paddingHorizontal: s(16),
                      paddingVertical: s(14),
                      gap: s(10),
                    }}
                  >
                    {Array.from(selectedSessionIds).map((sid) => {
                      const sess = sessionsForClient.find((s_) => s_.id === sid);
                      if (!sess) return null;
                      let dateLabel = sess.start;
                      let timeLabel = '';
                      try {
                        dateLabel = format(parseDate(sess.start), 'M월 d일 (E)', { locale: ko });
                        const startT = format(parseDate(sess.start), 'HH:mm', { locale: ko });
                        const endT = sess.end
                          ? format(parseDate(sess.end), 'HH:mm', { locale: ko })
                          : '';
                        timeLabel = endT ? `${startT} - ${endT}` : startT;
                      } catch {}
                      const isPrepaid = sess.status === 'scheduled';
                      return (
                        <View key={sid} className="flex-row items-center" style={{ gap: s(4) }}>
                          <Typography variant="body-02" weight="semibold" className="text-gray-900">
                            {dateLabel}
                          </Typography>
                          {timeLabel && (
                            <Typography variant="body-03" weight="regular" className="text-gray-400">
                              {timeLabel}
                            </Typography>
                          )}
                          {isPrepaid && (
                            <Typography
                              variant="label-02"
                              weight="semibold"
                              style={{ color: COLORS.text.state.brand }}
                            >
                              선결제
                            </Typography>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 선택 회기 있으면 박스 아래 간격(20), 없으면 타이틀 상단 정렬(marginTop 0).
                    타이틀↔콘텐츠 간격은 아래 "회기당 단가" 라벨의 marginTop으로 일정하게 유지 */}
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  className="text-gray-900"
                  style={{ marginTop: selectedCountForClient > 0 ? s(20) : 0 }}
                >
                  청구 금액을 입력해주세요
                </Typography>
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="text-gray-600"
                  style={{ marginTop: s(16), marginBottom: s(8) }}
                >
                  회기당 단가
                </Typography>
                <View
                  className="flex-row items-center rounded-xl border border-gray-200"
                  style={{
                    height: s(52),
                    paddingHorizontal: s(16),
                    backgroundColor:
                      selectedCountForClient > 0 ? undefined : COLORS.gray[50],
                  }}
                >
                  <TextInput
                    editable={selectedCountForClient > 0}
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
                      fontSize: s(18),
                      fontWeight: '700',
                      color:
                        selectedCountForClient > 0
                          ? COLORS.gray[800]
                          : COLORS.gray[400],
                      letterSpacing: -0.41,
                    }}
                  />
                  <Typography variant="body-02" className="ml-2 text-gray-400">원</Typography>
                </View>
                {/* 총액은 아래 통합 금액 요약(바우처 지원금 반영) 섹션에서 표시 */}
              </>
            )}

            {/* 바우처 선택 + 지원금 (공통) — 사용 가능한 바우처 없으면 미노출 */}
            <VoucherPickerRow
              centerId={centerId}
              clientId={selectedClient?.client.id ?? null}
              selected={selectedVoucher}
              onChange={setSelectedVoucher}
              subsidy={subsidy}
              onSubsidyChange={setSubsidy}
              subsidyRequired={subsidyRequired}
            />

            {/* 금액 요약 — 바우처 지원금 반영(본인부담금). 박스 없이 plain 행 (이미지) */}
            <View style={{ marginTop: s(20), gap: s(8) }}>
              {effectiveSubsidy > 0 ? (
                <>
                  <View className="flex-row items-center justify-between">
                    <Typography variant="body-02" weight="medium" className="text-gray-500">
                      정가 합계 {amountCountLabel}
                    </Typography>
                    <Typography variant="body-02" weight="medium" className="text-gray-700">
                      {subtotal.toLocaleString()}원
                    </Typography>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Typography
                      variant="body-02"
                      weight="medium"
                      style={{ color: COLORS.palette.mint }}
                    >
                      바우처 지원금
                    </Typography>
                    <Typography
                      variant="body-02"
                      weight="medium"
                      style={{ color: COLORS.palette.mint }}
                    >
                      −{effectiveSubsidy.toLocaleString()}원
                    </Typography>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Typography variant="body-02" weight="semibold" className="text-gray-700">
                      본인부담금
                    </Typography>
                    <Typography variant="title-01" weight="bold" className="text-gray-900">
                      {finalAmount.toLocaleString()}원
                    </Typography>
                  </View>
                </>
              ) : (
                <View className="flex-row items-center justify-between">
                  <Typography variant="body-02" weight="semibold" className="text-gray-700">
                    총액 {amountCountLabel}
                  </Typography>
                  <Typography variant="title-01" weight="bold" className="text-gray-900">
                    {finalAmount.toLocaleString()}원
                  </Typography>
                </View>
              )}
            </View>

            {/* 총액 ↔ 메모 구분선 — 청구 상세 시트와 동일한 점선 */}
            <View style={{ marginTop: s(24) }}>
              <DashedLine />
            </View>

            {/* 메모 (공통) */}
            <Typography
              variant="body-03"
              weight="medium"
              className="text-gray-600"
              style={{ marginTop: s(24), marginBottom: s(8) }}
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

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.7}
            className="mt-4 items-center justify-center rounded-md"
            style={{
              height: s(52),
              backgroundColor: canSubmit ? COLORS.primary : COLORS.button.primary['bg-disabled'],
            }}
            accessibilityLabel={isPackageMode && !isAssessment ? '패키지 선결제 발행' : '청구서 발행'}
            accessibilityRole="button"
          >
            {createBillable.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Typography
                variant="body-01"
                weight="semibold"
                style={{
                  color: canSubmit ? COLORS.white : COLORS.text.state.disabled,
                }}
              >
                {isPackageMode && !isAssessment ? '패키지 선결제 발행' : '청구서 발행'}
              </Typography>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* 시트(Modal) 위에 토스트가 보이도록 시트 안에서도 호스트 마운트 —
          없으면 발행 실패/성공 토스트가 모달 뒤로 숨어 "로딩만 되고 안 됨"처럼 보임 */}
      <GlobalToastHost elevated />
    </BottomSheet>
  );
}

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

// ─── 세트/개별 모드 토글 (sliding indicator) ───
const TOGGLE_PADDING = s(4);
const TOGGLE_HEIGHT = s(36);

function BillingModeToggle({
  mode,
  onSwitch,
}: {
  mode: 'set' | 'individual';
  onSwitch: (m: 'set' | 'individual') => void;
}) {
  const slideAnim = useRef(new Animated.Value(mode === 'set' ? 0 : 1)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'set' ? 0 : 1,
      useNativeDriver: false,
      tension: 300,
      friction: 30,
    }).start();
  }, [mode, slideAnim]);

  const tabWidth = containerWidth > 0 ? (containerWidth - TOGGLE_PADDING * 2) / 2 : 0;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  });

  return (
    <View
      style={{
        marginBottom: s(16),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[100],
        padding: TOGGLE_PADDING,
        height: TOGGLE_HEIGHT + TOGGLE_PADDING * 2,
      }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {tabWidth > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: TOGGLE_PADDING,
            left: TOGGLE_PADDING,
            width: tabWidth,
            height: TOGGLE_HEIGHT,
            borderRadius: s(10),
            backgroundColor: COLORS.white,
            transform: [{ translateX }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
          }}
        />
      )}
      <View style={{ flexDirection: 'row', height: TOGGLE_HEIGHT }}>
        {(['set', 'individual'] as const).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => onSwitch(m)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Typography
                variant="body-03"
                weight={active ? 'semibold' : 'medium'}
                style={{
                  color: active ? COLORS.gray[900] : COLORS.gray[500],
                }}
              >
                {m === 'set' ? '세트 전체' : '개별 검사'}
              </Typography>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step 1: 내담자 선택 ───
function ClientPickerStep({
  clients,
  selectedId,
  onSelect,
}: {
  clients: ClientCandidate[];
  selectedId: string | null;
  onSelect: (clientId: string) => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: s(8) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: s(8) }}>
        {clients.map((c) => {
          const totalSessions = c.sessions.length;
          const billableSessions = c.sessions.filter(
            (s) => !s.billed && s.status !== 'cancelled',
          ).length;
          const isSelected = selectedId === c.client.id;
          const genderLabel = genderToLabel(c.client.gender);
          const age = c.client.age;
          return (
            <TouchableOpacity
              key={c.client.id}
              onPress={() => onSelect(c.client.id)}
              activeOpacity={0.7}
              accessibilityLabel={`${c.client.name} ${isSelected ? '선택됨' : '선택'}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={{
                backgroundColor: isSelected ? COLORS.primary50 : COLORS.white,
                borderWidth: 1,
                borderColor: isSelected ? COLORS.primary : COLORS.gray[200],
                borderRadius: s(12),
                paddingHorizontal: s(14),
                paddingVertical: s(12),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(12),
              }}
            >
              <ClientAvatar
                name={c.client.name}
                imageUrl={c.client.profileImageUrl ?? null}
                seed={c.client.id}
                size={40}
              />
              <View style={{ flex: 1, gap: s(2) }}>
                <View className="flex-row items-center" style={{ gap: s(6) }}>
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    className="text-gray-900"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {c.client.name}
                  </Typography>
                  <GenderAgeMeta genderLabel={genderLabel} age={age} />
                </View>
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.text.label.default }}
                >
                  청구 가능 {billableSessions}/{totalSessions}회기
                </Typography>
              </View>
              <Icon
                name={isSelected ? 'check-on-28' : 'check-off-28'}
                size={28}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── 단일 검사 plain 행 (세트 하위 / 세트 없는 케이스) — 컨테이너 없이 리스트로 ───
function PlainTestRow({
  item,
  onToggle,
}: {
  item: AssessmentBillingItem;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.selected }}
      accessibilityLabel={`${item.description} ${item.selected ? '선택됨' : '선택 안 됨'}`}
      className="flex-row items-center"
      style={{ gap: s(10), paddingVertical: s(12) }}
    >
      <View style={{ flex: 1, gap: s(2) }}>
        <Typography
          variant="body-02"
          weight="medium"
          className="text-gray-900"
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {item.description}
        </Typography>
        <Typography
          variant="label-01"
          style={{
            color: item.unitPrice > 0 ? COLORS.text.label.default : COLORS.gray[400],
          }}
        >
          {item.unitPrice > 0 ? `${item.unitPrice.toLocaleString()}원` : '단가 미정'}
        </Typography>
      </View>
      {/* 선택됐을 때만 체크 아이콘 (회기 리스트와 동일) */}
      {item.selected && <Icon name="check-on-28" size={28} />}
    </TouchableOpacity>
  );
}

// ─── 검사 체크 행 (assessment) ───
function AssessmentItemCheckRow({
  item,
  onToggle,
}: {
  item: AssessmentBillingItem;
  onToggle: () => void;
}) {
  const isPackage = item.itemType === 'package';

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityLabel={`${item.description} ${item.selected ? '선택됨' : '선택 안 됨'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.selected }}
      style={{
        backgroundColor: item.selected ? COLORS.primary50 : COLORS.white,
        borderWidth: 1,
        borderColor: item.selected ? COLORS.primary : COLORS.gray[200],
        borderRadius: s(12),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
      }}
    >
      <View style={{ flex: 1, gap: s(4) }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          {isPackage && <SetBadge />}
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {item.description}
          </Typography>
        </View>
        <Typography
          variant="label-01"
          style={{ color: item.unitPrice > 0 ? COLORS.gray[600] : COLORS.gray[400] }}
        >
          {item.unitPrice > 0
            ? `${item.unitPrice.toLocaleString()}원`
            : '단가 미정'}
        </Typography>
      </View>

      {/* 선택됐을 때만 체크 아이콘 (회기 리스트와 동일 — 토글 없음) */}
      {item.selected && <Icon name="check-on-28" size={28} />}
    </TouchableOpacity>
  );
}

// ─── 회기 체크 행 ───
function SessionCheckRow({
  session,
  isSelected,
  isDisabled,
  onToggle,
}: {
  session: SessionForBilling;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  const dateLabel = (() => {
    try {
      return format(parseDate(session.start), 'yyyy년 M월 d일 (E)', { locale: ko });
    } catch {
      return session.start;
    }
  })();
  const timeLabel = (() => {
    try {
      const start = format(parseDate(session.start), 'HH:mm', { locale: ko });
      const end = session.end
        ? format(parseDate(session.end), 'HH:mm', { locale: ko })
        : '';
      return end ? `${start}-${end}` : start;
    } catch {
      return '';
    }
  })();

  // 청구완료 텍스트 영역 폭 — 2글자 상태 배지의 hug 폭(텍스트 + 좌우 패딩 s(12))과 맞춰 행 정렬 유지.
  // 배지 자체는 기존대로 hug 폭을 유지하고, 텍스트 영역만 이 폭으로 고정한다.
  const BILLED_TEXT_WIDTH = s(50);

  // 상담 상세 회기 리스트(SessionRow)의 SessionStatusBadge와 동일한 tag 팔레트 — 라운드 pill, 아이콘 없음.
  // 청구 완료(billed)는 배지가 아닌 brand 컬러 텍스트로만 표기 (아래 렌더 분기).
  const stateBadge: { label: string; color: string; bg: string } | null =
    session.status === 'cancelled'
      ? { label: '취소', color: COLORS.tag.red.fg, bg: COLORS.tag.red.bg }
      : session.status === 'no_show'
        ? { label: '노쇼', color: COLORS.tag.orange.fg, bg: COLORS.tag.orange.bg }
        : session.status === 'completed'
          ? { label: '완료', color: COLORS.tag.green.fg, bg: COLORS.tag.green.bg }
          : session.status === 'scheduled'
            ? { label: '예정', color: COLORS.tag.gray.fg, bg: COLORS.tag.gray.bg }
            : null;

  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityLabel={`회기 ${dateLabel} ${isSelected ? '선택됨' : '선택 안 됨'}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      style={{
        backgroundColor: isSelected ? COLORS.primary50 : COLORS.white,
        borderWidth: 1,
        borderColor: isSelected ? COLORS.primary : COLORS.gray[200],
        borderRadius: s(12),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
      }}
    >
      {/* 회기 정보 — 좌측 칩(딤드 제외) + 날짜(위)·시간(아래) 세로 스택. 상담 상세 회기 리스트와 동일 */}
      <View className="flex-row items-center" style={{ flex: 1, gap: s(12) }}>
        {session.billed ? (
          // 배지가 아닌 텍스트 전용 — 배지 폭에 맞춘 고정 폭에 가운데 정렬해 행 정렬 유지.
          <View style={{ width: BILLED_TEXT_WIDTH, alignItems: 'center' }}>
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.text.state.brand }}
            >
              청구완료
            </Typography>
          </View>
        ) : (
          stateBadge && (
            <BadgeRound bg={stateBadge.bg} color={stateBadge.color}>
              {stateBadge.label}
            </BadgeRound>
          )
        )}
        <View style={{ flex: 1, gap: s(2), opacity: isDisabled ? 0.55 : 1 }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {dateLabel}
          </Typography>
          {timeLabel.length > 0 && (
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
              numberOfLines={1}
            >
              {timeLabel}
            </Typography>
          )}
        </View>
      </View>

      {/* 우측 끝 — 선택됐을 때만 체크 아이콘 표시 (미선택·비활성은 아이콘 없음) */}
      {isSelected && <Icon name="check-on-28" size={28} />}
    </TouchableOpacity>
  );
}
