<script lang="ts">
  import type { CostBreakdownVM } from '../view-model'

  let { data }: { data: CostBreakdownVM } = $props()
</script>

<div class="section-border p-5">
  <div class="mb-1">
    <div class="flex items-center justify-between">
      <h3 class="text-body-03-normal-semibold text-gray-900">{data.title}</h3>
      <span class="text-title-01-normal-bold tabular-nums text-gray-900">{data.totalCostKrw}</span>
    </div>
    <div class="flex items-center justify-between mt-0.5">
      <p class="text-label-01-normal-regular text-gray-400">{data.description}</p>
      <span class="text-label-01-normal-regular tabular-nums text-gray-400">
        {data.totalCost} · {data.totalCount.toLocaleString()}{data.countLabel}
      </span>
    </div>
  </div>

  {#if data.items.length === 0}
    <div class="mt-6 flex flex-col items-center gap-2 pb-2">
      <p class="text-body-03-normal-regular text-gray-400">{data.emptyMessage || '데이터 없음'}</p>
      {#if data.emptyLink}
        <a href={data.emptyLink.href} class="text-label-01-normal-medium text-primary-500 transition-colors hover:text-primary-600">{data.emptyLink.label}</a>
      {/if}
    </div>
  {:else}
    <div class="mt-4 space-y-3.5">
      {#each data.items as item}
        <div>
          <!-- 라벨 + 비용 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-body-03-normal-medium text-gray-700">{item.label}</span>
              {#if item.model}
                <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular font-mono text-gray-500">{item.model}</span>
              {/if}
            </div>
            <div class="text-right">
              <span class="text-body-03-normal-semibold tabular-nums text-gray-900">{item.costKrw}</span>
            </div>
          </div>
          <!-- 바 -->
          <div class="relative mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              class="h-full rounded-full bg-primary-500 transition-all duration-500"
              style="width: {item.percentage}%"
            ></div>
          </div>
          <!-- 하단 메타 -->
          <div class="mt-1 flex items-center justify-between text-label-01-normal-regular text-gray-400">
            <span>{item.extraLabel} · {item.cost}</span>
            <div class="flex items-center gap-2">
              {#if item.labLink}
                <a href={item.labLink} class="text-label-01-normal-medium text-primary-500 transition-colors hover:text-primary-600">실험실 →</a>
              {/if}
              <span class="text-label-01-normal-medium tabular-nums">{item.percentage}%</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
