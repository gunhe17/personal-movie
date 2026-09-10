<script lang="ts">
  /**
   * 커스텀 PDF 뷰어 (pdf.js) — 연속 스크롤 + 근거 하이라이트.
   *
   * - 전 페이지를 세로로 이어 붙인 한 문서로 스크롤한다(일반 PDF 뷰어와 같은 감각).
   *   200쪽대 문서를 전부 그리면 메모리·렌더가 무너지므로 **화면 근처만 그린다**
   *   (가상 스크롤): 자리(높이)는 전부 잡아 두고 canvas·텍스트레이어는 보이는 창에만 붙인다.
   * - `page` 변경 → 그 페이지로 스크롤. 이후 이동은 사용자 몫(프롭이 다시 끌어가지 않는다).
   * - `query` 변경 → 해당 페이지 텍스트에서 매칭 구간을 찾아 하이라이트
   *   (공백 제거 정규화 후 exact 매칭 → 실패 시 최장 토큰 매칭)
   *
   * 강조는 **글자 단위**다 — 정규화 문자열의 글자마다 출처를 들고(pdf-charmap),
   * 매칭 구간을 DOM Range 로 되살려 그 실제 사각형만 칠한다.
   *
   * ponytail: 페이지 크기는 1쪽 기준으로 균일하다고 본다(정부 지침서는 균일).
   * 혼합 크기 문서가 들어오면 자리 계산이 어긋난다 — 그때 쪽별 실측으로 올린다.
   */
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  // ?url → 워커 파일의 정적 URL (문자열만 들어와 SSR 안전, 번들 신뢰성↑)
  import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
  import { buildCharMap, findAll, longestToken, norm, type Anchor } from '../pdf-charmap'

  interface Props {
    /** PDF presigned URL */
    url: string
    /** 이동할 페이지 (1-based). null = 1페이지 */
    page?: number | null
    /** 하이라이트할 텍스트 (포커스된 필드의 원문/값) */
    query?: string | null
    /** 총 페이지 수 (로드 후 채워짐) */
    numPages?: number
    /** 뷰포트 최대 높이 */
    maxHeight?: string
  }
  let {
    url,
    page = null,
    query = null,
    numPages = $bindable(0),
    maxHeight = '82vh'
  }: Props = $props()

  const fills = $derived(maxHeight === '100%')

  const GAP = 8 // 쪽 사이 여백(px)
  const OVERSCAN = 1 // 화면 위아래로 더 그려 둘 화면 수

  let scrollEl = $state<HTMLDivElement | null>(null)

  let pdfjs: any = null
  let TextLayerCls: any = null
  let pdfDoc: any = null

  let isReady = $state(false)
  let loadError = $state<string | null>(null)
  let scale = $state(1)
  let pageW = $state(0)
  let pageH = $state(0)
  let scrollTop = $state(0)
  let viewH = $state(0)

  /** 그려진 쪽 — 하이라이트가 글자 앵커를 다시 찾을 수 있게 쪽마다 들고 있는다 */
  type Painted = {
    overlay: HTMLDivElement
    charMap: Anchor<Text>[]
    text: string
  }
  const painted = new Map<number, Painted>()

  const totalH = $derived(numPages ? numPages * (pageH + GAP) : 0)

  /** 화면에 걸치는 쪽 번호들 (오버스캔 포함) */
  const windowPages = $derived.by(() => {
    if (!isReady || !pageH || !numPages) return [] as number[]
    const unit = pageH + GAP
    const pad = viewH * OVERSCAN
    const from = Math.max(1, Math.floor((scrollTop - pad) / unit) + 1)
    const to = Math.min(numPages, Math.ceil((scrollTop + viewH + pad) / unit))
    const out: number[] = []
    for (let n = from; n <= to; n++) out.push(n)
    return out
  })

  /** 툴바에 보이는 쪽 = 화면 중앙에 걸린 쪽 */
  const currentPage = $derived(
    !pageH || !numPages
      ? 1
      : Math.min(numPages, Math.max(1, Math.floor((scrollTop + viewH / 2) / (pageH + GAP)) + 1))
  )

  function clampPage(n: number | null): number {
    const t = n ?? 1
    if (!numPages) return Math.max(1, t)
    return Math.min(Math.max(1, t), numPages)
  }

  function offsetOf(n: number): number {
    return (n - 1) * (pageH + GAP)
  }

  function go(n: number) {
    if (!scrollEl) return
    scrollEl.scrollTop = offsetOf(clampPage(n))
  }

  async function ensureLib() {
    if (pdfjs) return
    pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = PdfWorkerUrl
    TextLayerCls = pdfjs.TextLayer
  }

  async function loadDoc() {
    loadError = null
    isReady = false
    painted.clear()
    try {
      await ensureLib()
      pdfDoc = await pdfjs.getDocument({ url }).promise
      numPages = pdfDoc.numPages

      // 1쪽 기준으로 배율·쪽 크기 확정 (균일 가정)
      const first = await pdfDoc.getPage(1)
      const base = first.getViewport({ scale: 1 })
      const avail = (scrollEl?.clientWidth || 600) - 2
      scale = Math.max(0.2, avail / base.width)
      const vp = first.getViewport({ scale })
      pageW = Math.floor(vp.width)
      pageH = Math.floor(vp.height)

      isReady = true
      measure()
      // 최초 위치 — 프롭이 가리키는 쪽
      await Promise.resolve()
      go(clampPage(page))
      measure()
    } catch (e: any) {
      loadError = e?.message ?? 'PDF를 불러오지 못했습니다.'
    }
  }

  function measure() {
    if (!scrollEl) return
    scrollTop = scrollEl.scrollTop
    viewH = scrollEl.clientHeight
  }

  /** 쪽 하나를 그 자리 노드에 그린다 — {#each} 가 붙일 때 action 으로 호출 */
  function renderPage(node: HTMLDivElement, n: number) {
    let alive = true

    void (async () => {
      if (!pdfDoc) return
      const canvas = node.querySelector('canvas') as HTMLCanvasElement | null
      const overlay = node.querySelector('.pdf-hl-layer') as HTMLDivElement | null
      const textLayer = node.querySelector('.pdf-textlayer') as HTMLDivElement | null
      if (!canvas || !overlay || !textLayer) return
      try {
        const p = await pdfDoc.getPage(n)
        if (!alive) return
        const dpr = window.devicePixelRatio || 1
        const cssVp = p.getViewport({ scale })
        const renderVp = p.getViewport({ scale: scale * dpr })

        const ctx = canvas.getContext('2d')!
        canvas.width = Math.floor(renderVp.width)
        canvas.height = Math.floor(renderVp.height)
        canvas.style.width = Math.floor(cssVp.width) + 'px'
        canvas.style.height = Math.floor(cssVp.height) + 'px'
        await p.render({ canvasContext: ctx, viewport: renderVp, canvas }).promise
        if (!alive) return

        textLayer.innerHTML = ''
        textLayer.style.width = Math.floor(cssVp.width) + 'px'
        textLayer.style.height = Math.floor(cssVp.height) + 'px'
        textLayer.style.setProperty('--scale-factor', String(scale))
        textLayer.style.setProperty('--total-scale-factor', String(scale))
        const tc = await p.getTextContent()
        if (!alive) return
        await new TextLayerCls({
          textContentSource: tc,
          container: textLayer,
          viewport: cssVp
        }).render()
        if (!alive) return

        const chunks: { source: Text; text: string }[] = []
        for (const el of textLayer.querySelectorAll('span')) {
          // markedContent 래퍼는 첫 자식이 element — 건너뛴다
          const t = el.firstChild
          if (t instanceof Text && t.nodeValue) chunks.push({ source: t, text: t.nodeValue })
        }
        const built = buildCharMap(chunks)
        painted.set(n, { overlay, charMap: built.map, text: built.text })
        paint(n)
      } catch {
        /* 스크롤로 즉시 떨어져 나간 쪽 — 다음 진입에서 다시 그린다 */
      }
    })()

    return {
      destroy() {
        alive = false
        painted.delete(n)
      }
    }
  }

  /** 하이라이트 대상 쪽 — 프롭이 가리키는 그 쪽에만 칠한다 */
  const targetPage = $derived(clampPage(page))

  function paint(n: number) {
    const p = painted.get(n)
    if (!p) return
    p.overlay.replaceChildren()
    if (n !== targetPage || !query || !p.text) return

    const q = norm(query)
    if (q.length < 2) return
    let spans = findAll(p.text, q).slice(0, 1)
    if (!spans.length) {
      const tok = longestToken(query)
      const tq = tok ? norm(tok) : ''
      if (tq.length < 2) return
      spans = findAll(p.text, tq)
    }

    const base = p.overlay.getBoundingClientRect()
    const frag = document.createDocumentFragment()
    for (const [lo, hi] of spans) {
      const a = p.charMap[lo]
      const b = p.charMap[hi - 1]
      if (!a || !b || !a.source.isConnected || !b.source.isConnected) continue
      try {
        const r = document.createRange()
        r.setStart(a.source, a.start)
        r.setEnd(b.source, b.end)
        for (const rect of r.getClientRects()) {
          if (rect.width < 0.5 || rect.height < 0.5) continue
          const d = document.createElement('div')
          d.className = 'pdf-hl'
          d.style.left = `${rect.left - base.left}px`
          d.style.top = `${rect.top - base.top}px`
          d.style.width = `${rect.width}px`
          d.style.height = `${rect.height}px`
          frag.appendChild(d)
        }
      } catch {
        /* 렌더 교체와 겹쳐 노드가 바뀐 경우 — 다음 진입이 다시 만든다 */
      }
    }
    p.overlay.appendChild(frag)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      go(currentPage - 1)
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault()
      go(currentPage + 1)
    }
  }

  function onPageInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value)
    if (Number.isFinite(v) && v >= 1) go(v)
  }

  // url 최초 설정/변경 → 로딩
  let loadedUrl = ''
  $effect(() => {
    if (!browser || !url) return
    if (url !== loadedUrl) {
      loadedUrl = url
      loadDoc()
    }
  })

  // page 프롭이 '바뀔 때만' 이동 — 그 사이 사용자가 옮긴 위치를 다시 끌어오지 않는다
  let lastPageProp: number | null | undefined = undefined
  $effect(() => {
    const p = page
    if (p === lastPageProp) return
    lastPageProp = p
    if (isReady) go(clampPage(p))
  })

  // query·대상 쪽 변경 → 이미 그려진 쪽들 다시 칠하기
  $effect(() => {
    query
    targetPage
    if (!isReady) return
    for (const n of painted.keys()) paint(n)
  })

  onDestroy(() => {
    try {
      pdfDoc?.destroy?.()
    } catch {
      /* noop */
    }
  })
