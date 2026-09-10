<script lang="ts">
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import Typography from '@common/components/Typography.svelte'
  import TrashIcon24 from '$lib/assets/TrashIcon24.svelte'
  import type { ItemRow } from '../types'

  let {
    item = $bindable(),
    canRemove = true,
    onRemove
  } = $props<{
    item: ItemRow
    canRemove?: boolean
    onRemove?: () => void
  }>()

  function handlePriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    const raw = target.value.replace(/[^0-9]/g, '')
    item.unitPrice = raw ? parseInt(raw, 10) : 0
  }

  const amount = $derived(item.quantity * item.unitPrice)
</script>

<div
  transition:slide={{ duration: 200, easing: quintOut }}
  class="rounded-lg border border-border-default bg-gray-50 p-3"
>
  <div class="flex items-center gap-2">
    <!-- 내역 -->
    <div class="flex-1">
      {#if item.locked}
        <div
          class="flex h-12 items-center rounded-lg bg-gray-100 px-3 text-body-01-normal-regular text-body-default"
        >
          {item.description}
        </div>
      {:else}
        <input
          type="text"
          bind:value={item.description}
          placeholder="항목 내역"
          class="field-input w-full"
        />
      {/if}
    </div>
    <!-- 삭제 -->
    {#if canRemove && !item.locked}
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        onclick={() => onRemove?.()}
        class="shrink-0 text-gray-500 transition hover:text-gray-700"
      >
        <TrashIcon24 />
      </button>
    {/if}
  </div>
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <!-- 수량 -->
    <div class="flex items-center gap-2">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">수량</Typography
      >
      <input
        type="number"
        bind:value={item.quantity}
        min="1"
        class="field-input w-20 text-center"
      />
    </div>
    <!-- 단가 -->
    <div class="flex items-center gap-2">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">단가</Typography
      >
      <input
        type="text"
        value={item.unitPrice > 0 ? item.unitPrice.toLocaleString() : ''}
        oninput={handlePriceInput}
        placeholder="0"
        class="field-input w-24 text-right"
      />
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        tag="span">원</Typography
      >
    </div>
    <!-- 소계 -->
    <div class="ml-auto">
      <Typography
        variant="body-02-normal-medium"
        color="text-body-strong"
        tag="span"
      >
        {amount.toLocaleString()}원
      </Typography>
    </div>
  </div>
</div>
