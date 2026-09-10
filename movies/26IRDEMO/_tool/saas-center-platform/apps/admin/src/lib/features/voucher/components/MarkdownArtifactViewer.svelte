<script lang="ts">
  interface Props {
    /** presigned URL — 동일 오리진 file-proxy 경유로 fetch (CORS 우회, PdfHighlightViewer 동일) */
    url: string
  }

  let { url }: Props = $props()

  // S1 산출 md 어휘는 닫혀 있다(processing_spec S1_WHOLE_SYS: 산문 그대로 + HTML <table>).
  // 페이지 마커로 나누고 표만 HTML 통과 — 범용 md 파서 불요. {@html}은 자사 파이프라인
  // 산출물(운영자 내부 도구)만 렌더하므로 허용.
  interface Segment {
    kind: 'html' | 'text'
    content: string
  }
  interface Page {
    id: string | null
    segments: Segment[]
  }

  let pages = $state<Page[] | null>(null)
  let error = $state<string | null>(null)

  function segment(body: string): Segment[] {
    const segs: Segment[] = []
    let last = 0
    for (const m of body.matchAll(/<table[\s\S]*?<\/table>/g)) {
      const before = body.slice(last, m.index).trim()
      if (before) segs.push({ kind: 'text', content: before })
      segs.push({ kind: 'html', content: m[0] })
      last = m.index + m[0].length
    }
    const rest = body.slice(last).trim()
    if (rest) segs.push({ kind: 'text', content: rest })
    return segs
  }

  function parse(md: string): Page[] {
    const parts = md.split(/<!--\s*(p-\d+)\s*-->/)
    const out: Page[] = []
    if (parts[0].trim()) out.push({ id: null, segments: segment(parts[0]) })
    for (let i = 1; i < parts.length; i += 2) {
      out.push({ id: parts[i], segments: segment(parts[i + 1] ?? '') })
    }
    return out
  }

  $effect(() => {
    fetch(`/api/file-proxy?url=${encodeURIComponent(url)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((t) => (pages = parse(t)))
      .catch((e) => (error = String(e)))
  })
</script>

<!-- 인라인 섹션용 컴팩트 높이 — 페이지 스크롤을 밀지 않게 -->
<div
  class="overflow-y-auto rounded-lg border border-gray-200 bg-white px-5 py-4"
  style="max-height: 40vh"
>
  {#if error}
    <p class="py-10 text-center text-sm text-red-500">불러오지 못했습니다: {error}</p>
  {:else if !pages}
    <p class="py-10 text-center text-sm text-gray-400">불러오는 중...</p>
  {:else}
    <div class="md-doc space-y-6">
      {#each pages as page, i (i)}
        <section>
          {#if page.id}
            <div class="mb-2 border-b border-gray-100 pb-1">
              <span class="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                {page.id}
              </span>
            </div>
          {/if}
          {#each page.segments as seg, j (j)}
            {#if seg.kind === 'html'}
              <div class="overflow-x-auto">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html seg.content}
              </div>
            {:else}
              <p class="whitespace-pre-wrap py-1 text-sm leading-6 text-gray-800">
                {seg.content}
              </p>
            {/if}
          {/each}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .md-doc :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.5rem 0;
    font-size: 0.8125rem;
  }
  .md-doc :global(td),
  .md-doc :global(th) {
    border: 1px solid #e5e7eb;
    padding: 0.375rem 0.5rem;
    vertical-align: top;
    color: #1f2937;
  }
</style>
