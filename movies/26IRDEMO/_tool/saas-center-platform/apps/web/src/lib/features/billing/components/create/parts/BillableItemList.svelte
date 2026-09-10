<script lang="ts">
  import { onMount } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import {
    getPriceListList,
    type PriceListResponse
  } from '$lib/hooks/actions/priceList.action'
  import { requireCenterId } from '$lib/stores/center.store'
  import BillableItemRow from './BillableItemRow.svelte'
  import PriceListMultiPicker from './PriceListMultiPicker.svelte'
  import type { ItemRow } from '../types'

  let {
    items = $bindable([]),
    nextId = $bindable(1),
    allowPriceListSelect = true,
    allowManualAdd = true,
    allowRemove = true,
    emptyMessage = '단가표에서 선택하거나 직접 입력으로 항목을 추가해주세요'
  } = $props<{
    items: ItemRow[]
    nextId: number
    allowPriceListSelect?: boolean
    allowManualAdd?: boolean
    /** 행 삭제 허용 — 항목이 다른 선택(회기 등)에서 파생될 땐 false */
    allowRemove?: boolean
    emptyMessage?: string
  }>()

  let priceListItems = $state<PriceListResponse[]>([])

  const existingPriceListIds = $derived(
    items
      .map((i: ItemRow) => i.priceListId)
      .filter((id: string | null): id is string => !!id)
  )

  onMount(async () => {
    if (!allowPriceListSelect) return
    try {
      const res = await getPriceListList().request({
        centerId: requireCenterId(),
        is_active: true,
        size: 200
      })
      priceListItems = res?.items ?? []
    } catch {
      // 실패해도 수동 입력 가능
    }
  })

  function handlePriceListPick(p: PriceListResponse) {
    // 같은 priceListId 라인이 이미 있으면 중복 추가 방지 (수량으로 조절)
    if (items.some((i: ItemRow) => i.priceListId === p.id)) return
    items = [
      ...items,
      {
        id: nextId++,
        description: p.service_name,
        quantity: 1,
        unitPrice: p.unit_price,
        priceListId: p.id,
        itemType: p.service_type === 'package' ? 'package' : 'service',
        locked: false
      }
    ]
  }

  function handlePriceListUnpick(priceListId: string) {
    items = items.filter((i: ItemRow) => i.priceListId !== priceListId)
  }

  function addEmptyItem() {
    items = [
      ...items,
      {
        id: nextId++,
        description: '',
        quantity: 1,
        unitPrice: 0,
        priceListId: null,
        itemType: 'service',
        locked: false
      }
    ]
  }

  function removeItem(id: number) {
    const next: ItemRow[] = items.filter((i: ItemRow) => i.id !== id)
    items = next
  }
</script>

<div>
  <div class="mb-2 flex min-h-5 items-center justify-between">
    <span class="field-label">
      청구 항목 <span class="field-required">*</span>
    </span>
    {#if allowManualAdd}
      <button
        onclick={addEmptyItem}
        class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
      >
        + 직접 입력
      </button>
    {/if}
  </div>

  {#if allowPriceListSelect && priceListItems.length > 0}
    <PriceListMultiPicker
      options={priceListItems}
      {existingPriceListIds}
      onPick={handlePriceListPick}
      onUnpick={handlePriceListUnpick}
    />
  {/if}

  {#if items.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-border-default py-8"
    >
      <Typography variant="body-02-normal-regular" color="text-caption-subtle">
        {emptyMessage}
      </Typography>
    </div>
  {:else}
    <div class="space-y-4">
      {#each items as item, i (item.id)}
        <BillableItemRow
          bind:item={items[i]}
          canRemove={allowRemove}
          onRemove={() => removeItem(item.id)}
        />
      {/each}
    </div>
  {/if}
</div>
