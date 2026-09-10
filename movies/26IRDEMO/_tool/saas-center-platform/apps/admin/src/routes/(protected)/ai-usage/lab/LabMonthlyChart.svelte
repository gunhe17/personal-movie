<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    type ChartConfiguration,
  } from 'chart.js'
  import type { MonthlyUsageItem } from '$hooks/actions/ai-usage.action'
  import { fmtKRW } from './mock'

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)
  Chart.defaults.font.family = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  interface Props {
    data: MonthlyUsageItem[]
    selectedMonth: string
    height?: number
    onSelectMonth: (month: string) => void
  }

  let { data, selectedMonth, height = 160, onSelectMonth }: Props = $props()

  const COLOR_SEL     = '#6366f1'  // primary-500
  const COLOR_HOVER   = '#a5b4fc'  // primary-300
  const COLOR_DEFAULT = '#e5e7eb'  // gray-200

  function orderedData() {
    return [...data].reverse()
  }

  function barColors(hoverIdx?: number | null) {
    return orderedData().map((item, i) => {
      if (item.month === selectedMonth) return COLOR_SEL
      if (i === hoverIdx) return COLOR_HOVER
      return COLOR_DEFAULT
    })
  }

  let canvas: HTMLCanvasElement | undefined = $state()
  let chart: Chart | null = null

  function buildConfig(): ChartConfiguration {
    const ordered = orderedData()
    return {
      type: 'bar',
      data: {
        labels: ordered.map((item) => `${Number(item.month.slice(5))}월`),
        datasets: [
          {
            data: ordered.map((item) => item.estimated_cost),
            backgroundColor: barColors(),
            hoverBackgroundColor: ordered.map((item) =>
              item.month === selectedMonth ? COLOR_SEL : COLOR_HOVER,
            ),
            borderRadius: 4,
            borderSkipped: 'bottom',
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        onClick: (_event, elements) => {
          if (elements.length > 0) {
            const month = orderedData()[elements[0].index].month
            onSelectMonth(month)
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#9ca3af',
            bodyColor: '#f9fafb',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11 },
            bodyFont: { size: 13, weight: 'bold' as const },
            callbacks: {
              title: (ti) => ti[0]?.label ?? '',
              label: (ti) => `  비용 ${fmtKRW(ti.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#9ca3af', font: { size: 11 }, maxRotation: 0 },
          },
          y: {
            display: false,
            beginAtZero: true,
          },
        },
      },
    }
  }

  function syncColors() {
    if (!chart) return
    const ordered = orderedData()
    ;(chart.data.datasets[0] as any).backgroundColor = ordered.map((item) =>
      item.month === selectedMonth ? COLOR_SEL : COLOR_DEFAULT,
    )
    chart.update('none')
  }

  onMount(() => {
    if (!canvas) return
    chart = new Chart(canvas, buildConfig())
  })

  onDestroy(() => {
    if (browser) chart?.destroy()
  })

  $effect(() => {
    const _sel = selectedMonth
    syncColors()
  })
</script>

<div style="height:{height}px; cursor:pointer">
  <canvas bind:this={canvas}></canvas>
</div>
