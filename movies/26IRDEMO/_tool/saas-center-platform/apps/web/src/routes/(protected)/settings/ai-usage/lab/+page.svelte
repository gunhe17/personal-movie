<script lang="ts">
  import { onMount } from 'svelte'

  type Status = 'normal' | 'warning' | 'danger'
  type Tab = 'overview' | 'credits' | 'calls'
  type PurposeTab = 'chart' | 'table'

  let activeLayout = $state<'A' | 'B' | 'C'>('A')
  let mockStatus = $state<Status>('warning')

  const mockBase = {
    planLabel: 'Pro',
    periodLabel: '2025.06.01 ~ 06.30',
    daysUntilReset: 12,
    insight: {
      dailyAvgCredits: 390,
      weeklyTrend: 'up' as const,
      weeklyTrendPercent: 15,
      estimatedDepletionDays: 8,
      dailyAvgCalls: 52,
      creditsPerCall: 7,
      callsWeeklyTrendPercent: 11,
      callsWeeklyTrend: 'up' as const
    },
    byPurpose: [
      { label: 'AI 상담일지', calls: 112, credits: 4368, percent: 56 },
      { label: '업무 도우미', calls: 68, credits: 2418, percent: 31 },
      { label: '검사 해석', calls: 29, credits: 1014, percent: 13 }
    ],
    memberUsage: [
      { name: '김민준', credits: 4368, percent: 56 },
      { name: '이서연', credits: 2418, percent: 31 },
      { name: '박지훈', credits: 1014, percent: 13 }
    ],
    capacity: [
      { label: 'AI 상담일지', count: '314회 가능' },
      { label: '업무 도우미', count: '440회 가능' },
      { label: '검사 해석', count: '733회 가능' }
    ],
    timeline: [
      {
        label: 'AI 상담일지',
        time: '오늘 14:32',
        credits: 45,
        member: '김민준'
      },
      {
        label: '업무 도우미',
        time: '오늘 13:15',
        credits: 28,
        member: '이서연'
      },
      {
        label: 'AI 상담일지',
        time: '오늘 11:08',
        credits: 38,
        member: '박지훈'
      },
      { label: '검사 해석', time: '어제 16:50', credits: 52, member: '김민준' }
    ],
    barHeights: [
      18, 32, 24, 48, 42, 58, 38, 66, 55, 74, 52, 82, 68, 88, 78, 84, 72, 78,
      82, 68, 88, 76, 86, 80, 92, 84, 90, 86, 95, 88
    ]
  }

  const statusConfig = {
    normal: {
      creditUsed: 2400,
      creditLimit: 10000,
      creditRemaining: 7600,
      usagePercent: 24,
      cardClass: 'border-gray-100 bg-white',
      barClass: 'bg-primary-500',
      inlineWarn: false
    },
    warning: {
      creditUsed: 7800,
      creditLimit: 10000,
      creditRemaining: 2200,
      usagePercent: 78,
      cardClass: 'border-amber-100 bg-amber-50/30',
      barClass: 'bg-amber-500',
      inlineWarn: true
    },
    danger: {
      creditUsed: 9400,
      creditLimit: 10000,
      creditRemaining: 600,
      usagePercent: 94,
      cardClass: 'border-red-100 bg-status-danger-bg/30',
      barClass: 'bg-red-500',
      inlineWarn: true
    }
  }

  const sc = $derived(statusConfig[mockStatus])

  // Layout A 상태
  let aPurposeTab = $state<PurposeTab>('chart')
  let aChartTab = $state<'credits' | 'calls'>('credits')
  let aShowMultiLine = $state(false)
  let aShowGuidance = $state(false)

  // Layout A: 추이 차트 인터랙션
  let aChartHover = $state<number | null>(null)
  let aChartAnimated = $state(false)

  const _bh = mockBase.barHeights
  const cDailyCredits = _bh.map((h) => Math.round(h * 3.77))
  const cDailyCalls = _bh.map((h) => Math.max(1, Math.round(h * 0.1)))
  const cCumCredits = (() => {
    let s = 0
    return cDailyCredits.map((v) => ((s += v), s))
  })()
  const cCumCalls = (() => {
    let s = 0
    return cDailyCalls.map((v) => ((s += v), s))
  })()
  const cLabels = Array.from(
    { length: 30 },
    (_, i) => `6.${String(i + 1).padStart(2, '0')}`
  )

  const CW = 640,
    CH = 200
  const cP = { t: 24, r: 52, b: 30, l: 54 }
  const cIW = CW - cP.l - cP.r
  const cIH = CH - cP.t - cP.b
  const cHitW = cIW / (_bh.length - 1) / 2

  function cxp(i: number): number {
    return cP.l + (i / (_bh.length - 1)) * cIW
  }
  function cyp(v: number, mx: number): number {
    return cP.t + cIH - (v / mx) * cIH
  }
  function fmtN(v: number): string {
    return v >= 1000
      ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : String(v)
  }

  const aChartDaily = $derived(
    aChartTab === 'credits' ? cDailyCredits : cDailyCalls
  )
  const aChartCum = $derived(aChartTab === 'credits' ? cCumCredits : cCumCalls)
  const aChartColors = $derived(
    aChartTab === 'credits'
      ? { line: '#6366f1', dot: '#a5b4fc' }
      : { line: '#8b5cf6', dot: '#c4b5fd' }
  )
  const aChartUnit = $derived(aChartTab === 'credits' ? '크레딧' : '회')
  const aMaxCum = $derived(Math.max(...aChartCum) * 1.15 || 1)
  const aGridVals = $derived(
    [0.25, 0.5, 0.75].map((r) => Math.round(aMaxCum * r))
  )
  const aCumPts = $derived(
    aChartCum.map((v, i) => [cxp(i), cyp(v, aMaxCum)] as [number, number])
  )
  const aCumLine = $derived(
    aCumPts
      .map(
        ([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      )
      .join(' ')
  )
  const aCumArea = $derived(
    aCumPts.length >= 2
      ? `${aCumLine} L${aCumPts[aCumPts.length - 1][0].toFixed(1)},${(cP.t + cIH).toFixed(1)} L${aCumPts[0][0].toFixed(1)},${(cP.t + cIH).toFixed(1)} Z`
      : ''
  )
  const aCumLen = $derived.by(() => {
    let len = 0
    for (let i = 1; i < aCumPts.length; i++) {
      const dx = aCumPts[i][0] - aCumPts[i - 1][0]
      const dy = aCumPts[i][1] - aCumPts[i - 1][1]
      len += Math.sqrt(dx * dx + dy * dy)
    }
    return Math.ceil(len * 1.1)
  })

  $effect(() => {
    void aChartTab
    aChartAnimated = false
    const t = setTimeout(() => {
      aChartAnimated = true
    }, 80)
    return () => clearTimeout(t)
  })

  // Layout A: 도넛 차트 인터랙션
  let aDonutHover = $state<number | null>(null)

  const DN_CX = 90,
    DN_CY = 90,
    DN_R = 66,
    DN_S = 22
  const DN_C = 2 * Math.PI * DN_R
  const DN_COLORS = ['#818cf8', '#a78bfa', '#ddd6fe']
  const DN_TOTAL = mockBase.byPurpose.reduce((s, p) => s + p.credits, 0)

  interface DonutSeg {
    offset: number
    dash: number
    color: string
    label: string
    percent: number
    credits: number
    calls: number
    hitPath: string
  }

  const aDonutSegs = $derived.by((): DonutSeg[] => {
    let off = 0
    return mockBase.byPurpose.map((p, idx) => {
      const dash = DN_TOTAL > 0 ? (p.credits / DN_TOTAL) * DN_C : 0
      const color = DN_COLORS[idx % DN_COLORS.length]
      const sa = (off / DN_C) * 2 * Math.PI - Math.PI / 2
      const ea = ((off + dash) / DN_C) * 2 * Math.PI - Math.PI / 2
      const oR = DN_R + DN_S / 2 + 5,
        iR = DN_R - DN_S / 2 - 5
      const large = dash / DN_C > 0.5 ? 1 : 0
      const pt = (r: number, a: number) =>
        [DN_CX + r * Math.cos(a), DN_CY + r * Math.sin(a)] as const
      const [ox1, oy1] = pt(oR, sa),
        [ox2, oy2] = pt(oR, ea)
      const [ix1, iy1] = pt(iR, ea),
        [ix2, iy2] = pt(iR, sa)
      const hitPath = `M${ox1.toFixed(1)},${oy1.toFixed(1)} A${oR},${oR} 0 ${large} 1 ${ox2.toFixed(1)},${oy2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${iR},${iR} 0 ${large} 0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z`
      const seg: DonutSeg = {
        offset: off,
        dash,
        color,
        label: p.label,
        percent: p.percent,
        credits: p.credits,
        calls: p.calls,
        hitPath
      }
      off += dash
      return seg
    })
  })
  const aDonutCenter = $derived(
    aDonutHover !== null ? aDonutSegs[aDonutHover] : aDonutSegs[0]
  )

  // Layout B 상태
  let bTab = $state<Tab>('overview')
  let bPurposeTab = $state<PurposeTab>('chart')
  let bShowMultiLine = $state(false)
  let bShowGuidance = $state(false)

  // Layout C 상태
  let cTab = $state<Tab>('overview')
  let cPurposeTab = $state<PurposeTab>('chart')
  let cShowMultiLine = $state(false)
  let cShowGuidance = $state(false)

  const TABS = [
    { key: 'overview' as const, label: '개요' },
    { key: 'credits' as const, label: '크레딧 추이' },
    { key: 'calls' as const, label: '사용 횟수' }
  ]

  const creditsTrendKpi = $derived([
    {
      label: '일평균',
      value: String(mockBase.insight.dailyAvgCredits),
      unit: '크레딧'
    },
    {
      label: '주간 추세',
      value: `${mockBase.insight.weeklyTrendPercent}%`,
      note: '↑',
      noteColor: 'text-status-danger'
    },
    {
      label: '1회당 비용',
      value: String(mockBase.insight.creditsPerCall),
      unit: '크레딧'
    },
    {
      label: '예상 소진',
      value: `${mockBase.insight.estimatedDepletionDays}일 후`,
      noteColor: 'text-amber-600'
    }
  ])

  const callsTrendKpi = $derived([
    { label: '총 횟수', value: '209', unit: '회' },
    {
      label: '일평균',
      value: String(mockBase.insight.dailyAvgCalls),
      unit: '회'
    },
    {
      label: '호출당 비용',
      value: String(mockBase.insight.creditsPerCall),
      unit: '크레딧'
    },
    {
      label: '호출 추세',
      value: `${mockBase.insight.callsWeeklyTrendPercent}%`,
      note: '↑',
      noteColor: 'text-status-danger'
    }
  ])
</script>

<!-- ────────────────────────────────────────────────────────────────── -->
<!-- LAB 헤더 -->
<!-- ────────────────────────────────────────────────────────────────── -->
<div class="flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <div>
      <h1 class="text-headline-01-normal-semibold text-gray-900">
        AI 사용량 — LAB
      </h1>
      <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
        {#if activeLayout === 'A'}A: 탭 없는 수직 플로우 대시보드 — 진입 즉시
          모든 지표 노출
        {:else if activeLayout === 'B'}B: 히어로 카드 3열 스트립 + 압축 탭 —
          상태 인식 최우선
        {:else}C: Sticky 크레딧 카드 + 탭 — 반복 조회 최적화{/if}
      </p>
    </div>

    <div class="flex items-center gap-3">
      <!-- 상태 스위처 -->
      <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
        {#each ['normal', 'warning', 'danger'] as const as s}
          <button
            class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
              {mockStatus === s
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}"
            onclick={() => (mockStatus = s)}
          >
            {s === 'normal' ? '정상' : s === 'warning' ? '경고' : '위험'}
          </button>
        {/each}
      </div>

      <!-- 레이아웃 스위처 -->
      <div class="flex gap-1 rounded-lg bg-gray-900 p-1">
        {#each ['A', 'B', 'C'] as layout}
          <button
            class="rounded-lg px-5 py-2 text-body-02-normal-medium transition-colors
              {activeLayout === layout
              ? 'bg-white text-gray-900'
              : 'text-gray-400 hover:text-white'}"
            onclick={() => (activeLayout = layout as 'A' | 'B' | 'C')}
          >
            {layout}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════ -->
  <!-- LAYOUT A: 수직 플로우 대시보드 (탭 없음)                         -->
  <!-- ══════════════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'A'}
    <div class="space-y-4">
      <!-- AI 크레딧 카드 — 항상 흰색 (프로덕션과 동일) -->
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-title-01-normal-semibold text-gray-900">
              AI 크레딧
            </h2>
            <span
              class="rounded-full bg-primary-50 px-2 py-0.5 text-body-03-normal-medium text-primary-600"
              >{mockBase.planLabel}</span
            >
          </div>
          <a
            href="/settings/subscription"
            class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
            >구독 관리 →</a
          >
        </div>

        <div class="flex items-end justify-between mb-1">
          <div>
            <span
              class="text-headline-00-normal-bold tabular-nums text-gray-900"
              >{sc.creditUsed.toLocaleString()}</span
            >
            <span class="text-body-02-normal-regular text-gray-400 ml-1"
              >/ {sc.creditLimit.toLocaleString()} 사용</span
            >
          </div>
          <span class="text-body-03-normal-regular text-gray-400"
            >{sc.creditRemaining.toLocaleString()} 남음</span
          >
        </div>

        <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500 {sc.barClass}"
            style="width: {sc.usagePercent}%"
          ></div>
        </div>

        <div
          class="mt-4 flex items-center justify-between text-body-03-normal-regular text-gray-500"
        >
          <span>{mockBase.periodLabel}</span>
          <span
            ><strong class="text-gray-700">{mockBase.daysUntilReset}일</strong> 후
            리셋</span
          >
        </div>
      </div>

      <!-- 경고 배너 — 프로덕션과 동일하게 카드 밖 독립 배치 -->
      {#if mockStatus === 'warning'}
        <div
          class="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-center gap-2.5"
        >
          <svg
            class="h-4 w-4 text-amber-400 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p class="text-body-02-normal-medium text-amber-700">
            크레딧이 얼마 남지 않았습니다.
            <span class="tabular-nums"
              >남은 {sc.creditRemaining.toLocaleString()} 크레딧 ({100 -
                sc.usagePercent}%)</span
            >
            <span class="text-body-03-normal-regular text-amber-600 ml-1"
              >· 약 {mockBase.insight.estimatedDepletionDays}일 후 소진 예상</span
            >
          </p>
        </div>
      {:else if mockStatus === 'danger'}
        <div
          class="rounded-lg bg-status-danger-bg border border-red-100 px-4 py-3 flex items-center gap-2.5"
        >
          <svg
            class="h-4 w-4 text-red-400 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p class="text-body-02-normal-medium text-red-600">
              크레딧이 거의 소진되었습니다.
              <span class="tabular-nums"
                >남은 {sc.creditRemaining.toLocaleString()} 크레딧 ({100 -
                  sc.usagePercent}%)</span
              >
              <span class="text-body-03-normal-regular text-status-danger ml-1"
                >· 약 {mockBase.insight.estimatedDepletionDays}일 후 소진 예상</span
              >
            </p>
            <a
              href="/settings/subscription"
              class="text-body-03-normal-regular text-status-danger hover:text-red-600 underline"
              >플랜 업그레이드로 크레딧 늘리기</a
            >
          </div>
        </div>
      {/if}

      <!-- TrendKpiBar — 프로덕션 TrendKpiBar.svelte와 동일 패턴 -->
      <div class="rounded-lg border border-gray-200 bg-white">
        <div class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
          {#each [{ label: '총 사용량', value: sc.creditUsed.toLocaleString(), unit: '크레딧' }, { label: '남은 크레딧', value: sc.creditRemaining.toLocaleString(), unit: '크레딧' }, { label: '일평균', value: String(mockBase.insight.dailyAvgCredits), unit: '크레딧' }, { label: '주간 추세', value: `↑ ${mockBase.insight.weeklyTrendPercent}%`, color: 'text-status-danger' }] as item}
            <div class="px-6 py-5">
              <p class="text-body-03-normal-regular text-gray-400 mb-1">
                {item.label}
              </p>
              <div class="flex items-baseline gap-1 flex-wrap">
                <span
                  class="text-title-01-normal-semibold tabular-nums {item.color ??
                    'text-gray-900'}">{item.value}</span
                >
                {#if item.unit}<span
                    class="text-body-03-normal-regular text-gray-400"
                    >{item.unit}</span
                  >{/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- 사용 분석 + 잔여 가능 작업 — UsageInsightCard/UsageSummaryCard 패턴 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 사용 인사이트: UsageInsightCard 패턴 -->
        <div class="rounded-lg border border-gray-200 bg-white">
          <div class="px-6 pt-6 pb-2">
            <h2 class="text-title-01-normal-semibold text-gray-900">
              사용 인사이트
            </h2>
          </div>
          <div class="px-3 pb-3">
            <!-- 일평균 사용량 -->
            <div class="flex items-center justify-between rounded-lg px-3 py-4">
              <div class="flex items-center gap-3.5">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50"
                >
                  <svg
                    class="h-5 w-5 text-violet-500"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-body-02-normal-medium text-gray-800">
                    일평균 사용량
                  </p>
                  <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                    하루 평균 크레딧 소비
                  </p>
                </div>
              </div>
              <p class="pl-4 shrink-0">
                <span
                  class="text-body-01-normal-semibold tabular-nums text-gray-900"
                  >{mockBase.insight.dailyAvgCredits}</span
                >
                <span class="text-body-03-normal-regular text-gray-400"
                  >크레딧</span
                >
              </p>
            </div>
            <div class="mx-3 border-b border-gray-100"></div>

            <!-- 하루 권장량 -->
            <div class="flex items-center justify-between rounded-lg px-3 py-4">
              <div class="flex items-center gap-3.5">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50"
                >
                  <svg
                    class="h-5 w-5 text-sky-500"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-body-02-normal-medium text-gray-800">
                    하루 권장량
                  </p>
                  <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                    {sc.creditRemaining.toLocaleString()} 잔여 ÷ {mockBase.daysUntilReset}일
                  </p>
                </div>
              </div>
              <p class="pl-4 shrink-0">
                <span
                  class="text-body-01-normal-semibold tabular-nums text-gray-900"
                  >{Math.round(
                    sc.creditRemaining / mockBase.daysUntilReset
                  ).toLocaleString()}</span
                >
                <span class="text-body-03-normal-regular text-gray-400"
                  >크레딧/일</span
                >
              </p>
            </div>
            <div class="mx-3 border-b border-gray-100"></div>

            <!-- 예상 소진 -->
            <div class="flex items-center justify-between rounded-lg px-3 py-4">
              <div class="flex items-center gap-3.5">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {mockStatus ===
                  'normal'
                    ? 'bg-green-50'
                    : mockStatus === 'warning'
                      ? 'bg-amber-50'
                      : 'bg-status-danger-bg'}"
                >
                  <svg
                    class="h-5 w-5 {mockStatus === 'normal'
                      ? 'text-green-500'
                      : mockStatus === 'warning'
                        ? 'text-amber-500'
                        : 'text-status-danger'}"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-body-02-normal-medium text-gray-800">
                    예상 소진
                  </p>
                  <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                    현재 속도 기준 소진 시점
                  </p>
                </div>
              </div>
              <span
                class="text-body-01-normal-semibold tabular-nums pl-4 shrink-0 {mockStatus ===
                'normal'
                  ? 'text-green-600'
                  : mockStatus === 'warning'
                    ? 'text-amber-600'
                    : 'text-red-600'}"
              >
                {mockBase.insight.estimatedDepletionDays}일 후
              </span>
            </div>
          </div>
        </div>

        <!-- 잔여 가능 작업 — UsageSummaryCard 패턴 -->
        <div class="rounded-lg border border-gray-200 bg-white">
          <div class="px-6 pt-6 pb-2">
            <h2 class="text-title-01-normal-semibold text-gray-900">
              남은 크레딧으로 가능한 작업
            </h2>
          </div>
          <div class="px-3 pb-3">
            {#each mockBase.capacity as c, i}
              {@const icons = [
                {
                  bg: 'bg-violet-50',
                  color: 'text-violet-500',
                  path: 'M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z'
                },
                {
                  bg: 'bg-sky-50',
                  color: 'text-sky-500',
                  path: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5'
                },
                {
                  bg: 'bg-emerald-50',
                  color: 'text-emerald-500',
                  path: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
                }
              ]}
              {#if i > 0}
                <div class="mx-3 border-b border-gray-100"></div>
              {/if}
              <div
                class="flex items-center justify-between rounded-lg px-3 py-4"
              >
                <div class="flex items-center gap-3.5">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {icons[
                      i % 3
                    ].bg}"
                  >
                    <svg
                      class="h-5 w-5 {icons[i % 3].color}"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d={icons[i % 3].path}
                      />
                    </svg>
                  </div>
                  <div>
                    <p class="text-body-02-normal-medium text-gray-800">
                      {c.label}
                    </p>
                    <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                      현재 평균 비용 기준
                    </p>
                  </div>
                </div>
                <p
                  class="pl-4 shrink-0 text-body-01-normal-semibold tabular-nums text-gray-900"
                >
                  {c.count}
                </p>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- 추이 차트 + 기능별 사용 2열 -->
      <div class="grid grid-cols-2 gap-3">
        <!-- 추이 차트 (탭: 크레딧 / 호출 횟수) -->
        <div
          class="rounded-lg border border-gray-200 bg-white px-6 py-6 flex flex-col"
        >
          <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h3 class="text-title-01-normal-semibold text-gray-900">
                {aChartTab === 'credits'
                  ? '크레딧 누적 사용량'
                  : 'API 호출 횟수'}
              </h3>
              <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                {aChartTab === 'credits'
                  ? '일별 크레딧 소비량 (30일)'
                  : '일별 API 호출 횟수 (30일)'}
              </p>
            </div>
            <div class="flex gap-1 rounded-lg bg-gray-100 p-1 shrink-0">
              {#each [['credits', '크레딧'], ['calls', '호출 횟수']] as const as [key, label]}
                <button
                  class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
                  {aChartTab === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'}"
                  onclick={() => (aChartTab = key)}>{label}</button
                >
              {/each}
            </div>
          </div>

          <!-- SVG 추이 차트 -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="relative w-full mt-1"
            onmouseleave={() => (aChartHover = null)}
          >
            <svg viewBox="0 0 {CW} {CH}" class="w-full h-auto overflow-visible">
              <defs>
                <linearGradient
                  id="areaGrad-{aChartTab}"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stop-color={aChartColors.line}
                    stop-opacity="0.08"
                  />
                  <stop
                    offset="100%"
                    stop-color={aChartColors.line}
                    stop-opacity="0.01"
                  />
                </linearGradient>
              </defs>

              <!-- Grid lines + Y labels -->
              {#each aGridVals as gv}
                {@const gy = cyp(gv, aMaxCum)}
                <line
                  x1={cP.l}
                  y1={gy}
                  x2={CW - cP.r}
                  y2={gy}
                  stroke="#f3f4f6"
                  stroke-width="1"
                />
                <text
                  x={cP.l - 6}
                  y={gy + 4}
                  text-anchor="end"
                  fill="#9ca3af"
                  font-size="11">{fmtN(gv)}</text
                >
              {/each}
              <line
                x1={cP.l}
                y1={cP.t + cIH}
                x2={CW - cP.r}
                y2={cP.t + cIH}
                stroke="#f3f4f6"
                stroke-width="1"
              />

              <!-- Area fill -->
              <path d={aCumArea} fill="url(#areaGrad-{aChartTab})" />

              <!-- Cumulative line (draw animation) -->
              <path
                d={aCumLine}
                fill="none"
                stroke={aChartColors.line}
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="stroke-dasharray:{aCumLen};stroke-dashoffset:{aChartAnimated
                  ? 0
                  : aCumLen};transition:stroke-dashoffset 1s cubic-bezier(0.33,1,0.68,1)"
              />

              <!-- Data points: solid color + white stroke (production 동일) -->
              {#each aCumPts as [px, py], i}
                <circle
                  cx={px}
                  cy={py}
                  r={aChartHover === i ? 4.5 : 2.5}
                  fill={aChartColors.line}
                  stroke="white"
                  stroke-width="1.5"
                  style="opacity:{aChartAnimated
                    ? 1
                    : 0};transition:opacity 0.3s ease {aChartAnimated
                    ? '0.8s'
                    : '0s'},r 0.1s ease"
                />
              {/each}

              <!-- Hover crosshair (solid line) -->
              {#if aChartHover !== null}
                {@const hx = aCumPts[aChartHover][0]}
                <line
                  x1={hx}
                  y1={cP.t}
                  x2={hx}
                  y2={cP.t + cIH}
                  stroke="#d1d5db"
                  stroke-width="1"
                />
              {/if}

              <!-- Invisible hover strips -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              {#each aCumPts as [px], i}
                <rect
                  x={px - cHitW}
                  y={cP.t}
                  width={cHitW * 2}
                  height={cIH}
                  fill="transparent"
                  onmouseenter={() => (aChartHover = i)}
                />
              {/each}

              <!-- X-axis labels -->
              <text
                x={cP.l}
                y={CH - 4}
                text-anchor="start"
                fill="#9ca3af"
                font-size="11">6.01</text
              >
              <text
                x={cxp(14)}
                y={CH - 4}
                text-anchor="middle"
                fill="#9ca3af"
                font-size="11">6.15</text
              >
              <text
                x={CW - cP.r}
                y={CH - 4}
                text-anchor="end"
                fill="#9ca3af"
                font-size="11">오늘</text
              >
            </svg>

            <!-- 툴팁: CSS absolute div (SVG 외부 — CSS px 기준으로 정확한 크기) -->
            {#if aChartHover !== null}
              {@const hIdx = aChartHover}
              {@const tipX = (aCumPts[hIdx][0] / CW) * 100}
              <div
                class="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
                style="left:{tipX}%"
              >
                <div
                  class="rounded-lg bg-gray-800 px-2.5 py-1.5 text-white shadow-lg whitespace-nowrap"
                >
                  <p class="text-label-02-normal-regular text-gray-400">
                    {cLabels[hIdx]}
                  </p>
                  <p class="text-label-02-normal-medium tabular-nums">
                    {fmtN(aChartCum[hIdx])}
                    {aChartUnit} (누적)
                  </p>
                  <p
                    class="text-label-02-normal-regular tabular-nums text-gray-300"
                  >
                    +{fmtN(aChartDaily[hIdx])}
                    {aChartUnit} (당일)
                  </p>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- 기능별 사용 — 도넛 + 테이블 나란히 -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="rounded-lg border border-gray-200 bg-white px-6 py-6 flex flex-col"
        >
          <h3 class="text-title-01-normal-semibold text-gray-900 mb-4 shrink-0">
            기능별 사용
          </h3>
          <div class="flex items-stretch gap-0 flex-1">
            <!-- 도넛 (좌) -->
            <div
              class="relative shrink-0 flex flex-col items-center justify-center pr-5"
              style="width:160px"
              onmouseleave={() => (aDonutHover = null)}
            >
              <div class="relative" style="width:140px;height:140px">
                <svg viewBox="0 0 180 180" class="h-full w-full">
                  <circle
                    cx={DN_CX}
                    cy={DN_CY}
                    r={DN_R}
                    fill="none"
                    stroke="#f3f4f6"
                    stroke-width={DN_S}
                  />
                  {#each aDonutSegs as seg, i}
                    <circle
                      cx={DN_CX}
                      cy={DN_CY}
                      r={DN_R}
                      fill="none"
                      stroke={seg.color}
                      stroke-width={aDonutHover === i ? DN_S + 5 : DN_S}
                      stroke-dasharray="{seg.dash} {DN_C}"
                      stroke-dashoffset={-seg.offset}
                      transform="rotate(-90 {DN_CX} {DN_CY})"
                      style="opacity:{aDonutHover !== null && aDonutHover !== i
                        ? 0.3
                        : 1};transition:stroke-width 0.15s ease,opacity 0.15s ease"
                    />
                  {/each}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  {#each aDonutSegs as seg, i}
                    <path
                      d={seg.hitPath}
                      fill="transparent"
                      style="cursor:pointer"
                      onmouseenter={() => (aDonutHover = i)}
                    />
                  {/each}
                </svg>
                <div
                  class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <span
                    class="text-label-01-normal-medium text-gray-700 max-w-[72px] truncate-safe text-center leading-none"
                  >
                    {aDonutCenter?.label ?? ''}
                  </span>
                  <span
                    class="text-title-01-normal-semibold tabular-nums text-gray-900 leading-none mt-0.5"
                  >
                    {aDonutCenter?.percent ?? 0}%
                  </span>
                </div>
              </div>
            </div>

            <!-- 구분선 -->
            <div class="w-px bg-gray-100 shrink-0 self-stretch"></div>

            <!-- 테이블 (우) -->
            <div class="flex-1 pl-5">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th
                      class="text-left text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                      >기능</th
                    >
                    <th
                      class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                      >크레딧</th
                    >
                    <th
                      class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                      >횟수</th
                    >
                    <th
                      class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                      >비율</th
                    >
                  </tr>
                </thead>
                <tbody>
                  {#each mockBase.byPurpose as p, i}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <tr
                      class="border-b border-gray-50 last:border-0 transition-opacity"
                      style="opacity:{aDonutHover !== null && aDonutHover !== i
                        ? 0.35
                        : 1}"
                      onmouseenter={() => (aDonutHover = i)}
                      onmouseleave={() => (aDonutHover = null)}
                    >
                      <td class="py-3">
                        <div class="flex items-center gap-2">
                          <span
                            class="inline-block h-2 w-2 rounded-full shrink-0"
                            style="background:{aDonutSegs[i]?.color}"
                          ></span>
                          <span class="text-body-02-normal-medium text-gray-700"
                            >{p.label}</span
                          >
                        </div>
                      </td>
                      <td
                        class="py-3 text-right text-body-02-normal-medium tabular-nums text-gray-900"
                        >{p.credits.toLocaleString()}</td
                      >
                      <td
                        class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                        >{p.calls}회</td
                      >
                      <td
                        class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                        >{p.percent}%</td
                      >
                    </tr>
                  {/each}
                </tbody>
                <tfoot>
                  <tr class="border-t border-gray-100">
                    <td class="pt-3 text-body-02-normal-medium text-gray-500"
                      >합계</td
                    >
                    <td
                      class="pt-3 text-right text-body-02-normal-semibold tabular-nums text-gray-900"
                      >{mockBase.byPurpose
                        .reduce((s, p) => s + p.credits, 0)
                        .toLocaleString()}</td
                    >
                    <td
                      class="pt-3 text-right text-body-02-normal-medium tabular-nums text-gray-500"
                      >{mockBase.byPurpose.reduce(
                        (s, p) => s + p.calls,
                        0
                      )}회</td
                    >
                    <td
                      class="pt-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                      >100%</td
                    >
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
      <!-- /grid -->

      <!-- 상담사별 사용 현황 + 사용 기록 2열 -->
      <div class="grid grid-cols-2 gap-3">
        <!-- 상담사별 사용 현황 -->
        <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-title-01-normal-semibold text-gray-900">
              상담사별 사용 현황
            </h3>
            <span class="text-body-03-normal-regular text-gray-400"
              >이번 달 기준</span
            >
          </div>
          <div class="space-y-3">
            {#each mockBase.memberUsage as m, i}
              {@const avatarColors = [
                {
                  bg: 'bg-indigo-100',
                  text: 'text-indigo-600',
                  bar: '#818cf8'
                },
                {
                  bg: 'bg-violet-100',
                  text: 'text-violet-600',
                  bar: '#a78bfa'
                },
                { bg: 'bg-purple-100', text: 'text-purple-600', bar: '#c4b5fd' }
              ]}
              {@const ac = avatarColors[i % avatarColors.length]}
              <div class="flex items-center gap-3">
                <!-- 순위 + 아바타 -->
                <div class="relative shrink-0">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full {ac.bg}"
                  >
                    <span class="text-body-02-normal-semibold {ac.text}"
                      >{m.name.charAt(0)}</span
                    >
                  </div>
                </div>
                <!-- 이름 + 바 -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between mb-1.5">
                    <span class="text-body-02-normal-medium text-gray-800"
                      >{m.name}</span
                    >
                    <span
                      class="text-body-02-normal-medium tabular-nums text-gray-900 shrink-0 ml-2"
                      >{m.credits.toLocaleString()} 크레딧</span
                    >
                  </div>
                  <div
                    class="relative h-1.5 rounded-full bg-gray-100 overflow-hidden"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      style="width:{m.percent}%;background:{ac.bar}"
                    ></div>
                  </div>
                </div>
                <!-- 퍼센트 -->
                <span
                  class="shrink-0 w-10 text-right text-body-03-normal-regular tabular-nums text-gray-400"
                  >{m.percent}%</span
                >
              </div>
            {/each}
          </div>
        </div>

        <!-- 사용 기록 -->
        <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-title-01-normal-semibold text-gray-900">
              사용 기록
            </h2>
            <span class="text-body-03-normal-regular text-gray-400"
              >총 {mockBase.timeline.length}건</span
            >
          </div>
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th
                  class="text-left text-body-02-normal-medium text-gray-600 pb-2.5 font-normal"
                  >기능</th
                >
                <th
                  class="text-left text-body-02-normal-medium text-gray-600 pb-2.5 font-normal"
                  >상담사</th
                >
                <th
                  class="text-left text-body-02-normal-medium text-gray-600 pb-2.5 font-normal"
                  >일시</th
                >
                <th
                  class="text-right text-body-02-normal-medium text-gray-600 pb-2.5 font-normal"
                  >크레딧</th
                >
              </tr>
            </thead>
            <tbody>
              {#each mockBase.timeline as t, i}
                {@const dotColors = [
                  '#818cf8',
                  '#a78bfa',
                  '#818cf8',
                  '#c4b5fd'
                ]}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="py-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-2 w-2 rounded-full shrink-0"
                        style="background:{dotColors[i % 4]}"
                      ></span>
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{t.label}</span
                      >
                    </div>
                  </td>
                  <td class="py-2">
                    <span class="text-body-02-normal-regular text-gray-400 ml-0"
                      >{t.member}</span
                    >
                  </td>
                  <td class="py-2">
                    <span class="text-body-02-normal-regular text-gray-500"
                      >{t.time}</span
                    >
                  </td>
                  <td class="py-2 text-right">
                    <span
                      class="text-body-02-normal-medium tabular-nums text-gray-900"
                      >{t.credits}</span
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <!-- /grid -->

      <!-- 안내 (프로덕션: 항상 노출, bg-gray-50 box) -->
      <div class="rounded-lg bg-gray-50 px-5 py-4">
        <p class="text-body-02-normal-medium text-gray-500 mb-2">안내</p>
        <ul class="space-y-1.5">
          {#each ['크레딧은 AI 기능 사용 시 자동으로 누적됩니다.', '크레딧은 기간 종료 시 초기화되며, 이월되지 않습니다.', '크레딧이 부족하면 AI 기능 사용이 제한됩니다.'] as note}
            <li class="flex items-start gap-1.5">
              <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
              ></span>
              <p class="text-body-02-normal-regular text-gray-500">{note}</p>
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT B: 히어로 카드 3열 스트립 + 압축 탭                       -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
  {:else if activeLayout === 'B'}
    <div class="space-y-4">
      <!-- 페이지 헤더 -->
      <div class="flex items-center justify-between">
        <h2 class="text-title-01-normal-semibold text-gray-900">AI 사용량</h2>
        <a
          href="/settings/subscription"
          class="inline-flex items-center gap-1 text-body-03-normal-medium text-primary-500 hover:text-primary-600"
        >
          구독 관리 <span>→</span>
        </a>
      </div>

      <!-- 히어로 카드 (3열 스트립) -->
      <div class="rounded-lg border {sc.cardClass} px-6 py-6">
        <div class="flex items-center justify-between mb-5">
          <span
            class="rounded-full bg-primary-50 px-2.5 py-0.5 text-body-03-normal-medium text-primary-600"
            >{mockBase.planLabel}</span
          >
          <span
            class="rounded-full bg-gray-100 px-2.5 py-0.5 text-body-03-normal-medium text-gray-500"
            >D-{mockBase.daysUntilReset}</span
          >
        </div>

        <div
          class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:divide-x lg:divide-gray-100"
        >
          <!-- 좌: 잔량 + 게이지 -->
          <div class="flex flex-col justify-center">
            <p class="text-body-03-normal-regular text-gray-400 mb-1">
              남은 크레딧
            </p>
            <div class="flex items-baseline gap-1.5 mb-3">
              <span
                class="text-headline-01-normal-bold tabular-nums leading-none text-gray-900"
                >{sc.creditRemaining.toLocaleString()}</span
              >
              <span class="text-body-02-normal-regular text-gray-400"
                >/ {sc.creditLimit.toLocaleString()}</span
              >
            </div>
            <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 {sc.barClass}"
                style="width:{sc.usagePercent}%"
              ></div>
            </div>
            <p class="mt-1.5 text-body-03-normal-regular text-gray-400">
              {sc.usagePercent}% 사용 · {mockBase.periodLabel}
            </p>
          </div>

          <!-- 중: PaceGuide 핵심 -->
          <div class="flex flex-col justify-center lg:pl-6 space-y-2.5">
            <p class="text-body-03-normal-regular text-gray-400 mb-0.5">
              사용 속도
            </p>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >하루 권장량</span
              >
              <span
                class="text-body-02-normal-medium tabular-nums text-gray-900"
                >{Math.round(
                  sc.creditRemaining / mockBase.daysUntilReset
                ).toLocaleString()}/일</span
              >
            </div>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >현재 속도</span
              >
              <div class="flex items-center gap-1.5">
                <span
                  class="text-body-02-normal-medium tabular-nums text-gray-900"
                  >{mockBase.insight.dailyAvgCredits}/일</span
                >
                <span
                  class="rounded-full {mockStatus === 'normal'
                    ? 'bg-green-50 text-green-600'
                    : mockStatus === 'warning'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-status-danger-bg text-red-600'} px-1.5 py-0.5 text-body-03-normal-medium"
                >
                  {mockStatus === 'normal'
                    ? '적정'
                    : mockStatus === 'warning'
                      ? '과속'
                      : '매우 과속'}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >예상 소진</span
              >
              <span
                class="text-body-02-normal-medium tabular-nums {mockStatus ===
                'danger'
                  ? 'text-red-600'
                  : mockStatus === 'warning'
                    ? 'text-amber-600'
                    : 'text-gray-900'}"
                >{mockBase.insight.estimatedDepletionDays}일 후</span
              >
            </div>
          </div>

          <!-- 우: 추세 KPI -->
          <div class="flex flex-col justify-center lg:pl-6 space-y-2.5">
            <p class="text-body-03-normal-regular text-gray-400 mb-0.5">
              추세 지표
            </p>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >일평균 크레딧</span
              >
              <span
                class="text-body-02-normal-medium tabular-nums text-gray-900"
                >{mockBase.insight.dailyAvgCredits} 크레딧</span
              >
            </div>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >주간 추세</span
              >
              <span
                class="text-body-02-normal-medium tabular-nums text-status-danger"
                >↑ {mockBase.insight.weeklyTrendPercent}%</span
              >
            </div>
            <div class="flex items-center justify-between">
              <span class="text-body-02-normal-regular text-gray-500"
                >1회당 비용</span
              >
              <span
                class="text-body-02-normal-medium tabular-nums text-gray-900"
                >{mockBase.insight.creditsPerCall} 크레딧</span
              >
            </div>
          </div>
        </div>

        {#if sc.inlineWarn}
          <div
            class="mt-5 border-t {mockStatus === 'danger'
              ? 'border-red-100'
              : 'border-amber-100'} pt-3 flex items-center gap-2"
          >
            <svg
              class="h-4 w-4 shrink-0 {mockStatus === 'danger'
                ? 'text-red-400'
                : 'text-amber-400'}"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p
              class="text-body-03-normal-medium {mockStatus === 'danger'
                ? 'text-red-600'
                : 'text-amber-700'}"
            >
              크레딧 {sc.usagePercent}% 소진 · 약 {mockBase.insight
                .estimatedDepletionDays}일 후 소진 예상
            </p>
            <a
              href="/settings/subscription"
              class="ml-auto text-body-03-normal-medium {mockStatus === 'danger'
                ? 'text-status-danger hover:text-red-600'
                : 'text-amber-600 hover:text-amber-700'} underline"
              >플랜 업그레이드</a
            >
          </div>
        {/if}
      </div>

      <!-- 탭 -->
      <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
        {#each TABS as tab}
          <button
            class="flex-1 rounded-lg px-4 py-2 text-body-02-normal-medium transition-colors
              {bTab === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}"
            onclick={() => (bTab = tab.key)}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- 탭 콘텐츠 -->
      {#if bTab === 'overview'}
        <div class="space-y-4">
          <!-- 기능별 서브탭 카드 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-title-01-normal-semibold text-gray-900">
                기능별 사용
              </h3>
              <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
                {#each ['chart', 'table'] as const as t}
                  <button
                    class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
                      {bPurposeTab === t
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}"
                    onclick={() => (bPurposeTab = t)}
                  >
                    {t === 'chart' ? '비율 차트' : '상세 수치'}
                  </button>
                {/each}
              </div>
            </div>
            {#if bPurposeTab === 'chart'}
              <div class="flex items-center gap-8">
                <svg viewBox="0 0 120 120" class="h-32 w-32 shrink-0">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#f3f4f6"
                    stroke-width="14"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#818cf8"
                    stroke-width="14"
                    stroke-dasharray="162 289"
                    stroke-dashoffset="0"
                    transform="rotate(-90 60 60)"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#a78bfa"
                    stroke-width="14"
                    stroke-dasharray="90 289"
                    stroke-dashoffset="-162"
                    transform="rotate(-90 60 60)"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#ddd6fe"
                    stroke-width="14"
                    stroke-dasharray="38 289"
                    stroke-dashoffset="-252"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div class="flex-1 space-y-2">
                  {#each mockBase.byPurpose as p, i}
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span
                          class="h-2.5 w-2.5 rounded-full {[
                            'bg-indigo-400',
                            'bg-violet-400',
                            'bg-purple-200'
                          ][i]}"
                        ></span>
                        <span class="text-body-02-normal-regular text-gray-700"
                          >{p.label}</span
                        >
                      </div>
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-500"
                        >{p.percent}%</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="overflow-hidden rounded-lg border border-gray-200">
                <table class="w-full text-left">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        class="px-4 py-2.5 text-body-03-normal-medium text-gray-500"
                        >기능</th
                      >
                      <th
                        class="px-4 py-2.5 text-right text-body-03-normal-medium text-gray-500"
                        >크레딧</th
                      >
                      <th
                        class="px-4 py-2.5 text-right text-body-03-normal-medium text-gray-500"
                        >횟수</th
                      >
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    {#each mockBase.byPurpose as p, i}
                      <tr>
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span
                              class="h-2 w-2 rounded-full {[
                                'bg-indigo-400',
                                'bg-violet-400',
                                'bg-purple-200'
                              ][i]}"
                            ></span>
                            <span
                              class="text-body-02-normal-regular text-gray-700"
                              >{p.label}</span
                            >
                          </div>
                        </td>
                        <td
                          class="px-4 py-3 text-right text-body-02-normal-medium tabular-nums text-gray-900"
                          >{p.credits.toLocaleString()}</td
                        >
                        <td
                          class="px-4 py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                          >{p.calls}회</td
                        >
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>

          <!-- 상담사별 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              상담사별 사용 현황
            </h3>
            <div class="space-y-3">
              {#each mockBase.memberUsage as m}
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"
                  >
                    <span class="text-body-03-normal-medium text-gray-500"
                      >{m.name.charAt(0)}</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{m.name}</span
                      >
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-900"
                        >{m.credits.toLocaleString()} 크레딧</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <div
                        class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                      >
                        <div
                          class="h-full rounded-full bg-primary-400"
                          style="width:{m.percent}%"
                        ></div>
                      </div>
                      <span
                        class="text-body-03-normal-regular tabular-nums text-gray-400 w-9 text-right"
                        >{m.percent}%</span
                      >
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            <p class="mt-3 text-body-03-normal-regular text-gray-400">
              최근 사용 기록 기준
            </p>
          </div>

          <!-- 타임라인 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              사용 기록
            </h3>
            <div class="space-y-3">
              {#each mockBase.timeline as t}
                <div
                  class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50"
                  >
                    <svg
                      class="h-3.5 w-3.5 text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{t.label}</span
                      >
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-900"
                        >{t.credits} 크레딧</span
                      >
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-body-03-normal-regular text-gray-400"
                        >{t.time}</span
                      >
                      <span class="text-gray-200">·</span>
                      <span class="text-body-03-normal-regular text-gray-400"
                        >{t.member}</span
                      >
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- 추이/횟수 탭 공통 구조 -->
        <div class="space-y-4">
          <!-- 추이 특화 TrendKpiBar -->
          <div class="rounded-lg border border-gray-200 bg-white">
            <div
              class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100"
            >
              {#each bTab === 'credits' ? creditsTrendKpi : callsTrendKpi as item}
                <div class="px-6 py-5">
                  <p class="text-body-03-normal-regular text-gray-400 mb-1">
                    {item.label}
                  </p>
                  <div class="flex items-baseline gap-1 flex-wrap">
                    <span
                      class="text-title-01-normal-semibold tabular-nums {item.noteColor &&
                      !item.unit
                        ? item.noteColor
                        : 'text-gray-900'}">{item.value}</span
                    >
                    {#if item.unit}<span
                        class="text-body-03-normal-regular text-gray-400"
                        >{item.unit}</span
                      >{/if}
                    {#if item.note}<span
                        class="text-body-02-normal-medium {item.noteColor}"
                        >{item.note}</span
                      >{/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- 차트 영역 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              {bTab === 'credits' ? '크레딧 누적 사용량' : 'AI 사용 횟수 추이'}
            </h3>
            <div
              class="flex items-end gap-0.5 overflow-hidden"
              style="height:128px"
            >
              {#each mockBase.barHeights as h, i}
                <div
                  class="flex-1 rounded-t transition-all"
                  style="height:{h}%; background:{i === 29
                    ? bTab === 'credits'
                      ? '#6366f1'
                      : '#8b5cf6'
                    : bTab === 'credits'
                      ? '#e0e7ff'
                      : '#ede9fe'}"
                ></div>
              {/each}
            </div>
            <div
              class="mt-2 flex justify-between text-body-03-normal-regular text-gray-300"
            >
              <span>6.1</span><span>6.10</span><span>6.30</span>
            </div>
          </div>

          <!-- 기능별 추이 토글 -->
          <div>
            <button
              class="flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-white px-5 py-3.5 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
              onclick={() => (bShowMultiLine = !bShowMultiLine)}
            >
              <svg
                class="h-4 w-4 text-gray-400 transition-transform duration-200 {bShowMultiLine
                  ? 'rotate-180'
                  : ''}"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
              기능별 추이 보기
            </button>
            {#if bShowMultiLine}
              <div
                class="rounded-b-2xl border-x border-b border-gray-100 bg-white px-6 py-6"
              >
                <div
                  class="flex items-end gap-1 overflow-hidden"
                  style="height:100px"
                >
                  {#each mockBase.barHeights.slice(0, 20) as h, i}
                    <div
                      class="flex-1 rounded-t"
                      style="height:{h}%; background:{[
                        '#818cf8',
                        '#a78bfa',
                        '#ddd6fe'
                      ][i % 3]}; opacity:{0.5 + (i % 3) * 0.25}"
                    ></div>
                  {/each}
                </div>
                <div
                  class="mt-3 flex items-center gap-4 text-body-03-normal-regular text-gray-400"
                >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-indigo-400"></span>AI
                    상담일지</span
                  >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-violet-400"
                    ></span>업무 도우미</span
                  >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-purple-200"
                    ></span>검사 해석</span
                  >
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 안내 Disclosure -->
      <div>
        <button
          class="flex items-center gap-2 text-body-03-normal-medium text-gray-400 hover:text-gray-600 transition-colors"
          onclick={() => (bShowGuidance = !bShowGuidance)}
        >
          <svg
            class="h-3.5 w-3.5 transition-transform duration-200 {bShowGuidance
              ? 'rotate-180'
              : ''}"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
          안내 보기
          <span class="text-body-03-normal-regular text-gray-300"
            >· 크레딧은 기간 종료 시 초기화됩니다</span
          >
        </button>
        {#if bShowGuidance}
          <div
            class="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 space-y-1.5"
          >
            {#each ['크레딧은 AI 기능 사용 시 자동으로 누적됩니다.', '크레딧은 기간 종료 시 초기화되며, 이월되지 않습니다.', '크레딧이 부족하면 AI 기능 사용이 제한됩니다.'] as note}
              <div class="flex items-start gap-1.5">
                <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                ></span>
                <p class="text-body-02-normal-regular text-gray-500">{note}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- LAYOUT C: Sticky 크레딧 카드 + 탭                                -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
  {:else}
    <div class="space-y-4">
      <!-- sticky 시뮬레이션 (lab에서는 top shadow로 표현) -->
      <div
        class="rounded-lg border border-gray-200 bg-white px-0 pb-0 mb-4 shadow-sm"
      >
        <div class="px-6 pt-3 pb-0">
          <p
            class="text-body-03-normal-regular text-primary-400 mb-2 flex items-center gap-1.5"
          >
            <svg
              class="h-3 w-3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.601a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              /></svg
            >
            sticky — 실제 페이지에서는 스크롤 시 상단 고정
          </p>

          <!-- 헤더 행 -->
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-title-01-normal-semibold text-gray-900">
              AI 사용량
            </h2>
            <a
              href="/settings/subscription"
              class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-body-03-normal-medium text-gray-600 hover:bg-gray-50"
            >
              구독 관리 →
            </a>
          </div>

          <!-- 컴팩트 현황 카드 (h-2 얇은 게이지) -->
          <div class="rounded-lg border {sc.cardClass} px-4 py-3">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <span
                  class="rounded-full bg-primary-50 px-2 py-0.5 text-body-03-normal-medium text-primary-600"
                  >{mockBase.planLabel}</span
                >
                <span
                  class="text-title-01-normal-semibold tabular-nums text-gray-900"
                  >{sc.creditUsed.toLocaleString()} / {sc.creditLimit.toLocaleString()}</span
                >
                <span class="text-body-03-normal-regular text-gray-400"
                  >크레딧 사용</span
                >
              </div>
              <span
                class="rounded-full bg-gray-100 px-2 py-0.5 text-body-03-normal-medium text-gray-500"
                >D-{mockBase.daysUntilReset}</span
              >
            </div>

            <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 {sc.barClass}"
                style="width:{sc.usagePercent}%"
              ></div>
            </div>

            <div
              class="mt-1.5 flex items-center justify-between text-body-03-normal-regular text-gray-400"
            >
              <span>{mockBase.periodLabel}</span>
              <span
                >{sc.creditRemaining.toLocaleString()} 남음 ({100 -
                  sc.usagePercent}%)</span
              >
            </div>

            {#if sc.inlineWarn}
              <div
                class="mt-2 border-t {mockStatus === 'danger'
                  ? 'border-red-100'
                  : 'border-amber-100'} pt-2 flex items-center gap-2"
              >
                <svg
                  class="h-3.5 w-3.5 shrink-0 {mockStatus === 'danger'
                    ? 'text-red-400'
                    : 'text-amber-400'}"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
                <p
                  class="text-body-03-normal-medium {mockStatus === 'danger'
                    ? 'text-red-600'
                    : 'text-amber-700'}"
                >
                  크레딧 {sc.usagePercent}% 소진 · 약 {mockBase.insight
                    .estimatedDepletionDays}일 후 소진 예상
                </p>
              </div>
            {/if}
          </div>
        </div>

        <!-- 탭 바 (sticky 블록 내 하단) -->
        <div class="px-6 pt-3 pb-3">
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
            {#each TABS as tab}
              <button
                class="flex-1 rounded-lg px-4 py-2 text-body-02-normal-medium transition-colors
                  {cTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (cTab = tab.key)}
              >
                {tab.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- 탭 콘텐츠 -->
      {#if cTab === 'overview'}
        <div class="space-y-4">
          <!-- PaceGuide + 잔여 가능 작업 2열 (개요 탭 최상단) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
                사용 속도 분석
              </h3>
              <div class="space-y-3">
                <div
                  class="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <span class="text-body-02-normal-regular text-gray-500"
                    >하루 권장량</span
                  >
                  <span
                    class="text-body-02-normal-medium tabular-nums text-gray-900"
                    >{Math.round(
                      sc.creditRemaining / mockBase.daysUntilReset
                    ).toLocaleString()}/일</span
                  >
                </div>
                <div
                  class="flex items-center justify-between py-2 border-b border-gray-100"
                >
                  <span class="text-body-02-normal-regular text-gray-500"
                    >현재 속도</span
                  >
                  <div class="flex items-center gap-1.5">
                    <span
                      class="text-body-02-normal-medium tabular-nums text-gray-900"
                      >{mockBase.insight.dailyAvgCredits}/일</span
                    >
                    <span
                      class="rounded-full {mockStatus === 'normal'
                        ? 'bg-green-50 text-green-600'
                        : mockStatus === 'warning'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-status-danger-bg text-red-600'} px-1.5 py-0.5 text-body-03-normal-medium"
                    >
                      {mockStatus === 'normal'
                        ? '적정'
                        : mockStatus === 'warning'
                          ? '과속'
                          : '매우 과속'}
                    </span>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2">
                  <span class="text-body-02-normal-regular text-gray-500"
                    >예상 소진</span
                  >
                  <span
                    class="text-body-02-normal-medium tabular-nums {mockStatus ===
                    'danger'
                      ? 'text-red-600'
                      : mockStatus === 'warning'
                        ? 'text-amber-600'
                        : 'text-gray-900'}"
                    >{mockBase.insight.estimatedDepletionDays}일 후</span
                  >
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
              <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
                남은 크레딧으로 가능한 작업
              </h3>
              <div class="space-y-3">
                {#each mockBase.capacity as c}
                  <div class="flex items-center justify-between py-1.5">
                    <span class="text-body-02-normal-medium text-gray-700"
                      >{c.label}</span
                    >
                    <span
                      class="text-body-02-normal-medium tabular-nums text-gray-900"
                      >{c.count}</span
                    >
                  </div>
                {/each}
              </div>
              <p class="mt-3 text-body-03-normal-regular text-gray-400">
                현재 평균 비용 기준 예측
              </p>
            </div>
          </div>

          <!-- 기능별 서브탭 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-title-01-normal-semibold text-gray-900">
                기능별 사용
              </h3>
              <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
                {#each ['chart', 'table'] as const as t}
                  <button
                    class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
                      {cPurposeTab === t
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}"
                    onclick={() => (cPurposeTab = t)}
                  >
                    {t === 'chart' ? '비율 차트' : '상세 수치'}
                  </button>
                {/each}
              </div>
            </div>
            {#if cPurposeTab === 'chart'}
              <div class="flex items-center gap-8">
                <svg viewBox="0 0 120 120" class="h-32 w-32 shrink-0">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#f3f4f6"
                    stroke-width="14"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#818cf8"
                    stroke-width="14"
                    stroke-dasharray="162 289"
                    stroke-dashoffset="0"
                    transform="rotate(-90 60 60)"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#a78bfa"
                    stroke-width="14"
                    stroke-dasharray="90 289"
                    stroke-dashoffset="-162"
                    transform="rotate(-90 60 60)"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="none"
                    stroke="#ddd6fe"
                    stroke-width="14"
                    stroke-dasharray="38 289"
                    stroke-dashoffset="-252"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div class="flex-1 space-y-2">
                  {#each mockBase.byPurpose as p, i}
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span
                          class="h-2.5 w-2.5 rounded-full {[
                            'bg-indigo-400',
                            'bg-violet-400',
                            'bg-purple-200'
                          ][i]}"
                        ></span>
                        <span class="text-body-02-normal-regular text-gray-700"
                          >{p.label}</span
                        >
                      </div>
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-500"
                        >{p.percent}%</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <div class="overflow-hidden rounded-lg border border-gray-200">
                <table class="w-full text-left">
                  <thead class="bg-gray-50">
                    <tr>
                      <th
                        class="px-4 py-2.5 text-body-03-normal-medium text-gray-500"
                        >기능</th
                      >
                      <th
                        class="px-4 py-2.5 text-right text-body-03-normal-medium text-gray-500"
                        >크레딧</th
                      >
                      <th
                        class="px-4 py-2.5 text-right text-body-03-normal-medium text-gray-500"
                        >횟수</th
                      >
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    {#each mockBase.byPurpose as p, i}
                      <tr>
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-2">
                            <span
                              class="h-2 w-2 rounded-full {[
                                'bg-indigo-400',
                                'bg-violet-400',
                                'bg-purple-200'
                              ][i]}"
                            ></span>
                            <span
                              class="text-body-02-normal-regular text-gray-700"
                              >{p.label}</span
                            >
                          </div>
                        </td>
                        <td
                          class="px-4 py-3 text-right text-body-02-normal-medium tabular-nums text-gray-900"
                          >{p.credits.toLocaleString()}</td
                        >
                        <td
                          class="px-4 py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                          >{p.calls}회</td
                        >
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>

          <!-- 상담사별 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              상담사별 사용 현황
            </h3>
            <div class="space-y-3">
              {#each mockBase.memberUsage as m}
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100"
                  >
                    <span class="text-body-03-normal-medium text-gray-500"
                      >{m.name.charAt(0)}</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{m.name}</span
                      >
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-900"
                        >{m.credits.toLocaleString()} 크레딧</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <div
                        class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                      >
                        <div
                          class="h-full rounded-full bg-primary-400"
                          style="width:{m.percent}%"
                        ></div>
                      </div>
                      <span
                        class="text-body-03-normal-regular tabular-nums text-gray-400 w-9 text-right"
                        >{m.percent}%</span
                      >
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            <p class="mt-3 text-body-03-normal-regular text-gray-400">
              최근 사용 기록 기준
            </p>
          </div>

          <!-- 타임라인 -->
          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              사용 기록
            </h3>
            <div class="space-y-3">
              {#each mockBase.timeline as t}
                <div
                  class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <div
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50"
                  >
                    <svg
                      class="h-3.5 w-3.5 text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                      />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{t.label}</span
                      >
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-900"
                        >{t.credits} 크레딧</span
                      >
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-body-03-normal-regular text-gray-400"
                        >{t.time}</span
                      >
                      <span class="text-gray-200">·</span>
                      <span class="text-body-03-normal-regular text-gray-400"
                        >{t.member}</span
                      >
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- 추이/횟수 탭 -->
        <div class="space-y-4">
          <div class="rounded-lg border border-gray-200 bg-white">
            <div
              class="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100"
            >
              {#each cTab === 'credits' ? creditsTrendKpi : callsTrendKpi as item}
                <div class="px-6 py-5">
                  <p class="text-body-03-normal-regular text-gray-400 mb-1">
                    {item.label}
                  </p>
                  <div class="flex items-baseline gap-1 flex-wrap">
                    <span
                      class="text-title-01-normal-semibold tabular-nums {item.noteColor &&
                      !item.unit
                        ? item.noteColor
                        : 'text-gray-900'}">{item.value}</span
                    >
                    {#if item.unit}<span
                        class="text-body-03-normal-regular text-gray-400"
                        >{item.unit}</span
                      >{/if}
                    {#if item.note}<span
                        class="text-body-02-normal-medium {item.noteColor}"
                        >{item.note}</span
                      >{/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
            <h3 class="text-title-01-normal-semibold text-gray-900 mb-4">
              {cTab === 'credits' ? '크레딧 누적 사용량' : 'AI 사용 횟수 추이'}
            </h3>
            <div
              class="flex items-end gap-0.5 overflow-hidden"
              style="height:128px"
            >
              {#each mockBase.barHeights as h, i}
                <div
                  class="flex-1 rounded-t"
                  style="height:{h}%; background:{i === 29
                    ? cTab === 'credits'
                      ? '#6366f1'
                      : '#8b5cf6'
                    : cTab === 'credits'
                      ? '#e0e7ff'
                      : '#ede9fe'}"
                ></div>
              {/each}
            </div>
            <div
              class="mt-2 flex justify-between text-body-03-normal-regular text-gray-300"
            >
              <span>6.1</span><span>6.10</span><span>6.30</span>
            </div>
          </div>

          <div>
            <button
              class="flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-white px-5 py-3.5 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 transition-colors"
              onclick={() => (cShowMultiLine = !cShowMultiLine)}
            >
              <svg
                class="h-4 w-4 text-gray-400 transition-transform duration-200 {cShowMultiLine
                  ? 'rotate-180'
                  : ''}"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
              기능별 추이 보기
            </button>
            {#if cShowMultiLine}
              <div
                class="rounded-b-2xl border-x border-b border-gray-100 bg-white px-6 py-6"
              >
                <div
                  class="flex items-end gap-1 overflow-hidden"
                  style="height:100px"
                >
                  {#each mockBase.barHeights.slice(0, 20) as h, i}
                    <div
                      class="flex-1 rounded-t"
                      style="height:{h}%; background:{[
                        '#818cf8',
                        '#a78bfa',
                        '#ddd6fe'
                      ][i % 3]}; opacity:{0.5 + (i % 3) * 0.25}"
                    ></div>
                  {/each}
                </div>
                <div
                  class="mt-3 flex items-center gap-4 text-body-03-normal-regular text-gray-400"
                >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-indigo-400"></span>AI
                    상담일지</span
                  >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-violet-400"
                    ></span>업무 도우미</span
                  >
                  <span class="flex items-center gap-1.5"
                    ><span class="h-2 w-2 rounded-full bg-purple-200"
                    ></span>검사 해석</span
                  >
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 안내 Disclosure -->
      <div class="mt-4">
        <button
          class="flex items-center gap-2 text-body-03-normal-medium text-gray-400 hover:text-gray-600 transition-colors"
          onclick={() => (cShowGuidance = !cShowGuidance)}
        >
          <svg
            class="h-3.5 w-3.5 transition-transform duration-200 {cShowGuidance
              ? 'rotate-180'
              : ''}"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
          안내 보기
          <span class="text-body-03-normal-regular text-gray-300"
            >· 크레딧은 기간 종료 시 초기화됩니다</span
          >
        </button>
        {#if cShowGuidance}
          <div
            class="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 space-y-1.5"
          >
            {#each ['크레딧은 AI 기능 사용 시 자동으로 누적됩니다.', '크레딧은 기간 종료 시 초기화되며, 이월되지 않습니다.', '크레딧이 부족하면 AI 기능 사용이 제한됩니다.'] as note}
              <div class="flex items-start gap-1.5">
                <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                ></span>
                <p class="text-body-02-normal-regular text-gray-500">{note}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
