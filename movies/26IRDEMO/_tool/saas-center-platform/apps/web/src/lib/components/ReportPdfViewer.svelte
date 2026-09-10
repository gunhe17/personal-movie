<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type * as PDFJSLib from 'pdfjs-dist'
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  let pdfjsLib: typeof PDFJSLib | null = $state(null)

  interface Props {
    url: string
  }

  let { url }: Props = $props()

  let pdfDoc: PDFJSLib.PDFDocumentProxy | null = $state(null)
  let currentPage = $state(1)
  let totalPages = $state(0)
  let scale = $state(1.0)
  let isLoading = $state(true)
  let loadError = $state<string | null>(null)
  let loadedUrl = $state('')

  let mainCanvas: HTMLCanvasElement | null = $state(null)
  let viewerContainer: HTMLDivElement | null = $state(null)

  const MIN_SCALE = 0.3
  const MAX_SCALE = 3.0
  const SCALE_STEP = 0.1
  const PADDING = 48

  let baseScale = $state(1.0)

  async function initPdfJs() {
    if (pdfjsLib) return
    const lib = await import('pdfjs-dist')
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = workerModule.default
    pdfjsLib = lib
  }

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

  async function loadPDF() {
    if (!url || !mainCanvas || !viewerContainer) return
    if (loadedUrl === url) return

    isLoading = true
    loadError = null
    try {
      await initPdfJs()
      if (!pdfjsLib) return

      if (pdfDoc) {
        pdfDoc.destroy()
        pdfDoc = null
      }

      // 우리가 fetch로 PDF 바이트를 받아서 전달 (인증 포함, HTML 에러 페이지가 넘어가는 것 방지)
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('auth')
        } else if (res.status === 404) {
          throw new Error('not_found')
        } else {
          throw new Error('server')
        }
      }
      const contentType = res.headers.get('content-type') ?? ''
      if (
        !contentType.includes('application/pdf') &&
        !contentType.includes('octet-stream')
      ) {
        throw new Error('invalid_format')
      }
      const arrayBuffer = await res.arrayBuffer()

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      pdfDoc = await loadingTask.promise
      totalPages = pdfDoc.numPages
      loadedUrl = url
      currentPage = 1

      baseScale = await calculateFitScale()
      scale = baseScale
      await renderPage(currentPage)
    } catch (err) {
      console.error('PDF 로드 실패:', err)
      const code = err instanceof Error ? err.message : ''
      if (code === 'auth') {
        loadError = '인증이 만료되었습니다. 페이지를 새로고침 해주세요.'
      } else if (code === 'not_found') {
        loadError = '문서가 삭제되었거나 존재하지 않습니다.'
      } else if (code === 'server') {
        loadError =
          '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      } else if (code === 'invalid_format') {
        loadError = '올바른 PDF 파일이 아닙니다.'
      } else if (err instanceof TypeError) {
        loadError = '네트워크 연결을 확인해주세요.'
      } else {
        loadError = 'PDF를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
      }
    } finally {
      isLoading = false
    }
  }

  async function renderPage(pageNum: number) {
    if (!pdfDoc || !mainCanvas) return
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const context = mainCanvas.getContext('2d')
    if (!context) return
    mainCanvas.height = viewport.height
    mainCanvas.width = viewport.width
    await page.render({
      canvasContext: context,
      viewport,
      canvas: mainCanvas
    }).promise
  }

  async function goToPage(pageNum: number) {
    if (pageNum < 1 || pageNum > totalPages) return
    currentPage = pageNum
    await renderPage(currentPage)
  }

  function prevPage() {
    if (currentPage > 1) goToPage(currentPage - 1)
  }

  function nextPage() {
    if (currentPage < totalPages) goToPage(currentPage + 1)
  }

  async function zoomIn() {
    if (scale < MAX_SCALE) {
      scale = Math.min(scale + SCALE_STEP, MAX_SCALE)
      await renderPage(currentPage)
    }
  }

  async function zoomOut() {
    if (scale > MIN_SCALE) {
      scale = Math.max(scale - SCALE_STEP, MIN_SCALE)
      await renderPage(currentPage)
    }
  }

  async function fitToScreen() {
    baseScale = await calculateFitScale()
    scale = baseScale
    await renderPage(currentPage)
  }

  const scalePercent = $derived(Math.round(scale * 100))

  onMount(() => {
    loadPDF()
  })

  $effect(() => {
    const u = url
    if (u && mainCanvas && viewerContainer && u !== loadedUrl) {
      loadPDF()
    }
  })

  onDestroy(() => {
    if (pdfDoc) {
      pdfDoc.destroy()
    }
  })
</script>

<div
  class="flex h-full flex-col rounded-lg border border-gray-200 bg-gray-100 overflow-hidden"
>
  <div
    bind:this={viewerContainer}
    class="relative flex flex-1 items-center justify-center overflow-auto bg-gray-200 p-6 min-h-0"
  >
    {#if loadError}
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
        <Typography variant="body-01-regular" color="text-gray-700">
          {loadError}
        </Typography>
        <button
          type="button"
          class="mt-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onclick={() => {
            loadedUrl = ''
            loadPDF()
          }}
        >
          다시 시도
        </button>
      </div>
    {:else if isLoading}
      <div
        class="absolute inset-0 z-10 flex items-center justify-center bg-gray-200"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary-500"
        ></div>
      </div>
    {/if}

    <div class="shadow-lg bg-white" class:invisible={isLoading || !!loadError}>
      <canvas bind:this={mainCanvas}></canvas>
    </div>
  </div>

  <!-- 하단 툴바: 페이지 이동 + 줌 + 화면맞춤 -->
  <div
    class="flex h-14 shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4"
  >
    <div class="flex items-center gap-2">
      <Tooltip text="이전 페이지">
        <button
          onclick={prevPage}
          disabled={currentPage <= 1 || isLoading}
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
      <div class="flex items-center gap-1 min-w-[4rem] justify-center">
        <Typography variant="body-02-medium" color="text-gray-700"
          >{currentPage}/{totalPages}</Typography
        >
        <Typography variant="body-02-medium" color="text-gray-500"
          >페이지</Typography
        >
      </div>
      <Tooltip text="다음 페이지">
        <button
          onclick={nextPage}
          disabled={currentPage >= totalPages || isLoading}
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

    <div class="flex items-center gap-4">
      <Tooltip text="축소">
        <button
          onclick={zoomOut}
          disabled={scale <= MIN_SCALE || isLoading}
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
      <div class="flex items-center gap-1 w-12 justify-center">
        <Typography variant="body-02-medium" color="text-gray-700"
          >{scalePercent}%</Typography
        >
      </div>
      <Tooltip text="확대">
        <button
          onclick={zoomIn}
          disabled={scale >= MAX_SCALE || isLoading}
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
      <Button
        class="h-8 rounded-md bg-gray-700 px-3 text-white hover:bg-gray-800"
        onclick={fitToScreen}
        disabled={isLoading}
      >
        <Typography variant="body-02-medium" color="text-white"
          >화면맞춤</Typography
        >
      </Button>
    </div>
  </div>
</div>