</script>

<svelte:window onresize={measure} />

<!-- maxHeight="100%" = 부모 높이를 꽉 채우는 창(분할 패널). 그 외에는 종전처럼 내용만큼. -->
<div
  class="flex flex-col overflow-hidden rounded-lg border border-gray-200 {fills
    ? 'h-full'
    : ''}"
>
  {#if !loadError}
    <div
      class="flex items-center gap-1.5 border-b border-gray-200 bg-white px-2 py-1.5"
      role="toolbar"
      aria-label="PDF 페이지 이동"
    >
      <button
        type="button"
        class="rounded px-2 py-0.5 text-sm text-gray-500 disabled:opacity-30 hover:bg-gray-100"
        disabled={!isReady || currentPage <= 1}
        onclick={() => go(currentPage - 1)}
        aria-label="이전 페이지"
      >
        ◀
      </button>

      <input
        type="number"
        min="1"
        max={numPages || 1}
        value={currentPage}
        onchange={onPageInput}
        disabled={!isReady}
        class="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-center font-mono text-xs outline-none focus:border-primary-400"
        aria-label="페이지 번호"
      />
      <span class="font-mono text-xs text-gray-400">/ {numPages || '—'}</span>

      <button
        type="button"
        class="rounded px-2 py-0.5 text-sm text-gray-500 disabled:opacity-30 hover:bg-gray-100"
        disabled={!isReady || currentPage >= numPages}
        onclick={() => go(currentPage + 1)}
        aria-label="다음 페이지"
      >
        ▶
      </button>
    </div>
  {/if}

  <div
    bind:this={scrollEl}
    class="relative w-full overflow-auto bg-gray-100 focus:outline-none {fills
      ? 'min-h-0 flex-1'
      : ''}"
    style={fills ? '' : `max-height: ${maxHeight}`}
    tabindex="0"
    role="document"
    aria-label="PDF 문서"
    onscroll={measure}
    onkeydown={onKey}
  >
    {#if loadError}
      <div
        class="flex h-full items-center justify-center px-6 text-center text-sm text-gray-400"
        style={fills ? '' : `height: ${maxHeight}`}
      >
        {loadError}
      </div>
    {:else if !isReady}
      <div
        class="flex h-full items-center justify-center text-sm text-gray-400"
        style={fills ? '' : `height: ${maxHeight}`}
      >
        PDF 불러오는 중…
      </div>
    {:else}
      <div class="relative w-full" style="height: {totalH}px">
        {#each windowPages as n (n)}
          <div
            use:renderPage={n}
            class="absolute left-1/2 bg-white shadow-sm"
            style="top: {offsetOf(n)}px; width: {pageW}px; height: {pageH}px; margin-left: {-pageW /
              2}px"
          >
            <canvas class="block"></canvas>
            <!-- 하이라이트: 텍스트레이어(z-1) 아래·canvas 위 -->
            <div class="pdf-hl-layer"></div>
            <div class="pdf-textlayer"></div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* pdf.js v5 텍스트레이어 위치 규칙 (span 은 pdfjs 가 동적 생성 → :global) */
  :global(.pdf-textlayer) {
    position: absolute;
    inset: 0;
    overflow: clip;
    opacity: 1;
    line-height: 1;
    text-align: initial;
    transform-origin: 0 0;
    z-index: 1;
    --min-font-size: 1;
    --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
    --min-font-size-inv: calc(1 / var(--min-font-size));
  }
  :global(.pdf-textlayer :is(span, br)) {
    color: transparent;
    position: absolute;
    white-space: pre;
    transform-origin: 0% 0%;
  }
  :global(.pdf-textlayer > :not(.markedContent)),
  :global(.pdf-textlayer .markedContent span:not(.markedContent)) {
    z-index: 1;
    --font-height: 0;
    font-size: calc(var(--text-scale-factor) * var(--font-height));
    --scale-x: 1;
    --rotate: 0deg;
    transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
  }
  :global(.pdf-textlayer .markedContent) {
    display: contents;
  }
  /* 하이라이트 오버레이 — 자식 div 는 스크립트가 만든다(:global 필요) */
  :global(.pdf-hl-layer) {
    position: absolute;
    inset: 0;
    overflow: clip;
    pointer-events: none;
  }
  :global(.pdf-hl-layer .pdf-hl) {
    position: absolute;
    /* 본문 위에 얹히는 색이라 옅으면 글자에 묻힌다 — 진한 노랑 + 또렷한 테두리 */
    background: rgba(250, 204, 21, 0.75);
    border-radius: 2px;
    box-shadow:
      0 0 0 2px rgba(202, 138, 4, 0.9),
      0 0 12px 2px rgba(250, 204, 21, 0.55);
    mix-blend-mode: multiply;
    animation: pdf-hl-pop 0.45s ease-out;
  }
  /* 바뀐 자리를 눈이 따라가도록 — 한 번만 번쩍인다 */
  @keyframes pdf-hl-pop {
    0% {
      background: rgba(251, 146, 60, 0.95);
      box-shadow:
        0 0 0 3px rgba(234, 88, 12, 1),
        0 0 18px 6px rgba(251, 146, 60, 0.7);
    }
    100% {
      background: rgba(250, 204, 21, 0.75);
      box-shadow:
        0 0 0 2px rgba(202, 138, 4, 0.9),
        0 0 12px 2px rgba(250, 204, 21, 0.55);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.pdf-hl-layer .pdf-hl) {
      animation: none;
    }
  }
</style>
