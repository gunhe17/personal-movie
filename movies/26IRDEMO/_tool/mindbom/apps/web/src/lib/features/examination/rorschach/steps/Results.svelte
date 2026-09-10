<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { institutionId } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'

  import {
    downloadRorschachReportPdf,
    getStructuralSummary,
    type StructuralSummary
  } from '$lib/features/examination/rorschach/actions'
  import {
    mapToUpperSection,
    mapToLowerSection,
    mapToSpecialIndices
  } from '$lib/features/examination/rorschach/result-mapper'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import { isConfirmed } from '$lib/features/examination/core/status'

  import UpperSection from '$lib/features/examination/rorschach/components/result/upperSection/UpperSection.svelte'
  import LowerSection from '$lib/features/examination/rorschach/components/result/lowerSection/LowerSection.svelte'
  import SpecialIndices from '$lib/features/examination/rorschach/components/result/specialIndices/SpecialIndices.svelte'
  import ResultSectionTabs, {
    type ResultTab
  } from '$lib/features/examination/rorschach/components/result/ResultSectionTabs.svelte'
  import ResultFooter from '$lib/features/examination/rorschach/components/result/ResultFooter.svelte'
  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import type { ExamStatus } from '$lib/features/examination/common/constants'
  import { EXAM_STATUS_VISUAL } from '$lib/features/examination/common/exam-visual'

  // --- Layout context ---
  const layoutCtx = getExamContext()
  let exam = $derived(layoutCtx.exam)

  // --- State ---
  let examId = $derived(page.params.examId ?? '')
  let summary = $state<StructuralSummary | null>(null)
  let isLoading = $state(true)
  let isInitialized = $state(false)
  let errorMsg = $state<string | null>(null)

  // exam 이 layout 에서 로드되면 status 가드 + summary 로드
  $effect(() => {
    const e = exam
    const instId = $institutionId
    if (!e || !instId || !examId || isInitialized) return

    if (!isConfirmed(layoutCtx.status)) {
      errorMsg =
        '검사 채점이 확정되지 않았습니다. 채점 화면에서 검토를 완료해주세요.'
      isLoading = false
      return
    }

    void loadSummary(instId, examId)
  })

  async function loadSummary(instId: string, eId: string) {
    isLoading = true
    errorMsg = null
    try {
      summary = await getStructuralSummary(instId, eId)
      isInitialized = true
    } catch (err) {
      console.error('[Result init] 실패', err)
      errorMsg = '결과를 불러오지 못했습니다.'
    } finally {
      isLoading = false
    }
  }

  // 백엔드 StructuralSummary → 참고 디자인 데이터로 변환
  let upperData = $derived(summary ? mapToUpperSection(summary) : null)
  let lowerData = $derived(summary ? mapToLowerSection(summary) : null)
  let specialData = $derived(summary ? mapToSpecialIndices(summary) : null)

  let activeTab = $state<ResultTab>('upper')

  function statusLabel(s: string): string {
    // 결과 화면 컨텍스트: confirmed 단계를 "확정 완료" 로 강조
    const contextual: Record<string, string> = {
      confirmed: '확정 완료'
    }
    return contextual[s] ?? EXAM_STATUS_VISUAL[s as ExamStatus]?.label ?? s
  }

  let isDownloadingPdf = $state(false)
  async function handleDownloadPdf() {
    const instId = $institutionId
    if (!instId || isDownloadingPdf) return
    isDownloadingPdf = true
    try {
      await downloadRorschachReportPdf(instId, examId)
      snackbarStore.success('보고서가 다운로드되었습니다.')
    } catch {
      snackbarStore.error('보고서 생성에 실패했습니다.')
    } finally {
      isDownloadingPdf = false
    }
  }
</script>

