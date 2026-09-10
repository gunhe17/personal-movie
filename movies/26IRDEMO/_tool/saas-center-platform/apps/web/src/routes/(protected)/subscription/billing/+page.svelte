<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import Select from '$lib/components/Select.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import PaymentHistoryTable, {
    type PaymentHistoryRow
  } from '$lib/components/subscription/PaymentHistoryTable.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { modalStore } from '$lib/stores/modal'
  import { getPaymentHistory } from '$lib/hooks/actions/subscription.action'
  import PaymentReceiptModal from './PaymentReceiptModal.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { SUBSCRIPTION_STALE_TIME } from '$lib/features/subscription/constants'
  import { useQueryClient } from '@tanstack/svelte-query'

  const queryClient = useQueryClient()

  // ── 결제 이력 쿼리 ───────────────────────────────────────────────────────
  const paymentsQuery = $derived(
    queryBuilder(
      getPaymentHistory,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME
      })
    )
  )

  // TODO: 실제 API 연결 후 제거
  const MOCK_PAYMENTS: PaymentHistoryRow[] = [
    {
      id: '1',
      date: '2026.06.01',
      planLabel: '스탠다드',
      cycle: '월간 구독',
      period: '2026.06.01 ~ 2026.06.30',
      amount: 49000,
      status: 'completed',
      statusLabel: '완료',
      method: '신한카드',
      cardSuffix: '**** 1234'
    },
    {
      id: '2',
      date: '2026.05.15',
      planLabel: '스탠다드',
      cycle: '월간 구독',
      period: '2026.05.15 ~ 2026.06.14',
      amount: 49000,
      status: 'completed',
      statusLabel: '완료',
      method: '신한카드',
      cardSuffix: '**** 1234'
    },
    {
      id: '3',
      date: '2026.05.01',
      planLabel: '스탠다드',
      cycle: '월간 구독',
      period: '2026.05.01 ~ 2026.05.31',
      amount: 49000,
      status: 'completed',
      statusLabel: '완료',
      method: '신한카드',
      cardSuffix: '**** 1234'
    },
    {
      id: '4',
      date: '2026.04.15',
      planLabel: '스탠다드',
      cycle: '업그레이드 차액',
      period: '2026.04.15 ~ 2026.04.30',
      amount: 20000,
      status: 'completed',
      statusLabel: '완료',
      method: '신한카드',
      cardSuffix: '**** 1234'
    },
    {
      id: '5',
      date: '2026.04.01',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.04.01 ~ 2026.04.30',
      amount: 29000,
      status: 'completed',
      statusLabel: '완료',
      method: '카카오페이'
    },
    {
      id: '6',
      date: '2026.03.01',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.03.01 ~ 2026.03.31',
      amount: 29000,
      status: 'completed',
      statusLabel: '완료',
      method: '카카오페이'
    },
    {
      id: '7',
      date: '2026.02.03',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.02.01 ~ 2026.02.28',
      amount: 29000,
      status: 'failed',
      statusLabel: '실패',
      method: '카카오페이'
    },
    {
      id: '8',
      date: '2026.02.01',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.02.01 ~ 2026.02.28',
      amount: 29000,
      status: 'completed',
      statusLabel: '완료',
      method: '카카오페이'
    },
    {
      id: '9',
      date: '2026.01.15',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.01.15 ~ 2026.02.14',
      amount: 29000,
      status: 'cancelled',
      statusLabel: '취소',
      method: '카카오페이'
    },
    {
      id: '10',
      date: '2026.01.01',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2026.01.01 ~ 2026.01.31',
      amount: 29000,
      status: 'completed',
      statusLabel: '완료',
      method: '카카오페이'
    },
    {
      id: '11',
      date: '2026.01.01',
      planLabel: '무료',
      cycle: '무료 체험',
      period: '2025.11.01 ~ 2025.12.31',
      amount: 0,
      status: 'completed',
      statusLabel: '완료',
      method: '-'
    },
    {
      id: '12',
      date: '2026.06.15',
      planLabel: '스탠다드',
      cycle: '월간 구독',
      period: '2026.06.15 ~ 2026.07.14',
      amount: 0,
      status: 'pending',
      statusLabel: '대기',
      method: '신한카드',
      cardSuffix: '**** 1234'
    },
    {
      id: '13',
      date: '2025.12.01',
      planLabel: '무료',
      cycle: '무료 체험',
      period: '2025.12.01 ~ 2025.12.31',
      amount: 0,
      status: 'completed',
      statusLabel: '완료',
      method: '-'
    },
    {
      id: '14',
      date: '2025.11.15',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2025.11.15 ~ 2025.12.14',
      amount: 29000,
      status: 'cancelled',
      statusLabel: '취소',
      method: '토스페이'
    },
    {
      id: '15',
      date: '2025.11.01',
      planLabel: '베이직',
      cycle: '월간 구독',
      period: '2025.11.01 ~ 2025.11.30',
      amount: 29000,
      status: 'completed',
      statusLabel: '완료',
      method: '토스페이'
    }
  ]
  const allPayments = $derived(MOCK_PAYMENTS)

  // ── 연도 필터 옵션 ───────────────────────────────────────────────────────
  const availableYears = $derived.by(() => {
    const years = new Set<number>()
    for (const p of allPayments) years.add(parseInt(p.date.substring(0, 4)))
    return Array.from(years).sort((a, b) => b - a)
  })
  const yearOptions = $derived(availableYears.map((y) => `${y}년`))

  // ── 필터 상태 ────────────────────────────────────────────────────────────
  let selectedYearStr = $state(`${new Date().getFullYear()}년`)
  let selectedStatus = $state('전체')
  const STATUS_OPTIONS = ['전체', '완료', '실패', '취소']
  const selectedYear = $derived(parseInt(selectedYearStr))

  const filteredPayments = $derived(
    allPayments.filter(
      (p) =>
        p.date.startsWith(String(selectedYear)) &&
        (selectedStatus === '전체' || p.statusLabel === selectedStatus)
    )
  )

  const totalPaid = $derived(
    filteredPayments
      .filter((p) => p.status !== 'failed' && p.status !== 'cancelled')
      .reduce((s, p) => s + p.amount, 0)
  )

  // ── 페이지네이션 ─────────────────────────────────────────────────────────
  const PAGE_SIZE = 10
  let currentPage = $state(1)

  $effect(() => {
    // 필터 변경 시 첫 페이지로 리셋 (의존성: 두 필터 값 읽기만 해도 추적됨)
    selectedYearStr
    selectedStatus
    currentPage = 1
  })

  const pagedPayments = $derived(
    filteredPayments.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE
    )
  )

  function resetFilters() {
    selectedYearStr = `${new Date().getFullYear()}년`
    selectedStatus = '전체'
  }

  function openReceipt(payment: PaymentHistoryRow) {
    modalStore.open({
      component: PaymentReceiptModal,
      props: { payment },
      options: { customWidth: 420, isReceipt: true }
    })
  }

  const showLoading = $derived(
    paymentsQuery.isLoading && allPayments.length === 0
  )
  const showError = $derived(paymentsQuery.isError && allPayments.length === 0)
