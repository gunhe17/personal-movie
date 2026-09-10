<script lang="ts">
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'

  interface Props {
    codedCount: number
    totalCount: number
    canConfirm: boolean
    isConfirming?: boolean
    isReadOnly?: boolean
    statusText?: string
    /**
     * 확정을 막는 반응 이름들 — 버튼만 비활성이면 임상가가 어디를 고쳐야
     * 할지 찾을 방법이 없다(§14-12).
     */
    uncodedHint?: string
    /**
     * 이전 단계(실시)로. 미제공 시 버튼 숨김.
     *
     * **채점과 실시는 자유롭게 오간다**(§3-1 "벽 없음"). 채점하다 빠진 반응이나
     * 잘못 그린 영역을 발견하면 되돌아가야 하는데, 그 경로가 화면에 없으면
     * 임상가는 URL을 직접 고치거나 포기한다.
     */
    onPrev?: () => void
    onConfirm: () => void
  }

  let {
    codedCount,
    totalCount,
    canConfirm,
    isConfirming = false,
    isReadOnly = false,
    statusText = '',
    uncodedHint = '',
    onPrev,
    onConfirm
  }: Props = $props()

  // 결과보기 버튼은 항상 표시. 확정 가능하거나 이미 확정된 상태면 활성화.
  let canGoNext = $derived(isReadOnly || canConfirm)
  /**
   * **라벨이 동작을 말해야 한다.** 미확정 상태에서 이 버튼은 조회가 아니라
   * 확정을 실행한다 — 되돌릴 수 없는 동작에 '결과 보기'라는 조회 이름이
   * 붙어 있었다.
   */
  let nextLabel = $derived(
    isConfirming ? '확정 중…' : isReadOnly ? '결과 보기' : '채점 확정'
  )
  let nextHint = $derived(
    isReadOnly || canConfirm
      ? null
      : totalCount === 0
        ? '채점할 반응이 없습니다'
        : uncodedHint || `${totalCount - codedCount}개 반응 확인 필요`
  )
</script>

<div
  class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
>
  <div class="text-sm text-gray-600">
    확인됨 <span class="font-semibold text-gray-900">{codedCount}</span> / {totalCount}
    {#if statusText}
      <span class="ml-3 text-xs text-gray-400">· {statusText}</span>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    {#if nextHint}
      <span class="max-w-100 truncate text-xs text-gray-400" title={nextHint}>
        {nextHint}
      </span>
    {/if}

    {#if onPrev}
      <button
        onclick={onPrev}
        class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <ArrowLeft size={20} />
        실시로
      </button>
    {/if}

    <button
      onclick={onConfirm}
      disabled={!canGoNext || isConfirming}
      class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
    >
      {nextLabel}
      <ArrowRight size={20} />
    </button>
  </div>
</div>
