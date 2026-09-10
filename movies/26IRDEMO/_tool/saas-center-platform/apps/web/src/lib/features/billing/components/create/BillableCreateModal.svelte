<script lang="ts">
  import type { ClientListItem } from '$lib/hooks/actions/client.action'
  import type {
    CreateBillablePayload,
    BillableTarget
  } from '$lib/hooks/actions/billable.action'
  import { getPriceListsByReferences } from '$lib/hooks/actions/priceList.action'
  import {
    requireCenterId,
    centerId as centerIdStore
  } from '$lib/stores/center.store'
  import { modalUtils } from '$lib/stores/modal'
  import BillableRelationPicker from '$lib/features/billing/components/BillableRelationPicker.svelte'
  import Typography from '@common/components/Typography.svelte'
  import BillableModalShell from './parts/BillableModalShell.svelte'
  import ClientField from './parts/ClientField.svelte'
  import VoucherField, {
    type SelectedVoucher
  } from './parts/VoucherField.svelte'
  import BillableItemList from './parts/BillableItemList.svelte'
  import SubsidyField from './parts/SubsidyField.svelte'
  import AmountSummary from './parts/AmountSummary.svelte'
  import NotesField from './parts/NotesField.svelte'
  import type { ItemRow } from './types'
  import { buildCreatePayload, buildVoucherPatch, sumItems } from './helpers'

  let {
    modalId = '',
    closeModal = () => {},
    onConfirm
  } = $props<{
    modalId?: string
    closeModal?: () => void
    onConfirm?: (payload: CreateBillablePayload) => Promise<void>
  }>()

  let selectedClient = $state<ClientListItem | null>(null)
  let selectedVoucher = $state<SelectedVoucher | null>(null)
  let items = $state<ItemRow[]>([])
  let nextId = $state(1)
  let notes = $state('')
  let subsidyAmount = $state(0)
  let isSubmitting = $state(false)

  // 연동 정보
  let relatedType = $state<string | null>(null)
  let relatedCaseId = $state<string | null>(null)
  let relatedSessionId = $state<string | null>(null)

  // 바우처 선택/해제 시 기존 items 전부에 일괄 적용
  function handleVoucherChange(voucher: SelectedVoucher | null) {
    const patch = buildVoucherPatch(voucher)
    items = items.map((it) => ({ ...it, ...patch }))
    if (!voucher) subsidyAmount = 0
  }

  // BillableItemList 내부에서 직접 추가된 items에도 현재 voucher 부착
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

  // 바우처 잔여 회기 부족 (차단)
  const voucherSessionsShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v) return false
    const totalSessions = items.reduce(
      (sum, it) => sum + (it.clientVoucherId ? it.quantity : 0),
      0
    )
    return totalSessions > v.remainingSessions
  })

  // 바우처 잔여 금액 부족 안내 (비차단 — 서버에서도 warnings로 한 번 더 안내됨)
  const voucherAmountShortage = $derived.by(() => {
    const v = selectedVoucher
    if (!v || v.remainingAmount == null) return null
    if (subsidyAmount <= v.remainingAmount) return null
    return v.remainingAmount - subsidyAmount // 음수
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

  // 연동 대상 선택 시 items 자동 추가
  // 깜박임 방지: 기존 자동 items를 미리 비우지 않고, 비동기 가격 조회를 모두
  // 끝낸 뒤 마지막에 items를 한 번만 교체한다 (빈 상태 구간 제거).
  async function handleRelationSelect(target: BillableTarget | null) {
    // 사용자가 직접 추가한 항목(수동)이 있으면, 일정 변경으로 정리되기 전 확인.
    // 취소 시 상태를 건드리지 않으면 RelationPicker도 이전 선택을 유지한다.
    const hasManualItems = items.some((i) => !i.autoFromRelation)
    if (hasManualItems) {
      const ok = await modalUtils.confirm(
        '직접 추가한 청구 항목이 있어요. 일정을 바꾸면 기존 항목이 정리돼요.',
        '연동 일정 변경',
        {
          description: '계속하면 현재 항목을 비우고 새 일정으로 다시 구성해요.',
          confirmText: '변경',
          cancelText: '취소',
          type: 'warning'
        }
      )
      if (!ok) return
    }

    if (!target) {
      relatedType = null
      relatedCaseId = null
      relatedSessionId = null
      // 확인을 거쳤거나 수동 항목이 없으므로 전체 비움
      items = []
      return
    }

    // 세션 없는 검사(일정 없이 접수) → case 단위 청구로 연동
    if (target.type === 'counseling') {
      relatedType = 'counseling_session'
    } else {
      relatedType = target.session_id ? 'assessment_session' : 'assessment_case'
    }
    relatedCaseId = target.case_id
    relatedSessionId = target.session_id

    const refIds = target.references.map((r) => r.reference_id)
    let priceMap = new Map<string, { unit_price: number; id: string | null }>()
    if (refIds.length > 0) {
      try {
        const matched = await getPriceListsByReferences().request({
          centerId: requireCenterId(),
          referenceIds: refIds
        })
        priceMap = new Map(
          matched
            .filter((p) => p.reference_id)
            .map((p) => [
              p.reference_id!,
              { unit_price: p.unit_price ?? 0, id: p.id ?? null }
            ])
        )
      } catch {
        // 매칭 실패해도 진행
      }
    }

    const newItems: ItemRow[] = []
    for (const ref of target.references) {
      const matched = priceMap.get(ref.reference_id)
      if (!matched) continue
      newItems.push({
        id: nextId++,
        description: ref.label,
        quantity: 1,
        unitPrice: matched.unit_price,
        priceListId: matched.id,
        itemType: ref.item_type || 'service',
        locked: false,
        autoFromRelation: true
      })
    }

    if (newItems.length === 0) {
      const description = target.subtitle
        ? `${target.title} (${target.subtitle})`
        : target.title
      newItems.push({
        id: nextId++,
        description,
        quantity: 1,
        unitPrice: 0,
        priceListId: null,
        itemType: 'service',
        locked: false,
        autoFromRelation: true
      })
    }

    // 새로 추가되는 items에도 현재 선택된 voucher 부착.
    // - 수동 항목이 있었으면(확인 통과): 전체를 비우고 새 일정 항목으로만 구성
    // - 수동 항목이 없었으면: 기존 자동 항목만 교체 (보존할 수동이 없어 결과 동일)
    // 한 번의 할당으로 처리해 빈 구간(깜박임) 없앰.
    const patch = buildVoucherPatch(selectedVoucher)
    const kept = hasManualItems ? [] : items.filter((i) => !i.autoFromRelation)
    items = [...kept, ...newItems.map((it) => ({ ...it, ...patch }))]
  }

  // 내담자가 실제로 바뀌면 청구 컨텍스트 전체 초기화.
  // (이전 내담자로 잡은 항목·연동·바우처·지원금은 새 내담자에 무효)
  // 초기 마운트 시점에는 건드리지 않도록 lastClientId(undefined)로 가드.
  let lastClientId: string | null | undefined = $state(undefined)
  $effect(() => {
    const current = selectedClient?.id ?? null
    if (current === lastClientId) return
    const wasInitialized = lastClientId !== undefined
    lastClientId = current
    if (!wasInitialized) return // 첫 실행은 스킵 (부모 초기값 존중)

    items = []
    relatedType = null
    relatedCaseId = null
    relatedSessionId = null
    selectedVoucher = null
    subsidyAmount = 0
  })
</script>

<BillableModalShell
  {modalId}
  {closeModal}
  title="청구서 생성"
  {canSubmit}
  {isSubmitting}
  onSubmit={handleSubmit}
>
  <ClientField bind:client={selectedClient} />

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

  <div>
    <span class="field-label mb-2">
      연동할 일정
      <span class="text-body-03-normal-regular text-body-subtle">(선택)</span>
    </span>
    <BillableRelationPicker
      centerId={$centerIdStore}
      clientId={selectedClient?.id ?? null}
      selectedKey={relatedSessionId ?? relatedCaseId}
      onSelect={handleRelationSelect}
    />
  </div>

  <BillableItemList bind:items bind:nextId />

  {#if items.length > 0}
    <AmountSummary {subtotal} subsidy={subsidyAmount} showDiscount={false} />
    {#if voucherSessionsShortage}
      <div
        class="rounded-lg bg-status-danger-bg px-3 py-3 text-body-02-normal-regular text-status-danger"
      >
        선택한 바우처의 잔여 회기({selectedVoucher?.remainingSessions}회)보다
        많은 회기를 청구할 수 없어요
      </div>
    {/if}
  {/if}

  <NotesField bind:value={notes} />
</BillableModalShell>
