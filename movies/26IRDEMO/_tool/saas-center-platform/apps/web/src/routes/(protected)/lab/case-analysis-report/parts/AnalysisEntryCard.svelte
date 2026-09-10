<script lang="ts">
  // 경과 분석 진입 카드 (B안의 '문').
  //
  // 문은 목적지를 미리 말해야 눌린다 — 상태에 따라 다른 것을 보여준다:
  //   완료  → 결론 첫 줄 + 분석 시각 (읽을 게 있다는 신호)
  //   진행중 → 스피너 + 지금 돌고 있다는 사실
  //   미실행 → 무엇을 해주는지 한 줄 + 실행 유도
  // 케이스 화면에서 AI 신호(ai-50 면 + ai-500 라인)는 이 카드 하나뿐이다.
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    view,
    onOpen
  }: {
    report: CaseReportVM
    view: 'empty' | 'running' | 'failed' | 'done'
    onOpen: () => void
  } = $props()
</script>

<button
  type="button"
  onclick={onOpen}
  class="w-full rounded-xl border border-ai-500 bg-ai-50 p-4 text-left transition-colors hover:bg-ai-100"
>
  <div class="flex items-center gap-2">
    <AiStarIcon20 />
    <span class="text-body-02-normal-medium text-ai-500">AI 경과 분석</span>
    <span class="ml-auto text-body-02-normal-regular text-body-subtle">
      {#if view === 'done'}
        {report.coverage.completedSessions}회기 ›
      {:else}
        ›
      {/if}
    </span>
  </div>

  {#if view === 'done'}
    <p class="mt-2 line-clamp-2 text-body-02-reading-regular text-body-strong">
      {report.headline}
    </p>
    <p class="mt-2 text-body-03-normal-regular text-caption-subtle">
      {report.createdAt} 분석
    </p>
  {:else if view === 'running'}
    <p
      class="mt-2 flex items-center gap-2 text-body-02-normal-regular text-body-default"
    >
      <span
        class="h-4 w-4 animate-spin rounded-full border-2 border-ai-200 border-t-ai-500"
      ></span>
      분석 중이에요 · 보통 1~2분
    </p>
  {:else if view === 'failed'}
    <p class="mt-2 text-body-02-reading-regular text-body-default">
      지난 분석이 실패했어요. 다시 시도해 주세요.
    </p>
  {:else}
    <p class="mt-2 text-body-02-reading-regular text-body-default">
      완료 {report.coverage.completedSessions}회기의 일지를 묶어 경과 · 개입
      효과 · 다음 방향을 정리해요.
    </p>
  {/if}
</button>
