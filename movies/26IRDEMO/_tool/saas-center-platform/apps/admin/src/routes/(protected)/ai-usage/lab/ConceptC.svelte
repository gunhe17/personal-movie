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

  // 경고 배너 조건
  const isHighCostAlert = $derived((MOCK_SUMMARY.cost_change_pct ?? 0) >= 30)
  const anomalyCenters  = $derived(
    MOCK_CENTERS.filter((c) => {
      const ext = centerExt(c.center_id)
      return ext?.is_anomaly ?? false
    }),
  )
  const hasAlert = $derived(isHighCostAlert || anomalyCenters.length > 0)

  // ─── 기능별 테이블 ───────────────────────────────────────────────────────
  const totalFeatureCost = $derived(MOCK_FEATURES.reduce((s, f) => s + f.monthly_cost, 0))

  interface FeatureRow {
    id: string; name: string; model: string; status: string
    calls: number; latency: number; share: number; cost: number
    errorCount: number; errorRatePct: number; marginPct: number
  }
  const featureRows = $derived<FeatureRow[]>(
    MOCK_FEATURES.map((f) => {
      const ext = featureExt(f.purpose)
      return {
        id: f.purpose, name: f.feature, model: f.model ?? '-', status: f.status,
        calls: f.call_count, latency: f.avg_latency_ms ?? 0,
        share: totalFeatureCost > 0 ? (f.monthly_cost / totalFeatureCost) * 100 : 0,
        cost: f.monthly_cost,
        errorCount: ext?.error_count ?? 0,
        errorRatePct: ext?.error_rate_pct ?? 0,
        marginPct: ext?.margin_pct ?? 0,
      }
    }),
  )

  const featureCols: TableColumn<FeatureRow>[] = [
    { key: 'name',         label: '기능',   width: '1fr',   render: fNameCell },
    { key: 'calls',        label: '호출',   width: '70px',  align: 'right', render: fCallCell },
    { key: 'errorRatePct', label: '실패율', width: '140px', align: 'right', render: fErrorCell },
    { key: 'latency',      label: '지연',   width: '70px',  align: 'right', render: fLatencyCell },
    { key: 'marginPct',    label: '마진',   width: '100px', align: 'right', render: fMarginCell },
    { key: 'cost',         label: '비용',   width: '90px',  align: 'right', render: fCostCell },
  ]

  // ─── 센터별 테이블 ────────────────────────────────────────────────────────
  const avgCPC = $derived.by(() => {
    const tc = MOCK_CENTERS.reduce((s, c) => s + c.call_count, 0)
    const cc = MOCK_CENTERS.reduce((s, c) => s + c.estimated_cost, 0)
    return tc > 0 ? cc / tc : 0
  })
  const maxCenterCost = $derived(Math.max(...MOCK_CENTERS.map((c) => c.estimated_cost)))

  interface CenterRow {
    id: string; rank: number; name: string
    calls: number; isHighCPC: boolean; bar: number; cost: number
    callSpikePct: number; isAnomaly: boolean
  }
  const centerRows = $derived<CenterRow[]>(
    MOCK_CENTERS.slice(0, 6).map((c, i) => {
      const cpc = c.call_count > 0 ? c.estimated_cost / c.call_count : 0
      const ext = centerExt(c.center_id)
      return {
        id: c.center_id, rank: i + 1, name: c.center_name,
        calls: c.call_count, isHighCPC: cpc > avgCPC * 1.5,
        bar: maxCenterCost > 0 ? (c.estimated_cost / maxCenterCost) * 100 : 0,
        cost: c.estimated_cost,
        callSpikePct: ext?.call_spike_pct ?? 0,
        isAnomaly: ext?.is_anomaly ?? false,
      }
    }),
  )

  const centerCols: TableColumn<CenterRow>[] = [
    { key: 'rank',  label: '#',    width: '36px',  align: 'center', render: cRankCell },
    { key: 'name',  label: '센터', width: '1fr',   render: cNameCell },
    { key: 'calls', label: '호출', width: '70px',  align: 'right',  render: cCallCell },
    { key: 'cost',  label: '비용', width: '90px',  align: 'right',  render: cCostCell },
  ]
</script>