</script>

<!-- ── 3-2 목록 페이지 표준 레이아웃 ──────────────────────────────────── -->
<div in:fade class="xl:h-full flex flex-col xl:overflow-hidden bg-gray-50">
  <!-- 타이틀 아래가 필터 바(여백 가진 행) → 간격 8 -->
  <PageTitleSection title="결제 내역" className="mb-2" />

  <!-- 5-2 필터 바 -->
  <div class="filter-bar mb-3 flex flex-wrap items-center gap-3">
    <Select
      class="bg-white rounded-lg"
      options={yearOptions}
      bind:selected={selectedYearStr}
      on:change={(e) =>
        (selectedYearStr =
          typeof e.detail === 'string' ? e.detail : e.detail.value)}
    />
    <Select
      class="bg-white rounded-lg"
      options={STATUS_OPTIONS}
      bind:selected={selectedStatus}
      showActiveHighlight={true}
      defaultValue="전체"
      on:change={(e) =>
        (selectedStatus =
          typeof e.detail === 'string' ? e.detail : e.detail.value)}
    />
    <FilterResetButton onclick={resetFilters} />
  </div>

  <!-- 카운트 행 (5-3 패턴) -->
  <div class="mb-2 flex h-11 items-center justify-between">
    <span class="text-body-01-normal-regular text-gray-700">
      총 {filteredPayments.length}건
      {#if totalPaid > 0}
        <span class="ml-1 text-body-03-normal-regular text-gray-400">
          · 결제 합계 ₩{totalPaid.toLocaleString()}
        </span>
      {/if}
    </span>
  </div>

  <!-- 테이블 + 페이지네이션 영역 (3-2 표준 목록 패턴) -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    {#if showLoading}
      <div class="flex-center h-full">
        <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
      </div>
    {:else if showError}
      <div class="flex-center h-full flex-col gap-3">
        <p class="text-body-01-reading-regular text-gray-500">
          데이터를 불러오지 못했어요.
        </p>
        <button
          onclick={() =>
            queryClient.invalidateQueries({
              queryKey: ['getPaymentHistory'],
              exact: false
            })}
          class="rounded-lg border border-gray-200 px-4 py-2 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          다시 시도
        </button>
      </div>
    {:else if filteredPayments.length > 0}
      <!-- 도메인 테이블 컴포넌트 (§4-2 도메인 테이블 표준) -->
      <PaymentHistoryTable
        data={pagedPayments}
        onReceipt={openReceipt}
        class="min-h-0 flex-1"
      />
    {:else if allPayments.length > 0}
      <!-- 필터 결과 없음 -->
      <div class="flex-center h-full">
        <NoDataSection
          description="{selectedYear}년 {selectedStatus !== '전체'
            ? selectedStatus + ' '
            : ''}결제 내역이 없어요"
        >
          {#snippet actions()}
            <button
              onclick={resetFilters}
              class="text-body-02-normal-medium text-primary-500 hover:underline"
            >
              필터 초기화
            </button>
          {/snippet}
        </NoDataSection>
      </div>
    {:else}
      <!-- 전체 빈 상태 -->
      <div class="flex-center h-full">
        <NoDataSection description="결제 내역이 없어요" />
      </div>
    {/if}

    <!-- 페이지네이션: {#if} 블록 밖 배치 (3-2 표준), 10건 초과 시 노출 -->
    {#if filteredPayments.length > PAGE_SIZE}
      <div class="mt-4 flex shrink-0 justify-center">
        <Pagination
          totalItems={filteredPayments.length}
          itemsPerPage={PAGE_SIZE}
          bind:currentPage
        />
      </div>
    {/if}
  </div>
</div>
