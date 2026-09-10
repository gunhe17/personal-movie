/** draft는 서버에서 걸러진다 — 센터가 발행한 청구서만 앱에 온다 */
export type BillableStatus = 'issued' | 'paid' | 'overdue';

/** GET /app/billables 항목 — 조회 전용(인앱 결제 없음) */
export interface AppBillable {
  id: string;
  profile_id: string;
  profile_name: string | null;
  center_id: string;
  center_name: string | null;
  billable_date: string;
  due_date: string | null;
  status: BillableStatus;
  total_amount: number;
  discount_amount: number;
  subsidy_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  item_summary: string;
}

/** 청구 항목(영수증 상세) */
export interface AppBillableItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  related_type: string | null; // counseling* | assessment* (아이콘 분기)
}

/** GET /app/billables/{id} — 영수증 상세 */
export interface AppBillableDetail {
  id: string;
  status: BillableStatus;
  billable_date: string;
  issued_at: string | null;
  total_amount: number;
  discount_amount: number;
  subsidy_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  memo: string | null;
  items: AppBillableItem[];
}
