<script lang="ts">
  import PdfHighlightViewer from './PdfHighlightViewer.svelte'

  interface Props {
    /** presigned URL — 뷰어에는 file-proxy 경유로 전달 (confirm 페이지 동일 방식) */
    url: string
  }

  let { url }: Props = $props()

  const proxiedUrl = $derived(`/api/file-proxy?url=${encodeURIComponent(url)}`)
  let page = $state(1)
  let numPages = $state(0)
</script>

<div>
  <div class="mb-2 flex items-center justify-center gap-3">
    <button
      type="button"
      disabled={page <= 1}
      onclick={() => (page = Math.max(1, page - 1))}
      class="rounded-md border border-gray-200 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
    >
      ← 이전
    </button>
    <span class="font-mono text-xs text-gray-500">
      {page} / {numPages || '–'}
    </span>
    <button
      type="button"
      disabled={numPages > 0 && page >= numPages}
      onclick={() => (page = numPages ? Math.min(numPages, page + 1) : page + 1)}
      class="rounded-md border border-gray-200 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
    >
      다음 →
    </button>
  </div>
  <PdfHighlightViewer url={proxiedUrl} {page} bind:numPages maxHeight="40vh" />
</div>
