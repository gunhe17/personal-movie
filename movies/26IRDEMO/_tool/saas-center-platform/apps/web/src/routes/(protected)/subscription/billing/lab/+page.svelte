<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'

  // ── 목 데이터 ──
  const MOCK_PAYMENTS = [
    {
      id: '1',
      planLabel: '스탠다드',
      amount: 49000,
      statusLabel: '완료',
      status: 'completed',
      method: '신한카드 1234',
      date: '2026.06.01',
      month: '2026.06'
    },
    {
      id: '2',
      planLabel: '스탠다드',
      amount: 49000,
      statusLabel: '완료',
      status: 'completed',
      method: '신한카드 1234',
      date: '2026.05.01',
      month: '2026.05'
    },
    {
      id: '3',
      planLabel: '스탠다드',
      amount: 49000,
      statusLabel: '완료',
      status: 'completed',
      method: '신한카드 1234',
      date: '2026.04.01',
      month: '2026.04'
    },
    {
      id: '4',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '완료',
      status: 'completed',
      method: '카카오페이',
      date: '2026.03.01',
      month: '2026.03'
    },
    {
      id: '5',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '실패',
      status: 'failed',
      method: '카카오페이',
      date: '2026.02.03',
      month: '2026.02'
    },
    {
      id: '6',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '완료',
      status: 'completed',
      method: '카카오페이',
      date: '2026.02.01',
      month: '2026.02'
    },
    {
      id: '7',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '완료',
      status: 'completed',
      method: '카카오페이',
      date: '2026.01.01',
      month: '2026.01'
    },
    {
      id: '8',
      planLabel: '무료',
      amount: 0,
      statusLabel: '완료',
      status: 'completed',
      method: '—',
      date: '2025.12.01',
      month: '2025.12'
    },
    {
      id: '9',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '취소',
      status: 'cancelled',
      method: '토스페이',
      date: '2025.11.15',
      month: '2025.11'
    },
    {
      id: '10',
      planLabel: '베이직',
      amount: 29000,
      statusLabel: '완료',
      status: 'completed',
      method: '토스페이',
      date: '2025.11.01',
      month: '2025.11'
    }
  ]

  const BADGE: Record<string, string> = {
    completed: 'bg-green-50 text-green-700',
    failed: 'bg-status-danger-bg text-red-600',
    cancelled: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-50 text-amber-700'
  }

  const YEARS = [2026, 2025]

  function fmt(n: number) {
    return n === 0 ? '무료' : `₩${n.toLocaleString()}`
  }

  function isPaid(status: string) {
    return status !== 'failed' && status !== 'cancelled'
  }

  // ── 시안 A 상태 ──
  let yearA = $state(2026)
  const rowsA = $derived(
    MOCK_PAYMENTS.filter((p) => p.date.startsWith(String(yearA)))
  )
  const totalA = $derived(
    rowsA.filter((p) => isPaid(p.status)).reduce((s, p) => s + p.amount, 0)
  )

  // ── 시안 B 상태 ──
  let yearB = $state(2026)
  const rowsB = $derived(
    MOCK_PAYMENTS.filter((p) => p.date.startsWith(String(yearB)))
  )
  const kpiMonthly = $derived(
    MOCK_PAYMENTS.filter(
      (p) => p.month === '2026.06' && isPaid(p.status)
    ).reduce((s, p) => s + p.amount, 0)
  )
  const kpiTotal = $derived(
    MOCK_PAYMENTS.filter((p) => isPaid(p.status)).reduce(
      (s, p) => s + p.amount,
      0
    )
  )
  const kpiCount = $derived(
    MOCK_PAYMENTS.filter((p) => isPaid(p.status)).length
  )

  // ── 시안 C 상태 ──
  let yearC = $state(2026)
  const rowsC = $derived(
    MOCK_PAYMENTS.filter((p) => p.date.startsWith(String(yearC)))
  )
  const groupsC = $derived.by(() => {
    const map = new Map<string, typeof MOCK_PAYMENTS>()
    for (const p of rowsC) {
      const list = map.get(p.month) ?? []
      list.push(p)
      map.set(p.month, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  })
  const totalC = $derived(
    rowsC.filter((p) => isPaid(p.status)).reduce((s, p) => s + p.amount, 0)
  )
</script>

<div in:fade class="flex flex-col gap-14 pb-12">
  <div>
    <PageTitleSection title="결제 내역 — 디자인 Lab" className="mb-2" />
    <p class="text-body-02-normal-regular text-gray-400">
      3가지 시안 비교. 아래 중 선택해주세요.
    </p>
  </div>

  <!-- ══════════════════════════════════════════════════
       시안 A  테이블 중심형
       · 연도 탭 (언더라인 인디케이터)
       · 5컬럼 테이블
       · 실패/취소 금액 취소선
       · 합산 행 (tfoot)
  ══════════════════════════════════════════════════ -->
  <section>
    <div class="mb-3 flex items-center gap-3">
      <span
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white"
        >A</span
      >
      <div>
        <span class="text-title-01-normal-semibold text-gray-800"
          >테이블 중심형</span
        >
        <span class="ml-2 text-body-03-normal-regular text-gray-400"
          >연도 탭 · 5컬럼 · 합산 행</span
        >
      </div>
    </div>

    <!-- 구독 스트립 -->
    <div
      class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-white px-6 py-3.5"
    >
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
          >스탠다드</span
        >
        <span class="text-body-03-normal-regular text-gray-500">활성</span>
      </div>
      <span class="hidden h-3.5 w-px bg-gray-300 sm:block"></span>
      <span class="text-body-03-normal-regular text-gray-500">
        다음 결제일 <span class="font-medium text-gray-700">2026.07.01</span>
      </span>
      <span class="hidden h-3.5 w-px bg-gray-300 sm:block"></span>
      <span class="text-body-03-normal-regular text-gray-500">
        다음 결제액 <span class="font-medium text-gray-700">₩49,000</span>
      </span>
    </div>

    <div class="overflow-hidden rounded-lg border border-gray-200">
      <!-- 연도 탭 헤더 -->
      <div
        class="flex items-center justify-between border-b border-gray-200 bg-white"
      >
        <div class="flex">
          {#each YEARS as y}
            <button
              onclick={() => (yearA = y)}
              class="relative px-5 py-4 text-body-02-normal-medium transition-colors
                {yearA === y
                ? 'text-primary-500'
                : 'text-gray-400 hover:text-gray-600'}"
            >
              {y}년
              {#if yearA === y}
                <span
                  class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary-500"
                ></span>
              {/if}
            </button>
          {/each}
        </div>
        {#if totalA > 0}
          <span class="pr-6 text-body-03-normal-medium text-gray-400">
            합계 <span class="text-gray-700">{fmt(totalA)}</span>
          </span>
        {/if}
      </div>

      {#if rowsA.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[540px]">
            <thead>
              <tr class="h-[52px] border-b border-gray-200 bg-gray-50/80">
                <th class="px-6 text-left font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >날짜</span
                  ></th
                >
                <th class="px-6 text-left font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >플랜</span
                  ></th
                >
                <th class="px-6 text-left font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >결제 수단</span
                  ></th
                >
                <th class="px-6 text-right font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >금액</span
                  ></th
                >
                <th class="px-6 text-right font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >상태</span
                  ></th
                >
              </tr>
            </thead>
            <tbody>
              {#each rowsA as p (p.id)}
                <tr
                  class="border-b border-gray-100 bg-white transition-colors last:border-0 hover:bg-gray-50"
                >
                  <td class="px-6 py-3.5">
                    <span
                      class="text-body-02-normal-regular tabular-nums text-gray-500"
                      >{p.date}</span
                    >
                  </td>
                  <td class="px-6 py-3.5">
                    <span class="text-body-02-normal-medium text-gray-800"
                      >{p.planLabel}</span
                    >
                  </td>
                  <td class="px-6 py-3.5">
                    <span class="text-body-02-normal-regular text-gray-500"
                      >{p.method}</span
                    >
                  </td>
                  <td class="px-6 py-3.5 text-right">
                    <span
                      class="text-body-02-normal-medium tabular-nums
                      {isPaid(p.status)
                        ? 'text-gray-800'
                        : 'text-gray-300 line-through'}"
                    >
                      {fmt(p.amount)}
                    </span>
                  </td>
                  <td class="px-6 py-3.5 text-right">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {BADGE[
                        p.status
                      ]}"
                    >
                      {p.statusLabel}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
            {#if totalA > 0}
              <tfoot>
                <tr class="border-t border-gray-200 bg-gray-50/60">
                  <td colspan="3" class="px-6 py-3">
                    <span class="text-body-03-normal-medium text-gray-500"
                      >{yearA}년 합계 (실패·취소 제외)</span
                    >
                  </td>
                  <td class="px-6 py-3 text-right">
                    <span class="text-body-02-normal-semibold text-primary-500"
                      >{fmt(totalA)}</span
                    >
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            {/if}
          </table>
        </div>
      {:else}
        <div class="py-14">
          <NoDataSection description="{yearA}년 결제 내역이 없어요" />
        </div>
      {/if}
    </div>
  </section>

  <!-- ══════════════════════════════════════════════════
       시안 B  KPI 카드 + 4컬럼 테이블
       · 상단 3개 KPI 요약 카드 (이번달 / 누적 / 현재 플랜)
       · 플랜+수단 통합 컬럼으로 4컬럼 테이블
       · 연도 Select
  ══════════════════════════════════════════════════ -->
  <section>
    <div class="mb-3 flex items-center gap-3">
      <span
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white"
        >B</span
      >
      <div>
        <span class="text-title-01-normal-semibold text-gray-800"
          >KPI 요약 카드형</span
        >
        <span class="ml-2 text-body-03-normal-regular text-gray-400"
          >상단 KPI 3카드 · 4컬럼 테이블</span
        >
      </div>
    </div>

    <!-- KPI 카드 3개 -->
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-4">
        <p class="mb-1 text-body-03-normal-regular text-gray-400">
          이번 달 결제
        </p>
        <p class="text-headline-02-normal-bold text-gray-900">
          {fmt(kpiMonthly)}
        </p>
        <p class="mt-1 text-body-03-normal-regular text-gray-400">2026년 6월</p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-4">
        <p class="mb-1 text-body-03-normal-regular text-gray-400">
          누적 결제 (전체)
        </p>
        <p class="text-headline-02-normal-bold text-gray-900">
          {fmt(kpiTotal)}
        </p>
        <p class="mt-1 text-body-03-normal-regular text-gray-400">
          총 {kpiCount}건 완료
        </p>
      </div>
      <div class="rounded-lg border border-primary-100 bg-primary-50 px-6 py-4">
        <p class="mb-1 text-body-03-normal-regular text-primary-400">
          현재 플랜
        </p>
        <p class="text-headline-02-normal-bold text-primary-500">스탠다드</p>
        <p class="mt-1 text-body-03-normal-regular text-primary-400">
          다음 결제 2026.07.01
        </p>
      </div>
    </div>

    <!-- 테이블 카드 -->
    <div class="overflow-hidden rounded-lg border border-gray-200">
      <div
        class="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4"
      >
        <h2 class="text-title-01-normal-semibold text-gray-800">결제 이력</h2>
        <select
          bind:value={yearB}
          class="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1.5
            text-body-03-normal-regular text-gray-700 focus:outline-none"
        >
          {#each YEARS as y}<option value={y}>{y}년</option>{/each}
        </select>
      </div>

      {#if rowsB.length > 0}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[480px]">
            <thead>
              <tr class="h-[52px] border-b border-gray-200 bg-gray-50/80">
                <th class="px-6 text-left font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >날짜</span
                  ></th
                >
                <th class="px-6 text-left font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >플랜 / 결제 수단</span
                  ></th
                >
                <th class="px-6 text-right font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >금액</span
                  ></th
                >
                <th class="px-6 text-right font-normal"
                  ><span class="text-body-02-normal-medium text-gray-600"
                    >상태</span
                  ></th
                >
              </tr>
            </thead>
            <tbody>
              {#each rowsB as p (p.id)}
                <tr
                  class="border-b border-gray-100 bg-white transition-colors last:border-0 hover:bg-gray-50"
                >
                  <td class="px-6 py-4">
                    <span
                      class="text-body-02-normal-regular tabular-nums text-gray-500"
                      >{p.date}</span
                    >
                  </td>
                  <td class="px-6 py-4">
                    <p class="text-body-02-normal-medium text-gray-800">
                      {p.planLabel}
                    </p>
                    <p class="mt-0.5 text-body-03-normal-regular text-gray-400">
                      {p.method}
                    </p>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <span
                      class="text-body-02-normal-semibold tabular-nums
                      {isPaid(p.status) ? 'text-gray-900' : 'text-gray-300'}"
                    >
                      {fmt(p.amount)}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {BADGE[
                        p.status
                      ]}"
                    >
                      {p.statusLabel}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="py-14">
          <NoDataSection description="{yearB}년 결제 내역이 없어요" />
        </div>
      {/if}
    </div>
  </section>

  <!-- ══════════════════════════════════════════════════
       시안 C  타임라인형
       · 연도 토글 버튼 (pill)
       · 월별 섹션 헤더 + 소계
       · 각 행: 날짜(일) / 플랜+수단 / 상태 / 금액
       · 연간 합산 행
  ══════════════════════════════════════════════════ -->
  <section>
    <div class="mb-3 flex items-center gap-3">
      <span
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white"
        >C</span
      >
      <div>
        <span class="text-title-01-normal-semibold text-gray-800"
          >타임라인형</span
        >
        <span class="ml-2 text-body-03-normal-regular text-gray-400"
          >월별 그루핑 · 소계 표시</span
        >
      </div>
    </div>

    <!-- 상단: 구독 요약 + 연도 토글 -->
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-6 py-4"
    >
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
          >스탠다드</span
        >
        <span class="text-body-03-normal-regular text-gray-500"
          >2026.06.01 ~ 2026.06.30</span
        >
        <span class="text-body-03-normal-regular text-gray-400"
          >· 다음 결제 2026.07.01</span
        >
      </div>
      <div class="flex items-center gap-1.5">
        {#each YEARS as y}
          <button
            onclick={() => (yearC = y)}
            class="h-8 rounded-full px-4 text-body-03-normal-medium transition-colors
              {yearC === y
              ? 'bg-gray-900 text-white'
              : 'border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
          >
            {y}
          </button>
        {/each}
      </div>
    </div>

    <!-- 타임라인 카드 -->
    <div class="overflow-hidden rounded-lg border border-gray-200">
      {#if rowsC.length > 0}
        {#each groupsC as [month, items]}
          {@const monthSubtotal = items
            .filter((p) => isPaid(p.status))
            .reduce((s, p) => s + p.amount, 0)}
          {@const [, m] = month.split('.')}

          <!-- 월 헤더 -->
          <div
            class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-2.5"
          >
            <span class="text-body-02-normal-semibold text-gray-600"
              >{parseInt(m)}월</span
            >
            {#if monthSubtotal > 0}
              <span class="text-body-03-normal-medium text-gray-400"
                >{fmt(monthSubtotal)}</span
              >
            {:else}
              <span class="text-body-03-normal-regular text-gray-300">—</span>
            {/if}
          </div>

          <!-- 해당 월 결제 항목들 -->
          {#each items as p (p.id)}
            <div
              class="flex items-center gap-5 border-b border-gray-100 bg-white px-6 py-4 transition-colors last:border-0 hover:bg-gray-50"
            >
              <!-- 날짜 (일만) -->
              <div class="w-14 shrink-0 text-center">
                <span
                  class="text-body-03-normal-regular tabular-nums text-gray-400"
                >
                  {p.date.substring(5)}
                </span>
              </div>

              <!-- 구분선 -->
              <div class="h-8 w-px shrink-0 bg-gray-100"></div>

              <!-- 플랜 + 수단 -->
              <div class="min-w-0 flex-1">
                <p class="text-body-02-normal-medium text-gray-800">
                  {p.planLabel} 플랜
                </p>
                <p class="mt-0.5 text-body-03-normal-regular text-gray-400">
                  {p.method}
                </p>
              </div>

              <!-- 상태 -->
              <span
                class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium {BADGE[
                  p.status
                ]}"
              >
                {p.statusLabel}
              </span>

              <!-- 금액 -->
              <div class="w-24 shrink-0 text-right">
                <span
                  class="text-body-02-normal-semibold tabular-nums
                  {isPaid(p.status)
                    ? 'text-gray-900'
                    : 'text-gray-300 line-through'}"
                >
                  {fmt(p.amount)}
                </span>
              </div>
            </div>
          {/each}
        {/each}

        <!-- 연간 합산 -->
        {#if totalC > 0}
          <div
            class="flex items-center justify-between border-t border-gray-200 bg-gray-50/50 px-6 py-4"
          >
            <span class="text-body-02-normal-medium text-gray-500"
              >{yearC}년 합계 (실패·취소 제외)</span
            >
            <span class="text-body-01-normal-semibold text-primary-500"
              >{fmt(totalC)}</span
            >
          </div>
        {/if}
      {:else}
        <div class="py-14">
          <NoDataSection description="{yearC}년 결제 내역이 없어요" />
        </div>
      {/if}
    </div>
  </section>
</div>
