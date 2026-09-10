<script lang="ts">
  /**
   * 상담사별 사용 현황 리스트.
   * 카드 래퍼 없이 렌더링하므로 페이지에서 카드로 감싸야 함.
   */
  import type { MemberUsageSummary } from '../view-model'

  interface Props {
    items: MemberUsageSummary[]
  }

  let { items }: Props = $props()

  const AVATAR_COLORS = [
    { bg: 'bg-indigo-100', text: 'text-indigo-600', bar: '#818cf8' },
    { bg: 'bg-violet-100', text: 'text-violet-600', bar: '#a78bfa' },
    { bg: 'bg-purple-100', text: 'text-purple-600', bar: '#c4b5fd' }
  ] as const
</script>

{#if items.length > 0}
  <div class="space-y-3">
    {#each items as m, i}
      {@const ac = AVATAR_COLORS[i % AVATAR_COLORS.length]}
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {ac.bg}"
        >
          <span class="text-body-02-normal-semibold {ac.text}"
            >{m.memberName.charAt(0)}</span
          >
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline justify-between mb-1.5">
            <span class="text-body-02-normal-medium text-gray-800"
              >{m.memberName}</span
            >
            <span
              class="text-body-02-normal-medium tabular-nums text-gray-900 shrink-0 ml-2"
            >
              {m.totalCredits.toLocaleString()} 크레딧
            </span>
          </div>
          <div class="relative h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              style="width:{m.percentage}%;background:{ac.bar}"
            ></div>
          </div>
        </div>
        <span
          class="shrink-0 w-10 text-right text-body-03-normal-regular tabular-nums text-gray-400"
        >
          {m.percentage}%
        </span>
      </div>
    {/each}
  </div>
{:else}
  <div class="flex flex-col items-center py-8 text-center">
    <div
      class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 mb-3"
    >
      <svg
        class="h-6 w-6 text-gray-300"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
        />
      </svg>
    </div>
    <p class="text-body-02-normal-medium text-gray-500 mb-1">
      상담사별 사용 기록이 없어요
    </p>
    <p class="text-body-03-normal-regular text-gray-400">
      AI 기능을 사용하면 상담사별 사용 현황을 확인할 수 있습니다
    </p>
  </div>
{/if}
