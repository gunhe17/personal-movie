<script lang="ts">
  /**
   * 결과 단계 푸터 — 확정 / 보고서 PDF.
   *
   * 'AI 분석 실행'은 응답 검토 단계로 옮겨졌다(SCTReviewFooter).
   * 예전에는 이 하나가 review/analyzing/results를 다 처리했다.
   */
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import Check from '$lib/assets/icons/Check.svelte'

  interface Props {
    /** 응답 수 — 좌측 진행 표시 */
    responseCount?: number
    /** 좌측에 덧붙일 상태 문구 */
    statusText?: string
    isConfirming?: boolean
    isDownloadingPdf?: boolean
    canDownloadReport?: boolean
    /**
     * 앞 단계로 — 갈 수 있을 때만 넘긴다(없으면 버튼을 감춘다).
     * HTP·로르샤하 결과 화면도 같은 자리에 둔다.
     */
    prevLabel?: string
    onPrev?: () => void
    onConfirm: () => void
    onDownloadPdf: () => void
  }

  let {
    responseCount = 0,
    statusText = '',
    isConfirming = false,
    isDownloadingPdf = false,
    canDownloadReport = false,
    prevLabel = '이전',
    onPrev,
    onConfirm,
    onDownloadPdf
  }: Props = $props()
</script>

<div
  class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
>
  <div class="text-sm text-gray-600">
    총 응답 <span class="font-semibold text-gray-900">{responseCount}</span>개
    {#if statusText}
      <span class="ml-3 text-xs text-gray-400">· {statusText}</span>
    {/if}
  </div>

  <!--
    '목록으로'는 두지 않는다 — 이탈은 헤더의 버튼 하나로 모았다.
    다만 **앞 단계로 돌아가는 것은 남긴다.** 한때 "이동은 사이드바에 있다"는
    이유로 뺐었는데, 그 근거였던 사이드바의 검사 목록 링크가 이후 걷혔다.
    HTP·로르샤하 결과 화면은 둘 다 이 자리에 '이전'을 두고 있어 SCT만 달랐다.
  -->
  <div class="flex items-center gap-2">
    {#if onPrev}
      <button
        type="button"
        onclick={onPrev}
        class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <ArrowLeft size={20} />
        {prevLabel}
      </button>
    {/if}

    {#if canDownloadReport}
      <button
        type="button"
        onclick={onDownloadPdf}
        disabled={isDownloadingPdf}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-600"
      >
        <span class="material-icons-round text-[18px]! leading-none"
          >picture_as_pdf</span
        >
        {isDownloadingPdf ? '생성 중…' : '보고서 PDF'}
      </button>
    {:else}
      <button
        type="button"
        onclick={onConfirm}
        disabled={isConfirming}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-600"
      >
        <Check size={20} />
        {isConfirming ? '확정 중…' : '검사 확정'}
      </button>
    {/if}
  </div>
</div>
