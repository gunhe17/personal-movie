<script lang="ts">
  /**
   * 2. 응답 검토 — 내담자 응답을 확인·수정하고 AI 분석을 실행한다.
   *
   * 예전에는 Results.svelte 하나가 review/analyzing/results 세 phase를 다
   * 처리했다. 화면 내용이 완전히 다른데(표 편집 vs 점수 카드) 단계는 하나라,
   * 사이드바가 실제 흐름과 어긋나 3단계를 하드코딩하는 우회가 생겼었다.
   * 단계와 화면을 1:1로 맞춘다.
   */
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { institutionId as institutionIdStore } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import ResponseReviewTable from '$lib/features/examination/sct/components/ResponseReviewTable.svelte'
  import SCTAnalyzingSpinner from '$lib/features/examination/sct/components/SCTAnalyzingSpinner.svelte'
  import SCTReviewFooter from '$lib/features/examination/sct/components/SCTReviewFooter.svelte'
  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import { isConfirmed } from '$lib/features/examination/core/status'
  import {
    getSCTResults,
    getSCTStems
  } from '$lib/features/examination/sct/query-builders'
  import { createSCTService } from '$lib/features/examination/sct/sct-service'
  import type {
    SCTResultsResponse,
    SCTStemListResponse
  } from '$lib/features/examination/sct/types'

  let examId = $derived(page.params.examId ?? '')
  // store 구독(값 없으면 ''). 새로고침 직후엔 institutionStore가 아직 hydrate되기
  // 전이라 requireInstitutionId를 렌더 중에 부르면 화면이 깨진다.
  let institutionId = $derived($institutionIdStore ?? '')

  const queryClient = useQueryClient()
  let service = $derived(createSCTService({ queryClient, institutionId, examId }))
  const layoutCtx = getExamContext()

  const stemsQuery = createQuery<SCTStemListResponse>(() => ({
    queryKey: ['sctStems', examId, institutionId],
    queryFn: () => getSCTStems().request({ institutionId, examId }),
    enabled: Boolean(examId && institutionId),
    staleTime: Infinity
  }))

  const resultsQuery = createQuery<SCTResultsResponse>(() => ({
    queryKey: ['sctResults', examId, institutionId],
    queryFn: () => getSCTResults().request({ institutionId, examId }),
    enabled: Boolean(examId && institutionId)
  }))

  let isAnalyzing = $state(false)

  /**
   * 확정 이후에는 조회만 — 응답 수정도 재분석도 막는다.
   * 확정본과 화면이 달라지면 이미 발행한 보고서와 어긋난다(SaMD 무결성).
   * 판정은 core/status.ts 하나에서 가져온다 — 화면마다 배열을 다시 적으면
   * 기준이 갈린다.
   */
  let isReadOnly = $derived(isConfirmed(layoutCtx.status))

  // 앞뒤 단계는 컨텍스트가 모듈 선언에서 골라 준다 — 진입 가능한 것만 온다.
  // 화면이 경로를 직접 적으면 모듈에서 단계가 바뀔 때 조용히 어긋난다.
  let prev = $derived(layoutCtx.neighbors.prev)
  let next = $derived(layoutCtx.neighbors.next)

  async function handleStartAnalysis() {
    if (isAnalyzing) return
    // 채점은 동기 요청이라 응답이 오면 이미 끝난 상태다.
    isAnalyzing = true
    // 사이드바 활성 단계 뱃지를 'AI 분석 중'으로 — 예전에는 여기서 layoutCtx.steps를
    // 손으로 map해 갈아끼웠다. 계약에 자리가 생겨 컨텍스트에 알리기만 하면 된다.
    layoutCtx.setBusy('AI 분석 중')
    try {
      await service.handleScore()
    } catch {
      snackbarStore.error('AI 분석을 시작하지 못했습니다.')
      isAnalyzing = false
      layoutCtx.setBusy(null)
      return
    }
    // 분석이 끝나면 결과 단계가 열린다 — 컨텍스트를 갱신해야 사이드바 잠금이 풀린다.
    await layoutCtx.refreshExam()
    isAnalyzing = false
    layoutCtx.setBusy(null)
    goto(`/examinations/${examId}/results`)
  }

  /**
   * 응답 검토 단계에서 임상심리사가 응답을 직접 고친다.
   *
   * 저장 API(PUT /responses)는 응답 목록을 통째로 갈아끼우므로, 고친 문항
   * 하나만 보내면 나머지 응답이 전부 지워진다. 전체 목록에 병합해서 보낸다.
   * answeredAt은 원본을 유지한다 — 내담자가 답한 시각이지 수정한 시각이 아니다.
   */
  async function handleResponseEdit(
    stemId: number,
    patch: { answer: string; reason?: string | null }
  ) {
    const current = resultsQuery.data?.results?.responses ?? []
    const exists = current.some((r) => r.stemId === stemId)
    // 미응답 문항은 목록에 아예 없을 수 있다 — 그때는 새 항목으로 추가한다
    const merged = exists
      ? current.map((r) => (r.stemId === stemId ? { ...r, ...patch } : r))
      : [...current, { stemId, ...patch }]

    try {
      await service.handleSaveResponses(merged)
    } catch {
      snackbarStore.error('응답 수정에 실패했습니다.')
      throw new Error('save failed')
    }
  }
</script>

<ExamLayoutShell
  headerTitle="응답 검토"
  headerSubtitle={isReadOnly
    ? '확정된 검사입니다. 읽기 전용으로 표시됩니다.'
    : undefined}
  exitMode={isReadOnly ? 'leave' : 'cancel'}
  mainClass="p-6"
>
  {#snippet footer()}
    <SCTReviewFooter
      responseCount={resultsQuery.data?.results?.responses?.length ?? 0}
      {isAnalyzing}
      {isReadOnly}
      prevLabel={prev?.label}
      onPrev={prev ? () => layoutCtx.goTo(prev) : undefined}
      nextLabel={next?.label}
      onNext={next ? () => layoutCtx.goTo(next) : undefined}
      onStartAnalysis={handleStartAnalysis}
    />
  {/snippet}

  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
  >
    {#if resultsQuery.isLoading || stemsQuery.isLoading}
      <div class="flex flex-1 items-center justify-center text-sm text-gray-500">
        불러오는 중…
      </div>
    {:else if resultsQuery.isError}
      <div class="flex flex-1 items-center justify-center text-sm text-red-500">
        결과를 불러오지 못했습니다.
      </div>
    {:else if isAnalyzing}
      <SCTAnalyzingSpinner />
    {:else}
      <div class="border-b border-gray-100 p-5">
        <h2 class="text-base font-semibold text-gray-900">응답 검토</h2>
        <p class="mt-1 text-sm text-gray-500">
          {#if isReadOnly}
            확정된 검사입니다. 응답은 조회만 가능합니다.
          {:else}
            내담자가 작성한 응답을 검토한 뒤 AI 분석을 실행하세요. 응답을
            클릭하면 직접 수정할 수 있습니다.
          {/if}
        </p>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <!-- 확정 후에는 onResponseChange를 넘기지 않는다 = 읽기 전용 -->
        <ResponseReviewTable
          responses={resultsQuery.data?.results?.responses ?? []}
          stems={stemsQuery.data?.stems ?? []}
          onResponseChange={isReadOnly ? undefined : handleResponseEdit}
        />
      </div>
    {/if}
  </div>
</ExamLayoutShell>
