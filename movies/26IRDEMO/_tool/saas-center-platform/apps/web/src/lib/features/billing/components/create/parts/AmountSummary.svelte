<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import WarningCircleIcon16 from '$lib/assets/WarningCircleIcon16.svelte'
  import { slide } from 'svelte/transition'

  let {
    subtotal,
    discount = $bindable(0),
    subsidy = 0,
    showDiscount = true,
    unitPrice = null,
    unitCount = 0
  } = $props<{
    subtotal: number
    discount?: number
    subsidy?: number
    showDiscount?: boolean
    /** 회기당 단가 — 항목 목록을 노출하지 않는 화면에서 단가가 보이도록 (null이면 행 자체가 없다) */
    unitPrice?: number | null
    unitCount?: number
  }>()

  // 입력 모드 (fixed: 정액 원, percent: 퍼센트)
  let discountMode = $state<'fixed' | 'percent'>('fixed')
  // 사용자가 입력한 원시값 — fixed면 금액, percent면 퍼센트
  let rawInput = $state<number>(0)

  // 모드/subtotal/입력이 바뀌면 실제 할인액(discount) 재계산
  $effect(() => {
    if (discountMode === 'percent') {
      discount = Math.round((subtotal * rawInput) / 100)
    } else {
      discount = rawInput
    }
  })

  const finalAmount = $derived(Math.max(subtotal - subsidy - discount, 0))
  const isDiscountOverflow = $derived(discount + subsidy > subtotal)
  const percentOverflow = $derived(discountMode === 'percent' && rawInput > 100)

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    const raw = target.value.replace(/[^0-9]/g, '')
    rawInput = raw ? parseInt(raw, 10) : 0
  }

  function handleModeToggle() {
    // 모드 전환 시 입력값 초기화 (단위가 달라 그대로 쓰면 혼란)
    rawInput = 0
    discountMode = discountMode === 'percent' ? 'fixed' : 'percent'
  }
</script>

<div
  class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3"
