<script lang="ts">
  // 앞으로 — 리포트에서 유일하게 행동을 요구하는 블록이라 끝에 둔다.
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let { report }: { report: CaseReportVM } = $props()
  const d = $derived(report.direction)
</script>

<div class="flex flex-col">
  {#if d.goals.length > 0 || d.approaches.length > 0}
    <div
      class="grid divide-y divide-border-subtle lg:grid-cols-2 lg:divide-x lg:divide-y-0"
    >
      <div class="px-5 py-4 first:pl-0">
        <p class="text-body-02-normal-medium text-title-subtitle">
          다음 회기에 할 일
        </p>
        <ul class="mt-3 flex flex-col gap-3">
          {#each d.goals as g, i}
            <li class="flex gap-3">
              <span
                class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary-100 text-label-01-normal-medium text-primary-500"
              >
                {i + 1}
              </span>
              <span class="text-body-02-reading-regular text-body-strong"
                >{g}</span
              >
            </li>
          {:else}
            <li class="text-body-02-normal-regular text-caption-subtle">
              적어둘 만한 게 없었어요
            </li>
          {/each}
        </ul>
      </div>
      <div class="px-5 py-4 last:pr-0">
        <p class="text-body-02-normal-medium text-title-subtitle">
          해볼 만한 개입 기법
        </p>
        <ul class="mt-3 flex flex-col gap-3">
          {#each d.approaches as a}
            <li class="flex gap-3">
              <span
                class="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400"
              ></span>
              <span class="text-body-02-reading-regular text-body-strong"
                >{a}</span
              >
            </li>
          {:else}
            <li class="text-body-02-normal-regular text-caption-subtle">
              적어둘 만한 게 없었어요
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}

  {#if d.closing}
    <div class="border-t border-border-subtle px-5 py-4 first:border-t-0">
      <p class="text-body-02-normal-medium text-title-subtitle">
        종결할지, 더 이어갈지
      </p>
      <p class="mt-2 text-body-01-reading-regular text-body-strong">
        {d.closing}
      </p>
    </div>
  {/if}

  {#if d.supervision.length > 0}
    <div class="border-t border-border-subtle px-5 py-4">
      <p class="text-body-02-normal-medium text-title-subtitle">
        슈퍼비전에서 나눠볼 질문
      </p>
      <ul class="mt-3 flex flex-col gap-2">
        {#each d.supervision as q}
          <li class="text-body-02-reading-regular text-body-default">— {q}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
