<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { institutionId, requireInstitutionId } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { htpService } from '$lib/features/examination/htp/htp-service'
  import { useDrawingState } from '$lib/features/examination/htp/use-drawing-state.svelte'
  import { useBBoxEditor } from '$lib/features/examination/htp/use-bbox-editor.svelte'

  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'
  import { isConfirmed } from '$lib/features/examination/core/status'
  import DrawingTabs from '$lib/features/examination/htp/components/DrawingTabs.svelte'
  import DrawingCanvas from '$lib/features/examination/htp/components/DrawingCanvas.svelte'
  import RightPanel from '$lib/features/examination/htp/components/RightPanel.svelte'
  import HTPFooter from '$lib/features/examination/htp/components/HTPFooter.svelte'
  import AnalyzingSpinner from '$lib/features/examination/htp/components/AnalyzingSpinner.svelte'
  import Drawer from '$lib/components/layout/Drawer.svelte'
  import Icon from '$components/ui/Icon.svelte'

  let panelOpen = $state(false)

  let examId = $derived(page.params.examId ?? '')

  // --- State ---
  let isLoading = $state(true)
  let visibleBBoxLabels = $state<Set<string>>(new Set())
  let canvasContainerEl = $state<HTMLElement | null>(null)

  // --- Composables ---
  const ds = useDrawingState()

  /**
   * BBox 편집은 상태에 반영하고 자동저장한다.
   *
   * 예전에는 이 콜백이 비어 있었다("visual-only"). 그런데 편집기는 매
   * mousemove마다 getBboxes()로 **원본을 다시 읽어** 계산하므로, 반영하지
   * 않으면 화면에서조차 박스가 움직이지 않았다 — 드래그 핸들만 있고 아무
   * 일도 일어나지 않는 UI였던 셈이다.
   *
   * 이제 좌표가 실제로 저장되고, '재해석'을 누르면 그 좌표로 조건과 해석이
   * 다시 계산된다(reinterpret).
   */
  const bbox = useBBoxEditor(
    () => ds.currentDrawing?.bboxes ?? [],
    (updated) => {
      if (isReadOnly) return
      ds.updateBBoxes(updated)
      regionDirty = true
      scheduleAnalysisSave()
    },
    () => canvasContainerEl,
  )

  const layoutCtx = getExamContext()

  /**
   * 확정 이후에는 조회만 — 이 화면은 결과를 확정한 뒤에도 열려 있다.
   *
   * 임상가가 결과를 본 뒤 "이 해석이 어느 부위에서 나왔는지" 확인하려면
   * 탐지 결과(BBox)를 다시 볼 수 있어야 한다. 예전에는 단계를 통째로 잠가
   * 그 경로가 없었는데, 잠근 이유는 이 화면의 입력이 전부 자동저장이라
   * 들어가는 것만으로 확정본이 바뀔 수 있어서였다(SaMD 데이터 무결성).
   * 그래서 단계를 여는 대신 **쓰기 경로 네 개를 전부 막는다** —
   * 업로드·AI분석 / PDI 저장 / 분석결과 저장 / 분석항목 삭제.
   *
   * 판정은 core/status.ts 하나에서 가져온다.
   */
  let isReadOnly = $derived(isConfirmed(layoutCtx.status))

  // 결과 화면 진입 조건도 같은 선언에서 가져온다 — 푸터 버튼과 사이드바가
  // 서로 다른 기준을 쓰면 "버튼은 눌리는데 가면 되돌아오는" 식으로 어긋난다.
  const resultsReady = $derived(
    layoutCtx.module.steps.find((s) => s.key === 'results')?.enabled?.(layoutCtx.gate) ?? true
  )

  // --- BBox 가시성 ---
  let filteredBboxes = $derived(
    (ds.currentDrawing?.bboxes ?? []).filter((b) => visibleBBoxLabels.has(b.label))
  )

  /**
   * 탭을 옮기면 그 그림의 영역을 전부 보이게 되돌린다.
   *
   * 넣는 것은 **박스가 있는 label뿐**이다. 예전에는 분석 항목 전체(미탐지
   * 포함)를 넣었는데, 그러면 '전체 표시'(박스 있는 것만 넣는다)와 기준이
   * 달라진다. 실제로 그 어긋남 때문에 '영역 표시' 토글이 처음 한 번만
   * 동작했다 — 탭 진입 직후에는 전부 들어 있어 allVisible이 참이지만, 한 번
   * 껐다 켜면 미탐지 label이 빠져 다시는 참이 되지 않았고, 토글은 늘 '표시'
   * 쪽으로만 동작했다.
   */
  $effect(() => {
    visibleBBoxLabels = new Set((ds.currentDrawing?.bboxes ?? []).map((b) => b.label))
  })

  // BBox drag/resize 마우스 이벤트
  $effect(() => {
    if (!bbox.isDragging && !bbox.isResizing) return
    return bbox.setupMouseListeners()
  })

  // --- Data loading ---
  $effect(() => {
    const instId = $institutionId
    if (!instId) return
    loadData(instId)
  })

  async function loadData(instId: string) {
    isLoading = true
    const [initRes, resultsRes] = await Promise.allSettled([
      htpService.initializeDrawings(instId, examId),
      htpService.getResults(instId, examId),
    ])

    // 첫 진입 race: getResults가 init 보다 먼저 응답하면 drawings=[] 일 수 있음.
    // 비어있으면 init 결과로 폴백해 4개 drawing 을 반드시 갖도록 보장.
    const resultsHasDrawings =
      resultsRes.status === 'fulfilled' && resultsRes.value.drawings.length > 0

    if (resultsHasDrawings) {
      ds.examStatus = resultsRes.value.status
      ds.setRawDrawings(resultsRes.value.drawings)
      regionDirty = resultsRes.value.needs_reinterpret ?? false
    } else if (initRes.status === 'fulfilled') {
      if (resultsRes.status === 'fulfilled') {
        ds.examStatus = resultsRes.value.status
      }
      ds.setRawDrawings(initRes.value.map((d) => ({ ...d, objects: [] })))
    } else {
      snackbarStore.error('검사 데이터를 불러오지 못했습니다.')
      isLoading = false
      return
    }

    isLoading = false
  }

  // --- Actions ---
  async function handleImageUpload(file: File) {
    if (isReadOnly) return
    const drawing = ds.getCurrentServerDrawing()
    if (!drawing) return
    const instId = requireInstitutionId()
    try {
      const updated = await htpService.uploadImage(instId, examId, drawing.id, file)
      ds.updateRawDrawing(drawing.id, (d) => ({ ...d, ...updated }))
      snackbarStore.success('이미지 업로드 완료. AI 분석을 시작합니다.')

      // 업로드 직후 즉시 AI 분석 실행 (placeholder 방식으로 미업로드 카테고리 처리)
      ds.isAnalyzing = true
      // 화면 안 스피너만으로는 사이드바가 평소 뱃지 그대로라 어디까지 왔는지
      // 알 수 없다. 일시 상태는 컨텍스트에 알려 사이드바도 함께 움직인다.
      layoutCtx.setBusy('AI 분석 중')
      try {
        // 방금 올린 그림만 다시 탐지한다.
        //
        // 예전에는 대상을 안 넘겨서(백엔드도 이 인자를 무시했다) 이미지가
        // 있는 그림을 매번 전부 다시 탐지하고 객체를 통째로 재생성했다.
        // 그래서 나무를 올리면 임상가가 집에서 옮겨 둔 BBox와 손으로 넣은
        // 항목이 함께 사라졌다. 이제 나머지 그림은 DB의 현재 객체를 그대로
        // 두고, 해석만 그 좌표까지 반영해 다시 만든다.
        const results = await htpService.analyze(instId, examId, [drawing.id])
        ds.setRawDrawings(results.drawings)
        ds.examStatus = results.status
        regionDirty = results.needs_reinterpret ?? false
        // 분석으로 progress.has_result가 true가 됐다. 갱신하지 않으면
        // 푸터의 '결과 보기'가 layoutCtx.gate의 옛 값을 보고 계속 비활성이고,
        // 툴팁은 "AI 분석이 끝난 뒤 결과를 볼 수 있습니다"라고 말한다.
        await layoutCtx.refreshExam()
        snackbarStore.success('AI 분석이 완료되었습니다.')
      } catch (e: any) {
        const msg = e?.response?.data?.detail || 'AI 분석에 실패했습니다.'
        snackbarStore.error(msg)
      } finally {
        ds.isAnalyzing = false
        layoutCtx.setBusy(null)
      }
    } catch {
      snackbarStore.error('이미지 업로드에 실패했습니다.')
    }
  }

  function handleRowClick(label: string) {
    if (visibleBBoxLabels.size === 1 && visibleBBoxLabels.has(label)) {
      visibleBBoxLabels = new Set((ds.currentDrawing?.bboxes ?? []).map((b) => b.label))
    } else {
      visibleBBoxLabels = new Set([label])
    }
  }

  /**
   * 화면에서 사라진 박스는 선택도 푼다.
   *
   * 선택 상태는 캔버스 위 '이 영역 삭제' 바를 띄운다. 다른 항목의 칩을
   * 눌러 그 박스가 안 보이게 됐는데도 선택이 남아 있으면, **보이지도 않는
   * 영역을 지우겠냐고 계속 묻는다** — 누르면 엉뚱한 박스가 사라진다.
   * 칩 클릭·전체 숨김·탭 이동 등 경로가 여럿이라 개별로 풀지 않고
   * "보이는 목록에 없으면 해제"라는 한 규칙으로 잡는다.
   */
  $effect(() => {
    const id = bbox.activeBBoxId
    if (!id) return
    if (!filteredBboxes.some((b) => b.id === id)) bbox.deselectBBox()
  })

  function handleSelectAll() {
    visibleBBoxLabels = new Set((ds.currentDrawing?.bboxes ?? []).map((b) => b.label))
  }

  function handleDeselectAll() {
    visibleBBoxLabels = new Set()
  }

  function handleTabChange(index: number) {
    // 탭을 옮기기 전에 이 그림의 미저장 입력을 흘려보낸다 (위 주석 참고)
    void flushPendingSaves()
    ds.switchTab(index)
    bbox.deselectBBox()
  }

  /**
   * --- 자동저장 (debounced) ---
   *
   * ⚠️ 저장 대상은 **예약할 때** 정한다. 예전에는 타이머가 터지는 시점에
   * ds.getCurrentServerDrawing()으로 "지금 탭"을 다시 읽었다. 집 탭에서
   * 답을 적고 1초 안에 나무 탭으로 넘어가면 나무 것이 저장되고 **집에 적은
   * 마지막 입력은 영영 사라졌다** — 임상 면접 기록이 소리 없이 유실됐다.
   * 그래서 예약 시점의 drawing id를 붙들고, 탭을 옮기거나 화면을 뜰 때는
   * 남은 예약을 먼저 흘려보낸다(flushPendingSaves).
   */
  let pdiSaveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPdiDrawingId: string | null = null

  function handlePDIUpdate(pdiLines: { question: string; answer: string }[]) {
    if (isReadOnly) return
    const drawing = ds.getCurrentServerDrawing()
    if (!drawing) return
    ds.updatePDI(pdiLines)

    pendingPdiDrawingId = drawing.id
    if (pdiSaveTimer) clearTimeout(pdiSaveTimer)
    pdiSaveTimer = setTimeout(() => savePDI(drawing.id), 1000)
  }

  async function savePDI(drawingId: string) {
    if (pendingPdiDrawingId === drawingId) pendingPdiDrawingId = null
    const drawing = ds.rawDrawings.find((d) => d.id === drawingId)
    if (!drawing) return
    const instId = requireInstitutionId()
    try {
      await htpService.updateDrawing(instId, examId, drawing.id, {
        pdi_data: drawing.pdi_data,
      })
    } catch {
      snackbarStore.error('사후 질문 저장에 실패했습니다.')
    }
  }

  // --- 분석 결과 자동저장 (debounced) ---
  let analysisSaveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingAnalysisDrawingId: string | null = null
  let isSavingAnalysis = false

  function scheduleAnalysisSave() {
    if (isReadOnly) return
    const drawing = ds.getCurrentServerDrawing()
    if (!drawing) return
    pendingAnalysisDrawingId = drawing.id
    if (analysisSaveTimer) clearTimeout(analysisSaveTimer)
    analysisSaveTimer = setTimeout(() => saveAnalysis(drawing.id), 1500)
  }

  // --- 재해석 ---
  let isReinterpreting = $state(false)

  /**
   * 마지막 재해석(또는 분석) 이후 탐지 영역이 바뀌었는가.
   *
   * 이 값이 참일 때만 우패널 아래에서 '해석 다시 만들기'가 올라온다. 늘 떠
   * 있으면 고친 게 없을 때도 누르게 되고, 그건 같은 결과를 위해 AI를 한 번 더
   * 부르는 일이다.
   *
   * **정본은 서버다**(needs_reinterpret). 로컬 상태로만 두면 결과 화면에
   * 다녀오거나 새로고침하는 순간 사라져, 좌표는 고쳐졌는데 버튼만 없는
   * 상태가 된다. 여기서는 편집 직후 즉시 반응하도록 켜 두기만 하고,
   * 서버 응답이 올 때마다 그 값으로 맞춘다.
   */
  let regionDirty = $state(false)

  /**
   * 수정한 BBox로 해석을 다시 만든다.
   *
   * 이 버튼이 없던 동안 임상가의 수정은 해석에 닿지 못했다 — 조건을 고쳐도
   * 해석 문장은 옛 판정 그대로였고, 한 줄에서 '표현'과 '해석'이 서로 다른
   * 얘기를 했다. 덮어쓰기이므로 실행 전에 무엇이 대체되는지 알린다.
   */
  async function handleReinterpret() {
    if (isReadOnly || isReinterpreting) return

    // 건수를 말하지 않는다. 예전에는 "손으로 고친 N건이 대체됩니다"라고 했는데,
    // 그 N은 사실 '조건이 있는 모든 항목' 수였다 — 대부분 AI가 넣은 값이라
    // 임상가가 겁먹을 숫자였고, 무엇보다 사실이 아니었다.
    const { modalUtils } = await import('$lib/stores/modal')
    const ok = await modalUtils.confirm(
      `수정한 탐지 영역으로 분석 조건과 해석을 다시 만듭니다.\n` +
        `AI 판정 항목의 조건·표현은 새로 계산된 값으로 대체됩니다.\n` +
        `직접 추가한 항목은 그대로 유지됩니다.`,
      '해석을 다시 만들까요?',
      { confirmText: '재해석', cancelText: '취소' }
    )
    if (!ok) return

    // 방금 옮긴 박스가 서버에 있어야 그 좌표로 해석이 나온다.
    await flushPendingSaves()

    const instId = requireInstitutionId()
    isReinterpreting = true
    layoutCtx.setBusy('해석 다시 만드는 중')
    try {
      const results = await htpService.reinterpret(instId, examId)
      ds.setRawDrawings(results.drawings)
      ds.examStatus = results.status
      regionDirty = results.needs_reinterpret ?? false
      await layoutCtx.refreshExam()

      const lost = results.important_carry_over?.lost ?? 0
      if (lost > 0) {
        // 조용히 사라지게 두지 않는다 — 임상가가 직접 찍은 판단이다.
        snackbarStore.warning(
          `해석을 다시 만들었습니다. 중요 표시 ${lost}건은 해당 해석이 바뀌어 옮기지 못했습니다.`,
          5000
        )
      } else {
        snackbarStore.success('해석을 다시 만들었습니다.')
      }
    } catch (e: any) {
      snackbarStore.error(e?.response?.data?.detail || '재해석에 실패했습니다.')
    } finally {
      isReinterpreting = false
      layoutCtx.setBusy(null)
    }
  }

  /** 남아 있는 자동저장 예약을 지금 실행한다 (탭 이동·화면 이탈 직전) */
  async function flushPendingSaves() {
    const pdiId = pendingPdiDrawingId
    const analysisId = pendingAnalysisDrawingId
    if (pdiSaveTimer) { clearTimeout(pdiSaveTimer); pdiSaveTimer = null }
    if (analysisSaveTimer) { clearTimeout(analysisSaveTimer); analysisSaveTimer = null }
    await Promise.all([
      pdiId ? savePDI(pdiId) : null,
      analysisId ? saveAnalysis(analysisId) : null,
    ])
  }

  async function handleRemoveResult(objectIndex: number) {
    if (isReadOnly) return
    const drawing = ds.getCurrentServerDrawing()
    const obj = drawing?.objects?.[objectIndex]
    if (!obj) return

    ds.removeAnalysisResult(objectIndex)

    // 서버에 저장된 항목이면 삭제 요청
    if (!obj.id.startsWith('manual-')) {
      const instId = requireInstitutionId()
      try {
        await htpService.updateResults(instId, examId, { delete_object_ids: [obj.id] })
      } catch {
        snackbarStore.error('삭제에 실패했습니다.')
      }
    }
  }

  /**
   * --- 영역 추가 ---
   *
   * 항목에 박스를 하나 덧붙인다. "객체 추가"가 아니라 **이미 목록에 있는
   * 항목에 박스를 더하는 것**이다 — label 집합은 해석 API가 고정한다.
   *
   * 탐지된 항목에도 열어 둔다. 박스 개수 자체가 판정이라, 창문이 셋인데 AI가
   * 하나만 찾았으면 둘을 더해야 `개수 → 많다`가 나온다.
   */
  let drawTargetIndex = $state<number | null>(null)

  let drawTargetLabel = $derived(
    drawTargetIndex === null
      ? null
      : ds.getCurrentServerDrawing()?.objects?.[drawTargetIndex]?.label ?? null
  )

  function handleAssignRegion(objectIndex: number) {
    if (isReadOnly) return
    // 같은 항목을 다시 누르면 모드를 끈다 (토글)
    drawTargetIndex = drawTargetIndex === objectIndex ? null : objectIndex
    bbox.deselectBBox()
  }

  function handleDrawComplete(rect: {
    xPercent: number
    yPercent: number
    widthPercent: number
    heightPercent: number
  }) {
    if (drawTargetIndex === null) return
    const label = drawTargetLabel
    ds.addObjectBBox(drawTargetIndex, rect)
    regionDirty = true
    scheduleAnalysisSave()
    const count =
      ds.getCurrentServerDrawing()?.objects?.[drawTargetIndex]?.bbox_data?.points?.length ?? 1
    // 모드는 켜 둔다 — 창문 셋처럼 같은 항목을 연달아 찍는 게 흔하다.
    // 끝내려면 Esc나 배너의 '취소'.
    snackbarStore.info(
      `'${label}' 영역 ${count}개. 계속 그리거나 Esc로 끝내세요. ` +
        `'해석 다시 만들기'를 눌러야 반영됩니다.`,
      4000
    )
  }

  /**
   * 선택한 영역 하나만 제거 — 항목 전체를 비우는 '탐지 취소'와 다르다.
   *
   * 박스 개수가 판정이므로(창문 3개 → '개수 많다'), 잘못 잡힌 박스 하나를
   * 빼는 것과 "이 객체가 아예 없다"고 말하는 것은 서로 다른 진술이다.
   */
  function handleRemoveSelectedBBox() {
    if (isReadOnly || !bbox.activeBBoxId) return
    const at = ds.locateBBox(bbox.activeBBoxId)
    if (!at) return
    ds.removeObjectBBoxAt(at.objectIndex, at.pointIndex)
    regionDirty = true
    // 남은 박스의 id 체계가 바뀔 수 있어(1개가 되면 `#idx`가 사라진다)
    // 선택을 반드시 푼다 — 안 그러면 없는 id를 가리킨 채로 남는다.
    bbox.deselectBBox()
    scheduleAnalysisSave()
  }

  // 탭을 옮기면 지정 모드를 끈다 — objectIndex는 그림마다 다른 배열의
  // 인덱스라, 그대로 두면 다른 그림의 엉뚱한 항목에 좌표가 들어간다.
  $effect(() => {
    ds.currentTabIndex
    drawTargetIndex = null
  })

  async function saveAnalysis(drawingId: string) {
    if (pendingAnalysisDrawingId === drawingId) pendingAnalysisDrawingId = null
    if (isSavingAnalysis) return
    const drawing = ds.rawDrawings.find((d) => d.id === drawingId)
    if (!drawing?.objects) return
    const instId = requireInstitutionId()

    // 완성된 항목만 저장 (수동 항목은 label + main_cond + sub_cond 모두 있어야)
    const objectsToSave = drawing.objects
      .filter((obj) => {
        if (obj.id.startsWith('manual-')) {
          return !!(obj.label && obj.main_cond && obj.sub_cond)
        }
        return true
      })
      .map((obj) => ({
        id: obj.id.startsWith('manual-') ? undefined : obj.id,
        drawing_id: drawing.id,
        label: obj.label,
        main_cond: obj.main_cond,
        sub_cond: obj.sub_cond,
        // 임상가가 옮긴 BBox도 함께 보낸다 — 이 좌표가 재해석의 입력이다.
        bbox_data: obj.bbox_data,
      }))

    if (objectsToSave.length === 0) return

    isSavingAnalysis = true
    try {
      await htpService.updateResults(instId, examId, { objects: objectsToSave })
    } catch {
      snackbarStore.error('분석 결과 저장에 실패했습니다.')
    } finally {
      isSavingAnalysis = false
    }
  }