{#snippet resultsMain()}
      {#if summary}
        <ResultSectionTabs {activeTab} onTabChange={(t) => (activeTab = t)} />
      {/if}

      <!--
        flex 컬럼이다 — 특수지표 탭의 카드가 남는 높이를 그대로 받게 하려는
        것이다. 퍼센트 높이(`h-full`)로 하면 조상 중 하나만 높이가 auto여도
        조용히 auto로 풀려 안쪽 `basis-0` 자식들이 접힌다.
      -->
      <div class="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        {#if isLoading}
          <div class="flex h-60 items-center justify-center">
            <div
              class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
            ></div>
          </div>
        {:else if errorMsg}
          <div
            class="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center"
          >
            <p class="text-sm text-orange-800">{errorMsg}</p>
            {#if exam && !isConfirmed(layoutCtx.status)}
              <button
                onclick={() => goto(`/examinations/${examId}/review`)}
                class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
              >
                채점 화면으로 이동
              </button>
            {/if}
          </div>
        {:else if summary}
          <!--
            프로토콜 타당성 안내.

            Exner CS는 R<14인 프로토콜을 해석하지 않고 재실시하도록 한다.
            그런 경우 백엔드가 하단 클러스터·특수지표를 비워 보내므로, 화면이
            "왜 비었는지"를 말하지 않으면 임상가는 오류로 오해한다.
            상단 집계는 그대로 보인다 — 몇 개 나왔는지 봐야 재실시를 판단한다.
          -->
          {#if summary.validity === 'insufficient_r'}
            <div
              class="mb-4 rounded-xl border border-orange-300 bg-orange-50 p-5"
              role="alert"
            >
              <p class="text-sm font-semibold text-orange-900">
                해석 불가 프로토콜 — 반응 수 {summary.R}개
              </p>
              <p class="mt-1.5 text-sm leading-relaxed text-orange-800">
                Exner CS는 반응이 14개 미만이면 해석하지 않고 재실시하도록
                합니다. 반응이 적으면 비율이 크게 흔들려 지표를 신뢰할 수
                없기 때문입니다.
                <strong class="font-semibold"
                  >하단 클러스터와 특수 지표는 산출하지 않았습니다.</strong
                >
              </p>
            </div>
          {/if}

          <!--
            특수지표 탭만 **콘텐츠 영역을 꽉 채운다**. 그 화면은 네 열이
            바닥까지 내려가야 표 높이가 서로 맞는다.

            안쪽이 `basis-0 flex-1`로 자리를 나누므로 **부모 높이가 확정이어야
            한다.** 퍼센트(`h-full`)는 조상 중 하나만 auto여도 조용히 풀려
            자식들이 접히고 표가 찌그러진다 — 그래서 flex로 받는다.

            다른 탭은 `shrink-0`이다. 그쪽은 내용이 영역보다 길어 바깥이
            스크롤되는 화면인데, flex 컬럼의 기본값(`shrink:1`)을 그대로 두면
            내용이 눌려 잘린다.
          -->
          <div
            class="bg-white shadow-sm rounded-2xl {activeTab === 'special'
              ? 'min-h-0 flex-1 overflow-auto'
              : 'shrink-0 overflow-hidden'}"
          >
            {#if activeTab === 'upper' && upperData}
              <UpperSection data={upperData} />
            {:else if activeTab === 'lower' && lowerData}
              <LowerSection data={lowerData} />
            {:else if activeTab === 'special' && specialData}
              <SpecialIndices data={specialData} />
            {/if}
          </div>
        {/if}
      </div>

{/snippet}

<!-- ?embed=1(리포트 모달 iframe) 처리는 셸이 한다 — 여기서 분기하지 않는다. -->
<ExamLayoutShell
  headerTitle="구조 요약 (Structural Summary)"
  headerSubtitle="Exner CS 기반 채점 결과 요약입니다."
  exitMode="leave"
>
  {#snippet footer()}
    {#if summary && !errorMsg}
      <ResultFooter
        R={summary.R}
        statusText={exam ? statusLabel(exam.status) : ''}
        canGenerateReport={!isDownloadingPdf}
        onPrev={() => goto(`/examinations/${examId}/review`)}
        onGenerateReport={handleDownloadPdf}
      />
    {/if}
  {/snippet}

  {@render resultsMain()}
</ExamLayoutShell>
