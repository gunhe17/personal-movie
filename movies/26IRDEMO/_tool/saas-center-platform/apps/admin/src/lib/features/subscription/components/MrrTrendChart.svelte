<script lang="ts">
  import { browser } from '$app/environment'
  import type { MrrTrendItem } from '$hooks/actions/subscription.action'

  interface Props {
    items: MrrTrendItem[]
    height?: number
  }

  let { items, height = 200 }: Props = $props()

  let canvas: HTMLCanvasElement | undefined = $state()
  let containerWidth = $state(0)
  let animProgress = $state(0)

  const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  function formatAmount(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
    return String(v)
  }

  function drawChart() {
    if (!canvas || !browser || items.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = containerWidth
    const h = height

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const padLeft = 56
    const padRight = 16
    const padTop = 16
    const padBottom = 32
    const chartW = w - padLeft - padRight
    const chartH = h - padTop - padBottom

    const values = items.map(i => i.mrr)
    const maxVal = Math.max(...values, 1)
    const minVal = 0

    const stepX = items.length > 1 ? chartW / (items.length - 1) : chartW / 2

    function toX(i: number): number {
      return padLeft + (items.length > 1 ? i * stepX : chartW / 2)
    }
    function toY(v: number): number {
      return padTop + chartH - ((v - minVal) / (maxVal - minVal)) * chartH
    }

    // Y축 그리드
    const gridLines = 4
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    for (let i = 0; i <= gridLines; i++) {
      const val = minVal + ((maxVal - minVal) * i) / gridLines
      const y = toY(val)
      ctx.beginPath()
      ctx.moveTo(padLeft, y)
      ctx.lineTo(w - padRight, y)
      ctx.stroke()

      ctx.fillStyle = '#9ca3af'
      ctx.font = '11px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(formatAmount(val), padLeft - 8, y)
    }

    // X축 라벨
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    items.forEach((item, i) => {
      ctx.fillText(MONTH_NAMES[item.month - 1], toX(i), h - padBottom + 10)
    })

    if (items.length < 2) {
      // 단일 포인트
      const x = toX(0)
      const y = toY(values[0] * animProgress)
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#6366f1'
      ctx.fill()
      return
    }

    // 영역 채우기 (그라데이션)
    const animatedValues = values.map(v => v * animProgress)
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH)
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.12)')
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)')

    ctx.beginPath()
    ctx.moveTo(toX(0), toY(0))
    animatedValues.forEach((v, i) => ctx.lineTo(toX(i), toY(v)))
    ctx.lineTo(toX(items.length - 1), toY(0))
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // 라인
    ctx.beginPath()
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    animatedValues.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v))
      else ctx.lineTo(toX(i), toY(v))
    })
    ctx.stroke()

    // 포인트
    animatedValues.forEach((v, i) => {
      const x = toX(i)
      const y = toY(v)

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2.5
      ctx.stroke()
    })

    // 값 라벨
    ctx.fillStyle = '#374151'
    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    animatedValues.forEach((v, i) => {
      if (v > 0) {
        ctx.fillText(formatAmount(v), toX(i), toY(v) - 8)
      }
    })
  }

  $effect(() => {
    if (!browser || items.length === 0 || containerWidth === 0) return

    animProgress = 0
    const start = performance.now()
    const duration = 800

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      animProgress = 1 - Math.pow(1 - progress, 3)
      drawChart()
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
</script>

<div
  class="w-full"
  bind:clientWidth={containerWidth}
>
  <canvas bind:this={canvas} class="w-full"></canvas>
</div>
