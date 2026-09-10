<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type * as PDFJSLib from 'pdfjs-dist'
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  // 동적으로 로드될 pdfjs 라이브러리
  let pdfjsLib: typeof PDFJSLib | null = $state(null)

  interface ReportToolbarOptions {
    title: string
    onFullScreen?: () => void
    onSendResult?: () => void
  }

  interface Props {
    file: File
    onDownload?: () => void
    onKeyboard?: () => void
    /** true면 상단 헤더(다운로드 버튼) 숨김 */
    hideHeader?: boolean
    /** 보고서용 상단 툴바 (전체화면·제목·결과전송·다운로드). 있으면 기본 헤더 대신 표시 */
    reportToolbar?: ReportToolbarOptions
    /**
     * 초기 줌의 최소 배율 (예: 1.0 = 100%).
     * 화면맞춤이 이보다 작아지면 이 값으로 시작해 PDF가 더 크게 보이게 하고, 스크롤로 확인.
     * 미지정 시 화면맞춤만 사용(작게 보일 수 있음).
     */
    minInitialScale?: number
  }

  let {
    file,
    onDownload,
    onKeyboard,
    hideHeader = false,
    reportToolbar,
    minInitialScale
  }: Props = $props()

  // 전체화면 대상 컨테이너 (reportToolbar 사용 시)
  let fullscreenContainer: HTMLDivElement | null = $state(null)

  // PDF 상태
  let pdfDoc: PDFJSLib.PDFDocumentProxy | null = $state(null)
  let currentPage = $state(1)
  let totalPages = $state(0)
  let scale = $state(1.0)
  let isLoading = $state(true)
  let loadError = $state<string | null>(null)
  let loadedFileName = $state('')

  // Canvas refs
  let mainCanvas: HTMLCanvasElement | null = $state(null)
  let viewerContainer: HTMLDivElement | null = $state(null)

  // 썸네일 목록
  let thumbnails: string[] = $state([])
  let showPageSelector = $state(false)

  // 줌 설정
  const MIN_SCALE = 0.3
  const MAX_SCALE = 3.0
  const SCALE_STEP = 0.1
  const PADDING = 48 // 위아래 여백 (24px * 2)

  // 기본 스케일 (화면맞춤용)
  let baseScale = $state(1.0)

  // PDF.js 라이브러리 초기화 (패키지와 동일 버전 worker 사용)
  async function initPdfJs() {
    if (pdfjsLib) return

    const lib = await import('pdfjs-dist')
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = workerModule.default
    pdfjsLib = lib
  }

  // 화면에 맞는 스케일 계산
  async function calculateFitScale(): Promise<number> {
    if (!pdfDoc || !viewerContainer) return 1.0

    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 1.0 })

    const containerHeight = viewerContainer.clientHeight - PADDING
    const containerWidth = viewerContainer.clientWidth - PADDING

    const scaleHeight = containerHeight / viewport.height
    const scaleWidth = containerWidth / viewport.width

    return Math.min(scaleHeight, scaleWidth)
  }

  // PDF 로드
  async function loadPDF() {
    if (!file || !mainCanvas || !viewerContainer) return
    if (loadedFileName === file.name) return // 이미 로드된 파일이면 스킵

    isLoading = true
    loadError = null
    try {
      await initPdfJs()
      if (!pdfjsLib) return

      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })

      // 이전 문서 정리
      if (pdfDoc) {
        pdfDoc.destroy()
      }

      pdfDoc = await loadingTask.promise
      totalPages = pdfDoc.numPages
      loadedFileName = file.name

      // 화면에 맞는 스케일 계산 후, minInitialScale 이상으로 보이게 할지 적용
      let initialScale = await calculateFitScale()
      if (minInitialScale != null && initialScale < minInitialScale) {
        initialScale = Math.min(minInitialScale, MAX_SCALE)
      }
      baseScale = initialScale
      scale = initialScale

      await renderPage(currentPage)
      generateThumbnails() // 백그라운드에서 썸네일 생성
    } catch (error) {
      console.error('PDF 로드 실패:', error)
      if (error instanceof Error && error.message?.includes('Invalid PDF')) {
        loadError = '파일이 손상되었거나 올바른 PDF 형식이 아닙니다.'
      } else {
        loadError =
          'PDF 파일을 열 수 없습니다. 파일을 확인 후 다시 시도해주세요.'
      }
    } finally {
      isLoading = false
    }
  }

  // 페이지 렌더링
  async function renderPage(pageNum: number) {
    if (!pdfDoc || !mainCanvas) return

    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const context = mainCanvas.getContext('2d')
    if (!context) return

    mainCanvas.height = viewport.height
    mainCanvas.width = viewport.width

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: mainCanvas
    }

    await page.render(renderContext).promise
  }

  // 모든 페이지 썸네일 생성
  async function generateThumbnails() {
    if (!pdfDoc) return

    const newThumbnails: string[] = []
    const thumbnailScale = 0.2

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: thumbnailScale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      const context = canvas.getContext('2d')
      if (!context) continue

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise

      newThumbnails.push(canvas.toDataURL())
    }

    thumbnails = newThumbnails
  }

  // 페이지 이동
  async function goToPage(pageNum: number) {
    if (pageNum < 1 || pageNum > totalPages) return
    currentPage = pageNum
    await renderPage(currentPage)
  }

  // 이전 페이지
  function prevPage() {
    if (currentPage > 1) {
      goToPage(currentPage - 1)
    }
  }

  // 다음 페이지
  function nextPage() {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1)
    }
  }

  // 줌 인
  async function zoomIn() {
    if (scale < MAX_SCALE) {
      scale = Math.min(scale + SCALE_STEP, MAX_SCALE)
      await renderPage(currentPage)
    }
  }

  // 줌 아웃
  async function zoomOut() {
    if (scale > MIN_SCALE) {
      scale = Math.max(scale - SCALE_STEP, MIN_SCALE)
      await renderPage(currentPage)
    }
  }

  // 화면 맞춤
  async function fitToScreen() {
    baseScale = await calculateFitScale()
    scale = baseScale
    await renderPage(currentPage)
  }

  // 다운로드
  function handleDownload() {
    if (onDownload) {
      onDownload()
    } else {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // 전체화면 (reportToolbar 사용 시: 컨테이너를 대상으로 Fullscreen API)
  async function handleFullScreen() {
    if (reportToolbar?.onFullScreen) {
      reportToolbar.onFullScreen()
      return
    }
    if (!fullscreenContainer) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await fullscreenContainer.requestFullscreen()
      }
    } catch {
      // 권한 거부 등
    }
  }

  // 퍼센트 표시
  const scalePercent = $derived(Math.round(scale * 100))

  // 페이지 선택기 외부 클릭 시 닫기
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.closest('.page-selector-container')) {
      showPageSelector = false
    }
  }

  // 마운트 시 PDF 로드
  onMount(() => {
    loadPDF()
    document.addEventListener('click', handleClickOutside)
  })

  // 클린업
  onDestroy(() => {
    if (pdfDoc) {
      pdfDoc.destroy()
    }
    document.removeEventListener('click', handleClickOutside)
  })
