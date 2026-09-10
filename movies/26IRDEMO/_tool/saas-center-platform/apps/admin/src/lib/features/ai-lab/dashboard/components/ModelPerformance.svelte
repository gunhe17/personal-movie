<script lang="ts">
  import type { ExperimentTypeGroupVM } from '../view-model'

  let { groups = [] }: { groups: ExperimentTypeGroupVM[] } = $props()
</script>

<section class="section-border p-5">
  <h3 class="text-body-03-normal-semibold text-gray-900">모델별 성능 비교</h3>
  <p class="mt-0.5 text-label-01-normal-regular text-gray-400">같은 작업 유형 안에서 모델 성능을 비교합니다</p>

  {#if groups.length === 0}
    <div class="mt-6 flex flex-col items-center gap-2 pb-4">
      <p class="text-body-03-normal-regular text-gray-400">비교할 데이터가 없습니다</p>
      <a href="/ai-lab/lab" class="text-label-01-normal-medium text-primary-500 transition-colors hover:text-primary-600">실험실에서 모델별 성능을 비교해보세요 →</a>
    </div>
  {:else}
    <div class="mt-3 space-y-4">
      {#each groups as group}
        <div>
          <!-- 작업 유형 헤더 -->
          <div class="flex items-center gap-2 mb-2">
            <span class="text-label-01-normal-bold text-gray-500">{group.typeLabel}</span>
            {#if !group.hasMultipleModels}
              <span class="rounded-full bg-gray-100 px-2 py-0.5 text-caption-01-normal-regular text-gray-400">단일 모델</span>
            {/if}
          </div>

          <!-- 모델별 카드 -->
          <div class="space-y-1.5">
            {#each group.models as row}
              <div class="rounded-lg border border-gray-100 px-3 py-2.5 {row.insufficientData ? 'opacity-60' : ''}">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-label-01-normal-medium text-gray-600">{row.modelName}</span>
                    {#if row.insufficientData}
                      <span class="rounded-full bg-amber-50 px-1.5 py-0.5 text-caption-01-normal-regular text-amber-500">데이터 부족</span>
                    {/if}
                  </div>
                  <span class="text-label-01-normal-regular text-gray-400">{row.totalRuns}회</span>
                </div>

                <div class="grid grid-cols-4 gap-2">
                  <div>
                    <p class="text-label-02-normal-regular text-gray-400">응답 속도</p>
                    <p class="mt-0.5 text-body-03-normal-semibold tabular-nums {row.isBestLatency ? 'text-emerald-600' : 'text-gray-700'}">
                      {row.avgLatency}
                    </p>
                  </div>
                  <div>
                    <p class="text-label-02-normal-regular text-gray-400">건당 비용</p>
                    <p class="mt-0.5 text-body-03-normal-semibold tabular-nums {row.isBestCost ? 'text-emerald-600' : 'text-gray-700'}">
                      {row.costPerRun}
                    </p>
                  </div>
                  <div>
                    <p class="text-label-02-normal-regular text-gray-400">품질</p>
                    <p class="mt-0.5 text-body-03-normal-semibold tabular-nums {row.isBestQuality ? 'text-emerald-600' : 'text-gray-700'}">
                      {#if row.hasQuality}
                        ★{row.avgQuality}
                      {:else}
                        <span class="text-gray-300">미평가</span>
                      {/if}
                    </p>
                  </div>
                  <div>
                    <p class="text-label-02-normal-regular text-gray-400">성공률</p>
                    <p class="mt-0.5 text-body-03-normal-semibold tabular-nums text-gray-700">
                      {row.successRate}
                    </p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
