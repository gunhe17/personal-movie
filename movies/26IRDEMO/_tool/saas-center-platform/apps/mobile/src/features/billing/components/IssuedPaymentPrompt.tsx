import { useEffect, useState } from 'react';
import { ConfirmModal } from '@/shared/components/ui/ConfirmModal';
import { BillableDetailSheet } from './BillableDetailSheet';

/** 발행 직후 이어가는 납부 대상 — 청구서 id + 미수금 */
export interface IssuedBillable {
  billableId: string;
  unpaidAmount: number;
}

/**
 * 청구서 발행 직후 플로우 — "이어서 납부 처리를 할까요?" 모달 → (납부하기) 청구 상세·납부 시트.
 * 납부 시트는 청구 메뉴(청구 현황)와 동일한 BillableDetailSheet를 재사용한다
 * (청구 상세 → "납부" 단계로 전환되는 2-step 시트).
 * UnifiedBillingSheet의 onIssued 결과를 부모가 state로 받아 이 컴포넌트에 넘긴다.
 */
export function IssuedPaymentPrompt({
  issued,
  centerId,
  onDone,
}: {
  issued: IssuedBillable | null;
  centerId: string | null;
  onDone: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  // 새 발행 결과가 들어오면 확인 모달부터 다시 시작
  useEffect(() => {
    if (issued) {
      setConfirmOpen(true);
      setPaying(false);
    } else {
      setConfirmOpen(false);
      setPaying(false);
    }
  }, [issued]);

  // 납부하기 — 확인 모달(RN Modal)을 먼저 닫고, 그 Modal이 unmount된 뒤 시트(역시 Modal)를 연다.
  // RN은 두 Modal을 동시에 present하면 두 번째(시트)가 안 뜨므로 시트 오픈을 지연한다.
  const goPay = () => {
    setConfirmOpen(false);
    setTimeout(() => setPaying(true), 220);
  };

  return (
    <>
      <ConfirmModal
        visible={confirmOpen && !paying}
        title="청구서를 발행했어요"
        message="이어서 납부 처리를 할까요?"
        confirmLabel="납부하기"
        cancelLabel="나중에"
        onConfirm={goPay}
        onCancel={onDone}
      />
      <BillableDetailSheet
        visible={!!issued && paying}
        onClose={onDone}
        centerId={centerId}
        billableId={issued?.billableId ?? null}
      />
    </>
  );
}
