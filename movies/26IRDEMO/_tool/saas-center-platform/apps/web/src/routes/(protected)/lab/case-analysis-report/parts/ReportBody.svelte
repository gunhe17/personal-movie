<script lang="ts">
  // 리포트 본문 + 네 상태(미실행/분석 중/실패/완료).
  //
  // 완료 상태는 **프로덕션 컴포넌트를 그대로** 그린다(CaseAnalysisReport). 랩에서
  // 보이는 리포트 = 실제로 배포되는 리포트. 상태 화면만 랩이 흉내 내는데, 프로덕션은
  // 서버 status로 갈리고 랩은 스위치로 갈리기 때문이다.
  import Typography from '@common/components/Typography.svelte'
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import CaseAnalysisReport from '$lib/components/counseling/analysis/CaseAnalysisReport.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'
  import { RUN_STEPS } from '../mock'

  let {
    report,
    view,
    step = 0,
    onRun
  }: {
    report: CaseReportVM
    view: 'empty' | 'running' | 'failed' | 'done'
    step?: number
    onRun: () => void
  } = $props()
</script>

{#if view === 'empty'}
  <div
    class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <div
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-50"
    >
      <AiStarIcon20 />
    </div>
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      아직 경과 분석이 없어요
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-body-subtle">
      완료된 {report.coverage.completedSessions}개 회기의 상담일지를 묶어,
      상담이 어떻게 진행돼 왔는지<br />국면 · 주제 · 개입 효과 · 앞으로의
      방향으로 정리해요.
    </Typography>
    <button
      type="button"
      onclick={onRun}
      class="mt-2 h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
    >
      경과 분석 실행
    </button>
  </div>
{:else if view === 'running'}
  <div class="mx-auto flex w-full max-w-[560px] flex-col gap-6 p-6 py-10">
    <div class="text-center">
      <Typography variant="title-01-normal-semibold" color="text-title-default">
        경과 분석을 진행하고 있어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="mt-2 block"
      >
        보통 1~2분 걸려요.<br />화면을 벗어나도 분석은 계속됩니다.
      </Typography>
    </div>

    <ol class="flex flex-col gap-2">
      {#each RUN_STEPS as s, i}
        {@const state = i < step ? 'done' : i === step ? 'active' : 'todo'}
        <li
          class="flex gap-3 rounded-xl p-4 {state === 'active'
            ? 'bg-brand-subtle'
            : ''}"
        >
          <span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
            {#if state === 'done'}
              <span
                class="flex h-5 w-5 items-center justify-center rounded-full bg-status-success text-caption-01-normal-medium text-white"
                >✓</span
              >
            {:else if state === 'active'}
              <span
                class="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500"
              ></span>
            {:else}
              <span class="h-2 w-2 rounded-full bg-border-default"></span>
            {/if}
          </span>
          <div class="min-w-0">
            <p
              class="text-body-01-normal-medium {state === 'todo'
                ? 'text-caption-subtle'
                : 'text-body-strong'}"
            >
              {s.label}
            </p>
            {#if state === 'active'}
              <p class="mt-2 text-body-03-reading-regular text-body-subtle">
                {s.detail}
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  </div>
{:else if view === 'failed'}
  <div
    class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <Typography variant="title-01-normal-semibold" color="text-title-default">
      분석을 마치지 못했어요
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-body-subtle">
      일시적인 문제일 수 있어요. 크레딧은 차감되지 않았습니다.
    </Typography>
    <button
      type="button"
      onclick={onRun}
      class="mt-2 h-11 rounded-lg border border-transparent bg-white px-4 text-body-01-normal-medium text-body-default transition-colors hover:border-gray-200 hover:text-gray-800"
    >
      다시 시도
    </button>
  </div>
{:else}
  <CaseAnalysisReport {report} canRerun onRerun={onRun} />
{/if}
