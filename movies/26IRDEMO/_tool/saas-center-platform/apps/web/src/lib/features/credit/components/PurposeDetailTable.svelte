<script lang="ts">
  import type { PurposeUsageItem } from '../view-model'
  import { PURPOSE_COLORS, DEFAULT_PURPOSE_COLOR } from '../constants'

  interface Props {
    items: PurposeUsageItem[]
  }

  let { items }: Props = $props()

  const totalCredits = $derived(items.reduce((s, p) => s + p.credits, 0))
  const totalCalls = $derived(items.reduce((s, p) => s + p.calls, 0))

  function colorOf(purpose: string): string {
    return (PURPOSE_COLORS[purpose] ?? DEFAULT_PURPOSE_COLOR).hex
  }

  function pct(val: number, total: number): number {
    return total > 0 ? Math.round((val / total) * 100) : 0
  }
</script>

{#if items.length > 0}
  <div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
    <h2 class="text-title-01-normal-semibold text-gray-900 mb-1">
      기능별 상세
    </h2>
    <p class="text-body-03-normal-regular text-gray-400 mb-4">
      기능별 크레딧 · 호출 수
    </p>

    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-100">
          <th
            class="text-left text-body-03-normal-medium text-gray-400 pb-2.5 font-normal"
            >기능</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2.5 font-normal"
            >크레딧</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2.5 font-normal"
            >호출</th
          >
          <th
            class="text-right text-body-03-normal-medium text-gray-400 pb-2.5 font-normal"
            >비중</th
          >
        </tr>
      </thead>
      <tbody>
        {#each items as item}
          <tr class="border-b border-gray-50 last:border-0">
            <td class="py-3">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-2 w-2 rounded-full shrink-0"
                  style="background: {colorOf(item.purpose)}"
                ></span>
                <span class="text-body-02-normal-medium text-gray-700"
                  >{item.label}</span
                >
              </div>
            </td>
            <td
              class="text-right py-3 text-body-02-normal-medium tabular-nums text-gray-900"
              >{item.credits.toLocaleString()}</td
            >
            <td
              class="text-right py-3 text-body-02-normal-regular tabular-nums text-gray-500"
              >{item.calls.toLocaleString()}</td
            >
            <td
              class="text-right py-3 text-body-02-normal-regular tabular-nums text-gray-500"
              >{pct(item.credits, totalCredits)}%</td
            >
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="border-t border-gray-100">
          <td class="pt-3 text-body-02-normal-medium text-gray-500">합계</td>
          <td
            class="text-right pt-3 text-body-02-normal-semibold tabular-nums text-gray-900"
            >{totalCredits.toLocaleString()}</td
          >
          <td
            class="text-right pt-3 text-body-02-normal-medium tabular-nums text-gray-500"
            >{totalCalls.toLocaleString()}</td
          >
          <td
            class="text-right pt-3 text-body-02-normal-regular tabular-nums text-gray-500"
            >100%</td
          >
        </tr>
      </tfoot>
    </table>
  </div>
{/if}
