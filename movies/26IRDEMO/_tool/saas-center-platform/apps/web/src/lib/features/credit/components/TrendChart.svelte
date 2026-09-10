<script lang="ts">
  /**
   * 통합 추이 차트 — Chart.js canvas 기반.
   * 누적 라인 + 일별 라인 복합. 확대(expand) 모달 내장.
   */

  export interface TrendChartItem {
    label: string
    daily: number
    cumulative: number
  }

  import type { Snippet } from 'svelte'
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'

  function teleport(node: HTMLElement) {
    if (!browser) return
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      }
    }
  }
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
    type ChartConfiguration
  } from 'chart.js'

  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip
  )

  // 프로젝트 폰트 맞춤 (Canvas는 CSS letter-spacing 미지원 — 폰트 패밀리만 통일)
  Chart.defaults.font.family =
    "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  interface Props {
    title: string
    subtitle?: string
    items: TrendChartItem[]
    dailyUnit?: string
    cumulativeUnit?: string
    theme?: 'indigo' | 'violet'
    headerRight?: Snippet
  }

  let {
    title,
    subtitle = '',
    items,
    dailyUnit = '',
    cumulativeUnit = '',
    theme = 'indigo',
    headerRight
  }: Props = $props()

  const COLORS = {
    indigo: {
      line: '#6366f1',
      area: 'rgba(99,102,241,0.08)',
      daily: '#a5b4fc'
    },
    violet: { line: '#8b5cf6', area: 'rgba(139,92,246,0.08)', daily: '#c4b5fd' }
  }

  function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K'
    return n.toLocaleString('ko-KR')
  }

  function makeLabels() {
    const labels = items.map((d) => d.label)
    if (labels.length > 0) labels[labels.length - 1] = '오늘'
    return labels
  }

  function yMax() {
    const maxCum = Math.max(...items.map((d) => d.cumulative), 0)
    return maxCum * 1.3 || 1
  }

  function buildConfig(tickLimit = 5): ChartConfiguration {
    const c = COLORS[theme]
    return {
      type: 'line',
      data: {
        labels: makeLabels(),
        datasets: [
          {
            label: `누적 ${cumulativeUnit}`,
            data: items.map((d) => d.cumulative),
            borderColor: c.line,
            backgroundColor: c.area,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: c.line,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            fill: true,
            tension: 0.35,
            yAxisID: 'y'
          },
          {
            label: `일별 ${dailyUnit}`,
            data: items.map((d) => d.daily),
            borderColor: c.daily,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: c.daily,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            fill: false,
            tension: 0.35,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#9ca3af',
            bodyColor: '#f9fafb',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (ti) => ti[0]?.label ?? '',
              label: (ti) => {
                const val = ti.parsed.y ?? 0
                const unit = ti.datasetIndex === 0 ? cumulativeUnit : dailyUnit
                const prefix = ti.datasetIndex === 1 ? '+' : ''
                return `  ${ti.dataset.label}: ${prefix}${val.toLocaleString('ko-KR')} ${unit}`
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              maxRotation: 0,
              maxTicksLimit: tickLimit
            }
          },
          y: {
            position: 'left',
            grid: { color: '#f3f4f6' },
            border: { display: false },
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              maxTicksLimit: 5,
              callback: (val) => fmt(Number(val))
            },
            max: yMax()
          }
        }
      }
    }
  }

  // ── 메인 차트 ──
  let canvas: HTMLCanvasElement | undefined = $state()
  let chart: Chart | null = null

  function createChart() {
    if (!canvas) return
    chart?.destroy()
    chart = new Chart(canvas, buildConfig())
  }

  function updateChart() {
    if (!chart) return
    const c = COLORS[theme]
    chart.data.labels = makeLabels()
    chart.data.datasets[0].data = items.map((d) => d.cumulative)
    chart.data.datasets[0].borderColor = c.line
    chart.data.datasets[0].backgroundColor = c.area
    ;(chart.data.datasets[0] as any).pointBackgroundColor = c.line
    chart.data.datasets[1].data = items.map((d) => d.daily)
    chart.data.datasets[1].borderColor = c.daily
    ;(chart.data.datasets[1] as any).pointBackgroundColor = c.daily
    if (chart.options.scales?.y) chart.options.scales.y.max = yMax()
    chart.update('active')
  }

  onMount(() => createChart())
  onDestroy(() => {
    chart?.destroy()
    modalChart?.destroy()
  })

  $effect(() => {
    const _i = items,
      _t = theme
    if (chart) updateChart()
    else createChart()
  })

  // ── 확대 뷰어 ──
  let expanded = $state(false)
  let modalCanvas: HTMLCanvasElement | undefined = $state()
  let modalChart: Chart | null = null

  function openExpanded() {
    expanded = true
  }
  function closeExpanded() {
    expanded = false
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeExpanded()
  }

  $effect(() => {
    if (expanded && modalCanvas) {
      modalChart?.destroy()
      modalChart = new Chart(modalCanvas, buildConfig(8))
    } else if (!expanded) {
      modalChart?.destroy()
      modalChart = null
    }
  })
