<script lang="ts">
  import Table, { type TableColumn } from '$components/Table.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import type { CenterUsageItem } from '$hooks/actions/ai-usage.action'
  import { fmtKRW, fmtNum } from '../view-model'

  interface Props {
    centers: CenterUsageItem[]
  }

  let { centers }: Props = $props()

  const avgCostPerCall = $derived.by(() => {
    const totalCalls = centers.reduce((s, c) => s + c.call_count, 0)
    const totalCost = centers.reduce((s, c) => s + c.estimated_cost, 0)
    return totalCalls > 0 ? totalCost / totalCalls : 0
  })

  const maxCost = $derived(centers.length > 0 ? Math.max(...centers.map((c) => c.estimated_cost)) : 0)
  const totalCost = $derived(centers.reduce((s, c) => s + c.estimated_cost, 0))

  interface CenterRow extends CenterUsageItem {
    _rank: number
    _costPerCall: number
    _isHighCPC: boolean
    _barWidth: number
  }

  const rows = $derived<CenterRow[]>(
    centers.map((c, i) => {
      const cpc = c.call_count > 0 ? c.estimated_cost / c.call_count : 0
      return {
        ...c,
        _rank: i + 1,
        _costPerCall: cpc,
        _isHighCPC: cpc > avgCostPerCall * 1.5 && avgCostPerCall > 0,
        _barWidth: maxCost > 0 ? (c.estimated_cost / maxCost) * 100 : 0,
      }
    }),
  )

  const columns: TableColumn<CenterRow>[] = [
    { key: '_rank',          label: '#',    width: '40px',  align: 'center', render: rankCell },
    { key: 'center_name',   label: '센터', width: '1fr',   render: nameCell },
    { key: 'call_count',    label: '호출', width: '80px',  align: 'right',  render: callCell },
    { key: '_costPerCall',  label: '건당', width: '90px',  align: 'right',  render: cpcCell },
    { key: 'estimated_cost', label: '비용', width: '100px', align: 'right',  render: costCell },
  ]
</script>

{#snippet rankCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-400">{item._rank}</span>
{/snippet}

{#snippet nameCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <div class="min-w-0">
    <div class="flex items-center gap-1.5">
      <a
        href="/center/manage/{item.center_id}"
        class="truncate text-body-03-normal-medium text-gray-800 hover:text-primary-600"
        onclick={(e) => e.stopPropagation()}
      >{item.center_name}</a>
      {#if item._isHighCPC}
        <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-label-02-normal-medium text-red-600">
          <span class="h-1 w-1 rounded-full bg-red-500"></span>
          고비용
        </span>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet callCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-regular text-gray-500">{fmtNum(item.call_count)}회</span>
{/snippet}

{#snippet cpcCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-medium {item._isHighCPC ? 'text-red-600' : 'text-gray-700'}">
    {fmtKRW(item._costPerCall)}
  </span>
{/snippet}

{#snippet costCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <div class="flex flex-col items-end gap-1">
    <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.estimated_cost)}</span>
    <div class="h-1 w-16 overflow-hidden rounded-full bg-gray-100">
      <div class="h-full rounded-full bg-primary-200 transition-all duration-500" style="width:{item._barWidth}%"></div>
    </div>
  </div>
{/snippet}

<div id="zone-centers">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-title-01-normal-semibold text-gray-900">센터별 사용량 TOP 10</h2>
    <div class="flex items-center gap-4">
      {#if centers.length > 0}
        <span class="text-body-03-normal-regular text-gray-500">
          평균 건당 <span class="tabular-nums text-body-03-normal-semibold text-gray-700">{fmtKRW(avgCostPerCall)}</span>
        </span>
      {/if}
      <a href="/center/manage" class="text-label-01-normal-medium text-primary-600 hover:underline">
        전체 보기 →
      </a>
    </div>
  </div>

  {#if centers.length === 0}
    <div class="section-border py-16">
      <NoDataSection description="데이터가 없습니다" />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={rows} keyField="center_id" />
    </div>
  {/if}
</div>
