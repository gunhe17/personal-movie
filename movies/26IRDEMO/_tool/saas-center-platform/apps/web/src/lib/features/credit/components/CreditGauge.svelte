<script lang="ts">
  /**
   * AI 크레딧 게이지 — 3가지 모드.
   *
   * - sidebar: 사이드바 하단 (가장 자주 사용)
   * - compact: 헤더 인라인 (agent 채팅 헤더)
   * - icon: 사이드바 축소 시 아이콘만
   */
  import type { CreditVM } from '../view-model'
  import { GAUGE_COLORS } from '../constants'

  interface Props {
    credit: CreditVM
    mode?: 'sidebar' | 'compact' | 'icon'
  }

  let { credit, mode = 'sidebar' }: Props = $props()

  const scheme = $derived(GAUGE_COLORS[credit.gaugeColor])
  let barColor = $derived(scheme.bar)
  let textColor = $derived(scheme.text)
  let iconColor = $derived(scheme.icon)
  let usagePercent = $derived(credit.usagePercent)
</script>

{#if mode === 'icon'}
  <!-- 아이콘 모드: 사이드바 축소 시 -->
  <div
    class="flex items-center justify-center"
    title="AI 크레딧 {credit.used}/{credit.limit}"
  >
    <div class="relative">
      <svg
        class="h-5 w-5 {iconColor}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      {#if credit.isExhausted}
        <span
          class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500"
        ></span>
      {/if}
    </div>
  </div>
{:else if mode === 'compact'}
  <!-- 컴팩트 모드: 헤더 인라인 -->
  <div
    class="flex items-center gap-2 text-label-02-normal-regular text-gray-500"
  >
    <svg
      class="h-3.5 w-3.5 {iconColor} shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
    <div
      class="h-1.5 rounded-full bg-gray-100 overflow-hidden min-w-[48px] max-w-[80px] flex-1"
    >
      <div
        class="h-full rounded-full transition-all duration-500 {barColor}"
        style="width: {usagePercent}%"
      ></div>
    </div>
    <span class="text-gray-400 tabular-nums text-label-02-normal-regular">
      {credit.used}
    </span>
  </div>
{:else}
  <!-- 사이드바 모드: 미니멀 카드 -->
  <div class="px-3 py-2">
    <div class="rounded-lg bg-gray-50 px-3 py-2.5">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <svg
            class="h-3.5 w-3.5 {iconColor} shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span class="text-label-02-normal-medium text-gray-600"
            >AI 크레딧</span
          >
        </div>
        <span class="text-label-02-normal-regular tabular-nums {textColor}">
          {credit.used}<span class="text-gray-300">/{credit.limit}</span>
        </span>
      </div>
      <div class="h-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 {barColor}"
          style="width: {usagePercent}%"
        ></div>
      </div>
      {#if credit.isExhausted}
        <p class="text-label-02-normal-regular text-status-danger mt-1.5">
          크레딧 소진
        </p>
      {/if}
    </div>
  </div>
{/if}
