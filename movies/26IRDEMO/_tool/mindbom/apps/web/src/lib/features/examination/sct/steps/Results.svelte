<script lang="ts">
  /**
   * 3. 결과 보기 — AI 채점 결과를 확인하고 확정한다.
   *
   * 응답 검토(2단계)는 Review.svelte로 분리했다. 예전에는 이 파일이
   * review/analyzing/results 세 phase를 다 처리했는데, 화면 내용이 완전히
   * 다른데 단계가 하나라 사이드바가 실제 흐름과 어긋났다.
   */
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { institutionId as institutionIdStore } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import DomainScoreChart from '$lib/features/examination/sct/components/DomainScoreChart.svelte'
  import DomainScoreTable from '$lib/features/examination/sct/components/DomainScoreTable.svelte'
  import ScoreRubricTooltip from '$lib/features/examination/sct/components/ScoreRubricTooltip.svelte'
  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import {
    isConfirmed,
    canDownloadReport as canDownloadReportFor
  } from '$lib/features/examination/core/status'
  import SCTResultsFooter from '$lib/features/examination/sct/components/SCTResultsFooter.svelte'
  import { getSCTResults } from '$lib/features/examination/sct/query-builders'
  import { createSCTService } from '$lib/features/examination/sct/sct-service'
  import type { SCTResultsResponse } from '$lib/features/examination/sct/types'

  let examId = $derived(page.params.examId ?? '')
  // store 구독(값 없으면 ''). 즉시 throw하던 requireInstitutionId 대신 —
  // iframe 임베드 시 store 준비 전 크래시를 막는다. 쿼리는 enabled로 가드됨.
  let institutionId = $derived($institutionIdStore ?? '')

  const queryClient = useQueryClient()
  let service = $derived(createSCTService({ queryClient, institutionId, examId }))

  const resultsQuery = createQuery<SCTResultsResponse>(() => ({
    queryKey: ['sctResults', examId, institutionId],
    queryFn: () => getSCTResults().request({ institutionId, examId }),
    enabled: Boolean(examId && institutionId)
  }))

  let isConfirming = $state(false)
  let isDownloadingPdf = $state(false)

  async function handleScoreEdit(stemId: number, newScore: number) {
    try {
      await service.handleUpdateScore(stemId, newScore)
    } catch {
      snackbarStore.error('점수 수정에 실패했습니다.')
    }
  }

  async function handleComplete() {
    if (isConfirming) return
    isConfirming = true
    try {
      await service.handleConfirm()
      // 확정으로 status가 바뀐다 — 사이드바 뱃지와 이탈 버튼이 이걸 본다.
      await layoutCtx.refreshExam()
    } catch {
      snackbarStore.error('확정에 실패했습니다.')
    } finally {
      isConfirming = false
    }
  }

  async function handleDownloadPdf() {
    if (isDownloadingPdf) return
    isDownloadingPdf = true
    try {
      await service.downloadReportPdf()
      snackbarStore.success('보고서가 다운로드되었습니다.')
    } catch {
      snackbarStore.error('보고서 생성에 실패했습니다.')
    } finally {
      isDownloadingPdf = false
    }
  }

  const layoutCtx = getExamContext()

  /**
   * 상태 판정은 core/status.ts 하나에서 가져온다.
   *
   * 예전에는 이 화면이 배열을 인라인으로 재구현하고(`['confirmed','report_generated']`)
   * 그 값을 isExamCompleted로 재사용했다. 그래서 completed(가장 끝난 상태)에서
   * PDF 버튼이 사라지고 '검사 확정' 버튼이 다시 뜨며, 헤더가 빨간 '검사 중단'으로
   * 되돌아갔다. "완료됐나"와 "PDF를 받을 수 있나"는 다른 질문이다.
   *
   * 출처도 layoutCtx.exam 하나로 모은다 — 예전에는 푸터가 resultsQuery.data.status,
   * 사이드바가 layoutCtx.exam.status를 봐서 확정 직후 둘이 갈렸다.
   */
  let isExamConfirmed = $derived(isConfirmed(layoutCtx.status))

  // 앞 단계는 컨텍스트가 모듈 선언에서 골라 준다 — 진입 가능할 때만 온다.
  let prev = $derived(layoutCtx.neighbors.prev)
  let canDownloadReport = $derived(canDownloadReportFor(layoutCtx.status))
</script>

{#snippet resultsBody()}
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
  >
    {#if resultsQuery.isLoading}
      <div class="flex flex-1 items-center justify-center text-sm text-gray-500">
        불러오는 중…
      </div>
    {:else if resultsQuery.isError}
      <div class="flex flex-1 items-center justify-center text-sm text-red-500">
        결과를 불러오지 못했습니다.
      </div>
    {:else if resultsQuery.data?.results}
      <div class="border-b border-gray-100 p-5">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold text-gray-900">SCT 채점 결과</h2>
          <ScoreRubricTooltip />
        </div>
        <p class="mt-1 text-sm text-gray-500">
          5개 영역 채점입니다. 점수를 클릭하여 임상심리사가 직접 수정할 수 있습니다.
        </p>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <DomainScoreChart scores={resultsQuery.data.results.scores} />
        <DomainScoreTable
          scores={resultsQuery.data.results.scores}
          onScoreChange={isExamConfirmed ? undefined : handleScoreEdit}
        />
      </div>
    {:else}
      <div class="flex flex-1 items-center justify-center text-sm text-gray-500">
        아직 결과 데이터가 없습니다.
      </div>
    {/if}
  </div>
{/snippet}

<!-- ?embed=1(리포트 모달 iframe) 처리는 셸이 한다 — 여기서 분기하지 않는다. -->
<ExamLayoutShell
  headerTitle="결과 보기"
  exitMode={isExamConfirmed ? 'leave' : 'cancel'}
  mainClass="p-6"
>
  {#snippet footer()}
    <SCTResultsFooter
      responseCount={resultsQuery.data?.results?.responses?.length ?? 0}
      statusText={isExamConfirmed ? '검사 완료' : '결과 확인'}
      {isConfirming}
      {isDownloadingPdf}
      {canDownloadReport}
      prevLabel={prev?.label}
      onPrev={prev ? () => layoutCtx.goTo(prev) : undefined}
      onConfirm={handleComplete}
      onDownloadPdf={handleDownloadPdf}
    />
  {/snippet}

  {@render resultsBody()}
</ExamLayoutShell>
