<style>
  /* 종합 리뷰에서 "해당 위치로 이동"을 눌렀을 때 대상 문단 강조.
     문단 엘리먼트는 PaginatedEditor 내부에서 만들어지므로 :global 필요.
     (이 화면에 남은 유일한 스타일이다 — 나머지는 각 컴포넌트가 들고 갔다.) */
  :global(.review-jump-target) {
    animation: review-jump 2s ease-out;
    border-radius: 4px;
  }
  @keyframes review-jump {
    0%,
    100% {
      background: transparent;
      box-shadow: none;
    }
    12%,
    62% {
      background: rgba(139, 92, 246, 0.18);
      box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.18);
    }
  }
</style>

<script lang="ts">
  /**
   * 종합보고서 편집 화면.
   *
   * 이 파일은 조립만 한다 — 데이터/상태머신/서비스를 초기화하고, 화면 고유의
   * 표시 상태(탭·접기·표시 패널)를 들고, 컴포넌트에 넘긴다.
   * (docs/FRONTEND_ARCHITECTURE.md §2 레이어 구조)
   *
   *   report-data.svelte.ts        실데이터 로드 + 자료 목록 파생
   *   report-template.ts           표지·본문·마무리 조립 (순수)
   *   report-editor-service.ts     본문 편집 + 모달 + 토스트 + PDF
   *   attachment.svelte.ts         첨부 자료 추적 + 말풍선
   *   overall-review / span-review AI 리뷰 상태머신
   *   span-selection.ts            "무엇이 선택됐는가" 판정 (순수)
   */
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import PaginatedEditor, {
    type InitialBlock,
    type BlockState
  } from '$lib/components/document-editor/components/PaginatedEditor.svelte'
  import type { DocMeta } from '$lib/components/document-editor/components/report-cover'
  import type {
    EditorDoc,
    MarkStyle,
    MarkKey,
    ListType,
    BlockStyle
  } from '$lib/components/document-editor/editor-core'
  import { institutionId } from '$lib/stores/institution.store'
  import type { MaterialAsset, MaterialGroup } from '$lib/features/report/materials'
  import ReportHeader from '$lib/features/report/ReportHeader.svelte'
  import ReportSidebar from '$lib/features/report/ReportSidebar.svelte'
  import type { SideTab } from '$lib/features/report/SidebarTabs.svelte'
  import DisplaySettings from '$lib/features/report/DisplaySettings.svelte'
  import SpanReviewButton from '$lib/features/report/SpanReviewButton.svelte'
  import FormatToolbar from '$lib/features/report/FormatToolbar.svelte'
  import AttachedAssetPopover from '$lib/features/report/AttachedAssetPopover.svelte'
  import AiReviewCard from '$lib/features/report/AiReviewCard.svelte'
  import OverallReviewPanel from '$lib/features/report/OverallReviewPanel.svelte'
  import type { ReviewBlock } from '$lib/features/report/overall-review'
  import { createOverallReview } from '$lib/features/report/overall-review.svelte'
  import { createSpanReview } from '$lib/features/report/span-review.svelte'
  import { judgeSelection } from '$lib/features/report/span-selection'
  import { createReportData } from '$lib/features/report/report-data.svelte'
  import { createAttachmentTracker } from '$lib/features/report/attachment.svelte'
  import {
    buildReportTemplate,
    reportFileName
  } from '$lib/features/report/report-template'
  import {
    createBlockJumper,
    createReportEditorService
  } from '$lib/features/report/report-editor-service'

  let { data } = $props<{ data: { examId: string; examIds: string[] } }>()

  // ── 실데이터 ──
  const report = createReportData()
  let examIds = $derived(data.examIds)

  $effect(() => {
    report.loadOnce($institutionId, examIds, buildTemplate)
  })

  // ── 서식 툴바 ──
  let editor = $state<PaginatedEditor>()
  let activeStyle = $state<MarkStyle>({})
  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28]
  const FONT_SIZE_OPTIONS = FONT_SIZES.map((s) => ({
    value: s,
    label: String(s)
  }))
  let curSize = $state<number>(14)

  function fmt(key: MarkKey, value?: boolean | number) {
    editor?.toggleStyle(key, value)
  }
  function onStyleChange(style: MarkStyle) {
    activeStyle = style
    // size가 없으면(기본 크기 구간) 툴바 표시도 기본값 14로 복원.
    // 이전 크기(예: 24)가 남아 실제 문맥과 어긋나는 문제 방지.
    curSize = style.size ?? 14
  }

  // 표지/마무리 화면 숨김 (PDF엔 항상 포함, 편집 화면 시야만 정리)
  let hideCover = $state(true)
  let hideClosing = $state(true)
  // 화면 표시 설정 패널 펼침 여부 (사이드바 상단 아이콘 버튼으로 토글)
  let showDisplayPanel = $state(false)

  // 커서 문단의 블록 상태(리스트/타이틀/인용) — 툴바 활성 표시용
  let blockState = $state<BlockState>({})
  function onBlockChange(state: BlockState) {
    blockState = state
  }
  function toggleList(type: ListType) {
    editor?.toggleListStyle(type)
  }
  function toggleBlock(style: BlockStyle) {
    editor?.toggleBlock(style)
  }
  function insertDivider() {
    editor?.insertDivider()
  }

  // ── 좌측 사이드바 탭 ──
  // materials: 검사결과(헤더) + 소속 에셋 통합 / longitudinal: 검사 간 교차분석
  let activeTab = $state<SideTab>('materials')

  // 검사 헤더 접기/펼치기 (기본 전부 펼침)
  let collapsed = $state<Set<string>>(new Set())
  function toggleCollapse(id: string) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsed = next
  }

  // ── 본문 편집 서비스 (본문 삽입·수정·모달·PDF) ──
  // 에디터 인스턴스는 bind:this로 늦게 채워지므로 게터로 넘긴다.
  const service = createReportEditorService({
    getEditor: () => editor,
    getAssets: () => report.assets,
    readReviewBlocks,
    // 본문이 바뀌었으니 리뷰를 갱신한다 (지적이 실제로 사라지는 걸 보여준다).
    // 4단계 진행은 다시 보여주지 않는다 — 이미 분석을 본 상태라
    // 점수와 지적이 즉시 갱신되는 편이 낫다.
    onDocumentChanged: () => overall.refresh()
  })

  // ── AI 리뷰 상태머신 ──
  // 구간 리뷰가 드래그한 문장만 본다면, 종합 리뷰는 보고서 전체를 훑는다.
  // 단계·타이머는 각 .svelte.ts가 갖는다. 여기서 넘기는 건 "본문을 읽는 법"뿐
  // — 상태머신이 에디터 API에 묶이지 않게 하려는 것.
  const spanReview = createSpanReview()

  /** 에디터 문서를 리뷰용 블록으로 변환 (이미지/표 등 텍스트 없는 블록은 제외) */
  function readReviewBlocks(): ReviewBlock[] {
    const doc = editor?.getDoc()
    if (!doc) return []
    return doc.paras
      .filter((p) => (p.kind ?? 'body') === 'body')
      .map((p) => ({
        id: p.id,
        text: p.text ?? '',
        isHeading: p.blockStyle === 'heading'
      }))
  }

  const overall = createOverallReview(readReviewBlocks)
  const jumper = createBlockJumper()

  // mouseup 시점에만 selection 확인 — selectionchange는 드래그 중 계속 발화해 과도함.
  // 판정 자체는 span-selection.ts, 여기는 화면 사정(표시 패널 닫기)만 얹는다.
  function onDocMouseUp(e: MouseEvent) {
    const target = e.target as HTMLElement | null

    // 화면 표시 패널: 바깥 클릭 시 닫기 (버튼/패널 내부는 유지)
    if (showDisplayPanel && !target?.closest('[data-display-panel]')) {
      showDisplayPanel = false
    }

    const judged = judgeSelection(target)
    if (judged.kind === 'ignore') return
    if (judged.kind === 'clear') {
      if (spanReview.phase !== 'idle') spanReview.close()
      return
    }
    // 선택 직후엔 버튼만 띄운다 — 편집 중 카드가 튀어나오지 않게
    spanReview.prompt(
      judged.text,
      judged.at,
      editor?.captureSelection() ?? null
    )
  }

  /** 구간 리뷰의 수정안 적용 (카드의 개별 1건 / 전체) */
  function applyFixPairs(pairs: [string, string][]) {
    const ok = service.applySpanFix(
      spanReview.currentRange(),
      spanReview.text,
      pairs
    )
    if (!ok) return
    spanReview.clearRange()
    spanReview.close()
  }
  function applyReviewFix(before: string, after: string) {
    applyFixPairs([[before, after]])
  }

  // ── 사이드바 자료 ──
  const attachment = createAttachmentTracker()

  /** 끌고 있는 자료 — 드롭 좌표에 커서를 놓고 클릭 삽입과 같은 경로로 넣는다 */
  let dragging = $state<{ g: MaterialGroup; a: MaterialAsset } | null>(null)
  function onEditorDrop(e: DragEvent) {
    if (!dragging) return
    e.preventDefault()
    editor?.placeCaretAtPoint(e.clientX, e.clientY)
    service.insertMaterial(dragging.g, dragging.a)
    dragging = null
  }

  /** 첨부된 자료 클릭 — 말풍선을 띄우면서 본문 위치도 함께 보여준다 */
  function onAttachedClick(a: MaterialAsset, e: MouseEvent) {
    attachment.openPopover(a, e)
    service.revealAttached(a.id)
  }

  function removeAttachedAsset() {
    const target = attachment.popover
    if (!target) return
    service.removeAttached(target.assetId, target.name)
    attachment.closePopover()
  }

  // 페이지를 떠날 때 예약된 타이머 정리 (언마운트 후 상태 갱신 시도를 막는다).
  // 구간 리뷰의 분석 타이머는 예전엔 여기서 빠져 있었다 — 각 상태머신이
  // destroy()로 제 타이머를 챙기게 되면서 빠뜨릴 자리가 없어졌다.
  onDestroy(() => {
    overall.destroy()
    spanReview.destroy()
    jumper.destroy()
  })

  // ── 보고서 템플릿 ── (조립은 report-template.ts, 여기는 실데이터만 넘긴다)
  let docMeta = $state<DocMeta>({})
  let template = $state<InitialBlock[]>([])

  function buildTemplate() {
    const built = buildReportTemplate({
      exams: report.exams,
      client: report.client,
      primaryExaminer: report.primaryExaminer,
      examiners: report.examiners
    })
    docMeta = built.docMeta
    template = built.blocks
  }

  // ── 본문 상태 ──
  let stat = $state<{ paras: number; chars: number }>({ paras: 0, chars: 0 })

  function onChange(doc: EditorDoc) {
    stat = {
      paras: doc.paras.length,
      chars: doc.paras.reduce((n, p) => n + p.text.length, 0)
    }
    attachment.sync(doc)
  }

  // ── 보고서 생성 (PDF 다운로드) ──
  let generating = $state(false)

  async function generateReport() {
    if (generating) return
    generating = true
    try {
      await service.generatePdf(reportFileName(report.client))
    } finally {
      generating = false
    }
  }
