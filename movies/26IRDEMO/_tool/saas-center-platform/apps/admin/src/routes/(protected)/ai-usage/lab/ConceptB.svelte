<script lang="ts">
  import PageHeader from '$components/PageHeader.svelte'
  import Select from '$components/Select.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import LabMonthlyChart from './LabMonthlyChart.svelte'
  import {
    MOCK_SUMMARY, MOCK_MONTHLY, MOCK_FEATURES, MOCK_CENTERS,
    MOCK_SUMMARY_EXT,
    MONTH_OPTIONS, fmtKRW, fmtNum, fmtTokens,
    costChangeBadge, featureStatusConfig,
    featureExt, centerExt,
    marginConfig, errorRateConfig, spikeConfig,
  } from './mock'

  // ─── 상태 ─────────────────────────────────────────────────────────────────
  let selectedMonth = $state(MOCK_MONTHLY[0].month)
  const selItem = $derived(MOCK_MONTHLY.find((m) => m.month === selectedMonth) ?? MOCK_MONTHLY[0])

  const costChg   = $derived(costChangeBadge(MOCK_SUMMARY.cost_change_pct))
  const marginCfg = $derived(marginConfig(MOCK_SUMMARY_EXT.margin_pct))
  const errorCfg  = $derived(errorRateConfig(MOCK_SUMMARY_EXT.total_error_count, MOCK_SUMMARY_EXT.total_error_rate_pct))

  // ─── 기능별 비중 리스트 ──────────────────────────────────────────────────────
  const totalFeatureCost = $derived(MOCK_FEATURES.reduce((s, f) => s + f.monthly_cost, 0))

  // ─── 센터별 테이블 (전체) ──────────────────────────────────────────────────
  const avgCPC = $derived.by(() => {
    const tc = MOCK_CENTERS.reduce((s, c) => s + c.call_count, 0)
    const cc = MOCK_CENTERS.reduce((s, c) => s + c.estimated_cost, 0)
    return tc > 0 ? cc / tc : 0
  })
  const maxCenterCost = $derived(Math.max(...MOCK_CENTERS.map((c) => c.estimated_cost)))

  interface CenterRow {
    id: string; rank: number; name: string
    calls: number; tokens: number; cpc: number; isHighCPC: boolean; bar: number; cost: number
    callSpikePct: number; isAnomaly: boolean
  }
  const centerRows = $derived<CenterRow[]>(
    MOCK_CENTERS.map((c, i) => {
      const cpc = c.call_count > 0 ? c.estimated_cost / c.call_count : 0
      const ext = centerExt(c.center_id)
      return {
        id: c.center_id, rank: i + 1, name: c.center_name,
        calls: c.call_count, tokens: c.total_tokens, cpc,
        isHighCPC: cpc > avgCPC * 1.5,
        bar: maxCenterCost > 0 ? (c.estimated_cost / maxCenterCost) * 100 : 0,
        cost: c.estimated_cost,
        callSpikePct: ext?.call_spike_pct ?? 0,
        isAnomaly: ext?.is_anomaly ?? false,
      }
    }),
  )

  const centerCols: TableColumn<CenterRow>[] = [
    { key: 'rank',   label: '#',    width: '40px',  align: 'center', render: cRankCell },
    { key: 'name',   label: '센터', width: '1fr',   render: cNameCell },
    { key: 'calls',  label: '호출', width: '80px',  align: 'right',  render: cCallCell },
    { key: 'tokens', label: '토큰', width: '90px',  align: 'right',  render: cTokenCell },
    { key: 'cpc',    label: '건당', width: '90px',  align: 'right',  render: cCpcCell },
    { key: 'cost',   label: '비용', width: '100px', align: 'right',  render: cCostCell },
    { key: 'id',     label: '관리', width: '60px',  align: 'center', render: cActionCell },
  ]
</script>

