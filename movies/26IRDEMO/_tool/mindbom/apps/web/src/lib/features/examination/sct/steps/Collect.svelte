<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { createExamExit } from '$lib/features/examination/core/exam-exit.svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { institutionId as institutionIdStore } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'
  import StemCard from '$lib/features/examination/sct/components/StemCard.svelte'
  import ProgressBar from '$lib/features/examination/sct/components/ProgressBar.svelte'
  import SCTFooter from '$lib/features/examination/sct/components/SCTFooter.svelte'
  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import { getSCTStems, getSCTResults } from '$lib/features/examination/sct/query-builders'
  import { createSCTService } from '$lib/features/examination/sct/sct-service'
  import { createSCTTest, type SCTTest } from '$lib/features/examination/sct/hooks.svelte'
  import type {
    SCTStemListResponse,
    SCTResultsResponse
  } from '$lib/features/examination/sct/types'
  import type { ExamStatus } from '$lib/features/examination/common/constants'

  let examId = $derived(page.params.examId ?? '')
  // store 구독(값 없으면 ''). 새로고침 직후에는 institutionStore가 아직 hydrate되기
  // 전이라, 즉시 throw하는 requireInstitutionId를 렌더 중에 부르면 화면이 깨진다.
  // 쿼리는 enabled로 가드되므로 값이 들어오면 그때 실행된다. (Results.svelte와 동일)
  let institutionId = $derived($institutionIdStore ?? '')

  const queryClient = useQueryClient()

  const stemsQuery = createQuery<SCTStemListResponse>(() => ({
    queryKey: ['sctStems', examId, institutionId],
    queryFn: () => getSCTStems().request({ institutionId, examId }),
    enabled: Boolean(examId && institutionId),
    staleTime: Infinity
  }))

  // 서버에 저장된 응답 — 응답 검토 화면에서 고친 내용이 여기 담긴다.
  // localStorage만 복원하면 그 수정이 반영되지 않는다.
  const resultsQuery = createQuery<SCTResultsResponse>(() => ({
    queryKey: ['sctResults', examId, institutionId],
    queryFn: () => getSCTResults().request({ institutionId, examId }),
    enabled: Boolean(examId && institutionId)
  }))

  const layoutCtx = getExamContext()
  /** 나갈 때 보던 목록 페이지·필터로 돌아가기 위한 주소 */
  const exit = createExamExit()

  let test: SCTTest | null = $state(null)
  let isSubmitting = $state(false)

  // stems 로드 후 1회만 SCT 인스턴스 생성 + storage 복원
  $effect(() => {
    const stems = stemsQuery.data?.stems
    if (stems && stems.length > 0 && !test) {
      const instance = createSCTTest(examId, stems)
      instance.load()
      test = instance
    }
  })

  // 서버 응답이 도착하면 로컬 상태를 맞춘다(서버 우선).
  // 자동저장이 옛 로컬 값으로 서버를 덮어쓰기 전에 반영돼야 한다.
  let syncedFromServer = false
  $effect(() => {
    const serverResponses = resultsQuery.data?.results?.responses
    if (!test || syncedFromServer || !serverResponses) return
    syncedFromServer = true
    test.syncFromServer(serverResponses)
  })

  let service = $derived(createSCTService({ queryClient, institutionId, examId }))

  // 서버 자동저장 (debounced) — localStorage는 즉시, 서버는 1.5초 디바운스
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let isAutoSaving = $state(false)
  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let savedHideTimer: ReturnType<typeof setTimeout> | null = null

  async function flushAutoSave() {
    if (!test || isAutoSaving) return
    if (test.responses.length === 0) return
    isAutoSaving = true
    saveStatus = 'saving'
    try {
      await service.handleSaveResponses(test.responses)
      saveStatus = 'saved'
      // 첫 저장은 created → in_progress 전이를 일으킨다. 컨텍스트를 갱신해야
      // 사이드바의 '응답 검토' 잠금이 풀린다.
      if (layoutCtx.exam?.status === 'created') {
        void layoutCtx.refreshExam()
      }
      if (savedHideTimer) clearTimeout(savedHideTimer)
      savedHideTimer = setTimeout(() => { saveStatus = 'idle' }, 2000)
    } catch {
      // localStorage가 백업 — 5초 후 자동 재시도
      saveStatus = 'error'
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(() => flushAutoSave(), 5000)
    } finally {
      isAutoSaving = false
    }
  }

  function scheduleAutoSave(delayMs = 1500) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => flushAutoSave(), delayMs)
  }

  // test 상태 변경 시 자동 저장 (localStorage 즉시 + 서버 디바운스)
  $effect(() => {
    if (!test) return
    // 의존성 트래킹용: 변경되는 값들 읽기
    const _deps = [test.responses, test.currentIndex]
    void _deps
    test.save()
    scheduleAutoSave()
  })

  onDestroy(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    if (savedHideTimer) clearTimeout(savedHideTimer)
  })

  async function handleSaveAndExit() {
    if (!test || isSubmitting) return
    isSubmitting = true
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
    try {
      await service.handleSaveResponses(test.responses)
      snackbarStore.success('응답을 저장했습니다.')
      goto(exit.listUrl)
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
      isSubmitting = false
    }
  }

  async function handleViewResults() {
    if (!test || isSubmitting) return
    isSubmitting = true
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
    try {
      const ok = await modalUtils.confirm(
        '응답을 제출하고 검토 화면으로 이동하시겠습니까?',
        '응답 검토',
        { confirmText: '검토하기', cancelText: '취소' }
      )
      if (!ok) {
        isSubmitting = false
        return
      }
      await service.handleSaveResponses(test.responses)
      // 저장으로 서버 상태가 바뀌었다(created → in_progress).
      // 컨텍스트의 exam은 layout 진입 시 1회만 로드되므로, 갱신하지 않으면
      // 검토 화면 진입 가드가 옛 상태를 보고 되돌려 보낸다.
      await layoutCtx.refreshExam()
      // 결과가 아니라 검토로 간다 — 이 시점엔 아직 채점이 없어 결과 단계가 잠겨 있다.
      goto(`/examinations/${examId}/review`)
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
      isSubmitting = false
    }
  }

  // Ctrl+Shift+F: 모의 응답 자동 채우기
  function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault()
      test?.fillMockResponses()
      snackbarStore.info('모의 응답으로 자동 채움.')
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<ExamLayoutShell
  headerTitle="문장 완성"
  onExit={handleSaveAndExit}