</script>


<svelte:head>
  <title>종합보고서 작성 · {data.examId}</title>
</svelte:head>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && attachment.popover) attachment.closePopover()
  }}
/>

<svelte:document onmouseup={onDocMouseUp} />

<!--
  골격 — 헤더가 전폭 최상단, 사이드바는 그 아래.
  검사 진행 화면(ExamLayoutShell)과 같은 순서다.
-->
<div class="fixed inset-0 z-50 flex h-screen flex-col overflow-hidden bg-chrome">
  <ReportHeader
    paras={stat.paras}
    chars={stat.chars}
    {generating}
    ready={report.loaded}
    ongenerate={generateReport}
    onexit={() => goto('/examinations')}
  />

  <div class="flex min-h-0 flex-1">
    <ReportSidebar
      {activeTab}
      onSelectTab={(t) => (activeTab = t)}
      groups={report.materialGroups}
      assetsLoading={report.assetsLoading}
      {collapsed}
      isAttached={attachment.isAttached}
      onToggleCollapse={toggleCollapse}
      onOpenResult={service.openGroupResult}
      onAssetClick={service.insertMaterial}
      onAssetDragStart={(g, a) => (dragging = { g, a })}
      {onAttachedClick}
      onScroll={() => attachment.popover && attachment.closePopover()}
      client={report.client}
      loaded={report.loaded}
    />

    <!-- ── 우측 메인 ── -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <FormatToolbar
        {activeStyle}
        {blockState}
        fontSize={curSize}
        fontSizeOptions={FONT_SIZE_OPTIONS}
        reviewOpen={overall.open}
        review={overall.review}
        ready={report.loaded}
        onMark={fmt}
        onFontSize={(n) => {
          curSize = n
          fmt('size', n)
        }}
        onList={toggleList}
        onIndent={(d) => editor?.changeIndent(d)}
        onBlock={toggleBlock}
        onDivider={insertDivider}
        onToggleReview={overall.toggle}
      />

      <div class="relative min-h-0 flex-1">
        <DisplaySettings
          open={showDisplayPanel}
          bind:hideCover
          bind:hideClosing
          ontoggle={() => (showDisplayPanel = !showDisplayPanel)}
        />

        <!--
          종합 리뷰 패널이 열려 있으면 그 폭(400px)만큼 오른쪽 여백을 준다.
          .workspace가 align-items:center이므로, 폭이 줄면 본문 A4는 자동으로
          "패널을 제외한 영역의 가운데"에 놓인다. (translate로 밀면 이동할 때마다
          위치가 튀어 보여서 이 방식으로 바꿨다.)

          padding이 아니라 width를 줄이는 이유: PaginatedEditor의 .editor-shell은
          자체 배경(#52555c)을 깔고 페이지는 794px 고정이라, 패딩으로 밀면 셸 배경과
          페이지가 패딩 영역 위로 흘러넘쳐 패널 밖으로 삐져나온다. 폭 자체를 줄이면
          넘칠 자리가 없어지고 overflow-y가 잘라 준다.
        -->
        <main
          class="scrollbar-custom scrollbar-editor h-full overflow-x-auto overflow-y-auto bg-background transition-[width] duration-300"
          ondragover={(e) => {
            if (!dragging) return
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
          }}
          ondrop={onEditorDrop}
          style={overall.open
            ? 'width: max(794px, calc(100% - 400px))'
            : 'width: 100%'}
        >
          {#if report.loaded}
            <PaginatedEditor
              bind:this={editor}
              initialBlocks={template}
              {docMeta}
              {onChange}
              {onStyleChange}
              {onBlockChange}
              {hideCover}
              {hideClosing}
            />
          {:else}
            <div
              class="flex h-full items-center justify-center text-title-01-normal-regular text-chrome-fg-3"
            >
              검사 정보를 불러오는 중…
            </div>
          {/if}
        </main>

        <!-- ── 종합 AI 리뷰 패널 (본문 위 오버레이) ── -->
        <OverallReviewPanel
          open={overall.open}
          phase={overall.phase}
          review={overall.review}
          stepIndex={overall.step}
          onclose={overall.close}
          onjump={jumper.jumpTo}
          onrerun={overall.run}
          onpreview={service.openFixPreview}
        />
      </div>
    </div>
  </div>
</div>

<!-- 첨부된 자료 말풍선 — fixed 좌표라 자료 그리드 밖에서 렌더된다 -->
{#if attachment.popover}
  <AttachedAssetPopover
    x={attachment.popover.x}
    y={attachment.popover.y}
    onclose={attachment.closePopover}
    onremove={removeAttachedAsset}
  />
{/if}

<!-- ── 구간 AI 리뷰: 본문 텍스트 선택 → 버튼 → 분석 결과 카드 ── -->
<SpanReviewButton
  phase={spanReview.phase}
  x={spanReview.x}
  y={spanReview.y}
  onrun={spanReview.run}
/>

<AiReviewCard
  open={spanReview.phase === 'result'}
  text={spanReview.text}
  x={spanReview.x}
  y={spanReview.y}
  onclose={spanReview.close}
  onapply={applyReviewFix}
  onapplyall={applyFixPairs}
/>
