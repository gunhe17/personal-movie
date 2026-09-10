<script lang="ts">
  import { goto } from '$app/navigation'
  import {
    institutionId,
    requireInstitutionId
  } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { htpService } from '$lib/features/examination/htp/htp-service'
  import {
    isConfirmed,
    canDownloadReport as canDownloadReportFor
  } from '$lib/features/examination/core/status'
  import {
    CATEGORY_ORDER,
    CATEGORY_CONFIG,
    ANALYSIS_CATEGORY_LABELS,
    CATEGORY_TO_KOREAN,
    TOAST_DURATION,
    ANALYSIS_CATEGORY_TO_MAIN
  } from '$lib/features/examination/htp/constants'
  import { useDrawingState } from '$lib/features/examination/htp/use-drawing-state.svelte'
  import type {
    HTPInterpretation,
    InterpretationItem,
    AnalysisCategory,
    HTPCategory
  } from '$lib/features/examination/htp/types'

  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import DrawingThumbnails from '$lib/features/examination/htp/components/DrawingThumbnails.svelte'
  import InterpretationTableSection from '$lib/features/examination/htp/components/InterpretationTableSection.svelte'
  import Drawer from '$lib/components/layout/Drawer.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'

  let pdiPanelOpen = $state(false)

  import { page } from '$app/state'

  let examId = $derived(page.params.examId ?? '')

  // --- Composables ---
  const ds = useDrawingState()

  // PDI subtabs
  const PDI_TABS: Array<{ id: HTPCategory; label: string; icon: string }> =
    CATEGORY_ORDER.map((cat) => ({
      id: cat,
      label: CATEGORY_CONFIG[cat].label,
      icon: CATEGORY_CONFIG[cat].icon
    }))

  // --- State ---
  let isLoading = $state(true)
  let rawInterpretations = $state<HTPInterpretation[]>([])
  let selectedDrawingIndex = $state<number | null>(null) // null = 전체 보기
  let currentCategory = $state<AnalysisCategory>('structural')
  let activePdiTab = $state<HTPCategory>('tree')
  let showImportantOnly = $state(false)

  // Toast state
  let toastVisible = $state(false)
  let toastMessage = $state('')

  /**
   * 중요 표시된 해석의 id 집합 — 서버 is_important의 화면 미러.
   *
   * 카테고리별 boolean 배열이던 것을 id 집합으로 바꿨다. 배열 방식은
   * (a) 화면 필터와 저장 코드가 서로 다른 인덱스를 써서 엉뚱한 해석에
   * 별표를 저장했고, (b) 매번 false로 초기화해 **서버에 저장된 별표가
   * 화면에서 사라졌다** — PDF에는 나오는데 화면에는 없으니 임상가는
   * 다시 찍었고, 그때마다 (a)가 또 어긋났다.
   * 초기값은 loadResults가 서버 값으로 채운다.
   */
  let importantIds = $state<Set<string>>(new Set())

  const layoutCtx = getExamContext()

  /**
   * 상태의 출처는 컨텍스트 하나로 모은다.
   *
   * ds.examStatus는 이 화면이 들고 있는 로컬 미러라, 상태를 바꾼 뒤
   * refreshExam()을 부르지 않으면 사이드바(layoutCtx.gate)와 갈린다.
   * 실제로 '확인 완료' 직후 푸터만 바뀌고 사이드바 배지는 옛 상태였다.
   */
  let examStatus = $derived(layoutCtx.status)

  // --- Lookup maps ---
  // drawing_id → 한글 카테고리명
  let drawingCategoryMap = $derived.by(() => {
    const map: Record<string, string> = {}
    for (const d of ds.drawings) {
      map[d.id] = d.category // 한글: 집, 나무, 남자사람, 여자사람
    }
    return map
  })

  // object_id → HTPObject (sub_cond 조회용)
  let objectMap = $derived.by(() => {
    const map: Record<
      string,
      { main_cond: string | null; sub_cond: string | null; label: string }
    > = {}
    for (const d of ds.rawDrawings) {
      for (const obj of d.objects ?? []) {
        map[obj.id] = {
          main_cond: obj.main_cond,
          sub_cond: obj.sub_cond,
          label: obj.label
        }
      }
    }
    return map
  })

  // 선택된 그림의 drawing_id (null이면 전체)
  let selectedDrawingId = $derived(
    selectedDrawingIndex !== null
      ? (ds.drawings[selectedDrawingIndex]?.id ?? null)
      : null
  )

  // --- Build interpretation items ---
  let categoryInterpretations = $derived.by((): InterpretationItem[] => {
    const mainCat = ANALYSIS_CATEGORY_TO_MAIN[currentCategory]
    const reverseMap: Record<string, AnalysisCategory> = {
      자기개념: 'structural',
      '정서적 안정성': 'emotional',
      대인관계: 'interpersonal'
    }

    return rawInterpretations
      .filter((i) => {
        if (i.main_category !== mainCat) return false
        // 그림 선택 필터: 선택된 그림이 있으면 해당 그림의 해석만, 없으면 전체
        if (
          selectedDrawingId &&
          i.drawing_id &&
          i.drawing_id !== selectedDrawingId
        )
          return false
        return true
      })
      .map((i) => {
        // drawing_id로 카테고리 조회, 없으면 target_name 폴백
        const drawingLabel = i.drawing_id
          ? drawingCategoryMap[i.drawing_id] || (i.target_name ?? '종합')
          : (i.target_name ?? '종합')

        // object_id로 표현 양상(sub_cond) 조회
        const relatedObj = i.object_id ? objectMap[i.object_id] : null
        const expression = relatedObj?.sub_cond ?? ''

        return {
          id: i.id,
          drawing: drawingLabel,
          element: i.sub_category,
          expression,
          text: i.sentence,
          important: importantIds.has(i.id),
          category: reverseMap[i.main_category] || 'structural',
          isCompound: i.is_compound
        }
      })
  })

  // Filtered by importance
  let filteredInterpretations = $derived.by(() => {
    if (!showImportantOnly) return categoryInterpretations
    return categoryInterpretations.filter((i) => i.important)
  })

  let importantCount = $derived(
    categoryInterpretations.filter((i) => i.important).length
  )

  // Current PDI drawing
  let currentPdiDrawing = $derived(
    ds.drawings.find((d) => d.type === activePdiTab)
  )

  /**
   * 실제로 답이 기록된 문항만 보여준다.
   *
   * 입력 화면은 표준 문항을 빈 답으로 띄워 두는데(PDIPanel), 임상가가 한
   * 문항이라도 채우면 그 목록 전체가 저장된다 — 빈 답변까지 함께. 그래서
   * 이 기록 화면에 "묻기만 하고 답이 없는" 줄이 잔뜩 남았다.
   * 여기는 조회 화면이므로 기록된 것만 보이는 편이 맞다.
   */
  let answeredPdi = $derived(
    (currentPdiDrawing?.pdi ?? []).filter((line) => line.answer?.trim())
  )

  // --- Load Data ---
  $effect(() => {
    const instId = $institutionId
    if (!instId) return
    loadResults(instId)
  })

  async function loadResults(instId: string) {
    isLoading = true
    try {
      const results = await htpService.getResults(instId, examId)
      ds.setRawDrawings(results.drawings)
      ds.examStatus = results.status
      rawInterpretations = results.interpretations
      // 별표는 서버가 정본이다 — 여기서 읽지 않으면 지난 검토에서 찍은
      // 중요 표시가 화면에서 전부 빈 별로 보인다(PDF에는 나오는데).
      importantIds = new Set(
        results.interpretations.filter((i) => i.is_important).map((i) => i.id)
      )
    } catch {
      snackbarStore.error('결과를 불러오지 못했습니다.')
    } finally {
      isLoading = false
    }
  }

  // --- Actions ---
  function showToast(message: string) {
    toastMessage = message
    toastVisible = true
    setTimeout(() => {
      toastVisible = false
    }, TOAST_DURATION)
  }

  /**
   * 별표 토글 — 화면과 서버가 같은 좌표(해석 id)를 쓴다.
   *
   * 실패하면 화면 상태를 되돌린다. 예전에는 화면만 바꾸고 저장 실패는
   * 스낵바로만 알려서, 임상가는 별표가 켜진 화면을 보며 "저장됐다"고 믿고
   * 넘어갔다 — 그리고 PDF에는 그 별표가 없었다.
   */
  function handleToggleImportant(id: string) {
    const next = !importantIds.has(id)

    const updated = new Set(importantIds)
    if (next) updated.add(id)
    else updated.delete(id)
    importantIds = updated

    showToast(next ? '중요 항목 선택됨' : '중요 항목 해제됨')

    const instId = requireInstitutionId()
    htpService.toggleImportant(instId, examId, id, next).catch(() => {
      const reverted = new Set(importantIds)
      if (next) reverted.delete(id)
      else reverted.add(id)
      importantIds = reverted
      snackbarStore.error('중요 표시 저장에 실패했습니다.')
    })
  }

  // 다음 단계 버튼이 노출되는 상태 (서버 상태 머신 기준):
  //   ai_draft_ready → (under_review →) confirmed   "확인 완료"
  // confirmed → report_generated 는 PDF 생성 시 백엔드에서 자동 전이됨.
  //
  // report_generated가 빠진 이유: 그게 마인드봄의 최종 상태다. 예전에는
  // 여기서 completed로 한 번 더 보냈지만, '완료'는 운영 플랫폼이 담당자
  // 검수로 판정하는 별개 사건이라 우리 축에서 뺐다(state_machine.py).
  const NEXT_STEP_STATUSES = ['ai_draft_ready'] as const

  let isCompleting = $state(false)
  let isDownloadingPdf = $state(false)

  async function patchStatus(instId: string, nextStatus: string) {
    const { patch } = await import('$lib/services/api/instances')
    await patch(`/institutions/${instId}/examinations/${examId}`, {
      status: nextStatus
    })
    ds.examStatus = nextStatus
  }

  async function handleComplete() {
    const instId = requireInstitutionId()
    const current = examStatus

    isCompleting = true
    try {
      if (current === 'ai_draft_ready') {
        // 임상가 검토 → 확정 (2단계 전이)
        await patchStatus(instId, 'under_review')
        await patchStatus(instId, 'confirmed')
        snackbarStore.success('임상심리사 확인이 완료되었습니다.')
      } else {
        snackbarStore.error('현재 상태에서는 다음 단계로 진행할 수 없습니다.')
        return
      }
      // 상태가 바뀌었으니 컨텍스트를 갱신한다 — 이걸 빼면 사이드바 배지와
      // 이탈 버튼이 옛 상태를 보고, 새로고침해야 맞춰진다.
      await layoutCtx.refreshExam()
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '상태 변경에 실패했습니다.'
      snackbarStore.error(msg)
    } finally {
      isCompleting = false
    }
  }

  async function handleDownloadPdf() {
    const instId = requireInstitutionId()
    isDownloadingPdf = true
    try {
      await htpService.downloadReportPdf(instId, examId)
      snackbarStore.success('보고서가 다운로드되었습니다.')
      // 백엔드가 confirmed → report_generated로 자동 전이시킨다(위 주석 참고).
      // 갱신하지 않으면 '완료' 버튼이 뜨지 않는다.
      await layoutCtx.refreshExam()
    } catch {
      snackbarStore.error('보고서 생성에 실패했습니다.')
    } finally {
      isDownloadingPdf = false
    }
  }
