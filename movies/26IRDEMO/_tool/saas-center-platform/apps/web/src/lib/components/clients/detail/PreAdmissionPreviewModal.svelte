<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import PreAdmissionTab from './PreAdmissionTab.svelte'
  import type { ClientDocumentItem } from '$lib/types/client'

  interface Props {
    onClose: () => void
    // ── PreAdmissionTab passthrough ──
    preAdmissionState: string
    preAdmissionDocument: ClientDocumentItem | null
    preAdmissionPdfDocument: ClientDocumentItem | null
    preAdmissionImageDocument: ClientDocumentItem | null
    fileCache: Record<string, File>
    submittedInstance: any | null
    templateSchema: any | null
    preAdmissionFileLoading: boolean
    onUploadClick: () => void
    onResendClick: () => void
  }

  let { onClose, ...rest }: Props = $props()

  // ESC로 닫기
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- z-50: modalStore(z-10000) 하위 — 업로드/재요청 모달이 이 위에 겹쳐 뜨도록 -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  transition:fade={{ duration: 120 }}
>
  <button
    type="button"
    class="absolute inset-0 bg-black/40"
    aria-label="닫기"
    onclick={onClose}
  ></button>

  <div
    transition:scale={{ duration: 150, start: 0.98 }}
    class="relative z-10 flex h-[85vh] max-h-[760px] w-[min(92vw,720px)] flex-col overflow-hidden rounded-2xl bg-white shadow-overlay"
  >
    <!-- 헤더 -->
    <header
      class="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4"
    >
      <Typography variant="title-01-normal-semibold" color="text-gray-900">
        사전기록지
      </Typography>
      <button
        type="button"
        onclick={onClose}
        aria-label="닫기"
        class="flex-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M15 5 5 15M5 5l10 10"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>

    <!-- 프리뷰 본문 (ContentPanel과 동일한 래퍼 규칙) -->
    <div class="min-h-0 flex-1 overflow-y-auto p-5">
      <PreAdmissionTab {...rest} />
    </div>
  </div>
</div>
