<script lang="ts">
  /**
   * 응답 검토 단계 푸터 — AI 분석 실행 하나만 담당한다.
   *
   * 예전에는 SCTResultsFooter가 review/analyzing/results 세 phase를 다 처리했다.
   * 검토와 결과를 별도 단계로 나누면서 각 단계가 자기 푸터를 갖는다.
   */
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'
  import Play from '$lib/assets/icons/Play.svelte'

  interface Props {
    /** 응답 수 — 좌측 진행 표시 */
    responseCount?: number
    /** 분석 실행 중이면 스피너로 바뀐다 */
    isAnalyzing?: boolean
    /** 확정 이후 — 재분석 버튼을 감춘다 */
    isReadOnly?: boolean
    /**
     * 앞 단계로 — 갈 수 있을 때만 넘긴다(없으면 버튼을 감춘다).
     *
     * 확정된 검사는 문장 완성 단계가 잠기므로 여기가 null이 된다. 예전에는
     * 경로를 직접 적어 버튼이 늘 보였는데, 누르면 잠금 가드가 되돌려 보냈다.
     */
    prevLabel?: string
    onPrev?: () => void
    /** 다음 단계로 — 위와 같다. 열리지 않았으면 넘기지 않는다. */
    nextLabel?: string
    onNext?: () => void
    onStartAnalysis: () => void
  }

  let {
    responseCount = 0,
    isAnalyzing = false,
    isReadOnly = false,
    prevLabel = '이전',
    onPrev,
    nextLabel = '다음',
    onNext,
    onStartAnalysis
  }: Props = $props()
</script>

<div
  class="flex h-16 shrink-0 items-center justify-between border-t border-gray-200 bg-white px-6"
>
  <div class="text-sm text-gray-600">
    총 응답 <span class="font-semibold text-gray-900">{responseCount}</span>개
  </div>

  <!--
    단계 이동은 앞뒤 모두 둔다 — 검토는 수집과 결과 사이에 끼어 있다.
    확정된 검사는 재분석 버튼이 사라지는데, 그때 이동 수단이 하나도 없으면
    이 화면에 갇힌다(HTP·로르샤하는 결과 화면에 '이전'을 두고 있었다).
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

    {#if isReadOnly}
      <!--
        확정된 검사는 재분석하지 않는다(확정본이 바뀐다). 버튼 자리를 비워 둘 뿐
        문구는 넣지 않는다 — 헤더 부제가 이미 확정 상태를 알려줘 중복이었다.
      -->
    {:else if isAnalyzing}
      <span class="mr-1 inline-flex items-center gap-2 text-sm text-gray-500">
        <span
          class="h-3 w-3 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600"
        ></span>
        AI 분석 중…
      </span>
    {:else}
      <button
        type="button"
        onclick={onStartAnalysis}
        class="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-5 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
      >
        <Play size={20} />
        AI 분석 실행
      </button>
    {/if}

    {#if onNext}
      <button
        type="button"
        onclick={onNext}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
      >
        {nextLabel}
        <ArrowRight size={20} />
      </button>
    {/if}
  </div>
</div>
