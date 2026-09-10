<script lang="ts">
  // 자주 나온 이야기 — 카드 3장이 아니라 한 블록 안의 3열. 같은 질문의 세 답이라 묶여 있어야 한다.
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Evidence from './Evidence.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    onSelectSession
  }: { report: CaseReportVM; onSelectSession?: (session: number) => void } =
    $props()

  // 제목과 설명이 같은 말을 하고 있었다(지속 ↔ 계속 남아 있는 것) — 한 줄로 합쳤다.
  const groups = $derived([
    {
      title: '지속',
      color: 'gray' as const,
      list: report.themes.recurring
    },
    {
      title: '새로 등장',
      color: 'blue' as const,
      list: report.themes.emerging
    },
    {
      // '해소'가 아니라 '사라짐' — 일지에서 안 나온다는 **사실**만 말한다.
      // 회피해서 안 꺼내는 것과 풀려서 안 나오는 것이 기록상 똑같이 보이는데,
      // '해소'라고 쓰면 리포트가 둘 중 하나로 단정해 버린다.
      title: '사라짐',
      color: 'green' as const,
      list: report.themes.resolved
    }
  ])
</script>

<div
  class="grid divide-y divide-border-subtle lg:grid-cols-3 lg:divide-x lg:divide-y-0"
>
  {#each groups as g}
    <div class="min-w-0 px-5 py-4 first:pl-0 last:pr-0">
      <p class="text-body-02-normal-medium text-title-subtitle">{g.title}</p>
      <ul class="mt-3 flex flex-col gap-3">
        {#each g.list as t}
          <li>
            <div class="flex flex-wrap items-center gap-2">
              <BadgeRectangle label={t.name} color={g.color} />
              <Evidence
                sessions={t.sessions}
                label={null}
                onSelect={onSelectSession}
              />
            </div>
            {#if t.note}
              <p class="mt-2 text-body-03-reading-regular text-body-subtle">
                {t.note}
              </p>
            {/if}
          </li>
        {:else}
          <li class="text-body-02-normal-regular text-caption-subtle">
            없어요
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</div>