<!-- ── 기능별 셀 렌더러 ──────────────────────────────────────────────────────── -->
{#snippet fNameCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = featureStatusConfig(item.status)}
  <div class="min-w-0">
    <div class="flex items-center gap-1.5">
      <span class="text-body-03-normal-medium text-gray-800">{item.name}</span>
      <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium">
        <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
        {cfg.label}
      </span>
    </div>
    <p class="mt-0.5">
      <span class="rounded bg-gray-100 px-1 py-0.5 font-mono text-label-02-normal-medium text-gray-500">{item.model}</span>
    </p>
  </div>
{/snippet}

{#snippet fCallCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-regular text-gray-600">{fmtNum(item.calls)}회</span>
{/snippet}

{#snippet fErrorCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = errorRateConfig(item.errorCount, item.errorRatePct)}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium tabular-nums">
    <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
    {fmtNum(item.errorCount)}건 ({item.errorRatePct.toFixed(1)}%)
  </span>
{/snippet}

{#snippet fLatencyCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-regular {item.latency > 3000 ? 'text-yellow-700' : 'text-gray-500'}">{(item.latency / 1000).toFixed(1)}s</span>
{/snippet}

{#snippet fMarginCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  {@const cfg = marginConfig(item.marginPct)}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {cfg.bg} {cfg.text} text-label-02-normal-medium tabular-nums">
    <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
    {item.marginPct >= 0 ? '+' : ''}{Math.round(item.marginPct)}%
  </span>
{/snippet}

{#snippet fCostCell({ item }: { item: FeatureRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.cost)}</span>
{/snippet}

<!-- ── 센터별 셀 렌더러 ──────────────────────────────────────────────────────── -->
{#snippet cRankCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-400">{item.rank}</span>
{/snippet}

{#snippet cNameCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  {@const spike = spikeConfig(item.callSpikePct)}
  <div class="min-w-0">
    <div class="flex items-center gap-1">
      <a
        href="/centers/{item.id}"
        class="truncate text-body-03-normal-medium text-gray-800 hover:text-primary-600"
        onclick={(e) => e.stopPropagation()}
      >{item.name}</a>
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

{#snippet cCostCell({ item }: { item: CenterRow; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(item.cost)}</span>
{/snippet}

<!-- ════════════════════════════════ C — 운영형 ═══════════════════════════════ -->
<div>
  <PageHeader title="AI 운영 현황" description="실시간 AI 비용 및 기능별 운영 상태를 모니터링합니다">
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

  <!-- ── 통합 경고 배너 ─────────────────────────────────────────────────────── -->
  {#if hasAlert}
    <div class="mb-5 flex flex-col gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3.5">
      {#if isHighCostAlert}
        <div class="flex items-start gap-2.5">
          <svg class="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
          <p class="text-body-03-normal-medium text-yellow-800">
            이번달 API 비용이 전월 대비
            <span class="tabular-nums text-body-03-normal-bold text-yellow-900"> +{Math.round(MOCK_SUMMARY.cost_change_pct ?? 0)}% 상승</span>했습니다.
            <span class="text-body-03-normal-regular text-yellow-700"> 기능별 설정을 점검하세요.</span>
          </p>
        </div>
      {/if}
      {#if anomalyCenters.length > 0}
        <div class="flex items-start gap-2.5">
          <svg class="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 002 0V7zm-1 7a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
          </svg>
          <p class="text-body-03-normal-medium text-red-700">
            이상 탐지:
            {#each anomalyCenters as center, i}
              {#if i > 0}<span class="text-red-400">, </span>{/if}
              <a href="/centers/{center.center_id}" class="text-body-03-normal-bold text-red-800 hover:underline" onclick={(e) => e.stopPropagation()}>{center.center_name}</a>
              {@const ext = centerExt(center.center_id)}
              <span class="tabular-nums text-body-03-normal-regular text-red-600"> (+{Math.round(ext?.call_spike_pct ?? 0)}%)</span>
            {/each}
            <span class="text-body-03-normal-regular text-red-600"> — 어뷰징 여부를 확인하세요.</span>
          </p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── KPI 인라인 스탯 ──────────────────────────────────────────────────── -->
  <div class="mb-6 flex flex-wrap gap-2">

    <div class="flex items-center gap-2 rounded-lg bg-white px-4 py-3 section-border">
      <span class="text-label-01-normal-regular text-gray-500">API 비용</span>
      <span class="tabular-nums text-body-01-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY.total_cost)}</span>
      {#if costChg}
        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {costChg.bg} {costChg.text} text-label-02-normal-medium tabular-nums">
          {costChg.label}
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-2 rounded-lg bg-white px-4 py-3 section-border">
      <span class="text-label-01-normal-regular text-gray-500">크레딧 매출</span>
      <span class="tabular-nums text-body-01-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY_EXT.total_revenue_krw)}</span>
    </div>

    <div class="flex items-center gap-2 rounded-lg bg-white px-4 py-3 section-border">
      <span class="text-label-01-normal-regular text-gray-500">마진</span>
      <span class="tabular-nums text-body-01-normal-bold text-gray-900">{fmtKRW(MOCK_SUMMARY_EXT.net_profit_krw)}</span>
      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 {marginCfg.bg} {marginCfg.text} text-label-02-normal-medium tabular-nums">
        <span class="h-1 w-1 rounded-full {marginCfg.dot}"></span>
        {MOCK_SUMMARY_EXT.margin_pct >= 0 ? '+' : ''}{MOCK_SUMMARY_EXT.margin_pct.toFixed(1)}%
      </span>
    </div>

    <div class="flex items-center gap-2 rounded-lg bg-white px-4 py-3 section-border">
      <span class="text-label-01-normal-regular text-gray-500">총 호출</span>
      <span class="tabular-nums text-body-01-normal-bold text-gray-900">{fmtNum(MOCK_SUMMARY.total_calls)}회</span>
    </div>

    <div class="flex items-center gap-2 rounded-lg bg-white px-4 py-3 section-border">
      <span class="text-label-01-normal-regular text-gray-500">에러</span>
      <span class="tabular-nums text-body-01-normal-bold text-gray-900">{fmtNum(MOCK_SUMMARY_EXT.total_error_count)}건</span>
      <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 {errorCfg.bg} {errorCfg.text} text-label-02-normal-medium tabular-nums">
        <span class="h-1 w-1 rounded-full {errorCfg.dot}"></span>
        {MOCK_SUMMARY_EXT.total_error_rate_pct.toFixed(1)}%
      </span>
    </div>

  </div>

  <!-- ── 차트 + 선택월 패널 ────────────────────────────────────────────────── -->
  <div class="mb-6 section-border bg-white">
    <div class="border-b border-gray-100 px-6 py-4">
      <h2 class="text-title-01-normal-semibold text-gray-900">월별 추이</h2>
    </div>
    <div class="grid grid-cols-1 divide-y divide-gray-100 lg:grid-cols-[1fr_200px] lg:divide-x lg:divide-y-0">
      <div class="px-6 py-5">
        <LabMonthlyChart
          data={MOCK_MONTHLY}
          {selectedMonth}
          height={148}
          onSelectMonth={(m) => (selectedMonth = m)}
        />
      </div>
      <div class="flex flex-col justify-center gap-3 px-5 py-5">
        <p class="tabular-nums text-body-03-normal-bold text-gray-700">{selItem.month.replace('-', '년 ')}월</p>
        <dl class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-label-01-normal-regular text-gray-400">비용</dt>
            <dd class="tabular-nums text-body-03-normal-bold text-gray-800">{fmtKRW(selItem.estimated_cost)}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-label-01-normal-regular text-gray-400">호출</dt>
            <dd class="tabular-nums text-body-03-normal-medium text-gray-700">{fmtNum(selItem.call_count)}회</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-label-01-normal-regular text-gray-400">건당</dt>
            <dd class="tabular-nums text-body-03-normal-medium text-gray-700">
              {selItem.call_count > 0 ? fmtKRW(Math.round(selItem.estimated_cost / selItem.call_count)) : '-'}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-label-01-normal-regular text-gray-400">토큰</dt>
            <dd class="tabular-nums text-body-03-normal-medium text-gray-700">{fmtTokens(selItem.total_tokens)}</dd>
          </div>
          {#if selItem.audio_minutes > 0}
            <div class="flex items-center justify-between gap-3">
              <dt class="text-label-01-normal-regular text-gray-400">STT</dt>
              <dd class="tabular-nums text-body-03-normal-medium text-gray-700">{fmtNum(selItem.audio_minutes)}분</dd>
            </div>
          {/if}
        </dl>
      </div>
    </div>
  </div>

  <!-- ── 2열: 기능별 + 센터별 ─────────────────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

    <div>
      <h2 class="mb-3 text-title-01-normal-semibold text-gray-900">기능별 상세</h2>
      <div class="section-border overflow-hidden">
        <Table columns={featureCols} data={featureRows} keyField="id" />
      </div>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-title-01-normal-semibold text-gray-900">센터별 순위</h2>
        <span class="text-label-01-normal-regular text-gray-400">
          평균 건당 <span class="tabular-nums text-label-01-normal-medium text-gray-600">{fmtKRW(avgCPC)}</span>
        </span>
      </div>
      <div class="section-border overflow-hidden">
        <Table columns={centerCols} data={centerRows} keyField="id" />
      </div>
    </div>

  </div>
</div>
