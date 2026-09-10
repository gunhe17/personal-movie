<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BillsIconCurrent20 from '$lib/assets/BillsIconCurrent20.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  // prop 이름을 그대로 `state`로 받으면 스코프에 state 변수가 생겨
  // 이 파일의 룬이 "state 스토어 자동구독"으로 컴파일된다(store_invalid_shape).
  let {
    state: billingState = 'none',
    disabled = false,
    onClick
  } = $props<{
    state?: 'none' | 'pending' | 'completed'
    disabled?: boolean
    onClick?: () => void
  }>()

  /**
   * 라벨은 **축1(청구 여부)만** 말한다 — 청구서가 없으면 만들고, 있으면 연다.
   * 납부 여부(축2)는 그 청구서의 속성이라 카드 표기·청구서 상세가 소유한다.
   *
   * 두 상태는 **형태로 구분**한다 — 폭이 라벨 길이를 따라가면 옆 카드를 밀어
   * 잘리기 때문에, 각 상태가 고정 폭을 갖도록 갈랐다:
   *   청구(주 액션)      = 레이블만 · 민트 아웃라인
   *   청구서 확인(조회)  = 아이콘만 · 그레이 아웃라인 + 툴팁
   * 두 상태의 박스 폭은 **80으로 동일** — 상태가 바뀌어도 카드 옆 자리가 흔들리지 않는다.
   */
  const isIssued = $derived(
    billingState === 'pending' || billingState === 'completed'
  )
  const label = $derived(isIssued ? '청구서 확인' : '청구하기')
  const ariaLabel = $derived(disabled ? '청구할 수 있는 회기가 없어요' : label)

  const pillClass = $derived(() => {
    if (disabled) {
      return 'bg-gray-100 text-gray-400 cursor-not-allowed'
    }
    // 발행된 청구서를 '여는' 버튼은 더 유도할 액션이 아니다 — 보더는 중립 회색으로
    // 낮추고 아이콘 색(민트)만 남겨 청구 도메인임을 표시한다.
    if (isIssued) {
      return 'bg-white border border-gray-200 text-billing-fg transition-colors hover:border-gray-300 hover:bg-gray-50'
    }
    // 정본 §Components>button-billing: 보더 mint-300(옅게) · 텍스트 mint-500(진하게)
    return 'bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover'
  })

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    onClick?.()
  }
</script>

<Tooltip text={ariaLabel} placement="top" disabled={!isIssued}>
  <button
    type="button"
    onclick={handleClick}
    {disabled}
    aria-label={ariaLabel}
    class="flex-center h-[71px] w-20 shrink-0 justify-center rounded-xl {pillClass()}"
  >
    {#if isIssued}
      <span class="flex h-5 w-5 shrink-0 items-center justify-center">
        <BillsIconCurrent20 className="w-full h-auto" />
      </span>
    {:else}
      <Typography
        variant="body-03-normal-medium"
        tag="span"
        color="text-current"
        className="whitespace-nowrap"
      >
        {label}
      </Typography>
    {/if}
  </button>
</Tooltip>
