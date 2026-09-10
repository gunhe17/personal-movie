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

  // 호출 증가 = 성장 신호 (녹색)
  function callChangeBadge(pct: number | null) {
    if (pct == null) return null
    if (Math.abs(pct) < 1) return { label: '유지', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' }
    if (pct > 0) return { label: `↑ +${Math.round(pct)}%`, bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' }
    return { label: `↓ ${Math.round(pct)}%`, bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' }
  }

  // ─── 상태 ─────────────────────────────────────────────────────────────────
  let selectedMonth = $state(MOCK_MONTHLY[0].month)
  const selItem = $derived(MOCK_MONTHLY.find((m) => m.month === selectedMonth) ?? MOCK_MONTHLY[0])

  const costChg    = $derived(costChangeBadge(MOCK_SUMMARY.cost_change_pct))
  const callChg    = $derived(callChangeBadge(MOCK_SUMMARY.call_change_pct))
  const marginCfg  = $derived(marginConfig(MOCK_SUMMARY_EXT.margin_pct))
  const errorCfg   = $derived(errorRateConfig(MOCK_SUMMARY_EXT.total_error_count, MOCK_SUMMARY_EXT.total_error_rate_pct))
  const costPerCall = $derived(
    MOCK_SUMMARY.total_calls > 0 ? Math.round(MOCK_SUMMARY.total_cost / MOCK_SUMMARY.total_calls) : 0,
  )

  // ─── 기능별 테이블 ───────────────────────────────────────────────────────
  const totalFeatureCost = $derived(MOCK_FEATURES.reduce((s, f) => s + f.monthly_cost, 0))

  interface FeatureRow {
    id: string; name: string; status: string
    calls: number; share: number; cost: number
    errorCount: number; errorRatePct: number; marginPct: number
  }
  const featureRows = $derived<FeatureRow[]>(
    MOCK_FEATURES.map((f) => {
      const ext = featureExt(f.purpose)
      return {
        id: f.purpose, name: f.feature, status: f.status,
        calls: f.call_count,
        share: totalFeatureCost > 0 ? (f.monthly_cost / totalFeatureCost) * 100 : 0,
        cost: f.monthly_cost,
        errorCount: ext?.error_count ?? 0,
        errorRatePct: ext?.error_rate_pct ?? 0,
        marginPct: ext?.margin_pct ?? 0,
      }
    }),
  )

  const featureCols: TableColumn<FeatureRow>[] = [
    { key: 'name',         label: '기능',     width: '1fr',   render: fNameCell },
    { key: 'errorRatePct', label: '실패율',   width: '150px', align: 'right', render: fErrorCell },
    { key: 'share',        label: '비용 비중', width: '130px', align: 'right', render: fShareCell },
    { key: 'cost',         label: '비용',     width: '90px',  align: 'right', render: fCostCell },
    { key: 'marginPct',    label: '마진',     width: '100px', align: 'right', render: fMarginCell },
  ]

  // ─── 센터별 TOP 5 ──────────────────────────────────────────────────────────
  const maxCenterCost = $derived(Math.max(...MOCK_CENTERS.map((c) => c.estimated_cost)))
  const avgCPC = $derived.by(() => {
    const tc = MOCK_CENTERS.reduce((s, c) => s + c.call_count, 0)
    const cc = MOCK_CENTERS.reduce((s, c) => s + c.estimated_cost, 0)
    return tc > 0 ? cc / tc : 0
  })

  interface CenterRow {
    id: string; rank: number; name: string
    calls: number; cpc: number; isHighCPC: boolean; bar: number; cost: number
    callSpikePct: number; isAnomaly: boolean
  }
  const centerRows = $derived<CenterRow[]>(
    MOCK_CENTERS.slice(0, 5).map((c, i) => {
      const cpc = c.call_count > 0 ? c.estimated_cost / c.call_count : 0
      const ext = centerExt(c.center_id)
      return {
        id: c.center_id, rank: i + 1, name: c.center_name,
        calls: c.call_count, cpc,
        isHighCPC: cpc > avgCPC * 1.5,
        bar: maxCenterCost > 0 ? (c.estimated_cost / maxCenterCost) * 100 : 0,
        cost: c.estimated_cost,
        callSpikePct: ext?.call_spike_pct ?? 0,
        isAnomaly: ext?.is_anomaly ?? false,
      }
    }),
  )

  const centerCols: TableColumn<CenterRow>[] = [
    { key: 'rank',  label: '#',    width: '40px',  align: 'center', render: cRankCell },
    { key: 'name',  label: '센터', width: '1fr',   render: cNameCell },
    { key: 'calls', label: '호출', width: '80px',  align: 'right',  render: cCallCell },
    { key: 'cpc',   label: '건당', width: '90px',  align: 'right',  render: cCpcCell },
    { key: 'cost',  label: '비용', width: '100px', align: 'right',  render: cCostCell },
  ]
</script>

<!-- ── 기능별 셀 ─────────────────────────────────────────────────────────────── -->
{#snippet fNameCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = featureStatusConfig(item.status)}
  <div class="flex items-center gap-2">
    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium">
      <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
      {cfg.label}
    </span>
    <span class="text-body-03-normal-medium text-gray-800">{item.name}</span>
  </div>
{/snippet}

{#snippet fErrorCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = errorRateConfig(item.errorCount, item.errorRatePct)}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium tabular-nums">
    <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
    {fmtNum(item.errorCount)}건 ({item.errorRatePct.toFixed(1)}%)
  </span>
{/snippet}

{#snippet fShareCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  <div class="flex items-center justify-end gap-2">
    <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
      <div class="h-full rounded-full bg-primary-400 transition-all" style="width:{Math.min(item.share, 100)}%"></div>
    </div>
    <span class="w-9 text-right tabular-nums text-label-01-normal-medium text-gray-500">{item.share.toFixed(0)}%</span>
  </div>
{/snippet}

{#snippet fCostCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.cost)}</span>
{/snippet}

{#snippet fMarginCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = marginConfig(item.marginPct)}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium tabular-nums">
    <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
    {item.marginPct >= 0 ? '+' : ''}{Math.round(item.marginPct)}%
  </span>
{/snippet}

<!-- ── 센터별 셀 ─────────────────────────────────────────────────────────────── -->
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
        <span class="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-label-02-normal-medium text-red-600">
          <span class="h-1 w-1 rounded-full bg-red-500"></span>
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

{#snippet cCpcCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-medium {item.isHighCPC ? 'text-red-600' : 'text-gray-700'}">{fmtKRW(item.cpc)}</span>
{/snippet}

{#snippet cCostCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <div class="flex flex-col items-end gap-1">
    <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.cost)}</span>
    <div class="h-1 w-16 overflow-hidden rounded-full bg-gray-100">
      <div class="h-full rounded-full bg-primary-200 transition-all" style="width:{item.bar}%"></div>
    </div>
  </div>
{/snippet}

<!-- ══════════════════════════════ A — 대시보드형 ══════════════════════════════ -->
<div>
  <PageHeader title="AI 사용량 관리" description="플랫폼 전체 AI 비용 및 사용 현황을 월별로 확인합니다">
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

  <!-- ── KPI: 2열 복합 카드 ────────────────────────────────────────────────── -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

    <!-- 비용·재무 복합 카드 -->
    <div class="section-border bg-white">
      <div class="px-6 pb-4 pt-5">
        <p class="text-label-01-normal-regular text-gray-500">이번달 AI 비용 (외부 API)</p>
        <div class="mt-2 flex flex-wrap items-baseline gap-3">
          <p class="tabular-nums text-headline-01-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY.total_cost)}</p>
          {#if costChg}
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 {costChg.bg} {costChg.text} text-label-01-normal-medium tabular-nums">
              <span class="h-1.5 w-1.5 rounded-full {costChg.dot}"></span>
              {costChg.label} 전월
            </span>
          {/if}
        </div>
      </div>
      <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">크레딧 매출</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{fmtKRW(MOCK_SUMMARY_EXT.total_revenue_krw)}</p>
        </div>
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">순이익 마진</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span class="tabular-nums text-body-03-normal-bold text-gray-700">{fmtKRW(MOCK_SUMMARY_EXT.net_profit_krw)}</span>
            <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {marginCfg.bg} {marginCfg.text} text-label-02-normal-medium tabular-nums">
              <span class="h-1 w-1 rounded-full {marginCfg.dot}"></span>
              {MOCK_SUMMARY_EXT.margin_pct >= 0 ? '+' : ''}{MOCK_SUMMARY_EXT.margin_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 호출·안정성 복합 카드 -->
    <div class="section-border bg-white">
      <div class="px-6 pb-4 pt-5">
        <p class="text-label-01-normal-regular text-gray-500">이번달 총 호출</p>
        <div class="mt-2 flex flex-wrap items-baseline gap-3">
          <p class="tabular-nums text-headline-01-normal-bold text-gray-900">
            {fmtNum(MOCK_SUMMARY.total_calls)}<span class="ml-1 text-body-01-normal-regular text-gray-400">회</span>
          </p>
          {#if callChg}
            <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 {callChg.bg} {callChg.text} text-label-01-normal-medium tabular-nums">
              <span class="h-1.5 w-1.5 rounded-full {callChg.dot}"></span>
              {callChg.label} 전월
            </span>
          {/if}
        </div>
      </div>
      <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">건당 평균 비용</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{fmtKRW(costPerCall)}</p>
        </div>
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">에러 현황</p>
          <div class="mt-0.5">
            <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {errorCfg.bg} {errorCfg.text} text-label-02-normal-medium tabular-nums">
              <span class="h-1 w-1 rounded-full {errorCfg.dot}"></span>
              {fmtNum(MOCK_SUMMARY_EXT.total_error_count)}건 ({MOCK_SUMMARY_EXT.total_error_rate_pct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 월별 비용 추이 차트 ──────────────────────────────────────────────────── -->
  <div class="mb-6 section-border bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
      <h2 class="text-title-01-normal-semibold text-gray-900">월별 비용 추이</h2>
      <span class="text-label-01-normal-regular text-gray-400">바를 클릭해 월별 상세 조회</span>
    </div>
    <div class="px-6 py-5">
      <LabMonthlyChart
        data={MOCK_MONTHLY}
        {selectedMonth}
        height={160}
        onSelectMonth={(m) => (selectedMonth = m)}
      />
    </div>
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3.5">
      <span class="tabular-nums text-body-03-normal-bold text-gray-700">{selItem.month.replace('-', '년 ')}월</span>
      <span class="text-body-03-normal-regular text-gray-500">
        비용 <span class="ml-0.5 tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(selItem.estimated_cost)}</span>
      </span>
      <span class="text-body-03-normal-regular text-gray-500">
        호출 <span class="ml-0.5 tabular-nums text-body-03-normal-semibold text-gray-800">{fmtNum(selItem.call_count)}회</span>
      </span>
      {#if selItem.call_count > 0}
        <span class="text-body-03-normal-regular text-gray-500">
          건당 <span class="ml-0.5 tabular-nums text-body-03-normal-semibold text-gray-800">{fmtKRW(Math.round(selItem.estimated_cost / selItem.call_count))}</span>
        </span>
      {/if}
      <span class="text-body-03-normal-regular text-gray-500">
        토큰 <span class="ml-0.5 tabular-nums text-body-03-normal-semibold text-gray-800">{fmtTokens(selItem.total_tokens)}</span>
      </span>
    </div>
  </div>

  <!-- ── 2열: 기능별 분석 + 센터별 TOP 5 ──────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">

    <div>
      <h2 class="mb-3 text-title-01-normal-semibold text-gray-900">기능별 비용 분석</h2>
      <div class="section-border overflow-hidden">
        <Table columns={featureCols} data={featureRows} keyField="id" />
      </div>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-title-01-normal-semibold text-gray-900">센터별 사용량 TOP 5</h2>
        <a href="/centers" class="text-label-01-normal-medium text-primary-600 hover:underline">전체 보기 →</a>
      </div>
      <div class="section-border overflow-hidden">
        <Table columns={centerCols} data={centerRows} keyField="id" />
      </div>
    </div>

  </div>
</div>