>
  {#if showDiscount}
    <div class="flex items-start justify-between">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">합계</Typography
      >
      <div class="flex flex-col items-end gap-1">
        <Typography
          variant="body-01-normal-regular"
          color="text-body-default"
          tag="span"
        >
          {subtotal.toLocaleString()}원
        </Typography>
        {#if unitPrice != null && unitCount > 0}
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            tag="span"
          >
            {unitPrice.toLocaleString()}원 × {unitCount}회
          </Typography>
        {/if}
      </div>
    </div>
    {#if subsidy > 0}
      <div class="flex items-center justify-between">
        <Typography
          variant="body-02-normal-medium"
          color="text-mint-600"
          tag="span">바우처 지원금</Typography
        >
        <Typography
          variant="body-01-normal-regular"
          color="text-mint-600"
          tag="span"
        >
          -{subsidy.toLocaleString()}원
        </Typography>
      </div>
    {/if}
    <div class="flex items-center justify-between gap-2">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">묶음 할인</Typography
      >
      <div class="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="할인 단위"
          class="relative inline-flex h-12 items-center rounded-lg bg-gray-100 p-1"
        >
          <!-- 슬라이딩 배경 -->
          <div
            class="absolute top-1 bottom-1 left-1 w-10 rounded-sm bg-white shadow-sm transition-transform duration-200 ease-out {discountMode ===
            'percent'
              ? 'translate-x-10'
              : 'translate-x-0'}"
            aria-hidden="true"
          ></div>
          <button
            type="button"
            role="radio"
            aria-checked={discountMode === 'fixed'}
            onclick={() => discountMode !== 'fixed' && handleModeToggle()}
            class="relative z-10 flex size-10 items-center justify-center rounded-sm text-body-02-normal-medium transition-colors {discountMode ===
            'fixed'
              ? 'text-body-strong'
              : 'text-caption-subtle hover:text-body-default'}"
          >
            원
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={discountMode === 'percent'}
            onclick={() => discountMode !== 'percent' && handleModeToggle()}
            class="relative z-10 flex size-10 items-center justify-center rounded-sm text-body-02-normal-medium transition-colors {discountMode ===
            'percent'
              ? 'text-body-strong'
              : 'text-caption-subtle hover:text-body-default'}"
          >
            %
          </button>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={rawInput > 0 ? rawInput.toLocaleString() : ''}
            oninput={handleInput}
            placeholder="0"
            class="field-input w-24 text-right {isDiscountOverflow ||
            percentOverflow
              ? 'is-error'
              : ''}"
          />
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            tag="span">{discountMode === 'percent' ? '%' : '원'}</Typography
          >
        </div>
      </div>
    </div>
    {#if discountMode === 'percent' && rawInput > 0 && !percentOverflow}
      <div
        transition:slide
        class="flex justify-end text-body-02-normal-regular text-body-subtle"
      >
        = {discount.toLocaleString()}원 할인
      </div>
    {/if}
    {#if percentOverflow}
      <div
        class="flex items-center gap-2 text-body-02-normal-regular text-status-danger"
      >
        <WarningCircleIcon16 />
        할인율은 100%를 초과할 수 없어요
      </div>
    {:else if isDiscountOverflow}
      <div
        class="flex items-center gap-2 text-body-02-normal-regular text-status-danger"
      >
        <WarningCircleIcon16 />
        {subsidy > 0
          ? '할인액 + 지원금이 합계를 초과할 수 없어요'
          : '할인액이 합계를 초과할 수 없어요'}
      </div>
    {/if}
    <div
      class="flex items-center justify-between border-t border-border-subtle pt-4"
    >
      <Typography
        variant="body-01-normal-medium"
        color="text-body-default"
        tag="span">최종 금액</Typography
      >
      <Typography
        variant="title-01-normal-semibold"
        color="text-body-strong"
        tag="span"
      >
        {finalAmount.toLocaleString()}원
      </Typography>
    </div>
  {:else if subsidy > 0}
    <div class="flex items-start justify-between">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">합계</Typography
      >
      <div class="flex flex-col items-end gap-1">
        <Typography
          variant="body-01-normal-regular"
          color="text-body-default"
          tag="span"
        >
          {subtotal.toLocaleString()}원
        </Typography>
        {#if unitPrice != null && unitCount > 0}
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            tag="span"
          >
            {unitPrice.toLocaleString()}원 × {unitCount}회
          </Typography>
        {/if}
      </div>
    </div>
    <div class="flex items-center justify-between">
      <Typography
        variant="body-02-normal-medium"
        color="text-mint-600"
        tag="span">바우처 지원금</Typography
      >
      <Typography
        variant="body-01-normal-regular"
        color="text-mint-600"
        tag="span"
      >
        -{subsidy.toLocaleString()}원
      </Typography>
    </div>
    <div
      class="flex items-center justify-between border-t border-border-subtle pt-4"
    >
      <Typography
        variant="body-01-normal-medium"
        color="text-body-default"
        tag="span">본인부담금</Typography
      >
      <Typography
        variant="title-01-normal-semibold"
        color="text-body-strong"
        tag="span"
      >
        {finalAmount.toLocaleString()}원
      </Typography>
    </div>
  {:else}
    <div class="flex items-start justify-between">
      <Typography
        variant="body-01-normal-medium"
        color="text-body-default"
        tag="span">합계</Typography
      >
      <div class="flex flex-col items-end gap-1">
        <Typography
          variant="title-01-normal-semibold"
          color="text-body-strong"
          tag="span"
        >
          {subtotal.toLocaleString()}원
        </Typography>
        {#if unitPrice != null && unitCount > 0}
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            tag="span"
          >
            {unitPrice.toLocaleString()}원 × {unitCount}회
          </Typography>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if finalAmount === 0 && subtotal >= 0}
  <div
    class="flex flex-col gap-2 rounded-lg bg-status-warning-bg px-3 py-3 text-status-warning"
  >
    <div class="flex items-center gap-2">
      <WarningCircleIcon16 />
      <Typography
        variant="body-02-normal-medium"
        tag="span"
        color="text-current"
      >
        청구액이 0원이에요
      </Typography>
    </div>
    <Typography
      variant="body-02-normal-regular"
      tag="span"
      color="text-current"
    >
      발행과 동시에 자동으로 완납 처리돼요.
    </Typography>
  </div>
{/if}