</script>

<div
  bind:this={fullscreenContainer}
  class="flex h-full flex-col rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
>
  <!-- 보고서용 상단 툴바: 전체화면 | 제목 | 결과전송·다운로드 -->
  {#if reportToolbar}
    <div
      class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4"
    >
      <Tooltip text="전체화면">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          onclick={handleFullScreen}
          aria-label="전체화면"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 6V2h4M18 6V2h-4M18 14v4h-4M2 14v4h4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>전체화면</span>
        </button>
      </Tooltip>
      <Typography
        variant="body-02-semibold"
        color="text-gray-900"
        className="flex-1 text-center truncate-safe px-4"
      >
        {reportToolbar.title}
      </Typography>
      <div class="flex items-center gap-2">
        <!-- {#if reportToolbar.onSendResult}
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onclick={reportToolbar.onSendResult}
            aria-label="결과 전송"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 3l8 5-8 5V3z" fill="currentColor" />
            </svg>
            <span>결과전송</span>
          </button>
        {/if} -->
        <Tooltip text="다운로드">
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onclick={handleDownload}
            aria-label="다운로드"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 11V3M8 11L5 8M8 11l3-3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M2 13h12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            <span>다운로드</span>
          </button>
        </Tooltip>
      </div>
    </div>
  {:else if !hideHeader}
    <!-- 기본 헤더 (hideHeader 시 숨김) -->
    <div class="flex h-14 shrink-0 items-center justify-end bg-gray-700 px-4">
      <Button
        class="h-9 rounded-lg bg-primary-500 px-4 hover:bg-primary-600"
        onclick={handleDownload}
      >
        <Typography variant="body-02-medium" color="text-white"
          >PDF 다운로드</Typography
        >
      </Button>
    </div>
  {/if}

  <!-- 메인 뷰어 영역: 스크롤은 상단부터, 내부는 작을 때 가운데 정렬 -->
  <div
    bind:this={viewerContainer}
    class="relative flex flex-1 overflow-auto bg-gray-200 p-6"
  >
    {#if loadError}
      <!-- 에러 폴백 UI -->
      <div class="flex flex-col items-center justify-center gap-4 text-center">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-status-danger-bg"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01M12 2L2 20h20L12 2z"
              stroke="#EF4444"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="space-y-1">
          <Typography variant="body-01-regular" color="text-gray-700">
            {loadError}
          </Typography>
        </div>
        <button
          type="button"
          class="mt-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onclick={() => {
            loadedFileName = ''
            loadPDF()
          }}
        >
          다시 시도
        </button>
      </div>
    {:else if isLoading}
      <!-- 로딩 스피너 -->
      <div
        class="absolute inset-0 z-10 flex items-center justify-center bg-gray-200"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary-500"
        ></div>
      </div>
    {/if}

    <!-- 래퍼: canvas 크기에 맞게 늘어나되 최소 100%폭으로 가운데 정렬. 컨테이너보다 크면 내부 스크롤 -->
    {#if !loadError}
      <div
        class="inline-flex min-h-full min-w-full shrink-0 self-start items-center justify-center"
      >
        <div class="shadow-lg bg-white" class:invisible={isLoading}>
          <canvas bind:this={mainCanvas}></canvas>
        </div>
      </div>
    {/if}

    <!-- 케어보드 버튼 (onKeyboard 전달 시에만 표시) -->
    {#if onKeyboard}
      <div class="absolute right-6 bottom-20">
        <Button
          class="h-10 rounded-lg border border-primary-500 bg-white px-4 hover:bg-primary-50"
          onclick={onKeyboard}
        >
          <div class="flex items-center gap-2 text-primary-500">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13 2L3.5 11.5L1 15L4.5 12.5L14 3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <Typography variant="body-02-semibold" color="text-primary-500"
              >케어보드</Typography
            >
          </div>
        </Button>
      </div>
    {/if}
  </div>

  <!-- 하단 툴바 -->
  <div
    class="flex h-16 shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4"
  >
    <!-- 현재 페이지 썸네일 (클릭 시 페이지 선택기 열림) -->
    <div class="page-selector-container relative">
      <Tooltip text="페이지 선택기 열기">
        <button
          onclick={() => (showPageSelector = !showPageSelector)}
          class="flex h-12 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 hover:bg-gray-100 transition-colors"
          aria-label="페이지 선택기 열기"
        >
          {#if thumbnails[currentPage - 1]}
            <div
              class="h-10 w-8 overflow-hidden rounded border border-gray-300 bg-white shadow-sm"
            >
              <img
                src={thumbnails[currentPage - 1]}
                alt="현재 페이지"
                class="h-full w-full object-contain"
              />
            </div>
          {:else}
            <div class="h-10 w-8 rounded border border-gray-300 bg-white"></div>
          {/if}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-gray-500 {showPageSelector
              ? 'rotate-180'
              : ''} transition-transform"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </Tooltip>

      <!-- 페이지 선택기 팝오버 -->
      {#if showPageSelector}
        <div
          class="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
        >
          <div class="grid grid-cols-4 gap-2">
            {#each thumbnails as thumbnail, index}
              <button
                onclick={() => {
                  goToPage(index + 1)
                  showPageSelector = false
                }}
                class="group relative overflow-hidden rounded-lg border-2 bg-white transition-all hover:border-primary-300 hover:shadow-md {currentPage ===
                index + 1
                  ? 'border-primary-500 ring-2 ring-primary-100'
                  : 'border-gray-200'}"
                aria-label="페이지 {index + 1}로 이동"
              >
                <img
                  src={thumbnail}
                  alt="페이지 {index + 1}"
                  class="w-full object-contain"
                />
                <span
                  class="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-xs text-white"
                >
                  {index + 1}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- 줌 & 페이지 컨트롤 -->
    <div class="flex items-center gap-4">
      <!-- 줌 아웃 -->
      <Tooltip text="축소">
        <button
          onclick={zoomOut}
          disabled={scale <= MIN_SCALE}
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          aria-label="축소"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10H16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </Tooltip>

      <!-- 줌 퍼센트 -->
      <div class="flex items-center gap-1">
        <Typography variant="body-02-medium" color="text-gray-700"
          >{scalePercent}</Typography
        >
        <Typography variant="body-02-medium" color="text-gray-500">%</Typography
        >
      </div>

      <!-- 줌 인 -->
      <Tooltip text="확대">
        <button
          onclick={zoomIn}
          disabled={scale >= MAX_SCALE}
          class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          aria-label="확대"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 4V16M4 10H16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </Tooltip>

      <!-- 화면맞춤 버튼 -->
      <Button
        class="h-8 rounded-md bg-gray-700 px-3 text-white hover:bg-gray-800"
        onclick={fitToScreen}
      >
        <Typography variant="body-02-medium" color="text-white"
          >화면맞춤</Typography
        >
      </Button>

      <!-- 페이지 네비게이션 -->
      <div class="flex items-center gap-2">
        <!-- 이전 페이지 -->
        <Tooltip text="이전 페이지">
          <button
            onclick={prevPage}
            disabled={currentPage <= 1}
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label="이전 페이지"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12 5L7 10L12 15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>

        <!-- 페이지 정보 -->
        <div class="flex items-center gap-1">
          <Typography variant="body-02-medium" color="text-gray-700"
            >{currentPage}/{totalPages}</Typography
          >
          <Typography variant="body-02-medium" color="text-gray-500"
            >페이지</Typography
          >
        </div>

        <!-- 다음 페이지 -->
        <Tooltip text="다음 페이지">
          <button
            onclick={nextPage}
            disabled={currentPage >= totalPages}
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            aria-label="다음 페이지"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 5L13 10L8 15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</div>