<!-- ── 센터별 셀 렌더러 ──────────────────────────────────────────────────────── -->
{#snippet cRankCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-400">{item.rank}</span>
{/snippet}

{#snippet cNameCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  {@const spike = spikeConfig(item.callSpikePct)}
  <div class="min-w-0">
    <div class="flex items-center gap-1.5">
      <a
        href="/centers/{item.id}"
        class="truncate text-body-03-normal-medium text-gray-800 hover:text-primary-600"
        onclick={(e) => e.stopPropagation()}
      >{item.name}</a>
      {#if item.isHighCPC}
        <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-yellow-50 px-1.5 py-0.5 text-label-02-normal-medium text-yellow-700">
          <span class="h-1 w-1 rounded-full bg-yellow-500"></span>
          고비용
        </span>
      {/if}
    </div>
    {#if spike}
      <span class="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {spike.bg} {spike.text} text-label-02-normal-medium tabular-nums">
        <span class="h-1 w-1 rounded-full {spike.dot}"></span>
        {spike.label}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet cCallCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-regular text-gray-500">{fmtNum(item.calls)}회</span>
{/snippet}

{#snippet cTokenCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-regular text-gray-500">{fmtTokens(item.tokens)}</span>
{/snippet}

{#snippet cCpcCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-medium {item.isHighCPC ? 'text-yellow-700' : 'text-gray-700'}">{fmtKRW(item.cpc)}</span>
{/snippet}

{#snippet cCostCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <div class="flex flex-col items-end gap-1">
    <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.cost)}</span>
    <div class="h-1 w-16 overflow-hidden rounded-full bg-gray-100">
      <div class="h-full rounded-full bg-primary-300 transition-all" style="width:{item.bar}%"></div>
    </div>
  </div>
{/snippet}

{#snippet cActionCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <a
    href="/centers/{item.id}"
    class="text-label-01-normal-medium text-primary-600 hover:underline"
    onclick={(e) => e.stopPropagation()}
  >관리</a>
{/snippet}

<!-- ════════════════════════════════ B — 분석형 ═══════════════════════════════ -->
<div>
  <PageHeader title="AI 사용량 분석" description="기능별·센터별 비용 분석 및 수익성 추이를 확인합니다">
    {#snippet actions()}
      <Select
        class="w-40"
        selected={selectedMonth}
        showActiveHighlight
        defaultValue={MOCK_MONTHLY[0].month}
        on:change={(e) => (selectedMonth = e.detail.value)}
        options={MONTH_OPTIONS}
      />
    {/snippet}
  </PageHeader>

  <!-- ── 4지표 수평 스트립 ──────────────────────────────────────────────────── -->
  <div class="section-border mb-6 flex flex-wrap divide-x divide-gray-100 overflow-hidden bg-white">

    <div class="flex min-w-40 flex-1 flex-col gap-1.5 px-5 py-4">
      <p class="text-label-01-normal-regular text-gray-400">API 비용 (지출)</p>
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="tabular-nums text-headline-02-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY.total_cost)}</span>
        {#if costChg}
          <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {costChg.bg} {costChg.text} text-label-02-normal-medium tabular-nums">
            <span class="h-1 w-1 rounded-full {costChg.dot}"></span>
            {costChg.label}
          </span>
        {/if}
      </div>
    </div>

    <div class="flex min-w-40 flex-1 flex-col gap-1.5 px-5 py-4">
      <p class="text-label-01-normal-regular text-gray-400">크레딧 매출 (수입)</p>
      <span class="tabular-nums text-headline-02-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY_EXT.total_revenue_krw)}</span>
    </div>

    <div class="flex min-w-40 flex-1 flex-col gap-1.5 px-5 py-4">
      <p class="text-label-01-normal-regular text-gray-400">순이익 / 마진</p>
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="tabular-nums text-headline-02-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY_EXT.net_profit_krw)}</span>
        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {marginCfg.bg} {marginCfg.text} text-label-02-normal-medium tabular-nums">
          <span class="h-1 w-1 rounded-full {marginCfg.dot}"></span>
          {MOCK_SUMMARY_EXT.margin_pct >= 0 ? '+' : ''}{MOCK_SUMMARY_EXT.margin_pct.toFixed(1)}%
        </span>
      </div>
    </div>

    <div class="flex min-w-40 flex-1 flex-col gap-1.5 px-5 py-4">
      <p class="text-label-01-normal-regular text-gray-400">에러 건수 / 실패율</p>
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="tabular-nums text-headline-02-normal-bold text-gray-900">{fmtNum(MOCK_SUMMARY_EXT.total_error_count)}건</span>
        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {errorCfg.bg} {errorCfg.text} text-label-02-normal-medium tabular-nums">
          <span class="h-1 w-1 rounded-full {errorCfg.dot}"></span>
          {MOCK_SUMMARY_EXT.total_error_rate_pct.toFixed(1)}%
        </span>
      </div>
    </div>

  </div>

  <!-- ── 2열: 차트 (2fr) + 기능별 비중 리스트 (1fr) ──────────────────────── -->
  <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">

    <!-- 바 차트 카드 -->
    <div class="section-border bg-white">
      <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 class="text-title-01-normal-semibold text-gray-900">월별 비용 추이</h2>
        <span class="tabular-nums text-body-03-normal-regular text-gray-400">
          선택: <span class="text-body-03-normal-medium text-gray-700">{selItem.month.replace('-', '년 ')}월</span>
          <span class="ml-2 text-gray-300">|</span>
          <span class="ml-2 tabular-nums text-body-03-normal-semibold text-gray-700">{fmtKRW(selItem.estimated_cost)}</span>
        </span>
      </div>
      <div class="px-6 py-5">
        <LabMonthlyChart
          data={MOCK_MONTHLY}
          {selectedMonth}
          height={168}
          onSelectMonth={(m) => (selectedMonth = m)}
        />
      </div>
    </div>

    <!-- 기능별 비중 리스트 -->
    <div class="section-border flex flex-col bg-white">
      <div class="border-b border-gray-100 px-5 py-4">
        <h2 class="text-title-01-normal-semibold text-gray-900">기능별 비중</h2>
      </div>
      <div class="flex flex-1 flex-col divide-y divide-gray-50">
        {#each MOCK_FEATURES as f}
          {@const share = totalFeatureCost > 0 ? (f.monthly_cost / totalFeatureCost) * 100 : 0}
          {@const scfg  = featureStatusConfig(f.status)}
          {@const ext   = featureExt(f.purpose)}
          {@const ecfg  = ext ? errorRateConfig(ext.error_count, ext.error_rate_pct) : null}
          {@const mcfg  = ext ? marginConfig(ext.margin_pct) : null}
          <div class="px-5 py-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-body-03-normal-medium text-gray-800">{f.feature}</span>
                  <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {scfg.bg} {scfg.text} text-label-02-normal-medium">
                    <span class="h-1 w-1 rounded-full {scfg.dot}"></span>
                    {scfg.label}
                  </span>
                </div>
                <div class="mt-1 flex flex-wrap gap-1">
                  {#if ecfg}
                    <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {ecfg.bg} {ecfg.text} text-label-02-normal-medium tabular-nums">
                      <span class="h-1 w-1 rounded-full {ecfg.dot}"></span>
                      실패 {fmtNum(ext?.error_count ?? 0)}건
                    </span>
                  {/if}
                  {#if mcfg && ext}
                    <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {mcfg.bg} {mcfg.text} text-label-02-normal-medium tabular-nums">
                      <span class="h-1 w-1 rounded-full {mcfg.dot}"></span>
                      {ext.margin_pct >= 0 ? '+' : ''}{ext.margin_pct.toFixed(1)}%
                    </span>
                  {/if}
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(f.monthly_cost)}</p>
                <p class="tabular-nums text-label-01-normal-regular text-gray-400">{share.toFixed(0)}%</p>
              </div>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-primary-400 transition-all" style="width:{Math.min(share, 100)}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

  </div>

  <!-- ── 센터별 상세 테이블 (전체, 풀너비) ────────────────────────────────── -->
  <div>
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-title-01-normal-semibold text-gray-900">센터별 사용 현황</h2>
      <span class="text-body-03-normal-regular text-gray-400">
        평균 건당 <span class="ml-1 tabular-nums text-body-03-normal-semibold text-gray-700">{fmtKRW(avgCPC)}</span>
      </span>
    </div>
    <div class="section-border overflow-hidden">
      <Table columns={centerCols} data={centerRows} keyField="id" />
    </div>
  </div>
</div>