</script>

<ExamLayoutShell
  headerTitle="이미지 분석"
  headerSubtitle={isReadOnly
    ? '확정된 검사입니다. 읽기 전용으로 표시됩니다.'
    : undefined}
  exitMode={isReadOnly ? 'leave' : 'cancel'}
>
  {#snippet headerExtras()}
    <button
      type="button"
      onclick={() => (panelOpen = true)}
      class="xl:hidden inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-label-01-normal-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      aria-label="분석 패널 열기"
    >
      <Icon name="analytics" size="sm" />
      분석 패널
    </button>
  {/snippet}

  <!-- Content Area -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left: Drawing area -->
    <div class="flex-1 min-w-0 bg-gray-100 flex flex-col overflow-hidden relative">
      <DrawingTabs
        drawings={ds.drawings}
        activeIndex={ds.currentTabIndex}
        onTabChange={handleTabChange}
      />

      <DrawingCanvas
        imageUrl={ds.currentDrawing?.imageUrl}
        originalImageUrl={ds.currentDrawing?.originalImageUrl}
        bboxes={filteredBboxes}
        activeBBoxId={bbox.activeBBoxId}
        onImageUpload={isReadOnly ? undefined : handleImageUpload}
        onBBoxSelect={bbox.selectBBox}
        onBBoxDeselect={bbox.deselectBBox}
        onDragStart={bbox.startDrag}
        onResizeStart={bbox.startResize}
        onPrevious={ds.prevTab}
        onNext={ds.nextTab}
        isFirstTab={ds.isFirstTab}
        isLastTab={ds.isLastTab}
        containerRef={(el) => { canvasContainerEl = el }}
        {drawTargetLabel}
        onDrawComplete={handleDrawComplete}
        onDrawCancel={() => (drawTargetIndex = null)}
        onRemoveSelected={isReadOnly ? undefined : handleRemoveSelectedBBox}
      />

      {#if isLoading}
        <div class="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
          <div class="flex items-center gap-2 text-body-03-normal-regular text-gray-500">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
            검사 데이터를 불러오는 중...
          </div>
        </div>
      {/if}

      {#if ds.isAnalyzing}
        <AnalyzingSpinner />
      {/if}
    </div>

    <!-- Right Panel (xl+ 인라인) -->
    <RightPanel
      pdiLines={ds.currentDrawing?.pdi ?? []}
      analysisResults={ds.currentDrawing?.analysisResults ?? []}
      {visibleBBoxLabels}
      drawingType={ds.currentDrawing?.category}
      readOnly={isReadOnly}
      onRowClick={handleRowClick}
      onSelectAll={handleSelectAll}
      onDeselectAll={handleDeselectAll}
      onExpressionChange={(idx, val) => { ds.updateExpression(idx, val); scheduleAnalysisSave() }}
      onObjectUpdate={(idx, fields) => { ds.updateObject(idx, fields); scheduleAnalysisSave() }}
      onRemoveResult={(idx) => handleRemoveResult(idx)}
      onAssignRegion={isReadOnly ? undefined : handleAssignRegion}
      {drawTargetIndex}
      onAddResult={isReadOnly ? undefined : () => ds.addAnalysisResult()}
      onReinterpret={isReadOnly || !resultsReady ? undefined : handleReinterpret}
      {isReinterpreting}
      {regionDirty}
      onPDIUpdate={handlePDIUpdate}
    />
  </div>

  <!-- Right Panel (< xl 드로어) -->
  <Drawer
    open={panelOpen}
    onClose={() => (panelOpen = false)}
    side="right"
    hideAt="xl"
  >
    <RightPanel
      inDrawer
      pdiLines={ds.currentDrawing?.pdi ?? []}
      analysisResults={ds.currentDrawing?.analysisResults ?? []}
      {visibleBBoxLabels}
      drawingType={ds.currentDrawing?.category}
      readOnly={isReadOnly}
      onRowClick={handleRowClick}
      onSelectAll={handleSelectAll}
      onDeselectAll={handleDeselectAll}
      onExpressionChange={(idx, val) => { ds.updateExpression(idx, val); scheduleAnalysisSave() }}
      onObjectUpdate={(idx, fields) => { ds.updateObject(idx, fields); scheduleAnalysisSave() }}
      onRemoveResult={(idx) => handleRemoveResult(idx)}
      onAssignRegion={isReadOnly ? undefined : handleAssignRegion}
      {drawTargetIndex}
      onAddResult={isReadOnly ? undefined : () => ds.addAnalysisResult()}
      onReinterpret={isReadOnly || !resultsReady ? undefined : handleReinterpret}
      {isReinterpreting}
      {regionDirty}
      onPDIUpdate={handlePDIUpdate}
    />
  </Drawer>

  {#snippet footer()}
    <HTPFooter
      uploadedCount={ds.drawings.filter((d) => d.imageUrl).length}
      totalCount={ds.drawings.length}
      canViewResults={resultsReady}
      viewDisabledHint="AI 분석이 끝난 뒤 결과를 볼 수 있습니다."
      onViewResults={async () => {
        // 미저장 입력을 흘려보낸 뒤 이동한다 — 안 그러면 마지막 편집이
        // debounce 안에서 죽는다.
        await flushPendingSaves()
        goto(`/examinations/${examId}/results`)
      }}
    />
  {/snippet}
</ExamLayoutShell>
