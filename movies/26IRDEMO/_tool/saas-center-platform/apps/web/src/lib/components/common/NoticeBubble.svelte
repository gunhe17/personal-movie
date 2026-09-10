<script module lang="ts">
  /** bottom-start 의 꼬리 중심(px) — 호출부가 앵커 정렬에 쓴다 */
  export const ARROW_START_OFFSET = 16
</script>

<script lang="ts">
  /**
   * NoticeBubble — 툴팁 모양(어두운 말풍선)의 **상시 노출** 고지.
   *
   * hover 로 뜨는 `Tooltip` 과 달리, 항상 떠 있고 사용자가 X 로 닫는다.
   * 배너처럼 자리를 차지하지 않으면서 특정 요소를 가리켜야 할 때 쓴다.
   *
   * 사용:
   *   <NoticeBubble text="3개의 미청구" onClose={() => (closed = true)} />
   *
   * 위치는 이 컴포넌트가 정하지 않는다 — 호출부가 flow 로 놓거나(inline)
   * `absolute` 래퍼로 앵커에 맞춘다. arrow 는 말풍선의 어느 변에 꼬리를 달지만 정한다.
   */
  import Typography from '@common/components/Typography.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'

  /**
   * 꼬리가 붙는 변 (둘 다 앵커 **위**에 놓일 때)
   * - `bottom`       꼬리 = 아래 변 가운데 (말풍선이 앵커 중앙 정렬)
   * - `bottom-start` 꼬리 = 아래 변 왼쪽 16px (말풍선이 오른쪽으로 뻗음)
   */
  type Arrow = 'bottom' | 'bottom-start'

  interface Props {
    text: string
    arrow?: Arrow
    /** 넘기면 X 버튼 노출. 닫힘 상태는 호출부가 소유한다 */
    onClose?: () => void
    /** 닫기 버튼 aria-label */
    closeLabel?: string
  }

  let {
    text,
    arrow = 'bottom',
    onClose,
    closeLabel = '알림 닫기'
  }: Props = $props()
</script>

<div
  role="status"
  class="relative flex items-center gap-2 whitespace-nowrap rounded-lg bg-gray-800 py-1.5 {onClose
    ? 'pl-3 pr-1.5'
    : 'px-3'}"
>
  <span
    aria-hidden="true"
    class="absolute top-full -translate-x-1/2 border-[5px] border-transparent border-t-gray-800 {arrow ===
    'bottom-start'
      ? 'left-4'
      : 'left-1/2'}"
  ></span>

  <Typography variant="body-03-normal-regular" color="text-white" tag="span">
    {text}
  </Typography>

  {#if onClose}
    <button
      type="button"
      onclick={onClose}
      aria-label={closeLabel}
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:text-white"
    >
      <CloseIcon size={16} color="currentColor" />
    </button>
  {/if}
</div>
