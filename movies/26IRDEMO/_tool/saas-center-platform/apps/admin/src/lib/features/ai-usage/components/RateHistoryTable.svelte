<script lang="ts">
  import { fmtNum } from '../view-model'
  import { formatDate } from '$lib/utils/format'

  export interface RateHistoryItem {
    changed_at: string
    from_tokens_per_credit: number
    to_tokens_per_credit: number
    changed_by: string | null
    reason: string | null
  }

  interface Props {
    items: RateHistoryItem[]
    isLoading?: boolean
  }

  let { items, isLoading = false }: Props = $props()
</script>

<details class="group border-t border-gray-100">
  <summary
    class="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50"
  >
    <span class="text-body-03-normal-medium text-gray-400 group-hover:text-gray-600">비율 변경 이력</span>
    <svg
      class="h-4 w-4 text-gray-400 transition-transform duration-200 group-open:rotate-180"
      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  </summary>

  <div class="border-t border-gray-100">
    {#if isLoading}
      <div class="flex items-center justify-center py-8">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"></div>
      </div>
    {:else if items.length === 0}
      <div class="flex flex-col items-center justify-center gap-1 py-8 text-center">
        <p class="text-body-03-normal-regular text-gray-400">변경 이력이 없습니다</p>
      </div>
    {:else}
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/60">
            <th class="py-2.5 pl-5 text-left text-label-01-normal-medium text-gray-500">변경 일시</th>
            <th class="py-2.5 text-right text-label-01-normal-medium text-gray-500">변경 전</th>
            <th class="py-2.5 text-right text-label-01-normal-medium text-gray-500">변경 후</th>
            <th class="py-2.5 text-right text-label-01-normal-medium text-gray-500">변경자</th>
            <th class="py-2.5 pl-4 pr-5 text-left text-label-01-normal-medium text-gray-500">사유</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.changed_at)}
            <tr class="border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50/60">
              <td class="py-2.5 pl-5 tabular-nums text-body-03-normal-regular text-gray-600">
                {formatDate(item.changed_at, 'YYYY-MM-DD HH:mm')}
              </td>
              <td class="py-2.5 text-right tabular-nums text-body-03-normal-regular text-gray-400">
                {fmtNum(item.from_tokens_per_credit)}
              </td>
              <td class="py-2.5 text-right tabular-nums text-body-03-normal-semibold text-gray-700">
                {fmtNum(item.to_tokens_per_credit)}
              </td>
              <td class="py-2.5 text-right text-body-03-normal-regular text-gray-500">
                {item.changed_by ?? '-'}
              </td>
              <td class="py-2.5 pl-4 pr-5 text-body-03-normal-regular text-gray-500">
                {item.reason ?? '-'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</details>
