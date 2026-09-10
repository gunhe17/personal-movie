<script lang="ts">
  // 좌측 케이스 정보 패널(목업) — 두 진입 구조가 공유한다.
  // B안에서는 이 패널 하단에 경과 분석 진입 카드가 들어간다(children).
  import type { Snippet } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let { report, children }: { report: CaseReportVM; children?: Snippet } =
    $props()
</script>

<div
  class="hidden w-[var(--spacing-detail-side)] shrink-0 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 xl:flex"
>
  <div class="mb-4 flex h-6 items-center">
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      상담 정보
    </Typography>
  </div>
  <div class="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
    {#each [['프로그램', '청소년 개인상담'], ['담당 상담사', '이서진'], ['기간', report.period], ['주호소', '시험 불안 · 등교 거부']] as [label, value]}
      <span class="text-body-01-normal-regular text-label-default">{label}</span
      >
      <span class="text-body-01-normal-regular text-body-strong">{value}</span>
    {/each}
  </div>

  <div class="my-7 h-px bg-border-default"></div>

  <div class="mb-4 flex h-6 items-center gap-1">
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      내담자
    </Typography>
    <Typography variant="body-03-normal-regular" color="text-title-subtitle"
      >1</Typography
    >
  </div>
  <div
    class="flex h-18 items-center gap-3 rounded-xl border border-gray-200 p-4"
  >
    <div class="h-10 w-10 shrink-0 rounded-full bg-gray-100"></div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-body-01-normal-semibold text-body-strong">
        {report.clientNames[0] ?? '내담자'}
      </p>
      <p class="mt-2 text-body-02-normal-regular text-body-subtle">
        2012.05.02 · 여
      </p>
    </div>
    <span class="shrink-0 text-body-03-normal-regular text-body-default">
      {report.coverage.completedSessions}/{report.planned}회
    </span>
  </div>

  {#if children}
    <div class="my-7 h-px bg-border-default"></div>
    {@render children()}
  {/if}
</div>
