<script lang="ts">
  import type { SCTDomainScore } from '../types'
  import { DOMAIN_COLORS } from '../constants'

  interface Props {
    scores: SCTDomainScore[]
  }

  let { scores }: Props = $props()
</script>

<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
  {#each scores as score (score.domain)}
    {@const colors = DOMAIN_COLORS[score.domain]}
    {@const percent = score.maxScore > 0 ? Math.round((score.totalScore / score.maxScore) * 100) : 0}
    <div class="rounded-xl border {colors.border} {colors.bg} p-4">
      <div class="text-xs font-medium {colors.text}">{score.domain}</div>
      <div class="mt-0.5 text-xs text-gray-600">{score.domainLabel}</div>
      <div class="mt-3 text-2xl font-bold text-gray-900">
        {score.totalScore}
        <span class="text-sm font-normal text-gray-400">/ {score.maxScore}</span>
      </div>
      <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div
          class="h-full rounded-full"
          style="width: {percent}%; background-color: {colors.hex}"
        ></div>
      </div>
    </div>
  {/each}
</div>
