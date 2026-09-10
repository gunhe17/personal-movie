<script lang="ts">
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'
  import Tooltip from '$lib/components/ui/Tooltip.svelte'

  interface Props {
    answeredCount: number
    totalCount: number
    onPrev: () => void
    onNext: () => void
    onViewResults: () => void
    isFirstItem: boolean
    isLastItem: boolean
    canViewResults: boolean
  }

  let {
    answeredCount,
    totalCount,
    onPrev,
    onNext,
    onViewResults,
    isFirstItem,
    isLastItem,
    canViewResults
  }: Props = $props()
</script>

<div
  class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
>
  <div class="text-sm text-gray-600">
    응답 <span class="font-semibold text-gray-900">{answeredCount}</span> / {totalCount}
  </div>

  <!-- 이탈은 헤더의 '검사 중단' 하나로 모았다. 여기는 문항 이동만. -->
  <div class="flex items-center gap-2">
    <!--
      첫 문항에서는 '이전'을 숨긴다 — 갈 곳이 없는 버튼을 회색으로 남겨 두면
      "왜 눌리지 않지"를 한 번 생각하게 만든다. 오른쪽도 마지막 문항에서
      '다음'을 '검토하기'로 갈아끼우므로(아래), 상황에 없는 선택지는 그리지
      않는다는 같은 규칙이다.
    -->
    {#if !isFirstItem}
      <button
        type="button"
        onclick={onPrev}
        class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <ArrowLeft size={20} />
        이전
      </button>
    {/if}

    {#if isLastItem}
      <Tooltip
        text={!canViewResults ? '응답을 하나 이상 입력해주세요.' : ''}
        placement="top"
      >
        <button
          type="button"
          onclick={onViewResults}
          disabled={!canViewResults}
          class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
        >
          검토하기
          <ArrowRight size={20} />
        </button>
      </Tooltip>
    {:else}
      <button
        type="button"
        onclick={onNext}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors"
      >
        다음
        <ArrowRight size={20} />
      </button>
    {/if}
  </div>
</div>