</script>

<svelte:window onkeydown={onKeydown} />

{#if items.length > 0}
  <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-title-01-normal-semibold text-gray-900">{title}</h2>
      <div class="flex items-center gap-2">
        {#if headerRight}
          {@render headerRight()}
        {:else}
          <span class="text-body-03-normal-regular text-gray-400"
            >최근 {items.length}일</span
          >
        {/if}
        <!-- 확대 버튼 -->
        <button
          onclick={openExpanded}
          class="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="차트 확대"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
            />
          </svg>
        </button>
      </div>
    </div>
    {#if subtitle}
      <p class="text-body-03-normal-regular text-gray-400 mb-3">{subtitle}</p>
    {:else}
      <div class="mb-3"></div>
    {/if}

    <!-- 범례 -->
    <div class="flex items-center gap-4 mb-4">
      <div class="flex items-center gap-1.5">
        <span
          class="inline-block h-[3px] w-4 rounded-full"
          style="background:{COLORS[theme].line}"
        ></span>
        <span class="text-body-03-normal-regular text-gray-500"
          >누적 {cumulativeUnit}</span
        >
      </div>
      <div class="flex items-center gap-1.5">
        <span
          class="inline-block h-[3px] w-4 rounded-full"
          style="background:{COLORS[theme].daily}"
        ></span>
        <span class="text-body-03-normal-regular text-gray-500"
          >일별 {dailyUnit}</span
        >
      </div>
    </div>

    <div class="w-full" style="height:200px">
      <canvas bind:this={canvas}></canvas>
    </div>
  </div>
{/if}

<!-- 확대 모달 — use:teleport으로 body에 직접 append (CSS 폰트/자간 완전 상속) -->
{#if expanded}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    use:teleport
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
    onclick={closeExpanded}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="w-full max-w-4xl rounded-lg bg-white px-8 py-7 shadow-2xl"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- 모달 헤더 -->
      <div class="flex items-start justify-between mb-2">
        <div>
          <h2 class="text-title-01-normal-semibold text-gray-900">{title}</h2>
          {#if subtitle}
            <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
              {subtitle}
            </p>
          {/if}
        </div>
        <button
          onclick={closeExpanded}
          class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- 범례 -->
      <div class="flex items-center gap-4 mb-5">
        <div class="flex items-center gap-1.5">
          <span
            class="inline-block h-[3px] w-4 rounded-full"
            style="background:{COLORS[theme].line}"
          ></span>
          <span class="text-body-03-normal-regular text-gray-500"
            >누적 {cumulativeUnit}</span
          >
        </div>
        <div class="flex items-center gap-1.5">
          <span
            class="inline-block h-[3px] w-4 rounded-full"
            style="background:{COLORS[theme].daily}"
          ></span>
          <span class="text-body-03-normal-regular text-gray-500"
            >일별 {dailyUnit}</span
          >
        </div>
        <span class="ml-auto text-body-03-normal-regular text-gray-400"
          >최근 {items.length}일</span
        >
      </div>

      <!-- 확대 차트 -->
      <div class="w-full" style="height:380px">
        <canvas bind:this={modalCanvas}></canvas>
      </div>

      <p class="mt-3 text-center text-body-03-normal-regular text-gray-400">
        ESC 또는 바깥 영역을 클릭하면 닫힙니다
      </p>
    </div>
  </div>
{/if}
