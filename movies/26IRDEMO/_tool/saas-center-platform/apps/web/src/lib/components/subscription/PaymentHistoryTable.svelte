<script lang="ts">
  // 결제 내역 도메인 테이블 (§4-2 도메인 테이블 표준 — generic Table을 감싸는 얇은 래퍼).
  // 기준 구현: CounselingStatusTable. 읽기 전용 이력이라 행 클릭은 없고, 영수증 버튼만 액션.
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'

  // 행 계약(ViewModel). 실제 API 연결 시 view-model.ts에서 이 형태로 매핑한다.
  export type PaymentHistoryRow = {
    id: string
    date: string
    planLabel: string
    cycle: string
    period: string
    amount: number
    status: string
    statusLabel: string
    method: string
    cardSuffix?: string
  }

  interface Props {
    data: PaymentHistoryRow[]
    /** 영수증 버튼 클릭 — 모달 열기는 페이지가 담당 */
    onReceipt?: (row: PaymentHistoryRow) => void
    class?: string
  }

  let { data, onReceipt, class: className = '' }: Props = $props()

  // 상태 배지 색상 (§2-2 시맨틱 정본 — 연한 배경 + 진한 텍스트)
  const STATUS_BADGE: Record<string, string> = {
    completed: 'bg-green-50 text-green-700',
    failed: 'bg-status-danger-bg text-red-600',
    cancelled: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-50 text-amber-700'
  }

  // 실패·취소 건은 흐리게 (소비 안 된 결제)
  const isDimmed = (status: string) =>
    status === 'failed' || status === 'cancelled'

  const columns: TableColumn<PaymentHistoryRow>[] = [
    {
      key: 'date',
      label: '결제일',
      width: '120px',
      align: 'left',
      render: dateCell
    },
    {
      key: 'planLabel',
      label: '플랜',
      width: 'minmax(100px, 1fr)',
      align: 'left',
      render: planCell
    },
    {
      key: 'period',
      label: '결제 기간',
      width: 'minmax(160px, 1.8fr)',
      align: 'left',
      render: periodCell
    },
    {
      key: 'method',
      label: '결제 수단',
      width: 'minmax(120px, 1fr)',
      align: 'left',
      render: methodCell
    },
    {
      key: 'amount',
      label: '금액',
      width: '110px',
      align: 'right',
      render: amountCell
    },
    {
      key: 'status',
      label: '상태',
      width: '72px',
      align: 'center',
      render: statusCell
    },
    {
      key: 'receipt',
      label: '영수증',
      width: '64px',
      align: 'center',
      cellClass: 'flex justify-center items-center',
      stopPropagation: true,
      render: receiptCell
    }
  ]
</script>

{#snippet dateCell({ item }: { item: PaymentHistoryRow })}
  {@const dimmed = isDimmed(item.status)}
  <span
    class="text-body-02-normal-regular tabular-nums text-gray-600 {dimmed
      ? 'line-through opacity-70'
      : ''}"
  >
    {item.date}
  </span>
{/snippet}

{#snippet planCell({ item }: { item: PaymentHistoryRow })}
  {@const dimmed = isDimmed(item.status)}
  <div class="flex flex-col gap-0.5">
    <span
      class="text-body-02-normal-regular text-gray-600 {dimmed
        ? 'line-through opacity-70'
        : ''}">{item.planLabel}</span
    >
    <span
      class="text-body-03-normal-regular text-gray-400 {dimmed
        ? 'line-through opacity-70'
        : ''}">{item.cycle}</span
    >
  </div>
{/snippet}

{#snippet periodCell({ item }: { item: PaymentHistoryRow })}
  {@const dimmed = isDimmed(item.status)}
  <span
    class="text-body-03-normal-regular tabular-nums text-gray-500 {dimmed
      ? 'line-through opacity-70'
      : ''}"
  >
    {item.period}
  </span>
{/snippet}

{#snippet methodCell({ item }: { item: PaymentHistoryRow })}
  {@const dimmed = isDimmed(item.status)}
  <div class="flex flex-col gap-0.5">
    <span
      class="text-body-02-normal-regular text-gray-500 {dimmed
        ? 'line-through opacity-70'
        : ''}">{item.method}</span
    >
    {#if item.cardSuffix}
      <span
        class="text-body-03-normal-regular text-gray-400 {dimmed
          ? 'line-through opacity-70'
          : ''}">{item.cardSuffix}</span
      >
    {/if}
  </div>
{/snippet}

{#snippet amountCell({ item }: { item: PaymentHistoryRow })}
  {@const dimmed = isDimmed(item.status)}
  <span
    class="text-body-02-normal-medium tabular-nums text-gray-800 {dimmed
      ? 'line-through opacity-70'
      : ''}"
  >
    {item.amount === 0 ? '무료' : `₩${item.amount.toLocaleString()}`}
  </span>
{/snippet}

{#snippet statusCell({ item }: { item: PaymentHistoryRow })}
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {STATUS_BADGE[
      item.status
    ] ?? 'bg-gray-100 text-gray-500'}"
  >
    {item.statusLabel}
  </span>
{/snippet}

{#snippet receiptCell({ item }: { item: PaymentHistoryRow })}
  {#if item.status === 'completed' && item.amount > 0}
    <button
      class="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      aria-label="영수증 보기"
      onclick={() => onReceipt?.(item)}
    >
      <svg
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </button>
  {/if}
{/snippet}

<div
  class="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 {className}"
>
  <Table
    {columns}
    {data}
    keyField="id"
    containerClass="flex-1 min-h-0"
    bodyClass="flex-1 min-h-0 overflow-auto"
    rowHeight="h-[64px] shrink-0"
    headerClass="bg-white border-b border-gray-200"
    rowClass="border-gray-100 !py-0"
    hoverEnabled={false}
  />
</div>