>
  {#snippet headerExtras()}
    {#if test}
      <span class="text-xs text-gray-400">
        {test.answeredCount} / {test.totalCount} 응답
      </span>
      {#if saveStatus === 'saving'}
        <span class="text-xs text-gray-400">저장 중...</span>
      {:else if saveStatus === 'saved'}
        <span class="text-xs text-green-300">저장됨</span>
      {:else if saveStatus === 'error'}
        <span class="text-xs text-orange-300">저장 실패 — 재시도 중</span>
      {/if}
    {/if}
  {/snippet}

  <div
    class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8"
  >
    {#if stemsQuery.isLoading || !test}
      <div class="text-sm text-gray-500">불러오는 중…</div>
    {:else if stemsQuery.isError}
      <div class="text-sm text-red-500">stems를 불러오지 못했습니다.</div>
    {:else if test.currentStem}
      <ProgressBar
        current={test.currentIndex}
        total={test.totalCount}
        answered={test.answeredCount}
      />
      <StemCard
        stemNumber={test.currentIndex + 1}
        totalCount={test.totalCount}
        stem={test.currentStem.stem}
        isCompound={test.currentStem.isCompound}
        answer={test.getCurrentAnswer()}
        reason={test.getCurrentReason()}
        onAnswerChange={(v) => test?.setAnswer(v)}
        onReasonChange={(v) => test?.setReason(v)}
        onSubmit={() => (test?.isLastItem ? handleViewResults() : test?.goNext())}
      />
    {/if}
  </div>

  {#snippet footer()}
    {#if test}
      <SCTFooter
        answeredCount={test.answeredCount}
        totalCount={test.totalCount}
        onPrev={() => test?.goPrev()}
        onNext={() => test?.goNext()}
        onViewResults={handleViewResults}
        isFirstItem={test.isFirstItem}
        isLastItem={test.isLastItem}
        canViewResults={test.answeredCount > 0 && !isSubmitting}
      />
    {/if}
  {/snippet}
</ExamLayoutShell>
