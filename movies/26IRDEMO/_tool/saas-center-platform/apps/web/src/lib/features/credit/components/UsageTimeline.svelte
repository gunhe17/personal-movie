<script lang="ts">
  import type { CreditHistoryItem } from '$lib/hooks/actions/credit.action'
  import { mapToHistoryTableItems } from '../view-model'
  import { PURPOSE_COLORS, DEFAULT_PURPOSE_COLOR } from '../constants'

  interface Props {
    items: CreditHistoryItem[]
  }

  let { items }: Props = $props()

  function colorOf(purpose: string): string {
    return (PURPOSE_COLORS[purpose] ?? DEFAULT_PURPOSE_COLOR).hex
  }

  // 점진적 로드: 초기 10건, 더 보기 클릭 시 20건씩 추가
  const INITIAL_COUNT = 10
  const LOAD_MORE_COUNT = 20
  let visibleCount = $state(INITIAL_COUNT)

  // items가 바뀌면 리셋
  $effect(() => {
    items
    visibleCount = INITIAL_COUNT
  })

  const allTableItems = $derived(mapToHistoryTableItems(items))
  const visibleItems = $derived(allTableItems.slice(0, visibleCount))
  const hasMore = $derived(visibleCount < allTableItems.length)
  const remainingCount = $derived(allTableItems.length - visibleCount)

  function loadMore() {
    visibleCount = Math.min(
      visibleCount + LOAD_MORE_COUNT,
      allTableItems.length
    )
  }
</script>

<div class="rounded-lg border border-gray-200 bg-white px-6 py-5">
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-title-01-normal-semibold text-gray-800">사용 기록</h2>
    {#if allTableItems.length > 0}
      <span class="text-body-03-normal-regular text-gray-400"
        >총 {allTableItems.length}건</span
      >
    {/if}
  </div>

  {#if visibleItems.length > 0}
    <div
      class={visibleCount > INITIAL_COUNT
        ? 'max-h-[520px] overflow-y-auto pr-2'
        : ''}
    >
      <table class="w-full">
        <thead
          class={visibleCount > INITIAL_COUNT
            ? 'sticky top-0 bg-white z-10'
            : ''}
        >
          <tr class="border-b border-gray-200">
            <th
              class="text-left text-body-02-normal-medium text-gray-600 pb-2.5 font-normal"
              >기능</th
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
          {#each visibleItems as item, i}
            {#if item.isFirstOfDate && i > 0}
              <tr>
                <td colspan="3" class="py-0.5">
                  <div class="border-t border-gray-100"></div>
                </td>
              </tr>
            {/if}
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="py-2">
                <div class="flex items-center gap-2">
                  <span
                    class="inline-block h-2 w-2 rounded-full shrink-0"
                    style="background: {colorOf(item.purpose)}"
                  ></span>
                  <div class="min-w-0">
                    <span class="text-body-02-normal-medium text-gray-800"
                      >{item.purposeLabel}</span
                    >
                    {#if item.memberName}
                      <span
                        class="text-body-03-normal-regular text-gray-400 ml-1.5"
                        >{item.memberName}</span
                      >
                    {/if}
                  </div>
                </div>
              </td>
              <td class="py-2">
                <span class="text-body-02-normal-regular text-gray-500"
                  >{item.dateLabel}</span
                >
                <span
                  class="text-body-02-normal-regular tabular-nums text-gray-400 ml-1"
                  >{item.time}</span
                >
              </td>
              <td class="py-2 text-right">
                <span
                  class="text-body-02-normal-medium tabular-nums text-gray-900"
                  >{item.credits}</span
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if hasMore}
      <button
        class="mt-3 w-full rounded-lg border border-gray-200 py-2 text-body-02-normal-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        onclick={loadMore}
      >
        더 보기 ({remainingCount}건)
      </button>
    {/if}
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
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>
      <p class="text-body-02-normal-medium text-gray-500 mb-1">
        아직 사용 기록이 없어요
      </p>
      <p class="text-body-03-normal-regular text-gray-400">
        AI 기능을 사용하면 여기에 기록이 표시됩니다
      </p>
    </div>
  {/if}
</div>
