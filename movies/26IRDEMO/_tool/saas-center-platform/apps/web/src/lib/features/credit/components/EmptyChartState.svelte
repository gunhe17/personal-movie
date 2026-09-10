<style>
  .bar-rise {
    transition:
      height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.4s ease;
  }
  .line-draw {
    transition: stroke-dashoffset 1.2s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .donut-sweep {
    transition: stroke-dashoffset 1s cubic-bezier(0.33, 1, 0.68, 1);
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  .float-anim {
    animation: float 3s ease-in-out infinite;
  }

  @keyframes soft-pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }
  .pulse-anim {
    animation: soft-pulse 2.5s ease-in-out infinite;
  }

  @keyframes slow-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .spin-slow-sm {
    animation: slow-spin 20s linear infinite;
    transform-origin: 80px 80px;
  }
  .spin-slow-lg {
    animation: slow-spin 20s linear infinite;
    transform-origin: 110px 110px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'

  interface Props {
    title?: string
    message?: string
    hint?: string
    /** 차트 스타일: chart(기본), donut, timeline */
    variant?: 'chart' | 'donut' | 'timeline'
    /** 크기: sm(그리드 내), lg(단독 카드) */
    size?: 'sm' | 'lg'
  }

  let {
    title = '',
    message = '아직 사용 데이터가 없습니다',
    hint = 'AI 기능을 사용하면 여기에 추이가 표시됩니다',
    variant = 'chart',
    size = 'sm'
  }: Props = $props()

  const isLg = $derived(size === 'lg')

  let mounted = $state(false)
  let animated = $state(false)

  onMount(() => {
    mounted = true
    const timer = setTimeout(() => {
      animated = true
    }, 150)
    return () => clearTimeout(timer)
  })
</script>

<div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
  {#if title}
    <h2
      class="text-title-01-normal-semibold text-gray-900 {isLg
        ? 'mb-1'
        : 'mb-4'}"
    >
      {title}
    </h2>
    {#if isLg}
      <p class="text-body-03-normal-regular text-gray-400 mb-2">
        데이터가 쌓이면 추이 차트가 표시됩니다
      </p>
    {/if}
  {/if}

  <div class="flex flex-col items-center {isLg ? 'py-12' : 'py-6'}">
    <!-- 일러스트 영역 -->
    <div class="float-anim {isLg ? 'mb-8' : 'mb-5'}">
      {#if variant === 'chart'}
        {#if isLg}
          <!-- 큰 바 차트 + 라인 일러스트 -->
          <svg width="360" height="200" viewBox="0 0 360 200" fill="none">
            <!-- 그리드 라인 -->
            <line
              x1="40"
              y1="30"
              x2="330"
              y2="30"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="40"
              y1="70"
              x2="330"
              y2="70"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="40"
              y1="110"
              x2="330"
              y2="110"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="40"
              y1="150"
              x2="330"
              y2="150"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="40"
              y1="180"
              x2="330"
              y2="180"
              stroke="#e5e7eb"
              stroke-width="1"
            />

            <!-- 바 차트 -->
            {#each [{ x: 65, h: animated ? 50 : 0, delay: 0 }, { x: 105, h: animated ? 85 : 0, delay: 0.08 }, { x: 145, h: animated ? 60 : 0, delay: 0.16 }, { x: 185, h: animated ? 110 : 0, delay: 0.24 }, { x: 225, h: animated ? 75 : 0, delay: 0.32 }, { x: 265, h: animated ? 95 : 0, delay: 0.4 }, { x: 305, h: animated ? 70 : 0, delay: 0.48 }] as bar}
              <rect
                x={bar.x - 12}
                y={180 - bar.h}
                width="24"
                rx="4"
                class="bar-rise"
                style="height: {bar.h}px; transition-delay: {bar.delay}s"
                fill="#e0e7ff"
                opacity={animated ? 0.6 : 0}
              />
            {/each}

            <!-- 곡선 라인 -->
            <path
              d="M65,145 Q105,100 145,115 T225,70 265,80 305,90"
              fill="none"
              stroke="#a5b4fc"
              stroke-width="2.5"
              stroke-linecap="round"
              class="line-draw"
              stroke-dasharray="400"
              stroke-dashoffset={animated ? 0 : 400}
              style="transition-delay: 0.3s"
            />

            <!-- 영역 그라데이션 -->
            <path
              d="M65,145 Q105,100 145,115 T225,70 265,80 305,90 L305,180 L65,180 Z"
              fill="url(#emptyChartGrad)"
              opacity={animated ? 0.4 : 0}
              style="transition: opacity 0.6s ease 0.8s"
            />

            <!-- 포인트 -->
            {#each [{ cx: 65, cy: 145, delay: 0.7 }, { cx: 145, cy: 115, delay: 0.85 }, { cx: 225, cy: 70, delay: 1.0 }, { cx: 265, cy: 80, delay: 1.1 }, { cx: 305, cy: 90, delay: 1.2 }] as pt}
              <circle
                cx={pt.cx}
                cy={pt.cy}
                r="4"
                fill="#818cf8"
                stroke="white"
                stroke-width="2"
                opacity={animated ? 0.5 : 0}
                style="transition: opacity 0.3s ease {pt.delay}s"
              />
            {/each}

            <!-- Y축 라벨 -->
            {#each [30, 70, 110, 150] as yy, i}
              <text
                x="32"
                y={yy + 4}
                text-anchor="end"
                fill="#d1d5db"
                font-size="9"
                class="pulse-anim"
                style="animation-delay: {i * 0.3}s">—</text
              >
            {/each}

            <!-- X축 라벨 -->
            {#each [65, 145, 225, 305] as xx, i}
              <rect
                x={xx - 14}
                y="186"
                width="28"
                height="6"
                rx="3"
                fill="#f3f4f6"
                opacity={animated ? 0.5 : 0}
                style="transition: opacity 0.3s ease {0.5 + i * 0.1}s"
              />
            {/each}

            <defs>
              <linearGradient id="emptyChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#a5b4fc" stop-opacity="0.2" />
                <stop offset="100%" stop-color="#a5b4fc" stop-opacity="0.02" />
              </linearGradient>
            </defs>
          </svg>
        {:else}
          <!-- 작은 바 차트 + 라인 일러스트 -->
          <svg width="200" height="120" viewBox="0 0 200 120" fill="none">
            <line
              x1="30"
              y1="20"
              x2="180"
              y2="20"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="30"
              y1="50"
              x2="180"
              y2="50"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="30"
              y1="80"
              x2="180"
              y2="80"
              stroke="#f3f4f6"
              stroke-width="1"
            />
            <line
              x1="30"
              y1="105"
              x2="180"
              y2="105"
              stroke="#e5e7eb"
              stroke-width="1"
            />

            {#each [{ x: 45, h: animated ? 30 : 0, delay: 0 }, { x: 70, h: animated ? 50 : 0, delay: 0.1 }, { x: 95, h: animated ? 35 : 0, delay: 0.2 }, { x: 120, h: animated ? 65 : 0, delay: 0.3 }, { x: 145, h: animated ? 45 : 0, delay: 0.4 }, { x: 170, h: animated ? 55 : 0, delay: 0.5 }] as bar}
              <rect
                x={bar.x - 8}
                y={105 - bar.h}
                width="16"
                rx="3"
                class="bar-rise"
                style="height: {bar.h}px; transition-delay: {bar.delay}s"
                fill="#e0e7ff"
                opacity={animated ? 0.7 : 0}
              />
            {/each}

            <path
              d="M45,85 Q70,60 95,70 T145,45 170,50"
              fill="none"
              stroke="#a5b4fc"
              stroke-width="2"
              stroke-linecap="round"
              class="line-draw"
              stroke-dasharray="200"
              stroke-dashoffset={animated ? 0 : 200}
              style="transition-delay: 0.4s"
            />

            {#each [{ cx: 45, cy: 85, delay: 0.8 }, { cx: 95, cy: 70, delay: 1.0 }, { cx: 145, cy: 45, delay: 1.2 }, { cx: 170, cy: 50, delay: 1.3 }] as pt}
              <circle
                cx={pt.cx}
                cy={pt.cy}
                r="3"
                fill="#818cf8"
                opacity={animated ? 0.5 : 0}
                style="transition: opacity 0.3s ease {pt.delay}s"
              />
            {/each}

            <text
              x="24"
              y="24"
              text-anchor="end"
              fill="#d1d5db"
              font-size="8"
              class="pulse-anim">—</text
            >
            <text
              x="24"
              y="54"
              text-anchor="end"
              fill="#d1d5db"
              font-size="8"
              class="pulse-anim"
              style="animation-delay: 0.3s">—</text
            >
            <text
              x="24"
              y="84"
              text-anchor="end"
              fill="#d1d5db"
              font-size="8"
              class="pulse-anim"
              style="animation-delay: 0.6s">—</text
            >
          </svg>
        {/if}
      {:else if variant === 'donut'}
        {#if isLg}
          <!-- 큰 도넛 -->
          <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
            <circle
              cx="110"
              cy="110"
              r="75"
              fill="none"
              stroke="#f3f4f6"
              stroke-width="26"
            />
            <g class="spin-slow-lg">
              {#each [{ color: '#c7d2fe', dash: 108, total: 471 }, { color: '#ddd6fe', dash: 136, total: 471 }, { color: '#e0e7ff', dash: 82, total: 471 }, { color: '#ede9fe', dash: 145, total: 471 }] as seg, i}
                {@const prevDash = [0, 108, 244, 326][i]}
                <circle
                  cx="110"
                  cy="110"
                  r="75"
                  fill="none"
                  stroke={seg.color}
                  stroke-width="26"
                  stroke-dasharray="{seg.dash} {seg.total - seg.dash}"
                  stroke-dashoffset={-prevDash}
                  transform="rotate(-90 110 110)"
                  opacity={animated ? 0.7 : 0}
                  style="transition: opacity 0.5s ease {i * 0.15}s"
                />
              {/each}
            </g>
            <text
              x="110"
              y="104"
              text-anchor="middle"
              fill="#9ca3af"
              font-size="13"
              font-weight="500">데이터</text
            >
            <text
              x="110"
              y="124"
              text-anchor="middle"
              fill="#d1d5db"
              font-size="11">없음</text
            >
          </svg>
        {:else}
          <!-- 작은 도넛 -->
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
            <circle
              cx="80"
              cy="80"
              r="55"
              fill="none"
              stroke="#f3f4f6"
              stroke-width="20"
            />
            <g class="spin-slow-sm">
              {#each [{ color: '#c7d2fe', dash: 80, total: 346 }, { color: '#ddd6fe', dash: 100, total: 346 }, { color: '#e0e7ff', dash: 60, total: 346 }, { color: '#ede9fe', dash: 106, total: 346 }] as seg, i}
                {@const prevDash = [0, 80, 180, 240][i]}
                <circle
                  cx="80"
                  cy="80"
                  r="55"
                  fill="none"
                  stroke={seg.color}
                  stroke-width="20"
                  stroke-dasharray="{seg.dash} {seg.total - seg.dash}"
                  stroke-dashoffset={-prevDash}
                  transform="rotate(-90 80 80)"
                  opacity={animated ? 0.7 : 0}
                  style="transition: opacity 0.5s ease {i * 0.15}s"
                />
              {/each}
            </g>
            <text
              x="80"
              y="76"
              text-anchor="middle"
              fill="#9ca3af"
              font-size="10"
              font-weight="500">데이터</text
            >
            <text
              x="80"
              y="92"
              text-anchor="middle"
              fill="#d1d5db"
              font-size="9">없음</text
            >
          </svg>
        {/if}
      {:else if variant === 'timeline'}
        {#if isLg}
          <!-- 큰 타임라인 -->
          <svg width="360" height="140" viewBox="0 0 360 140" fill="none">
            <line
              x1="20"
              y1="70"
              x2="340"
              y2="70"
              stroke="#e5e7eb"
              stroke-width="1.5"
              stroke-dasharray="6 5"
              class="line-draw"
              style="stroke-dasharray: 500; stroke-dashoffset: {animated
                ? 0
                : 500}"
            />
            {#each [{ cx: 50, delay: 0.3 }, { cx: 110, delay: 0.45 }, { cx: 170, delay: 0.6 }, { cx: 230, delay: 0.75 }, { cx: 290, delay: 0.9 }] as dot}
              <circle
                cx={dot.cx}
                cy="70"
                r="5"
                fill="#c7d2fe"
                opacity={animated ? 0.6 : 0}
                style="transition: opacity 0.4s ease {dot.delay}s"
              />
              <rect
                x={dot.cx - 20}
                y="34"
                width="40"
                height="22"
                rx="6"
                fill="#f3f4f6"
                opacity={animated ? 0.5 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.1}s"
              />
              <rect
                x={dot.cx - 16}
                y="40"
                width="32"
                height="4"
                rx="2"
                fill="#e5e7eb"
                opacity={animated ? 0.4 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.15}s"
              />
              <rect
                x={dot.cx - 16}
                y="48"
                width="20"
                height="3"
                rx="1.5"
                fill="#e5e7eb"
                opacity={animated ? 0.3 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.2}s"
              />
              <rect
                x={dot.cx - 18}
                y="84"
                width="36"
                height="12"
                rx="4"
                fill="#f9fafb"
                opacity={animated ? 0.4 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.15}s"
              />
              <rect
                x={dot.cx - 14}
                y="88"
                width="28"
                height="4"
                rx="2"
                fill="#f3f4f6"
                opacity={animated ? 0.35 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.2}s"
              />
            {/each}
          </svg>
        {:else}
          <!-- 작은 타임라인 -->
          <svg width="200" height="100" viewBox="0 0 200 100" fill="none">
            <line
              x1="20"
              y1="50"
              x2="180"
              y2="50"
              stroke="#e5e7eb"
              stroke-width="1.5"
              stroke-dasharray="4 4"
              class="line-draw"
              style="stroke-dasharray: 300; stroke-dashoffset: {animated
                ? 0
                : 300}"
            />
            {#each [{ cx: 40, delay: 0.4 }, { cx: 80, delay: 0.6 }, { cx: 120, delay: 0.8 }, { cx: 160, delay: 1.0 }] as dot}
              <circle
                cx={dot.cx}
                cy="50"
                r="4"
                fill="#c7d2fe"
                opacity={animated ? 0.6 : 0}
                style="transition: opacity 0.4s ease {dot.delay}s"
              />
              <rect
                x={dot.cx - 12}
                y="26"
                width="24"
                height="16"
                rx="4"
                fill="#f3f4f6"
                opacity={animated ? 0.5 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.1}s"
              />
              <rect
                x={dot.cx - 10}
                y="58"
                width="20"
                height="8"
                rx="3"
                fill="#f9fafb"
                opacity={animated ? 0.4 : 0}
                style="transition: opacity 0.4s ease {dot.delay + 0.15}s"
              />
            {/each}
          </svg>
        {/if}
      {/if}
    </div>

    <!-- 텍스트 -->
    {#if mounted}
      <div class="text-center" in:fly={{ y: 10, duration: 400, delay: 300 }}>
        <p
          class="{isLg
            ? 'text-body-01-normal-medium'
            : 'text-body-02-normal-medium'} leading-snug text-gray-500 mb-1"
        >
          {message}
        </p>
        <p
          class="{isLg
            ? 'text-body-02-normal-regular'
            : 'text-body-03-normal-regular'} leading-snug text-gray-400"
        >
          {hint}
        </p>
      </div>
    {/if}
  </div>
</div>
