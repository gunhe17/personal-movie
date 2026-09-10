<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getClientVoucherList,
    type ClientVoucherResponse
  } from '$lib/hooks/actions/clientVoucher.action'

  export interface SelectedVoucher {
    id: string
    name: string
    remainingSessions: number
    totalSessions: number
    remainingAmount: number | null
    totalAmount: number | null
    supportText: string | null
  }

  let {
    clientId,
    selected = $bindable(null),
    onChange
  } = $props<{
    clientId: string | null
    selected?: SelectedVoucher | null
    onChange?: (voucher: SelectedVoucher | null) => void
  }>()

  const listQuery = $derived(
    queryBuilder(
      getClientVoucherList,
      () => ({
        centerId: $centerId,
        client_id: clientId ?? '',
        page: 1,
        size: 100
      }),
      { enabled: !!$centerId && !!clientId }
    )
  )

  /** 오늘 기준 사용 가능: 잔여 회기 > 0 + 유효기간 내(있으면) */
  const usableVouchers = $derived.by(() => {
    const items = (listQuery.data?.items as ClientVoucherResponse[]) ?? []
    const today = new Date().toISOString().slice(0, 10)
    return items.filter((v) => {
      if (v.remaining_sessions <= 0) return false
      if (v.valid_from && v.valid_from > today) return false
      if (v.valid_until && v.valid_until < today) return false
      return true
    })
  })

  const NONE = 'none'

  const options = $derived([
    { value: NONE, title: '바우처 미사용 (자비)' },
    ...usableVouchers.map((v) => {
      const name = v.catalog?.name ?? '바우처'
      return {
        value: v.id,
        title: `${name} · 잔여 ${v.remaining_sessions}/${v.total_sessions}회`
      }
    })
  ])

  function toSelected(v: ClientVoucherResponse): SelectedVoucher {
    return {
      id: v.id,
      name: v.catalog?.name ?? '바우처',
      remainingSessions: v.remaining_sessions,
      totalSessions: v.total_sessions,
      remainingAmount: v.remaining_amount,
      totalAmount: v.total_amount,
      supportText: v.catalog?.support_amount_text ?? null
    }
  }

  function handleSelect(e: CustomEvent<{ value: string }>) {
    const id = e.detail.value
    if (!id || id === NONE) {
      selected = null
      onChange?.(null)
      return
    }
    const found = usableVouchers.find((v) => v.id === id)
    if (!found) return
    const next = toSelected(found)
    selected = next
    onChange?.(next)
  }

  // 내담자가 진짜로 바뀌면 선택 초기화 (selected를 effect 의존성에 잡지 않도록 ref로 추적)
  let lastClientId: string | null | undefined = $state(undefined)
  $effect(() => {
    const current = clientId
    if (current !== lastClientId) {
      const wasInitialized = lastClientId !== undefined
      lastClientId = current
      // 초기 마운트 시점에는 selected를 건드리지 않음 (부모가 미리 set한 값 존중)
      if (wasInitialized && selected) {
        selected = null
        onChange?.(null)
      }
    }
  })

  // 기본값 = "바우처 미사용 (자비)"(필수 선택) — 부모가 selected를 미리 지정한 경우에만 그대로 유지
</script>

{#if clientId && !listQuery.isLoading}
  <div>
    <span class="field-label mb-2">
      바우처 <span class="field-required">*</span>
    </span>
    <Select
      class="w-full rounded-lg"
      selected={selected?.id ?? NONE}
      on:change={handleSelect}
      hoverBoxClass="left-0"
      dropdownExactWidth
      {options}
    />
  </div>
{/if}
