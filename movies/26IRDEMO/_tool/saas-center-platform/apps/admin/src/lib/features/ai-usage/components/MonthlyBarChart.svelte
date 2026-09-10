<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { MonthlyUsageItem } from '$hooks/actions/ai-usage.action'
  import { fmtKRW, fmtNum, changePctDisplay } from '../view-model'
  import NoDataSection from '$components/NoDataSection.svelte'

  interface Props {
    items: MonthlyUsageItem[]
    selectedMonth: string
    mode: 'cost' | 'calls'
    rateChangeMonths?: string[]
    onMonthSelect?: (month: string) => void
  }

  let {
    items,
    selectedMonth,
    mode,
    rateChangeMonths = [],
    onMonthSelect,
  }: Props = $props()

  const reversed = $derived([...items].reverse())
  const maxCost = $derived(items.length > 0 ? Math.max(...items.map((m) => m.estimated_cost)) : 0)
  const maxCalls = $derived(items.length > 0 ? Math.max(...items.map((m) => m.call_count)) : 0)

  let hoveredIdx = $state<number | null>(null)

  function monthlyChange(
    arr: MonthlyUsageItem[],
    idx: number,
  ): { pct: number; direction: 'up' | 'down' | 'flat' } | null {
    if (idx >= arr.length - 1) return null
    const current = arr[idx].estimated_cost
    const prev = arr[idx + 1].estimated_cost
    if (prev === 0) return null
    const pct = ((current - prev) / prev) * 100
    if (Math.abs(pct) < 1) return { pct: 0, direction: 'flat' }
    return { pct, direction: pct > 0 ? 'up' : 'down' }
  }

  function handleBarClick(item: MonthlyUsageItem) {
    const [y, m] = item.month.split('-')
    onMonthSelect?.(`${y}-${Number(m)}`)
  }
</script>

{#if items.length === 0}
  <div class="py-16">
    <NoDataSection description="월별 사용 데이터가 없습니다" />
  </div>
{:else}
  <!-- 바 차트 영역 -->
  <div class="border-b border-gray-100 px-5 pb-4 pt-5">
    <div class="relative pt-8" style="height: 200px">
      <!-- 기준선 -->
      {#each [0, 0.25, 0.5, 0.75, 1] as ratio}
        <div
          class="absolute left-0 right-0 border-b border-dashed border-gray-100"
          style="bottom: {ratio * 100}%"
        ></div>
      {/each}

      <div class="relative flex h-full items-end gap-1 sm:gap-2">
        {#each reversed as item, idx}
          {@const maxVal = mode === 'cost' ? maxCost : maxCalls}
          {@const val = mode === 'cost' ? item.estimated_cost : item.call_count}
          {@const barH = maxVal > 0 ? (val / maxVal) * 100 : 0}
          {@const isSelected = item.month === selectedMonth}
          {@const isHovered = hoveredIdx === idx}
          {@const hasRateChange = rateChangeMonths.includes(item.month)}

          <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
          <div
            class="group relative flex flex-1 cursor-pointer flex-col items-center justify-end"
            style="height: 100%"
            onmouseenter={() => (hoveredIdx = idx)}
            onmouseleave={() => (hoveredIdx = null)}
            onclick={() => handleBarClick(item)}
          >
            {#if hasRateChange}
              <div
                class="absolute top-0 z-10 h-1.5 w-1.5 -translate-y-2 rounded-full bg-yellow-400"
                title="크레딧 비율 변경"
              ></div>
            {/if}

            <div
              class="relative w-full rounded-t-lg transition-all duration-300 ease-out
                {isSelected
                  ? 'bg-primary-500'
                  : isHovered
                    ? 'bg-primary-300'
                    : 'bg-gray-200'}
                {isHovered ? 'scale-x-105' : ''}"
              style="height: {Math.max(barH, 3)}%; max-width: 48px; margin: 0 auto"
            >
              <div
                class="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-label-01-normal-semibold tabular-nums transition-all duration-200
                  {isHovered || isSelected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                  {isSelected ? 'text-primary-600' : 'text-gray-600'}"
              >
                {mode === 'cost' ? fmtKRW(item.estimated_cost) : `${fmtNum(item.call_count)}회`}
              </div>
            </div>

            <p
              class="mt-2 text-center tabular-nums transition-colors duration-200
                {isSelected
                  ? 'text-label-01-normal-bold text-primary-600'
                  : isHovered
                    ? 'text-label-01-normal-medium text-gray-700'
                    : 'text-label-01-normal-regular text-gray-400'}"
            >
              {item.month.slice(5)}월
            </p>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- footer strip (ConceptA 스타일: 항상 gray bg) -->
  {#if hoveredIdx != null}
    {@const hItem = reversed[hoveredIdx]}
    {@const hChange = monthlyChange([...reversed].reverse(), reversed.length - 1 - hoveredIdx)}
    <div
      class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3.5"
      transition:slide={{ duration: 150 }}
    >
      <span class="tabular-nums text-body-03-normal-bold text-gray-700">{hItem.month}</span>
      <span class="text-body-03-normal-regular text-gray-500">
        비용 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(hItem.estimated_cost)}</span>
      </span>
      <span class="text-body-03-normal-regular text-gray-500">
        호출 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtNum(hItem.call_count)}회</span>
      </span>
      {#if hItem.call_count > 0}
        <span class="text-body-03-normal-regular text-gray-500">
          건당 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(Math.round(hItem.estimated_cost / hItem.call_count))}</span>
        </span>
      {/if}
      {#if hChange}
        {@const chgDisplay = changePctDisplay(hChange.pct)}
        {#if chgDisplay}
          <span class="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-label-01-normal-medium tabular-nums {chgDisplay.bgColor} {chgDisplay.color}">
            전월 대비 {chgDisplay.arrow}{chgDisplay.label}
          </span>
        {/if}
      {/if}
    </div>
  {:else}
    {@const selItem = reversed.find((m) => m.month === selectedMonth) ?? items[0]}
    {@const selIdx = items.findIndex((m) => m.month === selItem.month)}
    {@const selChange = selIdx >= 0 ? monthlyChange(items, selIdx) : null}
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3.5">
      <span class="tabular-nums text-body-03-normal-bold text-gray-700">{selItem.month}</span>
      <span class="text-body-03-normal-regular text-gray-500">
        비용 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(selItem.estimated_cost)}</span>
      </span>
      <span class="text-body-03-normal-regular text-gray-500">
        호출 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtNum(selItem.call_count)}회</span>
      </span>
      {#if selItem.call_count > 0}
        <span class="text-body-03-normal-regular text-gray-500">
          건당 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(Math.round(selItem.estimated_cost / selItem.call_count))}</span>
        </span>
      {/if}
      {#if selChange}
        {@const chgDisplay = changePctDisplay(selChange.pct)}
        {#if chgDisplay}
          <span class="inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-label-01-normal-medium tabular-nums {chgDisplay.bgColor} {chgDisplay.color}">
            전월 대비 {chgDisplay.arrow}{chgDisplay.label}
          </span>
        {/if}
      {/if}
    </div>
  {/if}
{/if}
