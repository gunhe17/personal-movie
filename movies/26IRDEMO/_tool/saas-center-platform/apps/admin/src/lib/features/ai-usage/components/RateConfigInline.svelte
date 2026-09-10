<script lang="ts">
  import type { CreditRateConfigResponse } from '$hooks/actions/ai-usage.action'
  import { fmtNum } from '../view-model'

  interface Props {
    rateConfig: CreditRateConfigResponse | null | undefined
    onChangeRate: () => void
  }

  let { rateConfig, onChangeRate }: Props = $props()
</script>

<div class="flex items-center gap-2">
  <span class="text-body-03-normal-regular text-gray-500">
    {#if rateConfig}
      <span class="text-body-03-normal-semibold tabular-nums text-gray-700">{fmtNum(rateConfig.tokens_per_credit)}</span>
      <span class="ml-0.5 text-label-02-normal-regular text-gray-400">t/c</span>
    {:else}
      <span class="text-label-01-normal-regular text-gray-400">비율 미설정</span>
    {/if}
  </span>
  <button
    class="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-label-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
    onclick={onChangeRate}
  >
    변경
  </button>
</div>
