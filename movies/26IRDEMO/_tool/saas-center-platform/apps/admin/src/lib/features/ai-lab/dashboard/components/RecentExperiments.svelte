<script lang="ts">
  import type { ExperimentVM } from '../view-model'

  let {
    experiments = [],
  }: {
    experiments: ExperimentVM[]
  } = $props()

  const STATUS_COLORS: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-100 text-gray-500',
  }
</script>

<section class="section-border p-5">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-body-03-normal-semibold text-gray-900">최근 실험</h3>
      <p class="mt-0.5 text-label-01-normal-regular text-gray-400">최근 실행된 실험 5건</p>
    </div>
    <a href="/ai-lab/lab" class="text-label-01-normal-medium text-primary-600 transition-colors hover:text-primary-700">
      전체 보기 →
    </a>
  </div>

  {#if experiments.length === 0}
    <div class="mt-6 flex flex-col items-center gap-2 pb-4">
      <p class="text-body-03-normal-regular text-gray-400">실험 이력이 없습니다</p>
      <a href="/ai-lab/lab" class="text-label-01-normal-medium text-primary-500 transition-colors hover:text-primary-600">실험실에서 첫 실험 실행하기 →</a>
    </div>
  {:else}
    <div class="mt-3 space-y-2">
      {#each experiments as exp}
        <div class="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
          <div class="flex items-center gap-3">
            <span class="rounded-full px-2.5 py-1 text-label-01-normal-medium {STATUS_COLORS[exp.statusColor] ?? STATUS_COLORS.gray}">
              {exp.statusLabel}
            </span>
            <div>
              <p class="text-body-03-normal-medium text-gray-700">{exp.typeLabel}</p>
              <p class="text-label-01-normal-regular text-gray-400">
                <span class="font-mono">{exp.modelName}</span>
                · {exp.createdAt}
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-body-03-normal-semibold tabular-nums text-gray-700">{exp.cost}</p>
            <p class="text-label-01-normal-regular tabular-nums text-gray-400">{exp.latency}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
