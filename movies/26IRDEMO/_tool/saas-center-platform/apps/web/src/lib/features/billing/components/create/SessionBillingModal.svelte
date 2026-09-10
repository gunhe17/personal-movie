<script lang="ts">
  import type { ClientListItem } from '$lib/hooks/actions/client.action'
  import type { CreateBillablePayload } from '$lib/hooks/actions/billable.action'
  import BillableModalShell from './parts/BillableModalShell.svelte'
  import ClientField from './parts/ClientField.svelte'
  import VoucherField, {
    type SelectedVoucher
  } from './parts/VoucherField.svelte'
  import BillableItemList from './parts/BillableItemList.svelte'
  import SubsidyField from './parts/SubsidyField.svelte'
  import AmountSummary from './parts/AmountSummary.svelte'
  import NotesField from './parts/NotesField.svelte'
  import type { ItemRow, PrefillItem } from './types'
  import { buildCreatePayload, buildVoucherPatch, sumItems } from './helpers'

  let {
    modalId = '',
    closeModal = () => {},
    client,
    items: prefillItems = [],
    relatedType,
    relatedCaseId,
    relatedSessionId,
    onConfirm
  } = $props<{
    modalId?: string
    closeModal?: () => void
    client: ClientListItem
    items?: PrefillItem[]
    relatedType: string
    relatedCaseId: string
    /** 세션(일정) 없이 케이스 단위 청구인 경우 undefined 가능 */
    relatedSessionId?: string
    onConfirm?: (payload: CreateBillablePayload) => Promise<void>
  }>()

  // 내담자는 고정 (모달 열릴 때 1회 초기값)
  // svelte-ignore state_referenced_locally
  let selectedClient = $state<ClientListItem | null>(client)

  // prefill → ItemRow (모달 열릴 때 1회 초기값)
  // svelte-ignore state_referenced_locally
  const initItems: ItemRow[] = prefillItems.map(
    (item: PrefillItem, idx: number) => ({
      id: idx + 1,
      description: item.description,
      quantity: 1,
      unitPrice: item.unitPrice ?? 0,
      priceListId: item.priceListId ?? null,
      itemType: item.itemType ?? 'service',
      locked: false,
      relatedSessionId: item.relatedSessionId,
      clientVoucherId: item.clientVoucherId ?? null,
      voucherName: item.voucherName ?? null,
      voucherRemaining: item.voucherRemaining ?? null,
      voucherTotal: item.voucherTotal ?? null,
      voucherSupportText: item.voucherSupportText ?? null
    })
  )

  let items = $state<ItemRow[]>(initItems)
  let nextId = $state(initItems.length + 1)
  let notes = $state('')
  let subsidyAmount = $state(0)
  let isSubmitting = $state(false)
  let selectedVoucher = $state<SelectedVoucher | null>(null)

  function handleVoucherChange(voucher: SelectedVoucher | null) {
    const patch = buildVoucherPatch(voucher)
    items = items.map((it) => ({ ...it, ...patch }))
    if (!voucher) subsidyAmount = 0
  }

  $effect(() => {
    const v = selectedVoucher
    if (!v) return
    const needsPatch = items.some((it) => it.clientVoucherId !== v.id)
    if (!needsPatch) return
    const patch = buildVoucherPatch(v)
    items = items.map((it) =>
      it.clientVoucherId === v.id ? it : { ...it, ...patch }
    )
  })

  const subtotal = $derived(sumItems(items))
  const subsidyExceedsSubtotal = $derived(subsidyAmount > subtotal)

  const voucherSessionsShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v) return false
    const totalSessions = items.reduce(
      (sum, it) => sum + (it.clientVoucherId ? it.quantity : 0),
      0
    )
    return totalSessions > v.remainingSessions
  })

  const voucherAmountShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v || v.remainingAmount == null) return null
    if (subsidyAmount <= v.remainingAmount) return null
    return v.remainingAmount - subsidyAmount
  })

  const canSubmit = $derived(
    !!selectedClient &&
      items.some((i) => i.description.trim()) &&
      !subsidyExceedsSubtotal &&
      !voucherSessionsShortage
  )

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !onConfirm || !selectedClient) return
    isSubmitting = true
    try {
      const payload = buildCreatePayload({
        clientId: selectedClient.id,
        items,
        notes,
        subsidyAmount,
        relatedType,
        relatedCaseId,
        relatedSessionId
      })
      await onConfirm(payload)
      closeModal()
    } catch {
      // 에러는 service에서 처리
    } finally {
      isSubmitting = false
    }
  }
</script>

<!-- 헤더·계산서 규격은 상담 청구 모달(CaseBillingModal)과 동일하다.
     부제만 다르다 — 검사는 고를 회기가 없어 '확인'이 사용자의 할 일이다. -->
<BillableModalShell
  {modalId}
  {closeModal}
  title="청구서를 만들게요"
  subtitle="청구 내용을 확인해주세요"
  {canSubmit}
  {isSubmitting}
  onSubmit={handleSubmit}
  showSummary={items.length > 0}
>
  {#snippet summary()}
    <div class="flex flex-col gap-2">
      <AmountSummary {subtotal} subsidy={subsidyAmount} showDiscount={false} />
      {#if voucherSessionsShortage}
        <div
          class="rounded-lg bg-status-danger-bg px-3 py-3 text-body-02-normal-regular text-status-danger"
        >
          선택한 바우처의 잔여 회기({selectedVoucher?.remainingSessions}회)보다
          많은 회기를 청구할 수 없어요
        </div>
      {/if}
    </div>
  {/snippet}
  <ClientField bind:client={selectedClient} locked />

  <VoucherField
    clientId={selectedClient?.id ?? null}
    bind:selected={selectedVoucher}
    onChange={handleVoucherChange}
  />

  {#if selectedVoucher}
    <SubsidyField
      bind:value={subsidyAmount}
      error={subsidyExceedsSubtotal
        ? `정가 합계(${subtotal.toLocaleString()}원)를 초과할 수 없어요`
        : null}
      warning={voucherAmountShortage != null
        ? `바우처 잔여 금액(${selectedVoucher?.remainingAmount?.toLocaleString()}원)을 ${Math.abs(voucherAmountShortage).toLocaleString()}원 초과해요. 진행은 가능하지만 운영 보정이 필요해요.`
        : null}
    />
  {/if}

  <BillableItemList bind:items bind:nextId />

  <NotesField bind:value={notes} />
</BillableModalShell>
