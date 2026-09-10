<script lang="ts">
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'

  interface Props {
    R: number
    statusText?: string
    canGenerateReport?: boolean
    onPrev: () => void
    onGenerateReport?: () => void
  }
  let {
    R,
    statusText = '',
    canGenerateReport = false,
    onPrev,
    onGenerateReport
  }: Props = $props()
</script>

<div
  class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
>
  <div class="text-sm text-gray-600">
    총 응답 <span class="font-semibold text-gray-900">{R}</span>개
    {#if statusText}
      <span class="ml-3 text-xs text-gray-400">· {statusText}</span>
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <button
      onclick={onPrev}
      class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <ArrowLeft size={20} />
      이전
    </button>

    <button
      onclick={onGenerateReport}
      disabled={!canGenerateReport}
      class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
    >
      <span class="material-icons-round text-[18px]! leading-none">picture_as_pdf</span>
      보고서 PDF
    </button>
  </div>
</div>