</script>

{#snippet pdiPanelContent()}
  <!-- Header — Collect 우패널의 탭 헤더와 같은 바탕·보더를 쓴다 -->
  <div class="shrink-0 border-b border-gray-200 bg-gray-50/50 p-4">
    <div class="flex items-center gap-2">
      <h4 class="text-body-02-normal-semibold text-gray-800">사후질문 기록</h4>
    </div>
  </div>

  <!--
    Drawing Subtabs — 이미지 분석 화면 우패널의 탭과 같은 형태.

    알약 버튼이던 것을 밑줄 인디케이터로 바꿨다. 같은 자리(우패널 상단)에
    서는 탭이 화면마다 다른 모양이면 같은 흐름으로 읽히지 않는다.
  -->
  {@const activeIdx = PDI_TABS.findIndex((t) => t.id === activePdiTab)}
  <div class="relative flex shrink-0 border-b border-gray-200 bg-gray-50/50">
    {#each PDI_TABS as tab (tab.id)}
      {@const isActive = activePdiTab === tab.id}
      <button
        onclick={() => {
          activePdiTab = tab.id
        }}
        class="flex flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 py-3 text-label-01-normal-medium transition-colors
          {isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}"
      >
        <Icon name={tab.icon} size="sm" />
        {tab.label}
      </button>
    {/each}

    <!--
      활성 표시 — 버튼 안에 그리면 탭을 바꿀 때 지워졌다 새로 생겨 튄다.
      트랙에 하나만 띄우고 좌우로 미끄러진다(RightPanel과 같은 원리).
      네 탭이 flex-1이라 폭은 항상 1/4이므로 translate만으로 충분하다.
    -->
    <span
      class="pointer-events-none absolute bottom-0 left-3 h-0.5 rounded-full bg-blue-600 transition-transform duration-300 ease-out motion-reduce:transition-none"
      style="width: calc(25% - 1.5rem); transform: translateX(calc({activeIdx} * (100% + 1.5rem)));"
    ></span>
  </div>


  <!-- PDI Transcript -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if answeredPdi.length}
      {#each answeredPdi as line, index (index)}
        <div class="mb-3">
          <div class="mb-1 text-body-03-reading-regular text-gray-600">
            <span class="text-body-03-normal-medium text-blue-500">검사자:</span
            >
            {line.question}
          </div>
          <div
            class="ml-2 border-l-2 border-blue-200 pl-2 text-body-03-reading-regular text-gray-900"
          >
            <span class="text-body-03-normal-medium text-gray-500">내담자:</span
            >
            {line.answer}
          </div>
        </div>
      {/each}
    {:else}
      <p class="py-4 text-center text-body-03-normal-regular text-gray-400">
        기록된 응답이 없습니다.
      </p>
    {/if}
  </div>
{/snippet}

{#snippet htpContent()}
  <!--
    로딩·빈 상태를 셸 **안**에서 그린다.
    예전에는 이 분기가 최상위에 있어서 로딩 중에는 ExamLayoutShell 자체가
    렌더되지 않았다 — 단계를 옮길 때마다 헤더와 사이드바가 통째로 사라졌다
    다시 나타나 화면이 번쩍였다(세 검사 중 HTP만 그랬다).
  -->
  {#if isLoading}
    <div class="flex flex-1 items-center justify-center">
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"
      ></div>
    </div>
  {:else if ds.drawings.length === 0}
    <div class="flex flex-1 items-center justify-center">
      <div class="text-center">
        <p class="text-gray-500 mb-4">분석 데이터가 없습니다.</p>
        <button
          onclick={() => goto(`/examinations/${examId}/collect`)}
          class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          분석 화면으로
        </button>
      </div>
    </div>
  {:else}
    {@render htpBody()}
  {/if}
{/snippet}

{#snippet htpBody()}
  <!-- Toast -->
  {#if toastVisible}
    <div
      class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up"
    >
      <div
        class="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
      >
        <Icon name="star" size="sm" class="text-yellow-400" />
        <span class="text-body-03-normal-regular">{toastMessage}</span>
      </div>
    </div>
  {/if}

  <!--
    Content Area — 이미지 분석 화면과 같은 골격.

    예전에는 좌·우가 모두 여백 안에 뜬 카드였는데, 같은 검사 흐름의 직전
    화면(Collect)은 우패널이 border-l로 화면 끝에 붙는다. 두 화면을 오갈 때
    오른쪽 덩어리가 떴다 붙었다 해서 이질감이 났다.
    여백은 좌측 본문에만 주고, 우패널은 셸에 붙인다.
  -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Panel - Interpretation -->
    <div class="flex-1 min-w-0 overflow-hidden p-4 md:p-6">
      <div
        class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <!-- Header description -->
        <div class="p-6 border-b border-gray-200">
          <h3 class="mb-2 text-headline-02-normal-semibold text-gray-900">
            HTP분석
          </h3>
          <p class="text-body-03-reading-regular text-gray-600">
            그림에서 임상적 특징이 나타날 경우 문제가 있는 것으로 나타나며
            자기개념, 정서적 안정성, 대인관계의 총 3가지 영역을 모두
            확인해주셔야 합니다. 해석 과정에서 중요하다고 판단되는 항목에 중요
            표시
            <Icon
              name="star"
              size="sm"
              class="inline-block align-middle text-yellow-400"
            />
            를 하면 보고서 작성 시 빠르게 조회할 수 있습니다.
          </p>
        </div>

        <!-- Drawing Thumbnails (클릭으로 필터, 다시 클릭하면 전체) -->
        <DrawingThumbnails
          drawings={ds.drawings}
          activeIndex={selectedDrawingIndex ?? -1}
          onSelect={(i) => {
            selectedDrawingIndex = selectedDrawingIndex === i ? null : i
          }}
        />

        <!-- Category Tabs -->
        <div class="px-6 border-b border-gray-200">
          <div class="flex gap-6">
            {#each ['structural', 'emotional', 'interpersonal'] as AnalysisCategory[] as cat}
              {@const isActive = cat === currentCategory}
              <button
                onclick={() => {
                  currentCategory = cat
                }}
                class="px-1 py-3 text-body-02-normal-medium transition-colors
                {isActive
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'}"
              >
                {ANALYSIS_CATEGORY_LABELS[cat]}
              </button>
            {/each}
          </div>
        </div>

        <!-- Interpretation Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-body-03-normal-semibold text-gray-700">
              {ANALYSIS_CATEGORY_LABELS[currentCategory]}
              {categoryInterpretations.length}
            </h4>
            <button
              onclick={() => {
                showImportantOnly = !showImportantOnly
              }}
              class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-label-01-normal-medium transition-colors
              {showImportantOnly
                ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}"
            >
              <Icon
                name="star"
                size="sm"
                class={showImportantOnly ? 'text-yellow-400' : 'text-gray-400'}
              />
              중요 항목만
              {#if importantCount > 0}
                <span
                  class="ml-0.5 px-1.5 py-0.5 rounded-full text-caption-01-normal-bold
                {showImportantOnly
                    ? 'bg-yellow-200 text-yellow-800'
                    : 'bg-gray-100 text-gray-600'}"
                >
                  {importantCount}
                </span>
              {/if}
            </button>
          </div>
          <!--
          확정 이후에는 별표가 잠긴다 — 이 값이 그대로 PDF의 ★ 열이라
          (htp_report.html), 확정한 뒤에 바꾸면 같은 검사에서 서로 다른
          보고서가 나온다. 백엔드도 같은 경계로 거절한다(_EDITABLE_STATUSES).
        -->
          <InterpretationTableSection
            interpretations={filteredInterpretations}
            onToggleImportant={handleToggleImportant}
            readOnly={isConfirmed(examStatus)}
          />
        </div>
      </div>
    </div>

    <!-- Right Panel - PDI (xl+ 인라인) — Collect의 RightPanel과 같은 형태 -->
    <div
      class="hidden xl:flex w-exam-panel shrink-0 flex-col border-l border-gray-200 bg-white"
    >
      {@render pdiPanelContent()}
    </div>
  </div>

  <!-- Right Panel - PDI (< xl 드로어) -->
  <Drawer
    open={pdiPanelOpen}
    onClose={() => (pdiPanelOpen = false)}
    side="right"
    hideAt="xl"
  >
    <div class="flex h-full w-[min(420px,100vw)] flex-col bg-white">
      {@render pdiPanelContent()}
    </div>
  </Drawer>
{/snippet}

{#snippet htpFooter()}
  <!-- Footer -->
  <div
    class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
  >
    <div class="text-body-03-normal-regular text-gray-600">
      해석 <span class="font-semibold text-gray-900"
        >{categoryInterpretations.length}</span
      >건
      {#if importantCount > 0}
        <span class="ml-3 text-label-01-normal-regular text-gray-400"
          >· 중요 {importantCount}건</span
        >
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <!--
        확정 후에도 보여준다 — 결과를 본 뒤 "이 해석이 어느 부위에서 나왔는지"
        탐지 결과를 다시 확인하는 경로가 여기다. 예전에는 collect가 확정 시
        잠겨서 눌러도 되돌려 보내졌기에 숨겼는데, 이제 그 화면이 읽기 전용으로
        열린다(htp/module.ts의 collect 주석).
      -->
      <button
        onclick={() => goto(`/examinations/${examId}/collect`)}
        class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2 text-body-03-normal-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <ArrowLeft size={20} />
        {isConfirmed(examStatus) ? '이미지 분석 보기' : '이전'}
      </button>

      <!-- PDF 다운로드 (confirmed 이상일 때) -->
      <!-- 다음 단계 버튼 — 더 진행할 단계가 남아 있을 때만 -->
      {#if NEXT_STEP_STATUSES.includes(ds.examStatus as any)}
        <button
          onclick={handleComplete}
          disabled={isCompleting}
          class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-body-03-normal-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
        >
          {#if isCompleting}
            처리 중...
          {:else if ds.examStatus === 'ai_draft_ready'}
            확인 완료
          {:else if ds.examStatus === 'report_generated'}
            완료
          {:else}
            다음 단계
          {/if}
          <ArrowRight size={20} />
        </button>
      {/if}

      <!-- PDF 다운로드 (confirmed 이상일 때) -->
      {#if canDownloadReportFor(examStatus)}
        <button
          onclick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-body-03-normal-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
        >
          <Icon name="picture_as_pdf" size="md" />
          {isDownloadingPdf ? '생성 중...' : '보고서 PDF'}
        </button>
      {/if}
    </div>
  </div>
{/snippet}

<!-- ?embed=1(리포트 모달 iframe) 처리는 셸이 한다 — 여기서 분기하지 않는다. -->
<ExamLayoutShell
  headerTitle="분석 결과보기"
  exitMode={isConfirmed(examStatus) ? 'leave' : 'cancel'}
>
  {#snippet headerExtras()}
    <button
      type="button"
      onclick={() => (pdiPanelOpen = true)}
      class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-label-01-normal-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 xl:hidden"
      aria-label="사후질문 패널 열기"
    >
      <Icon name="record_voice_over" size="sm" />
      사후질문
    </button>
  {/snippet}

  {#snippet footer()}
    {@render htpFooter()}
  {/snippet}

  {@render htpContent()}
</ExamLayoutShell>
